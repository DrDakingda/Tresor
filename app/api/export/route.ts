import ExcelJS from 'exceljs'
import { createClient } from '@/lib/supabase/server'
import { cargarInforme } from '@/lib/informe'
import { svgAPng } from '@/lib/rasterizar'
import { esMesValido, nombreMes, rangoMes } from '@/lib/format'
import { METODOS_PAGO, TIPOS_MOVIMIENTO } from '@/lib/types'

const FORMATO_EUR = '#,##0.00 [$€-es-ES];[Red]-#,##0.00 [$€-es-ES]'

export async function GET(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new Response('No autorizado', { status: 401 })
  const { data: perfil } = await supabase.from('perfiles').select('rol, activo').eq('id', user.id).single()
  if (!perfil?.activo || perfil.rol !== 'admin') return new Response('No autorizado', { status: 403 })

  const url = new URL(request.url)
  const mes = url.searchParams.get('mes') ?? ''
  if (!esMesValido(mes)) return new Response('Mes no válido', { status: 400 })

  const { data: locales } = await supabase.from('locales').select('id, nombre').order('created_at')
  const local = locales?.find((l) => l.id === url.searchParams.get('local')) ?? locales?.[0]
  if (!local) return new Response('Sin locales', { status: 400 })

  const p = await cargarInforme(supabase, mes, local.id)
  const { desde, hasta } = rangoMes(mes)
  const { data: gastos } = await supabase
    .from('gastos')
    .select('metodo, concepto, importe, ticket_path, cierres!inner(fecha, local_id, cajas(nombre), turnos(nombre)), categorias_gasto(nombre), autorizadores(nombre)')
    .eq('cierres.local_id', local.id)
    .gte('cierres.fecha', desde)
    .lt('cierres.fecha', hasta)

  const variasCajas = p.catalogos.cajas.filter((c) => c.activo).length > 1
  const wb = new ExcelJS.Workbook()
  wb.creator = 'Tresor'

  // Resumen
  const resumen = wb.addWorksheet('Resumen')
  resumen.columns = [{ width: 32 }, { width: 16 }]
  resumen.addRow([`${local.nombre} · ${nombreMes(mes)}`]).font = { bold: true, size: 14 }
  resumen.addRow([])
  resumen.addRow(['Ingresos']).font = { bold: true }
  for (const m of p.ingresosPorMetodo) resumen.addRow([m.nombre, m.importe])
  resumen.addRow(['Total ingresos', p.actual.ingresos]).font = { bold: true }
  resumen.addRow([])
  resumen.addRow(['Gastos']).font = { bold: true }
  resumen.addRow(['Gastos de caja', p.actual.gastosCaja])
  for (const m of p.movimientosPorTipo) resumen.addRow([TIPOS_MOVIMIENTO.find((t) => t.value === m.tipo)!.label, m.importe])
  resumen.addRow(['Total gastos', p.actual.gastosCaja + p.actual.movimientos]).font = { bold: true }
  resumen.addRow([])
  resumen.addRow(['Flujo de caja', p.actual.flujo]).font = { bold: true, size: 12 }
  resumen.getColumn(2).numFmt = FORMATO_EUR

  // Gráficos (los mismos del informe PDF, como imágenes)
  const hojaGraficos = wb.addWorksheet('Gráficos', { views: [{ showGridLines: false }] })
  hojaGraficos.getColumn(1).width = 110
  let fila = 1
  const graficos: [string, string | null][] = [
    ['Ingresos por día', p.graficos.diario],
    ['Ingresos por forma de cobro', p.graficos.reparto],
    ['Gastos por partida', p.graficos.partidas],
    ['Ingresos y gastos · últimos 6 meses', p.graficos.meses],
  ]
  for (const [titulo, svg] of graficos) {
    if (!svg) continue
    const ancho = Number(svg.match(/width="(d+)"/)?.[1] ?? 720)
    const alto = Number(svg.match(/height="(d+)"/)?.[1] ?? 220)
    hojaGraficos.getCell(fila, 1).value = titulo
    hojaGraficos.getCell(fila, 1).font = { bold: true, size: 12 }
    const imagen = wb.addImage({ buffer: svgAPng(svg, ancho) as unknown as ExcelJS.Buffer, extension: 'png' })
    hojaGraficos.addImage(imagen, { tl: { col: 0, row: fila }, ext: { width: ancho, height: alto } })
    fila += Math.ceil(alto / 20) + 3
  }

  // Cierres
  const metodos = p.ingresosPorMetodo
  const hojaCierres = wb.addWorksheet('Cierres')
  hojaCierres.columns = [
    { header: 'Fecha', key: 'fecha', width: 12 },
    ...(variasCajas ? [{ header: 'Caja', key: 'caja', width: 14 }] : []),
    { header: 'Turno', key: 'turno', width: 12 },
    { header: 'Evento', key: 'evento', width: 22 },
    ...metodos.map((m) => ({ header: m.nombre, key: m.id, width: 14 })),
    { header: 'Total ingresos', key: 'ingresos', width: 15 },
    { header: 'Gastos', key: 'gastos', width: 14 },
    { header: 'Neto', key: 'neto', width: 14 },
  ]
  for (const c of [...p.cierresMes].reverse()) {
    hojaCierres.addRow({
      fecha: new Date(c.fecha + 'T12:00:00Z'),
      caja: c.caja,
      turno: c.turno,
      evento: c.evento ?? '',
      ...Object.fromEntries(metodos.map((m) => [m.id, c.ingresos[m.id] ?? 0])),
      ingresos: c.totalIngresos,
      gastos: c.totalGastos,
      neto: c.totalIngresos - c.totalGastos,
    })
  }
  hojaCierres.getColumn('fecha').numFmt = 'dd/mm/yyyy'
  for (let i = variasCajas ? 5 : 4; i <= hojaCierres.columnCount; i++) hojaCierres.getColumn(i).numFmt = FORMATO_EUR
  hojaCierres.getRow(1).font = { bold: true }
  hojaCierres.views = [{ state: 'frozen', ySplit: 1 }]

  // Por evento
  if (p.eventosMes.length) {
    const hojaEventos = wb.addWorksheet('Eventos')
    hojaEventos.columns = [
      { header: 'Evento', key: 'nombre', width: 28 },
      { header: 'Cierres', key: 'cierres', width: 10 },
      { header: 'Ingresos', key: 'ingresos', width: 14 },
      { header: 'Gastos', key: 'gastos', width: 14 },
      { header: 'Neto', key: 'neto', width: 14 },
    ]
    for (const e of p.eventosMes) hojaEventos.addRow(e)
    for (const k of ['ingresos', 'gastos', 'neto']) hojaEventos.getColumn(k).numFmt = FORMATO_EUR
    hojaEventos.getRow(1).font = { bold: true }
  }

  // Gastos de caja (detalle)
  type FilaGasto = {
    metodo: string
    concepto: string
    importe: number
    ticket_path: string | null
    cierres: { fecha: string; cajas: { nombre: string } | null; turnos: { nombre: string } | null }
    categorias_gasto: { nombre: string } | null
    autorizadores: { nombre: string } | null
  }
  const hojaGastos = wb.addWorksheet('Gastos de caja')
  hojaGastos.columns = [
    { header: 'Fecha', key: 'fecha', width: 12 },
    ...(variasCajas ? [{ header: 'Caja', key: 'caja', width: 14 }] : []),
    { header: 'Turno', key: 'turno', width: 12 },
    { header: 'Método', key: 'metodo', width: 14 },
    { header: 'Categoría', key: 'categoria', width: 18 },
    { header: 'Concepto', key: 'concepto', width: 30 },
    { header: 'Autorizado por', key: 'autorizado', width: 18 },
    { header: 'Importe', key: 'importe', width: 14 },
    { header: 'Ticket', key: 'ticket', width: 8 },
  ]
  for (const g of ((gastos ?? []) as unknown as FilaGasto[]).sort((a, b) => a.cierres.fecha.localeCompare(b.cierres.fecha))) {
    hojaGastos.addRow({
      fecha: new Date(g.cierres.fecha + 'T12:00:00Z'),
      caja: g.cierres.cajas?.nombre,
      turno: g.cierres.turnos?.nombre,
      metodo: METODOS_PAGO.find((m) => m.value === g.metodo)?.label,
      categoria: g.categorias_gasto?.nombre,
      concepto: g.concepto,
      autorizado: g.autorizadores?.nombre,
      importe: Number(g.importe),
      ticket: g.ticket_path ? 'Sí' : 'No',
    })
  }
  hojaGastos.getColumn('fecha').numFmt = 'dd/mm/yyyy'
  hojaGastos.getColumn('importe').numFmt = FORMATO_EUR
  hojaGastos.getRow(1).font = { bold: true }
  hojaGastos.views = [{ state: 'frozen', ySplit: 1 }]

  // Apuntes de responsables
  const hojaMov = wb.addWorksheet('Fijos, personal, mercancía')
  hojaMov.columns = [
    { header: 'Tipo', key: 'tipo', width: 16 },
    { header: 'Concepto', key: 'concepto', width: 32 },
    { header: 'Importe', key: 'importe', width: 14 },
  ]
  for (const m of p.movimientosMes) {
    hojaMov.addRow({ tipo: TIPOS_MOVIMIENTO.find((t) => t.value === m.tipo)?.label, concepto: m.concepto, importe: m.importe })
  }
  hojaMov.getColumn('importe').numFmt = FORMATO_EUR
  hojaMov.getRow(1).font = { bold: true }

  const buffer = await wb.xlsx.writeBuffer()
  const nombre = `tresor-${local.nombre.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${mes}.xlsx`
  return new Response(buffer, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${nombre}"`,
    },
  })
}
