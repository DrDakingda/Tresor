'use client'

import { useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { euros, fechaCierrePorDefecto, hoyMadrid, importeAInput, parseImporte, sumarDias } from '@/lib/format'
import { comprimirImagen } from '@/lib/imagen'
import { METODOS_PAGO } from '@/lib/types'
import type { Autorizador, Caja, Categoria, Cierre, Evento, Local, MetodoIngreso, MetodoPago, Perfil, Turno } from '@/lib/types'

type FilaGasto = {
  key: string
  id?: string
  metodo: MetodoPago
  categoria_id: string
  concepto: string
  autorizado_id: string
  importe: string
  ticket_path: string | null
  subiendo?: boolean
}

type Props = {
  perfil: Pick<Perfil, 'rol' | 'local_id'>
  locales: Local[]
  cajas: Caja[]
  turnos: Turno[]
  metodos: MetodoIngreso[]
  categorias: Categoria[]
  autorizadores: Autorizador[]
  eventos: Evento[]
  cierre?: Cierre
  editable: boolean
}

const NUEVA_CATEGORIA = '__nueva__'

export function CierreForm(props: Props) {
  const { perfil, locales, turnos, metodos, autorizadores, eventos, cierre, editable } = props
  const router = useRouter()
  const supabase = useMemo(() => createClient(), [])
  const esAdmin = perfil.rol === 'admin'

  const [categorias, setCategorias] = useState(props.categorias)
  const [localId, setLocalId] = useState(cierre?.local_id ?? perfil.local_id ?? locales[0]?.id ?? '')
  const cajas = props.cajas.filter((c) => c.local_id === localId && (c.activo || c.id === cierre?.caja_id))
  const [cajaId, setCajaId] = useState(cierre?.caja_id ?? cajas[0]?.id ?? '')
  const turnosVisibles = turnos.filter((t) => t.activo || t.id === cierre?.turno_id)
  const [turnoId, setTurnoId] = useState(cierre?.turno_id ?? turnosVisibles[0]?.id ?? '')
  const [fecha, setFecha] = useState(cierre?.fecha ?? fechaCierrePorDefecto())
  const [evento, setEvento] = useState(cierre?.evento ?? '')
  const [notas, setNotas] = useState(cierre?.notas ?? '')

  const metodosVisibles = metodos.filter((m) => m.activo || cierre?.ingresos.some((i) => i.metodo_id === m.id))
  const [ingresos, setIngresos] = useState<Record<string, string>>(() =>
    Object.fromEntries(metodosVisibles.map((m) => [m.id, importeAInput(cierre?.ingresos.find((i) => i.metodo_id === m.id)?.importe ?? 0)]))
  )

  const [gastos, setGastos] = useState<FilaGasto[]>(() =>
    (cierre?.gastos ?? []).map((g) => ({
      key: crypto.randomUUID(),
      id: g.id,
      metodo: g.metodo,
      categoria_id: g.categoria_id,
      concepto: g.concepto,
      autorizado_id: g.autorizado_id,
      importe: importeAInput(g.importe),
      ticket_path: g.ticket_path,
    }))
  )

  const [error, setError] = useState<string | null>(null)
  const [guardando, setGuardando] = useState(false)

  // Totales
  const totalIngresos = metodosVisibles.reduce((s, m) => s + (parseImporte(ingresos[m.id] ?? '') || 0), 0)
  const efectivoIngresado = metodosVisibles.filter((m) => m.es_efectivo).reduce((s, m) => s + (parseImporte(ingresos[m.id] ?? '') || 0), 0)
  const totalGastos = gastos.reduce((s, g) => s + (parseImporte(g.importe) || 0), 0)
  const gastosEfectivo = gastos.filter((g) => g.metodo === 'efectivo').reduce((s, g) => s + (parseImporte(g.importe) || 0), 0)

  function actualizarGasto(key: string, cambios: Partial<FilaGasto>) {
    setGastos((gs) => gs.map((g) => (g.key === key ? { ...g, ...cambios } : g)))
  }

  function anadirGasto() {
    setGastos((gs) => [
      ...gs,
      {
        key: crypto.randomUUID(),
        metodo: 'efectivo',
        categoria_id: '',
        concepto: '',
        autorizado_id: '',
        importe: '',
        ticket_path: null,
      },
    ])
  }

  async function elegirCategoria(key: string, valor: string) {
    if (valor !== NUEVA_CATEGORIA) {
      actualizarGasto(key, { categoria_id: valor })
      return
    }
    const nombre = window.prompt('Nombre de la nueva categoría')?.trim()
    if (!nombre) return
    const existente = categorias.find((c) => c.nombre.toLowerCase() === nombre.toLowerCase())
    if (existente) {
      actualizarGasto(key, { categoria_id: existente.id })
      return
    }
    const { data, error } = await supabase.from('categorias_gasto').insert({ nombre }).select().single()
    if (error || !data) {
      setError('No se ha podido crear la categoría.')
      return
    }
    setCategorias((cs) => [...cs, data as Categoria].sort((a, b) => a.nombre.localeCompare(b.nombre)))
    actualizarGasto(key, { categoria_id: data.id })
  }

  async function subirTicket(key: string, archivo: File) {
    actualizarGasto(key, { subiendo: true })
    try {
      const esPdf = archivo.type === 'application/pdf'
      const cuerpo = esPdf ? archivo : await comprimirImagen(archivo)
      const ruta = `${localId}/${fecha.slice(0, 7)}/${crypto.randomUUID()}.${esPdf ? 'pdf' : 'jpg'}`
      const { error } = await supabase.storage.from('tickets').upload(ruta, cuerpo, {
        contentType: esPdf ? 'application/pdf' : 'image/jpeg',
      })
      if (error) throw error
      actualizarGasto(key, { ticket_path: ruta, subiendo: false })
    } catch {
      actualizarGasto(key, { subiendo: false })
      setError('No se ha podido subir el ticket. Prueba otra vez.')
    }
  }

  async function verTicket(ruta: string) {
    const { data } = await supabase.storage.from('tickets').createSignedUrl(ruta, 300)
    if (data?.signedUrl) window.open(data.signedUrl, '_blank', 'noopener')
  }

  function validar(): string | null {
    if (!localId || !cajaId || !turnoId) return 'Elige caja y turno.'
    if (!fecha) return 'Indica la fecha.'
    if (fecha > hoyMadrid()) return 'La fecha no puede ser futura.'
    for (const m of metodosVisibles) {
      if (Number.isNaN(parseImporte(ingresos[m.id] ?? ''))) return `El importe de ${m.nombre} no es válido.`
    }
    for (const [i, g] of gastos.entries()) {
      const n = parseImporte(g.importe)
      if (!g.categoria_id) return `Elige la categoría del gasto ${i + 1}.`
      if (!g.autorizado_id) return `Indica quién autoriza el gasto ${i + 1}.`
      if (!(n > 0)) return `El importe del gasto ${i + 1} no es válido.`
      if (g.subiendo) return 'Espera a que terminen de subir los tickets.'
    }
    return null
  }

  async function guardar(e: React.FormEvent) {
    e.preventDefault()
    const fallo = validar()
    if (fallo) {
      setError(fallo)
      return
    }
    setGuardando(true)
    setError(null)
    const { data, error } = await supabase.rpc('guardar_cierre', {
      p: {
        id: cierre?.id ?? null,
        local_id: localId,
        caja_id: cajaId,
        turno_id: turnoId,
        fecha,
        evento: evento.trim(),
        notas,
        ingresos: metodosVisibles.map((m) => ({ metodo_id: m.id, importe: parseImporte(ingresos[m.id] ?? '') || 0 })),
        gastos: gastos.map((g) => ({
          id: g.id ?? null,
          metodo: g.metodo,
          categoria_id: g.categoria_id,
          concepto: g.concepto.trim(),
          autorizado_id: g.autorizado_id,
          importe: parseImporte(g.importe),
          ticket_path: g.ticket_path,
        })),
      },
    })
    if (error || !data) {
      setGuardando(false)
      if (error?.code === '23505') setError('Ya existe un cierre para esa caja, fecha y turno.')
      else if (error?.code === '42501' || error?.message.includes('permiso')) setError('Fuera de plazo: solo un responsable puede guardar cierres de esa fecha.')
      else setError('No se ha podido guardar el cierre.')
      return
    }
    router.push(`/cierres?mes=${fecha.slice(0, 7)}`)
    router.refresh()
  }

  async function borrar() {
    if (!cierre || !window.confirm('¿Borrar este cierre y todos sus gastos?')) return
    setGuardando(true)
    const { error } = await supabase.rpc('borrar_cierre', { p_id: cierre.id })
    if (error) {
      setGuardando(false)
      setError('No se ha podido borrar el cierre.')
      return
    }
    router.push(`/cierres?mes=${cierre.fecha.slice(0, 7)}`)
    router.refresh()
  }

  const minFecha = esAdmin ? undefined : primerDiaEditable()

  return (
    <form onSubmit={guardar} className="space-y-5">
      {!editable && (
        <p className="text-sm bg-warn-soft text-warn rounded-md px-4 py-3">
          Este cierre está fuera de plazo. Solo un responsable puede modificarlo.
        </p>
      )}

      <fieldset disabled={!editable || guardando} className="space-y-5">
        {/* Cabecera */}
        <section className="tarjeta p-4 sm:p-5 grid gap-4 sm:grid-cols-4">
          {esAdmin && locales.length > 1 && (
            <label className="space-y-1 sm:col-span-4">
              <span className="etiqueta">Local</span>
              <select
                className="campo"
                value={localId}
                onChange={(e) => {
                  setLocalId(e.target.value)
                  setCajaId(props.cajas.find((c) => c.local_id === e.target.value && c.activo)?.id ?? '')
                }}
              >
                {locales.map((l) => (
                  <option key={l.id} value={l.id}>{l.nombre}</option>
                ))}
              </select>
            </label>
          )}
          <label className="space-y-1 sm:col-span-2">
            <span className="etiqueta">Fecha</span>
            <input className="campo" type="date" required value={fecha} min={minFecha} max={hoyMadrid()} onChange={(e) => setFecha(e.target.value)} />
          </label>
          <label className="space-y-1">
            <span className="etiqueta">Caja</span>
            <select className="campo" required value={cajaId} onChange={(e) => setCajaId(e.target.value)}>
              {cajas.map((c) => (
                <option key={c.id} value={c.id}>{c.nombre}</option>
              ))}
            </select>
          </label>
          <label className="space-y-1">
            <span className="etiqueta">Turno</span>
            <select className="campo" required value={turnoId} onChange={(e) => setTurnoId(e.target.value)}>
              {turnosVisibles.map((t) => (
                <option key={t.id} value={t.id}>{t.nombre}</option>
              ))}
            </select>
          </label>
          <label className="space-y-1 sm:col-span-4">
            <span className="etiqueta">Evento <span className="normal-case tracking-normal font-normal text-faint">(opcional)</span></span>
            <input
              className="campo"
              list="eventos-sugeridos"
              autoComplete="off"
              placeholder="Escribe o elige un evento"
              value={evento}
              onChange={(e) => setEvento(e.target.value)}
            />
            <datalist id="eventos-sugeridos">
              {eventos
                .filter((ev) => ev.activo)
                .map((ev) => (
                  <option key={ev.id} value={ev.nombre} />
                ))}
            </datalist>
            {evento.trim() && !eventos.some((ev) => ev.nombre.toLowerCase() === evento.trim().toLowerCase()) && (
              <span className="block text-xs text-faint">Evento nuevo: se añadirá a la lista al guardar.</span>
            )}
          </label>
        </section>

        {/* Ingresos */}
        <section className="tarjeta">
          <h2 className="etiqueta px-4 sm:px-5 pt-4">Ingresos</h2>
          <div className="divide-y divide-line">
            {metodosVisibles.map((m) => (
              <label key={m.id} className="flex items-center justify-between gap-4 px-4 sm:px-5 py-2.5">
                <span className="text-sm">{m.nombre}</span>
                <input
                  className="campo num max-w-40"
                  inputMode="decimal"
                  placeholder="0,00"
                  value={ingresos[m.id] ?? ''}
                  onChange={(e) => setIngresos((s) => ({ ...s, [m.id]: e.target.value }))}
                />
              </label>
            ))}
          </div>
          <div className="flex justify-between px-4 sm:px-5 py-3 border-t border-line-strong font-medium">
            <span className="text-sm">Total ingresos</span>
            <span className="num">{euros(totalIngresos)}</span>
          </div>
        </section>

        {/* Gastos */}
        <section className="tarjeta">
          <div className="flex items-center justify-between px-4 sm:px-5 pt-4 pb-2">
            <h2 className="etiqueta">Gastos</h2>
            <button type="button" onClick={anadirGasto} className="btn h-8 px-3 text-xs no-print">Añadir gasto</button>
          </div>
          {gastos.length === 0 ? (
            <p className="px-4 sm:px-5 pb-4 text-sm text-muted">Sin gastos en este cierre.</p>
          ) : (
            <div className="divide-y divide-line">
              {gastos.map((g, i) => (
                <div key={g.key} className="px-4 sm:px-5 py-3 grid gap-2 sm:grid-cols-12 items-end">
                  <label className="space-y-1 sm:col-span-2">
                    <span className="etiqueta">Método</span>
                    <select className="campo" value={g.metodo} onChange={(e) => actualizarGasto(g.key, { metodo: e.target.value as MetodoPago })}>
                      {METODOS_PAGO.map((mp) => (
                        <option key={mp.value} value={mp.value}>{mp.label}</option>
                      ))}
                    </select>
                  </label>
                  <label className="space-y-1 sm:col-span-3">
                    <span className="etiqueta">Categoría</span>
                    <select className="campo" value={g.categoria_id} onChange={(e) => elegirCategoria(g.key, e.target.value)}>
                      <option value="" disabled>Elegir…</option>
                      {categorias
                        .filter((c) => c.activo || c.id === g.categoria_id)
                        .map((c) => (
                          <option key={c.id} value={c.id}>{c.nombre}</option>
                        ))}
                      <option value={NUEVA_CATEGORIA}>+ Nueva categoría</option>
                    </select>
                  </label>
                  <label className="space-y-1 sm:col-span-3">
                    <span className="etiqueta">Concepto</span>
                    <input className="campo" placeholder="Hielo, bombillas…" value={g.concepto} onChange={(e) => actualizarGasto(g.key, { concepto: e.target.value })} />
                  </label>
                  <label className="space-y-1 sm:col-span-2">
                    <span className="etiqueta">Autorizado por</span>
                    <select className="campo" value={g.autorizado_id} onChange={(e) => actualizarGasto(g.key, { autorizado_id: e.target.value })}>
                      <option value="" disabled>Elegir…</option>
                      {autorizadores
                        .filter((a) => a.activo || a.id === g.autorizado_id)
                        .map((a) => (
                          <option key={a.id} value={a.id}>{a.nombre}</option>
                        ))}
                    </select>
                  </label>
                  <label className="space-y-1 sm:col-span-2">
                    <span className="etiqueta">Importe</span>
                    <input className="campo num" inputMode="decimal" placeholder="0,00" value={g.importe} onChange={(e) => actualizarGasto(g.key, { importe: e.target.value })} />
                  </label>
                  <div className="sm:col-span-12 flex items-center justify-between gap-2">
                    <TicketBoton
                      ruta={g.ticket_path}
                      subiendo={!!g.subiendo}
                      onSubir={(f) => subirTicket(g.key, f)}
                      onVer={() => g.ticket_path && verTicket(g.ticket_path)}
                    />
                    <button
                      type="button"
                      className="text-xs text-muted hover:text-neg no-print"
                      aria-label={`Quitar gasto ${i + 1}`}
                      onClick={() => setGastos((gs) => gs.filter((x) => x.key !== g.key))}
                    >
                      Quitar gasto
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
          <div className="flex justify-between px-4 sm:px-5 py-3 border-t border-line-strong font-medium">
            <span className="text-sm">Total gastos</span>
            <span className="num text-neg">{totalGastos ? `−${euros(totalGastos)}` : euros(0)}</span>
          </div>
        </section>

        <label className="block space-y-1">
          <span className="etiqueta">Notas</span>
          <textarea className="campo h-20 py-2" value={notas} onChange={(e) => setNotas(e.target.value)} placeholder="Incidencias del turno" />
        </label>
      </fieldset>

      {/* Resumen */}
      <section className="grid gap-3 grid-cols-1 sm:grid-cols-3">
        <Resumen etiqueta="Efectivo neto" valor={efectivoIngresado - gastosEfectivo} ayuda="Efectivo ingresado − gastos en efectivo" />
        <Resumen etiqueta="Total gastos" valor={totalGastos} />
        <Resumen etiqueta="Resultado del cierre" valor={totalIngresos - totalGastos} destacado />
      </section>

      {error && <p className="text-sm text-neg bg-neg-soft rounded-md px-4 py-3">{error}</p>}

      {editable && (
        <div className="flex flex-wrap gap-2 justify-between no-print">
          {cierre ? (
            <button type="button" onClick={borrar} disabled={guardando} className="btn btn-peligro">Borrar cierre</button>
          ) : (
            <span />
          )}
          <div className="flex gap-2">
            <button type="button" onClick={() => router.back()} className="btn">Cancelar</button>
            <button className="btn btn-primario" disabled={guardando}>
              {guardando ? 'Guardando…' : 'Guardar cierre'}
            </button>
          </div>
        </div>
      )}
    </form>
  )
}

function primerDiaEditable() {
  const hoy = hoyMadrid()
  const inicioMes = `${hoy.slice(0, 7)}-01`
  const hace3 = sumarDias(hoy, -3)
  return hace3 < inicioMes ? hace3 : inicioMes
}

function Resumen({ etiqueta, valor, ayuda, destacado }: { etiqueta: string; valor: number; ayuda?: string; destacado?: boolean }) {
  return (
    <div className={`rounded-lg px-4 py-3 ${destacado ? 'bg-accent-soft' : 'bg-surface border border-line'}`}>
      <p className="text-xs text-muted">{etiqueta}</p>
      <p className={`num text-left text-xl font-medium ${valor < 0 ? 'text-neg' : destacado ? 'text-accent' : ''}`}>{euros(valor)}</p>
      {ayuda && <p className="text-xs text-faint mt-0.5">{ayuda}</p>}
    </div>
  )
}

function TicketBoton({ ruta, subiendo, onSubir, onVer }: { ruta: string | null; subiendo: boolean; onSubir: (f: File) => void; onVer: () => void }) {
  const input = useRef<HTMLInputElement>(null)
  if (ruta) {
    return (
      // Enlace en vez de botón para que siga funcionando en cierres bloqueados (fieldset deshabilitado)
      <a href="#" onClick={(e) => { e.preventDefault(); onVer() }} className="btn h-8 px-3 text-xs text-accent" title="Ver ticket">
        Ver ticket
      </a>
    )
  }
  return (
    <>
      <input
        ref={input}
        type="file"
        accept="image/*,application/pdf"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0]
          if (f) onSubir(f)
          e.target.value = ''
        }}
      />
      <button type="button" onClick={() => input.current?.click()} className="btn h-8 px-3 text-xs no-print" title="Adjuntar ticket" disabled={subiendo}>
        {subiendo ? 'Subiendo…' : 'Adjuntar ticket'}
      </button>
    </>
  )
}
