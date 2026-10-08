// Gráficos como SVG en texto: los mismos sirven para el informe PDF y, rasterizados, para el Excel.
// Paleta categórica validada (CVD y contraste) en orden fijo; nunca se recicla.

export const SERIES = ['#2a78d6', '#eb6834', '#1baf7a', '#eda100', '#e87ba4', '#008300', '#4a3aa7', '#e34948']
export const ACENTO = '#1f5c4a'

const TINTA = '#1b1b19'
const SECUNDARIO = '#6b6a64'
const REJILLA = '#e4e2dc'
const SUPERFICIE = '#ffffff'
const FUENTE = "font-family=\"Inter, system-ui, sans-serif\""

const compacto = new Intl.NumberFormat('es-ES', { notation: 'compact', maximumFractionDigits: 1 })
const euros = new Intl.NumberFormat('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2, useGrouping: 'always' })
const eur = (n: number) => `${euros.format(Math.round(n * 100) / 100)} €`

function esc(s: string) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

function maximoRedondo(v: number) {
  if (v <= 0) return 1
  const exp = Math.pow(10, Math.floor(Math.log10(v)))
  for (const m of [1, 1.25, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10]) if (m * exp >= v) return m * exp
  return 10 * exp
}

// Columna con extremo de datos redondeado (4px) y base recta.
function columna(x: number, y: number, w: number, h: number, redondear: boolean) {
  if (h <= 0) return ''
  const r = redondear ? Math.min(4, w / 2, h) : 0
  return `M${x},${y + h}V${y + r}Q${x},${y} ${x + r},${y}H${x + w - r}Q${x + w},${y} ${x + w},${y + r}V${y + h}Z`
}

function barraH(x: number, y: number, w: number, h: number) {
  if (w <= 0) return ''
  const r = Math.min(4, h / 2, w)
  return `M${x},${y}H${x + w - r}Q${x + w},${y} ${x + w},${y + r}V${y + h - r}Q${x + w},${y + h} ${x + w - r},${y + h}H${x}Z`
}

function leyenda(series: { nombre: string; color: string }[], x: number, y: number) {
  let cx = x
  return series
    .map((s) => {
      const parte = `<rect x="${cx}" y="${y - 9}" width="10" height="10" rx="2" fill="${s.color}"/><text x="${cx + 15}" y="${y}" font-size="11" fill="${SECUNDARIO}">${esc(s.nombre)}</text>`
      cx += 15 + s.nombre.length * 6.4 + 16
      return parte
    })
    .join('')
}

function ejeY(max: number, x0: number, x1: number, yBase: number, alto: number) {
  return [0, 0.25, 0.5, 0.75, 1]
    .map((f) => {
      const y = yBase - f * alto
      return `<line x1="${x0}" x2="${x1}" y1="${y}" y2="${y}" stroke="${REJILLA}" stroke-width="1"/><text x="${x0 - 6}" y="${y + 4}" font-size="10" fill="${SECUNDARIO}" text-anchor="end">${compacto.format(max * f)}</text>`
    })
    .join('')
}

function envolver(ancho: number, alto: number, titulo: string, cuerpo: string) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${ancho}" height="${alto}" viewBox="0 0 ${ancho} ${alto}" ${FUENTE} role="img"><title>${esc(titulo)}</title><rect width="${ancho}" height="${alto}" fill="${SUPERFICIE}"/>${cuerpo}</svg>`
}

/** Ingresos de cada día del mes, apilados por forma de cobro. */
export function graficoIngresosDiarios(
  dias: number,
  series: { nombre: string; color: string; valores: number[] }[],
  ancho = 720,
  alto = 230
) {
  const m = { izq: 44, der: 8, arr: 30, abj: 24 }
  const altoPlot = alto - m.arr - m.abj
  const anchoPlot = ancho - m.izq - m.der
  const totales = Array.from({ length: dias }, (_, d) => series.reduce((s, x) => s + (x.valores[d] ?? 0), 0))
  const max = maximoRedondo(Math.max(...totales, 0))
  const banda = anchoPlot / dias
  const w = Math.min(24, banda - 2)
  const yBase = m.arr + altoPlot

  let barras = ''
  for (let d = 0; d < dias; d++) {
    const x = m.izq + d * banda + (banda - w) / 2
    let acumulado = 0
    const ultima = series.map((s, i) => ((s.valores[d] ?? 0) > 0 ? i : -1)).reduce((a, b) => Math.max(a, b), -1)
    const partes = series.map((s, i) => {
      const v = s.valores[d] ?? 0
      if (v <= 0) return ''
      const h = (v / max) * altoPlot
      const y = yBase - ((acumulado + v) / max) * altoPlot
      acumulado += v
      // 2px de separación en el color de la superficie entre segmentos apilados
      const hVisible = i === ultima ? h : Math.max(0, h - 2)
      return `<path d="${columna(x, y + (h - hVisible), w, hVisible, i === ultima)}" fill="${s.color}"><title>Día ${d + 1} · ${esc(s.nombre)}: ${eur(v)}</title></path>`
    })
    barras += partes.join('')
  }

  const etiquetasX = Array.from({ length: dias }, (_, d) => d + 1)
    .filter((d) => d === 1 || d % 5 === 0)
    .map((d) => `<text x="${m.izq + (d - 1) * banda + banda / 2}" y="${alto - 6}" font-size="10" fill="${SECUNDARIO}" text-anchor="middle">${d}</text>`)
    .join('')

  const cuerpo =
    leyenda(series, m.izq, 14) +
    ejeY(max, m.izq, ancho - m.der, yBase, altoPlot) +
    barras +
    `<line x1="${m.izq}" x2="${ancho - m.der}" y1="${yBase}" y2="${yBase}" stroke="${SECUNDARIO}" stroke-width="1"/>` +
    etiquetasX
  return envolver(ancho, alto, 'Ingresos por día', cuerpo)
}

/** Reparto en una sola barra 100 % con etiquetas directas. */
export function graficoReparto(items: { nombre: string; color: string; valor: number }[], ancho = 720) {
  const alto = 64
  const total = items.reduce((s, i) => s + i.valor, 0)
  const visibles = items.filter((i) => i.valor > 0)
  if (!total) return envolver(ancho, alto, 'Reparto', `<text x="0" y="20" font-size="12" fill="${SECUNDARIO}">Sin datos</text>`)
  let x = 0
  let cuerpo = ''
  visibles.forEach((it, i) => {
    const w = (it.valor / total) * ancho
    const ultima = i === visibles.length - 1
    const wVisible = ultima ? w : Math.max(0, w - 2)
    const r = 4
    const primera = i === 0
    // Extremos exteriores redondeados; uniones interiores rectas con 2px de aire.
    const d =
      primera && ultima
        ? `M${x + r},8H${x + w - r}Q${x + w},8 ${x + w},${8 + r}V${28 - r}Q${x + w},28 ${x + w - r},28H${x + r}Q${x},28 ${x},${28 - r}V${8 + r}Q${x},8 ${x + r},8Z`
        : primera
          ? `M${x + r},8H${x + wVisible}V28H${x + r}Q${x},28 ${x},${28 - r}V${8 + r}Q${x},8 ${x + r},8Z`
          : ultima
            ? `M${x},8H${x + w - r}Q${x + w},8 ${x + w},${8 + r}V${28 - r}Q${x + w},28 ${x + w - r},28H${x}Z`
            : `M${x},8H${x + wVisible}V28H${x}Z`
    const pct = Math.round((it.valor / total) * 100)
    cuerpo += `<path d="${d}" fill="${it.color}"><title>${esc(it.nombre)}: ${eur(it.valor)} (${pct} %)</title></path>`
    if (w > 70) {
      cuerpo += `<text x="${x}" y="46" font-size="11" fill="${TINTA}" font-weight="500">${esc(it.nombre)}</text><text x="${x}" y="60" font-size="10" fill="${SECUNDARIO}">${pct} % · ${compacto.format(it.valor)} €</text>`
    }
    x += w
  })
  return envolver(ancho, alto, 'Reparto', cuerpo)
}

/** Barras horizontales de una sola serie, ordenadas, con el valor al final. */
export function graficoBarrasH(items: { nombre: string; valor: number }[], ancho = 720) {
  const fila = 26
  const alto = Math.max(1, items.length) * fila + 8
  const izq = 150
  const der = 90
  const max = Math.max(...items.map((i) => i.valor), 0) || 1
  const cuerpo = items
    .map((it, i) => {
      const y = 4 + i * fila
      const w = (it.valor / max) * (ancho - izq - der)
      return (
        `<text x="${izq - 10}" y="${y + 15}" font-size="11" fill="${TINTA}" text-anchor="end">${esc(it.nombre.length > 22 ? it.nombre.slice(0, 21) + '…' : it.nombre)}</text>` +
        `<path d="${barraH(izq, y + 4, w, 14)}" fill="${ACENTO}"><title>${esc(it.nombre)}: ${eur(it.valor)}</title></path>` +
        `<text x="${izq + w + 6}" y="${y + 15}" font-size="11" fill="${SECUNDARIO}">${eur(it.valor)}</text>`
      )
    })
    .join('')
  return envolver(ancho, alto, 'Gastos por partida', `<line x1="${izq}" x2="${izq}" y1="2" y2="${alto - 2}" stroke="${SECUNDARIO}" stroke-width="1"/>${cuerpo}`)
}

/** Columnas agrupadas: ingresos y gastos de los últimos meses. */
export function graficoMeses(meses: { etiqueta: string; ingresos: number; gastos: number }[], ancho = 720, alto = 220) {
  const m = { izq: 44, der: 8, arr: 30, abj: 24 }
  const altoPlot = alto - m.arr - m.abj
  const anchoPlot = ancho - m.izq - m.der
  const max = maximoRedondo(Math.max(...meses.flatMap((x) => [x.ingresos, x.gastos]), 0))
  const banda = anchoPlot / meses.length
  const w = Math.min(24, (banda - 16) / 2)
  const yBase = m.arr + altoPlot
  const series = [
    { nombre: 'Ingresos', color: SERIES[0], clave: 'ingresos' as const },
    { nombre: 'Gastos', color: SERIES[1], clave: 'gastos' as const },
  ]
  const barras = meses
    .map((mes, i) => {
      const centro = m.izq + i * banda + banda / 2
      return (
        series
          .map((s, j) => {
            const v = mes[s.clave]
            const h = (v / max) * altoPlot
            const x = centro - w - 1 + j * (w + 2)
            return `<path d="${columna(x, yBase - h, w, h, true)}" fill="${s.color}"><title>${esc(mes.etiqueta)} · ${s.nombre}: ${eur(v)}</title></path>`
          })
          .join('') + `<text x="${centro}" y="${alto - 6}" font-size="10" fill="${SECUNDARIO}" text-anchor="middle">${esc(mes.etiqueta)}</text>`
      )
    })
    .join('')
  const cuerpo =
    leyenda(series, m.izq, 14) +
    ejeY(max, m.izq, ancho - m.der, yBase, altoPlot) +
    barras +
    `<line x1="${m.izq}" x2="${ancho - m.der}" y1="${yBase}" y2="${yBase}" stroke="${SECUNDARIO}" stroke-width="1"/>`
  return envolver(ancho, alto, 'Ingresos y gastos por mes', cuerpo)
}
