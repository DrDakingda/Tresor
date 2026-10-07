import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'
import { cargarCatalogos, cierresDelMes, type CierreResumen } from '@/lib/datos'
import { desplazarMes, rangoMes } from '@/lib/format'
import type { MovimientoMes, TipoMovimiento } from '@/lib/types'

export type ResumenMes = {
  mes: string
  ingresos: number
  gastosCaja: number
  movimientos: number
  flujo: number
}

function resumir(mes: string, cierres: CierreResumen[], movimientos: MovimientoMes[]): ResumenMes {
  const delMes = cierres.filter((c) => c.fecha.startsWith(mes))
  const ingresos = delMes.reduce((s, c) => s + c.totalIngresos, 0)
  const gastosCaja = delMes.reduce((s, c) => s + c.totalGastos, 0)
  const mov = movimientos.filter((m) => m.mes.startsWith(mes)).reduce((s, m) => s + m.importe, 0)
  return { mes, ingresos, gastosCaja, movimientos: mov, flujo: ingresos - gastosCaja - mov }
}

export async function cargarPanel(supabase: SupabaseClient, mes: string, localId?: string) {
  const primerMes = desplazarMes(mes, -5)
  const { hasta } = rangoMes(mes)
  const desde = `${primerMes}-01`

  let qMov = supabase.from('movimientos_mes').select('*').gte('mes', desde).lt('mes', hasta).order('created_at')
  if (localId) qMov = qMov.eq('local_id', localId)

  const [catalogos, cierres, movRes] = await Promise.all([
    cargarCatalogos(supabase),
    cierresDelMes(supabase, desde, hasta, localId),
    qMov,
  ])
  const movimientos = ((movRes.data ?? []) as MovimientoMes[]).map((m) => ({ ...m, importe: Number(m.importe) }))

  const cierresMes = cierres.filter((c) => c.fecha.startsWith(mes))
  const movimientosMes = movimientos.filter((m) => m.mes.startsWith(mes))

  const ingresosPorMetodo = catalogos.metodos
    .map((m) => ({ id: m.id, nombre: m.nombre, importe: cierresMes.reduce((s, c) => s + (c.ingresos[m.id] ?? 0), 0) }))
    .filter((m) => m.importe > 0 || catalogos.metodos.find((x) => x.id === m.id)?.activo)

  const porCategoria = new Map<string, { efectivo: number; tarjeta: number; transferencia: number }>()
  for (const c of cierresMes) {
    for (const g of c.gastos) {
      const fila = porCategoria.get(g.categoria_id) ?? { efectivo: 0, tarjeta: 0, transferencia: 0 }
      fila[g.metodo as 'efectivo' | 'tarjeta' | 'transferencia'] += g.importe
      porCategoria.set(g.categoria_id, fila)
    }
  }
  const gastosPorCategoria = [...porCategoria.entries()]
    .map(([id, v]) => ({
      nombre: catalogos.categorias.find((c) => c.id === id)?.nombre ?? '—',
      ...v,
      total: v.efectivo + v.tarjeta + v.transferencia,
    }))
    .sort((a, b) => b.total - a.total)

  const movimientosPorTipo = (['fijo', 'personal', 'mercancia', 'otro'] as TipoMovimiento[]).map((tipo) => ({
    tipo,
    importe: movimientosMes.filter((m) => m.tipo === tipo).reduce((s, m) => s + m.importe, 0),
  }))

  const historico = Array.from({ length: 6 }, (_, i) => resumir(desplazarMes(primerMes, i), cierres, movimientos)).reverse()

  return {
    catalogos,
    cierresMes,
    movimientosMes,
    ingresosPorMetodo,
    gastosPorCategoria,
    movimientosPorTipo,
    actual: historico[0],
    anterior: historico[1],
    historico,
  }
}
