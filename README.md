# Tresor

Cierres de caja y control financiero interno. Next.js 16 + Supabase, desplegado en Vercel.

## Qué hace

- **Encargados**: registran el cierre de cada caja y turno (tardeo, noche…) con ingresos por forma de cobro (tarjeta, efectivo, Fourvenues) y los gastos del día (método, categoría, concepto, quién autoriza y foto del ticket). Pueden editar cierres del mes en curso o de hasta 3 días atrás.
- **Responsables (admin)**: ven y editan todo, apuntan gastos fijos, personal y mercancía por mes, ven el flujo de caja y la comparativa de 6 meses, y exportan a Excel o PDF.
- **Ajustes**: usuarios, autorizadores, categorías, formas de cobro, turnos, locales y cajas.

Las reglas de acceso (rol, local y plazo de edición) se aplican en la base de datos con RLS.

## Puesta en marcha

1. Crear un proyecto nuevo en Supabase (organización Katibu).
2. En **SQL Editor**, ejecutar `supabase/001_schema.sql` entero.
3. En **Authentication → Sign In / Providers**, desactivar *Allow new users to sign up* (los usuarios los da de alta un responsable).
4. En **Authentication → Users → Add user**, crear tu usuario y después hacerte admin:
   ```sql
   update perfiles set rol = 'admin', nombre = 'Tu nombre'
   where id = (select id from auth.users where email = 'tu@email.com');
   ```
5. Copiar `.env.example` a `.env.local` y rellenar la URL y la anon key (Project Settings → API).
6. `npm install` y `npm run dev`.

En Vercel, añadir las mismas dos variables de entorno al proyecto.

## Estructura

- `app/(app)/cierres` — listado mensual, nuevo cierre y detalle
- `app/(app)/panel` — panel de responsables
- `app/(app)/ajustes` — catálogos y usuarios
- `app/api/export` — Excel del mes
- `supabase/` — SQL (se ejecuta a mano en Supabase)
