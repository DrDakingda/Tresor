'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export function Nav({ nombre, esAdmin }: { nombre: string; esAdmin: boolean }) {
  const pathname = usePathname()
  const router = useRouter()

  const enlaces = [
    { href: '/cierres', label: 'Cierres' },
    ...(esAdmin
      ? [
          { href: '/panel', label: 'Responsables' },
          { href: '/ajustes', label: 'Ajustes' },
        ]
      : []),
  ]

  async function salir() {
    await createClient().auth.signOut()
    router.replace('/login')
    router.refresh()
  }

  return (
    <header className="no-print border-b border-line bg-surface">
      <div className="mx-auto max-w-5xl px-4 h-14 flex items-center gap-6">
        <Link href="/cierres" className="font-semibold tracking-tight">Tresor</Link>
        <nav className="flex gap-1 text-sm">
          {enlaces.map((e) => (
            <Link
              key={e.href}
              href={e.href}
              className={`px-3 py-1.5 rounded-md ${pathname.startsWith(e.href) ? 'bg-accent-soft text-accent font-medium' : 'text-muted hover:text-ink'}`}
            >
              {e.label}
            </Link>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-3 text-sm">
          <span className="text-muted hidden sm:inline">{nombre}</span>
          <button onClick={salir} className="text-muted hover:text-ink">Salir</button>
        </div>
      </div>
    </header>
  )
}
