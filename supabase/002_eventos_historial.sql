-- Tresor · migración 002: eventos e historial de cambios
-- Ejecutar entero en Supabase → SQL Editor (después de 001_schema.sql).

-- ─────────────────────────────────────────────────────────────
-- Eventos (opcional en cada cierre)
-- ─────────────────────────────────────────────────────────────

create table eventos (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  activo boolean not null default true,
  created_at timestamptz not null default now()
);
create unique index eventos_nombre_unico on eventos (lower(nombre));

alter table eventos enable row level security;
create policy lectura on eventos for select using (es_usuario_activo());
create policy admin on eventos for all using (es_admin()) with check (es_admin());

alter table cierres add column evento_id uuid references eventos(id);

-- ─────────────────────────────────────────────────────────────
-- Historial de cambios: una foto completa del cierre en cada guardado o borrado.
-- Solo lo leen los responsables; nadie puede escribirlo directamente.
-- ─────────────────────────────────────────────────────────────

create table historial_cierres (
  id bigint generated always as identity primary key,
  cierre_id uuid not null,
  local_id uuid not null,
  usuario_id uuid,
  usuario_nombre text,
  accion text not null check (accion in ('creado', 'modificado', 'borrado')),
  datos jsonb not null,
  created_at timestamptz not null default now()
);
create index historial_cierre on historial_cierres (cierre_id, created_at);
create index historial_fecha on historial_cierres (created_at desc);

alter table historial_cierres enable row level security;
create policy admin_lectura on historial_cierres for select using (es_admin());

-- Foto legible del cierre (con nombres, no ids) para comparar versiones.
create or replace function snapshot_cierre(p_id uuid) returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'fecha', c.fecha,
    'caja', ca.nombre,
    'turno', t.nombre,
    'evento', e.nombre,
    'notas', c.notas,
    'ingresos', coalesce((
      select jsonb_object_agg(m.nombre, ci.importe)
      from cierre_ingresos ci join metodos_ingreso m on m.id = ci.metodo_id
      where ci.cierre_id = c.id), '{}'::jsonb),
    'gastos', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', g.id, 'metodo', g.metodo, 'categoria', cg.nombre, 'concepto', g.concepto,
        'autorizado', a.nombre, 'importe', g.importe, 'ticket', g.ticket_path is not null
      ) order by g.created_at)
      from gastos g
      join categorias_gasto cg on cg.id = g.categoria_id
      join autorizadores a on a.id = g.autorizado_id
      where g.cierre_id = c.id), '[]'::jsonb)
  )
  from cierres c
  join cajas ca on ca.id = c.caja_id
  join turnos t on t.id = c.turno_id
  left join eventos e on e.id = c.evento_id
  where c.id = p_id
$$;

create or replace function registrar_historial(p_id uuid, p_accion text) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_datos jsonb := snapshot_cierre(p_id);
  v_ultimo jsonb;
begin
  if p_accion = 'modificado' then
    select datos into v_ultimo from historial_cierres
    where cierre_id = p_id order by created_at desc, id desc limit 1;
    -- Guardar sin cambios no deja rastro.
    if v_ultimo = v_datos then return; end if;
  end if;
  insert into historial_cierres (cierre_id, local_id, usuario_id, usuario_nombre, accion, datos)
  select p_id, c.local_id, auth.uid(), (select nombre from perfiles where id = auth.uid()), p_accion, v_datos
  from cierres c where c.id = p_id;
end $$;

-- Los cierres existentes entran en el historial como su versión inicial.
insert into historial_cierres (cierre_id, local_id, usuario_id, usuario_nombre, accion, datos, created_at)
select c.id, c.local_id, c.creado_por, p.nombre, 'creado', snapshot_cierre(c.id), c.created_at
from cierres c left join perfiles p on p.id = c.creado_por;

-- ─────────────────────────────────────────────────────────────
-- Escrituras solo a través de funciones (que comprueban permisos y registran).
-- ─────────────────────────────────────────────────────────────

drop policy crear on cierres;
drop policy editar on cierres;
drop policy borrar on cierres;
drop policy escritura on cierre_ingresos;
drop policy escritura on gastos;

create or replace function guardar_cierre(p jsonb) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_id uuid := nullif(p->>'id', '')::uuid;
  v_local uuid := (p->>'local_id')::uuid;
  v_fecha date := (p->>'fecha')::date;
  v_caja uuid := (p->>'caja_id')::uuid;
  v_evento_nombre text := nullif(btrim(p->>'evento'), '');
  v_evento uuid;
  v_actual cierres%rowtype;
  v_ids_gastos uuid[];
begin
  if not es_usuario_activo() then
    raise exception 'No tienes permiso para modificar este cierre' using errcode = '42501';
  end if;

  if v_id is not null then
    select * into v_actual from cierres where id = v_id for update;
    if not found then raise exception 'El cierre no existe'; end if;
    v_local := v_actual.local_id;
    if not puede_editar_cierre(v_actual.local_id, v_actual.fecha) then
      raise exception 'No tienes permiso para modificar este cierre' using errcode = '42501';
    end if;
  end if;

  if not puede_editar_cierre(v_local, v_fecha) then
    raise exception 'No tienes permiso para modificar este cierre' using errcode = '42501';
  end if;
  if not exists (select 1 from cajas where id = v_caja and local_id = v_local) then
    raise exception 'La caja no pertenece al local';
  end if;

  if v_evento_nombre is not null then
    select id into v_evento from eventos where lower(nombre) = lower(v_evento_nombre);
    if v_evento is null then
      insert into eventos (nombre) values (v_evento_nombre) returning id into v_evento;
    end if;
  end if;

  if v_id is null then
    insert into cierres (local_id, caja_id, turno_id, fecha, evento_id, notas, creado_por)
    values (v_local, v_caja, (p->>'turno_id')::uuid, v_fecha, v_evento, nullif(p->>'notas', ''), auth.uid())
    returning id into v_id;
  else
    update cierres set
      caja_id = v_caja,
      turno_id = (p->>'turno_id')::uuid,
      fecha = v_fecha,
      evento_id = v_evento,
      notas = nullif(p->>'notas', '')
    where id = v_id;
  end if;

  delete from cierre_ingresos where cierre_id = v_id;
  insert into cierre_ingresos (cierre_id, metodo_id, importe)
  select v_id, (i->>'metodo_id')::uuid, (i->>'importe')::numeric
  from jsonb_array_elements(coalesce(p->'ingresos', '[]')) i
  where (i->>'importe')::numeric > 0;

  -- Gastos: se conservan los ids para que el historial sepa qué gasto cambió.
  select coalesce(array_agg((g->>'id')::uuid), '{}') into v_ids_gastos
  from jsonb_array_elements(coalesce(p->'gastos', '[]')) g
  where nullif(g->>'id', '') is not null;

  delete from gastos where cierre_id = v_id and not (id = any (v_ids_gastos));

  update gastos set
    metodo = (g->>'metodo')::metodo_pago,
    categoria_id = (g->>'categoria_id')::uuid,
    concepto = coalesce(g->>'concepto', ''),
    autorizado_id = (g->>'autorizado_id')::uuid,
    importe = (g->>'importe')::numeric,
    ticket_path = nullif(g->>'ticket_path', '')
  from jsonb_array_elements(coalesce(p->'gastos', '[]')) g
  where gastos.cierre_id = v_id and gastos.id = nullif(g->>'id', '')::uuid;

  insert into gastos (cierre_id, metodo, categoria_id, concepto, autorizado_id, importe, ticket_path)
  select v_id, (g->>'metodo')::metodo_pago, (g->>'categoria_id')::uuid,
         coalesce(g->>'concepto', ''), (g->>'autorizado_id')::uuid,
         (g->>'importe')::numeric, nullif(g->>'ticket_path', '')
  from jsonb_array_elements(coalesce(p->'gastos', '[]')) g
  where nullif(g->>'id', '') is null;

  perform registrar_historial(v_id, case when v_actual.id is null then 'creado' else 'modificado' end);
  return v_id;
end $$;

create or replace function borrar_cierre(p_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_actual cierres%rowtype;
begin
  select * into v_actual from cierres where id = p_id for update;
  if not found then raise exception 'El cierre no existe'; end if;
  if not es_usuario_activo() or not puede_editar_cierre(v_actual.local_id, v_actual.fecha) then
    raise exception 'No tienes permiso para borrar este cierre' using errcode = '42501';
  end if;
  perform registrar_historial(p_id, 'borrado');
  delete from cierres where id = p_id;
end $$;

revoke execute on function snapshot_cierre(uuid) from public, anon, authenticated;
revoke execute on function registrar_historial(uuid, text) from public, anon, authenticated;
revoke execute on function guardar_cierre(jsonb) from public, anon;
revoke execute on function borrar_cierre(uuid) from public, anon;
grant execute on function guardar_cierre(jsonb) to authenticated;
grant execute on function borrar_cierre(uuid) to authenticated;
