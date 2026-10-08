import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'
import { cargarPanel } from '@/lib/resumen'
import { graficoBarrasH, graficoIngresosDiarios, graficoMeses, graficoReparto, SERIES } from '@/lib/graficos'
import { TIPOS_MOVIMIENTO } from '@/lib/types'

const MESES_CORTOS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']

export async function cargarInforme(supabase: SupabaseClient, mes: string, localId: string) {
  const p = await cargarPanel(supabase, mes, localId)
  const [anio, numMes] = mes.split('-').map(Number)
  const dias = new Date(Date.UTC(anio, numMes, 0)).getUTCDate()

  // Color fijo por forma de cobro según su orden en Ajustes, para que no cambie de un mes a otro.
  const metodos = p.ingresosPorMetodo.map((m) => ({
    ...m,
    color: SERIES[p.catalogos.metodos.findIndex((x) => x.id === m.id) % SERIES.length],
  }))

  const seriesDiarias = metodos.map((m) => {
    const valores = Array(dias).fill(0)
    for (const c of p.cierresMes) valores[Number(c.fecha.slice(8, 10)) - 1] += c.ingresos[m.id] ?? 0
    return { nombre: m.nombre, color: m.color, valores }
  })

  const nombresMov = new Set(TIPOS_MOVIMIENTO.map((t) => t.label))
  const partidas = [
    ...p.gastosPorCategoria.map((c) => ({ nombre: nombresMov.has(c.nombre) ? `${c.nombre} (caja)` : c.nombre, valor: c.total })),
    ...p.movimientosPorTipo
      .filter((m) => m.importe > 0)
      .map((m) => ({ nombre: TIPOS_MOVIMIENTO.find((t) => t.value === m.tipo)!.label, valor: m.importe })),
  ].sort((a, b) => b.valor - a.valor)

  const meses = [...p.historico].reverse().map((h) => {
    const [a, mm] = h.mes.split('-').map(Number)
    return { etiqueta: `${MESES_CORTOS[mm - 1]} ${String(a).slice(2)}`, ingresos: h.ingresos, gastos: h.gastosCaja + h.movimientos }
  })

  const graficos = {
    diario: graficoIngresosDiarios(dias, seriesDiarias),
    reparto: graficoReparto(metodos.map((m) => ({ nombre: m.nombre, color: m.color, valor: m.importe }))),
    partidas: partidas.length ? graficoBarrasH(partidas) : null,
    meses: graficoMeses(meses),
  }

  return { ...p, dias, partidas, graficos }
}
