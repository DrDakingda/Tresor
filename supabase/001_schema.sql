-- Tresor · esquema inicial
-- Ejecutar entero en Supabase → SQL Editor sobre un proyecto vacío.

-- ─────────────────────────────────────────────────────────────
-- Catálogos
-- ─────────────────────────────────────────────────────────────

create table locales (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  activo boolean not null default true,
  created_at timestamptz not null default now()
);

create table cajas (
  id uuid primary key default gen_random_uuid(),
  local_id uuid not null references locales(id) on delete cascade,
  nombre text not null,
  orden int not null default 0,
  activo boolean not null default true
);

create table turnos (
  id uuid primary key default gen_random_uuid(),
  nombre text not null unique,
  orden int not null default 0,
  activo boolean not null default true
);

-- Formas de cobro (Tarjeta, Efectivo, Fourvenues…). es_efectivo marca la que cuenta para el efectivo neto.
create table metodos_ingreso (
  id uuid primary key default gen_random_uuid(),
  nombre text not null unique,
  es_efectivo boolean not null default false,
  orden int not null default 0,
  activo boolean not null default true
);

create table categorias_gasto (
  id uuid primary key default gen_random_uuid(),
  nombre text not null unique,
  activo boolean not null default true,
  created_at timestamptz not null default now()
);

create table autorizadores (
  id uuid primary key default gen_random_uuid(),
  nombre text not null unique,
  activo boolean not null default true
);

-- ─────────────────────────────────────────────────────────────
-- Usuarios
-- ─────────────────────────────────────────────────────────────

create type rol_usuario as enum ('encargado', 'admin');

create table perfiles (
  id uuid primary key references auth.users(id) on delete cascade,
  nombre text not null,
  rol rol_usuario not null default 'encargado',
  local_id uuid references locales(id),
  activo boolean not null default true,
  created_at timestamptz not null default now()
);

-- ─────────────────────────────────────────────────────────────
-- Cierres de caja
-- ─────────────────────────────────────────────────────────────

create table cierres (
  id uuid primary key default gen_random_uuid(),
  local_id uuid not null references locales(id),
  caja_id uuid not null references cajas(id),
  turno_id uuid not null references turnos(id),
  fecha date not null,
  notas text,
  creado_por uuid references perfiles(id) default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (caja_id, fecha, turno_id)
);
create index cierres_local_fecha on cierres (local_id, fecha);

create table cierre_ingresos (
  cierre_id uuid not null references cierres(id) on delete cascade,
  metodo_id uuid not null references metodos_ingreso(id),
  importe numeric(12,2) not null default 0 check (importe >= 0),
  primary key (cierre_id, metodo_id)
);

create type metodo_pago as enum ('efectivo', 'tarjeta', 'transferencia');

create table gastos (
  id uuid primary key default gen_random_uuid(),
  cierre_id uuid not null references cierres(id) on delete cascade,
  metodo metodo_pago not null,
  categoria_id uuid not null references categorias_gasto(id),
  concepto text not null default '',
  autorizado_id uuid not null references autorizadores(id),
  importe numeric(12,2) not null check (importe > 0),
  ticket_path text,
  created_at timestamptz not null default now()
);
create index gastos_cierre on gastos (cierre_id);

-- ─────────────────────────────────────────────────────────────
-- Apuntes mensuales de responsables (fijos, personal, mercancía)
-- ─────────────────────────────────────────────────────────────

create type tipo_movimiento as enum ('fijo', 'personal', 'mercancia', 'otro');

create table movimientos_mes (
  id uuid primary key default gen_random_uuid(),
  local_id uuid not null references locales(id),
  mes date not null check (extract(day from mes) = 1),
  tipo tipo_movimiento not null,
  concepto text not null,
  importe numeric(12,2) not null check (importe > 0),
  created_at timestamptz not null default now()
);
create index movimientos_local_mes on movimientos_mes (local_id, mes);

-- ─────────────────────────────────────────────────────────────
-- Funciones de apoyo
-- ─────────────────────────────────────────────────────────────

create or replace function hoy_madrid() returns date
language sql stable as $$ select (now() at time zone 'Europe/Madrid')::date $$;

create or replace function es_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from perfiles where id = auth.uid() and rol = 'admin' and activo)
$$;

create or replace function mi_local() returns uuid
language sql stable security definer set search_path = public as $$
  select local_id from perfiles where id = auth.uid() and activo
$$;

create or replace function es_usuario_activo() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from perfiles where id = auth.uid() and activo)
$$;

-- Un encargado puede tocar cierres del mes en curso o de hasta 3 días atrás (nunca futuros).
create or replace function en_plazo(f date) returns boolean
language sql stable as $$
  select f <= hoy_madrid()
     and (f >= date_trunc('month', hoy_madrid())::date or f >= hoy_madrid() - 3)
$$;

create or replace function puede_editar_cierre(p_local uuid, p_fecha date) returns boolean
language sql stable security definer set search_path = public as $$
  select es_admin() or (p_local = mi_local() and en_plazo(p_fecha))
$$;

-- Perfil automático al crear un usuario en Authentication.
create or replace function crear_perfil() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into perfiles (id, nombre, local_id)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'nombre', split_part(new.email, '@', 1)),
    (select id from locales where activo order by created_at limit 1)
  );
  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function crear_perfil();

create or replace function tocar_updated_at() returns trigger
language plpgsql as $$ begin new.updated_at = now(); return new; end $$;

create trigger cierres_updated_at before update on cierres
  for each row execute function tocar_updated_at();

-- ─────────────────────────────────────────────────────────────
-- Guardado atómico de un cierre con sus ingresos y gastos.
-- Se ejecuta con los permisos del usuario (RLS aplica).
-- ─────────────────────────────────────────────────────────────

create or replace function guardar_cierre(p jsonb) returns uuid
language plpgsql security invoker set search_path = public as $$
declare
  v_id uuid := nullif(p->>'id', '')::uuid;
begin
  if v_id is null then
    insert into cierres (local_id, caja_id, turno_id, fecha, notas)
    values (
      (p->>'local_id')::uuid, (p->>'caja_id')::uuid, (p->>'turno_id')::uuid,
      (p->>'fecha')::date, nullif(p->>'notas', '')
    )
    returning id into v_id;
  else
    update cierres set
      caja_id = (p->>'caja_id')::uuid,
      turno_id = (p->>'turno_id')::uuid,
      fecha = (p->>'fecha')::date,
      notas = nullif(p->>'notas', '')
    where id = v_id;
    if not found then
      raise exception 'No tienes permiso para modificar este cierre';
    end if;
  end if;

  delete from cierre_ingresos where cierre_id = v_id;
  insert into cierre_ingresos (cierre_id, metodo_id, importe)
  select v_id, (i->>'metodo_id')::uuid, (i->>'importe')::numeric
  from jsonb_array_elements(coalesce(p->'ingresos', '[]')) i
  where (i->>'importe')::numeric > 0;

  delete from gastos where cierre_id = v_id;
  insert into gastos (cierre_id, metodo, categoria_id, concepto, autorizado_id, importe, ticket_path)
  select v_id, (g->>'metodo')::metodo_pago, (g->>'categoria_id')::uuid,
         coalesce(g->>'concepto', ''), (g->>'autorizado_id')::uuid,
         (g->>'importe')::numeric, nullif(g->>'ticket_path', '')
  from jsonb_array_elements(coalesce(p->'gastos', '[]')) g;

  return v_id;
end $$;

-- ─────────────────────────────────────────────────────────────
-- Seguridad (RLS)
-- ─────────────────────────────────────────────────────────────

alter table locales enable row level security;
alter table cajas enable row level security;
alter table turnos enable row level security;
alter table metodos_ingreso enable row level security;
alter table categorias_gasto enable row level security;
alter table autorizadores enable row level security;
alter table perfiles enable row level security;
alter table cierres enable row level security;
alter table cierre_ingresos enable row level security;
alter table gastos enable row level security;
alter table movimientos_mes enable row level security;

-- Catálogos: los lee cualquier usuario activo; los gestiona el admin.
create policy lectura on locales for select using (es_usuario_activo());
create policy admin on locales for all using (es_admin()) with check (es_admin());
create policy lectura on cajas for select using (es_usuario_activo());
create policy admin on cajas for all using (es_admin()) with check (es_admin());
create policy lectura on turnos for select using (es_usuario_activo());
create policy admin on turnos for all using (es_admin()) with check (es_admin());
create policy lectura on metodos_ingreso for select using (es_usuario_activo());
create policy admin on metodos_ingreso for all using (es_admin()) with check (es_admin());
create policy lectura on autorizadores for select using (es_usuario_activo());
create policy admin on autorizadores for all using (es_admin()) with check (es_admin());
-- Las categorías también las puede crear un encargado al apuntar un gasto.
create policy lectura on categorias_gasto for select using (es_usuario_activo());
create policy crear on categorias_gasto for insert with check (es_usuario_activo());
create policy admin on categorias_gasto for all using (es_admin()) with check (es_admin());

create policy propio on perfiles for select using (id = auth.uid() or es_admin());
create policy admin on perfiles for update using (es_admin()) with check (es_admin());

create policy lectura on cierres for select
  using (es_admin() or local_id = mi_local());
create policy crear on cierres for insert
  with check (puede_editar_cierre(local_id, fecha));
create policy editar on cierres for update
  using (puede_editar_cierre(local_id, fecha))
  with check (puede_editar_cierre(local_id, fecha));
create policy borrar on cierres for delete
  using (puede_editar_cierre(local_id, fecha));

create policy lectura on cierre_ingresos for select using (
  exists (select 1 from cierres c where c.id = cierre_id and (es_admin() or c.local_id = mi_local())));
create policy escritura on cierre_ingresos for all using (
  exists (select 1 from cierres c where c.id = cierre_id and puede_editar_cierre(c.local_id, c.fecha)))
  with check (
  exists (select 1 from cierres c where c.id = cierre_id and puede_editar_cierre(c.local_id, c.fecha)));

create policy lectura on gastos for select using (
  exists (select 1 from cierres c where c.id = cierre_id and (es_admin() or c.local_id = mi_local())));
create policy escritura on gastos for all using (
  exists (select 1 from cierres c where c.id = cierre_id and puede_editar_cierre(c.local_id, c.fecha)))
  with check (
  exists (select 1 from cierres c where c.id = cierre_id and puede_editar_cierre(c.local_id, c.fecha)));

create policy admin on movimientos_mes for all using (es_admin()) with check (es_admin());

-- ─────────────────────────────────────────────────────────────
-- Tickets (Storage): bucket privado, ruta {local_id}/{aaaa-mm}/{archivo}
-- ─────────────────────────────────────────────────────────────

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('tickets', 'tickets', false, 5242880, array['image/jpeg', 'image/png', 'image/webp', 'application/pdf']);

create policy tickets_lectura on storage.objects for select using (
  bucket_id = 'tickets' and (es_admin() or (storage.foldername(name))[1] = mi_local()::text));
create policy tickets_subida on storage.objects for insert with check (
  bucket_id = 'tickets' and (es_admin() or (storage.foldername(name))[1] = mi_local()::text));

-- ─────────────────────────────────────────────────────────────
-- Datos iniciales
-- ─────────────────────────────────────────────────────────────

with l as (insert into locales (nombre) values ('Local principal') returning id)
insert into cajas (local_id, nombre) select id, 'Caja 1' from l;

insert into turnos (nombre, orden) values ('Único', 0), ('Tardeo', 1), ('Noche', 2);

insert into metodos_ingreso (nombre, es_efectivo, orden) values
  ('Tarjeta', false, 0), ('Efectivo', true, 1), ('Fourvenues', false, 2);

insert into categorias_gasto (nombre) values
  ('Mercancía'), ('Limpieza'), ('Reparaciones'), ('Proveedores'), ('Varios');

-- Después de crear tu usuario en Authentication → Users, hazte admin:
--   update perfiles set rol = 'admin', nombre = 'Tu nombre' where id = (select id from auth.users where email = 'tu@email.com');
