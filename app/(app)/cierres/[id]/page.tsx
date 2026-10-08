import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getPerfil } from '@/lib/auth'
import { cargarCatalogos } from '@/lib/datos'
import { CierreForm } from '@/components/CierreForm'
import { enPlazo, fechaLarga } from '@/lib/format'
import type { Cierre } from '@/lib/types'

export default async function CierrePage({ params }: PageProps<'/cierres/[id]'>) {
  const { id } = await params
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound()

  const perfil = await getPerfil()
  const supabase = await createClient()
  const [catalogos, { data }] = await Promise.all([
    cargarCatalogos(supabase),
    supabase
      .from('cierres')
      .select('id, local_id, caja_id, turno_id, fecha, notas, eventos(nombre), ingresos:cierre_ingresos(metodo_id, importe), gastos(id, metodo, categoria_id, concepto, autorizado_id, importe, ticket_path, created_at)')
      .eq('id', id)
      .order('created_at', { referencedTable: 'gastos' })
      .maybeSingle(),
  ])
  if (!data) notFound()

  const cierre = data as unknown as Cierre & { eventos: { nombre: string } | null }
  cierre.evento = cierre.eventos?.nombre ?? null
  cierre.ingresos = cierre.ingresos.map((i) => ({ ...i, importe: Number(i.importe) }))
  cierre.gastos = cierre.gastos.map((g) => ({ ...g, importe: Number(g.importe) }))

  const editable = perfil.rol === 'admin' || (cierre.local_id === perfil.local_id && enPlazo(cierre.fecha))

  return (
    <div className="space-y-5">
      <div className="flex items-end justify-between gap-3">
        <div>
          <Link href={`/cierres?mes=${cierre.fecha.slice(0, 7)}`} className="text-sm text-muted hover:text-ink no-print">← Cierres</Link>
          <h1 className="text-xl font-semibold tracking-tight mt-1 first-letter:uppercase">Cierre del {fechaLarga(cierre.fecha)}</h1>
        </div>
        <div className="flex gap-2 no-print">
          <a href={`/imprimir/cierre/${cierre.id}?imprimir=1`} target="_blank" rel="noopener" className="btn">Imprimir</a>
          {perfil.rol === 'admin' && (
            <Link href={`/historial?cierre=${cierre.id}`} className="btn">Historial de cambios</Link>
          )}
        </div>
      </div>
      <CierreForm perfil={perfil} {...catalogos} cierre={cierre} editable={editable} />
    </div>
  )
}
