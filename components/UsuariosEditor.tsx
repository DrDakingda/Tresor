'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { Local, Perfil } from '@/lib/types'

export function UsuariosEditor({ usuarios, locales, miId }: { usuarios: Perfil[]; locales: Local[]; miId: string }) {
  const router = useRouter()
  const supabase = useMemo(() => createClient(), [])
  const [error, setError] = useState<string | null>(null)

  async function actualizar(id: string, cambios: Partial<Perfil>) {
    setError(null)
    const { error } = await supabase.from('perfiles').update(cambios).eq('id', id)
    if (error) setError('No se ha podido guardar.')
    router.refresh()
  }

  const variosLocales = locales.length > 1

  return (
    <section className="tarjeta p-4 sm:p-5">
      <h2 className="font-medium">Usuarios</h2>
      <ul className="mt-3 divide-y divide-line">
        {usuarios.map((u) => {
          const yo = u.id === miId
          return (
            // Móvil: nombre arriba y controles debajo. Escritorio: todo en una fila.
            <li key={u.id} className={`py-2.5 grid gap-2 grid-cols-2 ${variosLocales ? 'sm:grid-cols-[1fr_10rem_10rem_7rem]' : 'sm:grid-cols-[1fr_10rem_7rem]'} sm:items-center`}>
              <input
                aria-label="Nombre"
                className={`campo h-9 col-span-2 sm:col-span-1 ${u.activo ? '' : 'text-faint line-through'}`}
                defaultValue={u.nombre}
                onBlur={(e) => {
                  const v = e.target.value.trim()
                  if (v && v !== u.nombre) actualizar(u.id, { nombre: v })
                }}
              />
              <select aria-label="Rol" className="campo h-9" value={u.rol} disabled={yo} onChange={(e) => actualizar(u.id, { rol: e.target.value as Perfil['rol'] })}>
                <option value="encargado">Encargado</option>
                <option value="admin">Responsable</option>
              </select>
              {variosLocales && (
                <select aria-label="Local" className="campo h-9" value={u.local_id ?? ''} onChange={(e) => actualizar(u.id, { local_id: e.target.value })}>
                  {locales.map((l) => (
                    <option key={l.id} value={l.id}>{l.nombre}</option>
                  ))}
                </select>
              )}
              {yo ? (
                <span className="text-xs text-faint self-center">Tú</span>
              ) : (
                <button type="button" onClick={() => actualizar(u.id, { activo: !u.activo })} className="btn h-9 px-2 text-xs">
                  {u.activo ? 'Quitar acceso' : 'Dar acceso'}
                </button>
              )}
            </li>
          )
        })}
      </ul>
      {error && <p className="text-sm text-neg mt-2">{error}</p>}
    </section>
  )
}
