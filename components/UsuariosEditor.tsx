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

  return (
    <section className="tarjeta p-4 sm:p-5 overflow-x-auto">
      <h2 className="font-medium">Usuarios</h2>
      <table className="w-full text-sm mt-3">
        <thead>
          <tr className="text-xs text-muted text-left border-b border-line">
            <th className="font-normal py-1.5">Nombre</th>
            <th className="font-normal py-1.5">Rol</th>
            <th className="font-normal py-1.5">Local</th>
            <th className="font-normal py-1.5" />
          </tr>
        </thead>
        <tbody>
          {usuarios.map((u) => {
            const yo = u.id === miId
            return (
              <tr key={u.id} className="border-b border-line last:border-0">
                <td className="py-1.5 pr-2">
                  <input
                    className={`campo h-9 ${u.activo ? '' : 'text-faint line-through'}`}
                    defaultValue={u.nombre}
                    onBlur={(e) => {
                      const v = e.target.value.trim()
                      if (v && v !== u.nombre) actualizar(u.id, { nombre: v })
                    }}
                  />
                </td>
                <td className="py-1.5 pr-2">
                  <select className="campo h-9" value={u.rol} disabled={yo} onChange={(e) => actualizar(u.id, { rol: e.target.value as Perfil['rol'] })}>
                    <option value="encargado">Encargado</option>
                    <option value="admin">Responsable</option>
                  </select>
                </td>
                <td className="py-1.5 pr-2">
                  <select className="campo h-9" value={u.local_id ?? ''} onChange={(e) => actualizar(u.id, { local_id: e.target.value })}>
                    {locales.map((l) => (
                      <option key={l.id} value={l.id}>{l.nombre}</option>
                    ))}
                  </select>
                </td>
                <td className="py-1.5 text-right">
                  {!yo && (
                    <button type="button" onClick={() => actualizar(u.id, { activo: !u.activo })} className="btn h-9 px-2 text-xs w-28">
                      {u.activo ? 'Quitar acceso' : 'Dar acceso'}
                    </button>
                  )}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
      {error && <p className="text-sm text-neg mt-2">{error}</p>}
    </section>
  )
}
