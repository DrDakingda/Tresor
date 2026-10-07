import 'server-only'
import { cache } from 'react'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import type { Perfil } from '@/lib/types'

export const getPerfil = cache(async (): Promise<Perfil> => {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data } = await supabase.from('perfiles').select('*').eq('id', user.id).single()
  if (!data || !data.activo) redirect('/login?sin-acceso=1')
  return data as Perfil
})

export async function requireAdmin() {
  const perfil = await getPerfil()
  if (perfil.rol !== 'admin') redirect('/cierres')
  return perfil
}
