import { LoginForm } from '@/components/LoginForm'

export default async function LoginPage({ searchParams }: PageProps<'/login'>) {
  const params = await searchParams
  return <LoginForm sinAcceso={'sin-acceso' in params} />
}
