import { euros } from '@/lib/format'

export type Snapshot = {
  fecha: string
  caja: string
  turno: string
  evento: string | null
  notas: string | null
  ingresos: Record<string, number>
  gastos: {
    id: string
    metodo: string
    categoria: string
    concepto: string
    autorizado: string
    importe: number
    ticket: boolean
  }[]
}

export type Cambio = { texto: string; antes?: string; despues?: string }

const eur = (n: number | undefined) => `${euros(Number(n ?? 0))} €`

function describirGasto(g: Snapshot['gastos'][number]) {
  return `${g.categoria}${g.concepto ? ` · ${g.concepto}` : ''} · ${eur(g.importe)} (${g.metodo}, autoriza ${g.autorizado})`
}

export function totales(s: Snapshot) {
  const ingresos = Object.values(s.ingresos).reduce((a, n) => a + Number(n), 0)
  const gastos = s.gastos.reduce((a, g) => a + Number(g.importe), 0)
  return { ingresos, gastos }
}

// Lista legible de lo que cambió entre dos versiones de un cierre.
export function diferencias(antes: Snapshot, despues: Snapshot): Cambio[] {
  const cambios: Cambio[] = []
  const campos: [keyof Snapshot, string][] = [
    ['fecha', 'Fecha'],
    ['caja', 'Caja'],
    ['turno', 'Turno'],
    ['evento', 'Evento'],
    ['notas', 'Notas'],
  ]
  for (const [campo, etiqueta] of campos) {
    const a = (antes[campo] as string | null) ?? ''
    const d = (despues[campo] as string | null) ?? ''
    if (a !== d) cambios.push({ texto: etiqueta, antes: a || '—', despues: d || '—' })
  }

  const metodos = new Set([...Object.keys(antes.ingresos), ...Object.keys(despues.ingresos)])
  for (const m of metodos) {
    const a = Number(antes.ingresos[m] ?? 0)
    const d = Number(despues.ingresos[m] ?? 0)
    if (a !== d) cambios.push({ texto: `Ingreso ${m}`, antes: eur(a), despues: eur(d) })
  }

  const previos = new Map(antes.gastos.map((g) => [g.id, g]))
  const actuales = new Map(despues.gastos.map((g) => [g.id, g]))
  for (const g of antes.gastos) {
    if (!actuales.has(g.id)) cambios.push({ texto: 'Gasto eliminado', antes: describirGasto(g) })
  }
  for (const g of despues.gastos) {
    const p = previos.get(g.id)
    if (!p) {
      cambios.push({ texto: 'Gasto añadido', despues: describirGasto(g) })
      continue
    }
    const nombre = p.concepto || p.categoria
    if (Number(p.importe) !== Number(g.importe)) cambios.push({ texto: `Gasto «${nombre}» · importe`, antes: eur(p.importe), despues: eur(g.importe) })
    if (p.metodo !== g.metodo) cambios.push({ texto: `Gasto «${nombre}» · método`, antes: p.metodo, despues: g.metodo })
    if (p.categoria !== g.categoria) cambios.push({ texto: `Gasto «${nombre}» · categoría`, antes: p.categoria, despues: g.categoria })
    if (p.concepto !== g.concepto) cambios.push({ texto: `Gasto «${nombre}» · concepto`, antes: p.concepto || '—', despues: g.concepto || '—' })
    if (p.autorizado !== g.autorizado) cambios.push({ texto: `Gasto «${nombre}» · autorizado por`, antes: p.autorizado, despues: g.autorizado })
    if (p.ticket !== g.ticket) cambios.push({ texto: `Gasto «${nombre}» · ticket`, antes: p.ticket ? 'Sí' : 'No', despues: g.ticket ? 'Sí' : 'No' })
  }
  return cambios
}

export function fechaHora(iso: string) {
  return new Intl.DateTimeFormat('es-ES', {
    timeZone: 'Europe/Madrid',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(iso))
}
