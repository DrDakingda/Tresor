'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

type Extra =
  | { tipo: 'checkbox'; campo: string; label: string }
  | { tipo: 'select'; campo: string; label: string; opciones: { value: string; label: string }[] }

type Fila = { id: string; nombre: string; activo: boolean; orden?: number }

export function ListaEditor({ tabla, titulo, ayuda, filas, extra, conOrden, valoresNuevos }: {
  tabla: string
  titulo: string
  ayuda?: string
  filas: Fila[]
  extra?: Extra
  conOrden?: boolean
  // Campos fijos que se añaden a cada fila nueva (p. ej. el local de una caja).
  valoresNuevos?: Record<string, unknown>
}) {
  const router = useRouter()
  const supabase = useMemo(() => createClient(), [])
  const [nuevo, setNuevo] = useState('')
  const [nuevoExtra, setNuevoExtra] = useState<string>(extra?.tipo === 'select' ? extra.opciones[0]?.value ?? '' : '')
  const [error, setError] = useState<string | null>(null)

  async function actualizar(id: string, cambios: Record<string, unknown>) {
    setError(null)
    const { error } = await supabase.from(tabla).update(cambios).eq('id', id)
    if (error) setError(error.code === '23505' ? 'Ya existe uno con ese nombre.' : 'No se ha podido guardar.')
    router.refresh()
  }

  async function anadir(e: React.FormEvent) {
    e.preventDefault()
    const nombre = nuevo.trim()
    if (!nombre) return
    setError(null)
    const fila: Record<string, unknown> = { ...valoresNuevos, nombre }
    if (extra?.tipo === 'select') fila[extra.campo] = nuevoExtra
    if (conOrden) fila.orden = Math.max(-1, ...filas.map((f) => f.orden ?? 0)) + 1
    const { error } = await supabase.from(tabla).insert(fila)
    if (error) return setError(error.code === '23505' ? 'Ya existe uno con ese nombre.' : 'No se ha podido añadir.')
    setNuevo('')
    router.refresh()
  }

  const valorExtra = (f: Fila) => (extra ? (f as Record<string, unknown>)[extra.campo] : undefined)

  return (
    <section className="tarjeta p-4 sm:p-5">
      <h2 className="font-medium">{titulo}</h2>
      {ayuda && <p className="text-xs text-muted mt-0.5">{ayuda}</p>}
      <ul className="mt-3 divide-y divide-line">
        {filas.map((f) => (
          <li key={f.id} className="flex items-center gap-2 py-1.5">
            <input
              className={`campo h-9 flex-1 min-w-0 ${f.activo ? '' : 'text-faint line-through'}`}
              defaultValue={f.nombre}
              onBlur={(e) => {
                const v = e.target.value.trim()
                if (v && v !== f.nombre) actualizar(f.id, { nombre: v })
              }}
            />
            {extra?.tipo === 'checkbox' && (
              <label className="flex items-center gap-1 text-xs text-muted whitespace-nowrap">
                <input type="checkbox" checked={Boolean(valorExtra(f))} onChange={(e) => actualizar(f.id, { [extra.campo]: e.target.checked })} />
                {extra.label}
              </label>
            )}
            {extra?.tipo === 'select' && (
              <select className="campo h-9 w-36" value={String(valorExtra(f) ?? '')} onChange={(e) => actualizar(f.id, { [extra.campo]: e.target.value })}>
                {extra.opciones.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            )}
            <button type="button" onClick={() => actualizar(f.id, { activo: !f.activo })} className="btn h-9 px-2 text-xs w-24 shrink-0">
              {f.activo ? 'Desactivar' : 'Activar'}
            </button>
          </li>
        ))}
      </ul>
      <form onSubmit={anadir} className="flex gap-2 mt-3">
        <input className="campo h-9 flex-1 min-w-0" placeholder="Añadir…" value={nuevo} onChange={(e) => setNuevo(e.target.value)} />
        {extra?.tipo === 'select' && (
          <select className="campo h-9 w-36" value={nuevoExtra} onChange={(e) => setNuevoExtra(e.target.value)}>
            {extra.opciones.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        )}
        <button className="btn h-9">Añadir</button>
      </form>
      {error && <p className="text-sm text-neg mt-2">{error}</p>}
    </section>
  )
}
