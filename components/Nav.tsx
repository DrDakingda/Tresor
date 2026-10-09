'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export function Nav({ nombre, esAdmin }: { nombre: string; esAdmin: boolean }) {
  const pathname = usePathname()
  const router = useRouter()

  const enlaces = esAdmin
    ? [
        { href: '/panel', label: 'Resumen' },
        { href: '/cierres', label: 'Cierres' },
        { href: '/historial', label: 'Historial' },
        { href: '/ajustes', label: 'Ajustes' },
      ]
    : [{ href: '/cierres', label: 'Cierres' }]

  async function salir() {
    await createClient().auth.signOut()
    router.replace('/login')
    router.refresh()
  }

  const pestanas = enlaces.map((e) => (
    <Link
      key={e.href}
      href={e.href}
      className={`px-3 py-1.5 rounded-md text-center ${pathname.startsWith(e.href) ? 'bg-accent-soft text-accent font-medium' : 'text-muted hover:text-ink'}`}
    >
      {e.label}
    </Link>
  ))

  return (
    <header className="no-print border-b border-line bg-surface">
      <div className="mx-auto max-w-5xl px-4 h-14 flex items-center gap-6">
        <Link href="/" className="font-semibold tracking-tight">Tresor</Link>
        {/* En escritorio las pestañas van en la misma fila */}
        <nav className="hidden sm:flex gap-1 text-sm">{pestanas}</nav>
        <div className="ml-auto flex items-center gap-3 text-sm min-w-0">
          <span className="text-muted truncate">{nombre}</span>
          <button onClick={salir} className="text-muted hover:text-ink shrink-0">Salir</button>
        </div>
      </div>
      {/* En móvil, segunda fila a todo el ancho para que quepan todas */}
      {enlaces.length > 1 && (
        <nav className="sm:hidden grid gap-1 px-2 pb-2 text-sm" style={{ gridTemplateColumns: `repeat(${enlaces.length}, minmax(0, 1fr))` }}>
          {pestanas}
        </nav>
      )}
    </header>
  )
}
