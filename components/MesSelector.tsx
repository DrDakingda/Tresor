import Link from 'next/link'
import { desplazarMes, mesActual, nombreMes } from '@/lib/format'

export function MesSelector({ mes, ruta, extra = '' }: { mes: string; ruta: string; extra?: string }) {
  const siguiente = desplazarMes(mes, 1)
  const hayFuturo = siguiente <= mesActual()
  return (
    <div className="flex items-center gap-1 w-full sm:w-auto">
      <Link href={`${ruta}?mes=${desplazarMes(mes, -1)}${extra}`} className="btn px-3" aria-label="Mes anterior">‹</Link>
      <span className="flex-1 sm:flex-none sm:min-w-36 text-center font-medium capitalize">{nombreMes(mes)}</span>
      {hayFuturo ? (
        <Link href={`${ruta}?mes=${siguiente}${extra}`} className="btn px-3" aria-label="Mes siguiente">›</Link>
      ) : (
        <span className="btn px-3 opacity-40" aria-hidden>›</span>
      )}
    </div>
  )
}
