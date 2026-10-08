'use client'

import { useEffect } from 'react'
import Link from 'next/link'

// Barra superior de las páginas imprimibles; con ?imprimir=1 abre el diálogo al cargar.
export function BarraImpresion({ volver, autoImprimir }: { volver: string; autoImprimir: boolean }) {
  useEffect(() => {
    if (!autoImprimir) return
    const t = setTimeout(() => window.print(), 400)
    return () => clearTimeout(t)
  }, [autoImprimir])

  return (
    <div className="no-print sticky top-0 z-10 bg-surface border-b border-line">
      <div className="mx-auto max-w-[210mm] px-4 h-14 flex items-center justify-between">
        <Link href={volver} className="text-sm text-muted hover:text-ink">← Volver</Link>
        <button type="button" onClick={() => window.print()} className="btn btn-primario">Guardar PDF o imprimir</button>
      </div>
    </div>
  )
}
