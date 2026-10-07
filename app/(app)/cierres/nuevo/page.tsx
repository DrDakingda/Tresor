import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { getPerfil } from '@/lib/auth'
import { cargarCatalogos } from '@/lib/datos'
import { CierreForm } from '@/components/CierreForm'

export default async function NuevoCierrePage() {
  const perfil = await getPerfil()
  const supabase = await createClient()
  const catalogos = await cargarCatalogos(supabase)

  return (
    <div className="space-y-5">
      <div>
        <Link href="/cierres" className="text-sm text-muted hover:text-ink">← Cierres</Link>
        <h1 className="text-xl font-semibold tracking-tight mt-1">Nuevo cierre</h1>
      </div>
      <CierreForm perfil={perfil} {...catalogos} editable />
    </div>
  )
}
