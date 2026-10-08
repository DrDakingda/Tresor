'use client'

import Link from 'next/link'

// Barra superior de las páginas imprimibles (informe mensual y cierre).
export function BarraImpresion({ volver }: { volver: string }) {
  return (
    <div className="no-print sticky top-0 z-10 bg-surface border-b border-line">
      <div className="mx-auto max-w-[210mm] px-4 h-14 flex items-center justify-between">
        <Link href={volver} className="text-sm text-muted hover:text-ink">← Volver</Link>
        <button type="button" onClick={() => window.print()} className="btn btn-primario">Guardar PDF o imprimir</button>
      </div>
    </div>
  )
}
