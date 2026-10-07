import Link from 'next/link'
import { desplazarMes, mesActual, nombreMes } from '@/lib/format'

export function MesSelector({ mes, ruta }: { mes: string; ruta: string }) {
  const siguiente = desplazarMes(mes, 1)
  const hayFuturo = siguiente <= mesActual()
  return (
    <div className="flex items-center gap-1">
      <Link href={`${ruta}?mes=${desplazarMes(mes, -1)}`} className="btn px-3" aria-label="Mes anterior">‹</Link>
      <span className="min-w-36 text-center font-medium capitalize">{nombreMes(mes)}</span>
      {hayFuturo ? (
        <Link href={`${ruta}?mes=${siguiente}`} className="btn px-3" aria-label="Mes siguiente">›</Link>
      ) : (
        <span className="btn px-3 opacity-40" aria-hidden>›</span>
      )}
    </div>
  )
}
