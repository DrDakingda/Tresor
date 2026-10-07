import { getPerfil } from '@/lib/auth'
import { Nav } from '@/components/Nav'

export default async function AppLayout({ children }: LayoutProps<'/'>) {
  const perfil = await getPerfil()

  return (
    <div className="min-h-screen">
      <Nav nombre={perfil.nombre} esAdmin={perfil.rol === 'admin'} />
      <main className="mx-auto max-w-5xl px-4 py-6 pb-16">{children}</main>
    </div>
  )
}
