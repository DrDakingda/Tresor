import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Autorizador, Caja, Categoria, Local, MetodoIngreso, Turno } from '@/lib/types'

export async function cargarCatalogos(supabase: SupabaseClient) {
  const [locales, cajas, turnos, metodos, categorias, autorizadores] = await Promise.all([
    supabase.from('locales').select('*').order('created_at'),
    supabase.from('cajas').select('*').order('orden').order('nombre'),
    supabase.from('turnos').select('*').order('orden'),
    supabase.from('metodos_ingreso').select('*').order('orden'),
    supabase.from('categorias_gasto').select('*').order('nombre'),
    supabase.from('autorizadores').select('*').order('nombre'),
  ])
  return {
    locales: (locales.data ?? []) as Local[],
    cajas: (cajas.data ?? []) as Caja[],
    turnos: (turnos.data ?? []) as Turno[],
    metodos: (metodos.data ?? []) as MetodoIngreso[],
    categorias: (categorias.data ?? []) as Categoria[],
    autorizadores: (autorizadores.data ?? []) as Autorizador[],
  }
}

export type CierreResumen = {
  id: string
  local_id: string
  fecha: string
  caja: string
  turno: string
  ingresos: Record<string, number>
  totalIngresos: number
  gastos: { metodo: string; categoria_id: string; importe: number }[]
  totalGastos: number
  gastosEfectivo: number
}

export async function cierresDelMes(supabase: SupabaseClient, desde: string, hasta: string, localId?: string) {
  let q = supabase
    .from('cierres')
    .select('id, local_id, fecha, cajas(nombre), turnos(nombre, orden), cierre_ingresos(metodo_id, importe), gastos(metodo, categoria_id, importe)')
    .gte('fecha', desde)
    .lt('fecha', hasta)
    .order('fecha', { ascending: false })
  if (localId) q = q.eq('local_id', localId)
  const { data, error } = await q
  if (error) throw error

  type Fila = {
    id: string
    local_id: string
    fecha: string
    cajas: { nombre: string } | null
    turnos: { nombre: string; orden: number } | null
    cierre_ingresos: { metodo_id: string; importe: number }[]
    gastos: { metodo: string; categoria_id: string; importe: number }[]
  }

  return ((data ?? []) as unknown as Fila[])
    .sort((a, b) => b.fecha.localeCompare(a.fecha) || (a.turnos?.orden ?? 0) - (b.turnos?.orden ?? 0))
    .map((c): CierreResumen => {
      const ingresos: Record<string, number> = {}
      for (const i of c.cierre_ingresos) ingresos[i.metodo_id] = Number(i.importe)
      const gastos = c.gastos.map((g) => ({ ...g, importe: Number(g.importe) }))
      return {
        id: c.id,
        local_id: c.local_id,
        fecha: c.fecha,
        caja: c.cajas?.nombre ?? '',
        turno: c.turnos?.nombre ?? '',
        ingresos,
        totalIngresos: Object.values(ingresos).reduce((s, n) => s + n, 0),
        gastos,
        totalGastos: gastos.reduce((s, g) => s + g.importe, 0),
        gastosEfectivo: gastos.filter((g) => g.metodo === 'efectivo').reduce((s, g) => s + g.importe, 0),
      }
    })
}
