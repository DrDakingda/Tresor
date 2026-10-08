import { createClient } from '@/lib/supabase/server'
import { requireAdmin } from '@/lib/auth'
import { cargarCatalogos } from '@/lib/datos'
import { ListaEditor } from '@/components/ListaEditor'
import { UsuariosEditor } from '@/components/UsuariosEditor'
import type { Perfil } from '@/lib/types'

export default async function AjustesPage() {
  const yo = await requireAdmin()
  const supabase = await createClient()
  const [c, { data: usuarios }] = await Promise.all([
    cargarCatalogos(supabase),
    supabase.from('perfiles').select('*').order('nombre'),
  ])
  const opcionesLocal = c.locales.map((l) => ({ value: l.id, label: l.nombre }))

  return (
    <div className="space-y-5">
      <h1 className="text-xl font-semibold tracking-tight">Ajustes</h1>
      <UsuariosEditor usuarios={(usuarios ?? []) as Perfil[]} locales={c.locales} miId={yo.id} />
      <div className="grid gap-4 lg:grid-cols-2">
        <ListaEditor tabla="autorizadores" titulo="Autorizan gastos" ayuda="Personas que aparecen en «Autorizado por»." filas={c.autorizadores} />
        <ListaEditor tabla="categorias_gasto" titulo="Categorías de gasto" filas={c.categorias} />
        <ListaEditor tabla="metodos_ingreso" titulo="Formas de cobro" filas={c.metodos} conOrden />
        <ListaEditor tabla="eventos" titulo="Eventos" ayuda="Se crean solos al escribirlos en un cierre. Desactiva los que ya no quieras ver sugeridos." filas={c.eventos} />
        <ListaEditor tabla="turnos" titulo="Turnos" filas={c.turnos} conOrden />
        <ListaEditor tabla="locales" titulo="Locales" filas={c.locales} />
        <ListaEditor tabla="cajas" titulo="Cajas" filas={c.cajas} extra={{ tipo: 'select', campo: 'local_id', label: 'Local', opciones: opcionesLocal }} conOrden />
      </div>
    </div>
  )
}
