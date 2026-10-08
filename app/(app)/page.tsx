import { redirect } from 'next/navigation'
import { getPerfil } from '@/lib/auth'

export default async function Inicio() {
  const perfil = await getPerfil()
  redirect(perfil.rol === 'admin' ? '/panel' : '/cierres')
}
