'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export function LoginForm({ sinAcceso }: { sinAcceso: boolean }) {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)

  useEffect(() => {
    if (sinAcceso) createClient().auth.signOut()
  }, [sinAcceso])

  async function entrar(e: React.FormEvent) {
    e.preventDefault()
    setEnviando(true)
    setError(null)
    const { error } = await createClient().auth.signInWithPassword({ email, password })
    if (error) {
      setError('Email o contraseña incorrectos.')
      setEnviando(false)
      return
    }
    router.replace('/')
    router.refresh()
  }

  return (
    <main className="min-h-screen flex items-center justify-center px-4">
      <form onSubmit={entrar} className="tarjeta w-full max-w-sm p-6 space-y-4">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Tresor</h1>
          <p className="text-sm text-muted">Cierres de caja y control financiero</p>
        </div>
        {sinAcceso && (
          <p className="text-sm bg-warn-soft text-warn rounded-md px-3 py-2">
            Tu usuario no tiene acceso. Habla con un responsable.
          </p>
        )}
        <label className="block space-y-1">
          <span className="etiqueta">Email</span>
          <input className="campo" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        </label>
        <label className="block space-y-1">
          <span className="etiqueta">Contraseña</span>
          <input className="campo" type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
        </label>
        {error && <p className="text-sm text-neg">{error}</p>}
        <button className="btn btn-primario w-full" disabled={enviando}>
          {enviando ? 'Entrando…' : 'Entrar'}
        </button>
      </form>
    </main>
  )
}
