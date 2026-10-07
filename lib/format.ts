const eur = new Intl.NumberFormat('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

export function euros(n: number) {
  return eur.format(Math.round(n * 100) / 100)
}

// Acepta "1.234,56", "1234,56" o "1234.56".
export function parseImporte(s: string): number {
  const t = s.trim().replace(/\s|€/g, '')
  if (!t) return 0
  const normalizado = t.includes(',') ? t.replace(/\./g, '').replace(',', '.') : t
  const n = Number(normalizado)
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : NaN
}

export function importeAInput(n: number) {
  return n ? String(n).replace('.', ',') : ''
}

const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']
const DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado']

export function hoyMadrid(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Madrid' }).format(new Date())
}

// Fecha por defecto del cierre: antes de las 8:00 se cierra la noche anterior.
export function fechaCierrePorDefecto(): string {
  const hora = Number(new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Madrid', hour: 'numeric', hour12: false }).format(new Date()))
  return hora < 8 ? sumarDias(hoyMadrid(), -1) : hoyMadrid()
}

export function sumarDias(fecha: string, dias: number): string {
  const d = new Date(fecha + 'T12:00:00Z')
  d.setUTCDate(d.getUTCDate() + dias)
  return d.toISOString().slice(0, 10)
}

export function fechaLarga(fecha: string) {
  const d = new Date(fecha + 'T12:00:00Z')
  return `${DIAS[d.getUTCDay()]} ${d.getUTCDate()} de ${MESES[d.getUTCMonth()]}`
}

export function fechaCorta(fecha: string) {
  const d = new Date(fecha + 'T12:00:00Z')
  return `${String(d.getUTCDate()).padStart(2, '0')}/${String(d.getUTCMonth() + 1).padStart(2, '0')}`
}

// mes en formato "2026-10"
export function mesActual() {
  return hoyMadrid().slice(0, 7)
}

export function nombreMes(mes: string) {
  const [a, m] = mes.split('-').map(Number)
  return `${MESES[m - 1]} ${a}`
}

export function desplazarMes(mes: string, n: number) {
  const [a, m] = mes.split('-').map(Number)
  const d = new Date(Date.UTC(a, m - 1 + n, 1))
  return d.toISOString().slice(0, 7)
}

export function rangoMes(mes: string) {
  return { desde: `${mes}-01`, hasta: `${desplazarMes(mes, 1)}-01` }
}

export function esMesValido(s: string | undefined): s is string {
  return !!s && /^\d{4}-(0[1-9]|1[0-2])$/.test(s)
}

// Espejo de en_plazo() en SQL, solo para la interfaz; la regla real la aplica la base de datos.
export function enPlazo(fecha: string) {
  const hoy = hoyMadrid()
  return fecha <= hoy && (fecha.slice(0, 7) === hoy.slice(0, 7) || fecha >= sumarDias(hoy, -3))
}
