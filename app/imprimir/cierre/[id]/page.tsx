import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getPerfil } from '@/lib/auth'
import { BarraImpresion } from '@/components/BarraImpresion'
import { euros, fechaLarga } from '@/lib/format'
import { fechaHora } from '@/lib/historial'
import { METODOS_PAGO } from '@/lib/types'

type Datos = {
  id: string
  fecha: string
  notas: string | null
  updated_at: string
  locales: { nombre: string } | null
  cajas: { nombre: string } | null
  turnos: { nombre: string } | null
  eventos: { nombre: string } | null
  perfiles: { nombre: string } | null
  cierre_ingresos: { importe: number; metodos_ingreso: { nombre: string; orden: number; es_efectivo: boolean } | null }[]
  gastos: {
    metodo: string
    concepto: string
    importe: number
    ticket_path: string | null
    categorias_gasto: { nombre: string } | null
    autorizadores: { nombre: string } | null
  }[]
}

export default async function ImprimirCierrePage({ params, searchParams }: PageProps<'/imprimir/cierre/[id]'>) {
  const { id } = await params
  const { imprimir } = await searchParams
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound()
  await getPerfil()
  const supabase = await createClient()
  const { data } = await supabase
    .from('cierres')
    .select(
      'id, fecha, notas, updated_at, locales(nombre), cajas(nombre), turnos(nombre), eventos(nombre), perfiles(nombre), cierre_ingresos(importe, metodos_ingreso(nombre, orden, es_efectivo)), gastos(metodo, concepto, importe, ticket_path, categorias_gasto(nombre), autorizadores(nombre))'
    )
    .eq('id', id)
    .order('created_at', { referencedTable: 'gastos' })
    .maybeSingle()
  if (!data) notFound()
  const c = data as unknown as Datos

  const ingresos = c.cierre_ingresos
    .map((i) => ({ ...i, importe: Number(i.importe) }))
    .sort((a, b) => (a.metodos_ingreso?.orden ?? 0) - (b.metodos_ingreso?.orden ?? 0))
  const gastos = c.gastos.map((g) => ({ ...g, importe: Number(g.importe) }))
  const totalIngresos = ingresos.reduce((s, i) => s + i.importe, 0)
  const totalGastos = gastos.reduce((s, g) => s + g.importe, 0)
  const efectivo = ingresos.filter((i) => i.metodos_ingreso?.es_efectivo).reduce((s, i) => s + i.importe, 0)
  const gastosEfectivo = gastos.filter((g) => g.metodo === 'efectivo').reduce((s, g) => s + g.importe, 0)

  return (
    <>
      <BarraImpresion volver={`/cierres/${c.id}`} autoImprimir={imprimir === '1'} />
      <article className="hoja">
        <header className="flex items-start justify-between border-b-2 border-ink pb-3">
          <div>
            <p className="text-xs text-muted uppercase tracking-wider">Cierre de caja</p>
            <h1 className="text-2xl font-semibold tracking-tight first-letter:uppercase">{fechaLarga(c.fecha)} {c.fecha.slice(0, 4)}</h1>
            <p className="text-sm text-muted">
              {c.locales?.nombre} · {c.cajas?.nombre} · {c.turnos?.nombre}
              {c.eventos && ` · ${c.eventos.nombre}`}
            </p>
          </div>
          <div className="text-right text-xs text-muted">
            <p className="font-semibold text-ink text-sm">Tresor</p>
            <p>Cerrado por {c.perfiles?.nombre ?? '—'}</p>
            <p>Última modificación {fechaHora(c.updated_at)}</p>
          </div>
        </header>

        <h2>Ingresos</h2>
        <table>
          <tbody>
            {ingresos.map((i, n) => (
              <tr key={n}>
                <td>{i.metodos_ingreso?.nombre}</td>
                <td className="num">{euros(i.importe)}</td>
              </tr>
            ))}
            {ingresos.length === 0 && (
              <tr>
                <td className="text-muted">Sin ingresos</td>
                <td />
              </tr>
            )}
          </tbody>
          <tfoot>
            <tr>
              <td>Total ingresos</td>
              <td className="num">{euros(totalIngresos)}</td>
            </tr>
          </tfoot>
        </table>

        <h2>Gastos</h2>
        {gastos.length === 0 ? (
          <p className="text-sm text-muted">Sin gastos.</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Método</th>
                <th>Categoría</th>
                <th>Concepto</th>
                <th>Autoriza</th>
                <th>Ticket</th>
                <th className="num">Importe</th>
              </tr>
            </thead>
            <tbody>
              {gastos.map((g, n) => (
                <tr key={n}>
                  <td>{METODOS_PAGO.find((m) => m.value === g.metodo)?.label}</td>
                  <td>{g.categorias_gasto?.nombre}</td>
                  <td>{g.concepto || '—'}</td>
                  <td>{g.autorizadores?.nombre}</td>
                  <td>{g.ticket_path ? 'Sí' : 'No'}</td>
                  <td className="num">{euros(g.importe)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={5}>Total gastos</td>
                <td className="num">{euros(totalGastos)}</td>
              </tr>
            </tfoot>
          </table>
        )}

        <section className="grid grid-cols-3 gap-3 mt-6 bloque">
          <Cifra etiqueta="Efectivo neto" valor={efectivo - gastosEfectivo} ayuda="Efectivo − gastos en efectivo" />
          <Cifra etiqueta="Total gastos" valor={totalGastos} />
          <Cifra etiqueta="Resultado del cierre" valor={totalIngresos - totalGastos} destacado />
        </section>

        {c.notas && (
          <>
            <h2>Notas</h2>
            <p className="text-sm whitespace-pre-wrap">{c.notas}</p>
          </>
        )}

        <section className="grid grid-cols-2 gap-10 mt-16 bloque text-xs text-muted">
          <div className="border-t border-ink pt-1.5">Firma del encargado</div>
          <div className="border-t border-ink pt-1.5">Firma del responsable</div>
        </section>
      </article>
    </>
  )
}

function Cifra({ etiqueta, valor, ayuda, destacado }: { etiqueta: string; valor: number; ayuda?: string; destacado?: boolean }) {
  return (
    <div className={`rounded-md px-3 py-2.5 ${destacado ? 'bg-accent-soft' : 'border border-line'}`}>
      <p className="text-[11px] text-muted">{etiqueta}</p>
      <p className={`num text-left text-lg font-semibold ${valor < 0 ? 'text-neg' : destacado ? 'text-accent' : ''}`}>{euros(valor)} €</p>
      {ayuda && <p className="text-[10px] text-faint">{ayuda}</p>}
    </div>
  )
}
