import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { getPerfil } from '@/lib/auth'
import { cargarCatalogos, cierresDelMes } from '@/lib/datos'
import { MesSelector } from '@/components/MesSelector'
import { enPlazo, esMesValido, euros, fechaLarga, mesActual, rangoMes } from '@/lib/format'

export default async function CierresPage({ searchParams }: PageProps<'/cierres'>) {
  const { mes: mesParam } = await searchParams
  const mes = typeof mesParam === 'string' && esMesValido(mesParam) ? mesParam : mesActual()
  const perfil = await getPerfil()
  const supabase = await createClient()
  const { desde, hasta } = rangoMes(mes)
  const [{ metodos, locales, cajas }, cierres] = await Promise.all([
    cargarCatalogos(supabase),
    cierresDelMes(supabase, desde, hasta),
  ])

  const metodosVisibles = metodos.filter((m) => m.activo || cierres.some((c) => c.ingresos[m.id]))
  const variosLocales = locales.length > 1
  // Con una sola caja no tiene sentido mostrarla.
  const variasCajas = cajas.filter((c) => c.activo).length > 1
  const nombreLocal = (id: string) => locales.find((l) => l.id === id)?.nombre ?? ''

  const totales = {
    porMetodo: Object.fromEntries(metodosVisibles.map((m) => [m.id, cierres.reduce((s, c) => s + (c.ingresos[m.id] ?? 0), 0)])),
    ingresos: cierres.reduce((s, c) => s + c.totalIngresos, 0),
    gastos: cierres.reduce((s, c) => s + c.totalGastos, 0),
  }

  return (
    <div className="space-y-5">
      <div className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <h1 className="text-xl font-semibold tracking-tight">Cierres de caja</h1>
          <Link href="/cierres/nuevo" className="btn btn-primario">Nuevo cierre</Link>
        </div>
        <MesSelector mes={mes} ruta="/cierres" />
      </div>

      {cierres.length === 0 ? (
        <div className="tarjeta p-10 text-center">
          <p className="font-medium">Sin cierres este mes</p>
          <p className="text-sm text-muted mt-1">Cuando hagas el primer cierre aparecerá aquí.</p>
        </div>
      ) : (
        <>
        {/* Móvil: lista */}
        <div className="md:hidden tarjeta divide-y divide-line">
          {cierres.map((c) => {
            const bloqueado = !(perfil.rol === 'admin' || enPlazo(c.fecha))
            const detalle = [
              ...metodosVisibles.filter((m) => c.ingresos[m.id]).map((m) => `${m.nombre} ${euros(c.ingresos[m.id])}`),
              ...(c.totalGastos ? [`Gastos −${euros(c.totalGastos)}`] : []),
            ]
            return (
              <Link key={c.id} href={`/cierres/${c.id}`} className="block px-4 py-3 active:bg-bg">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-medium first-letter:uppercase">{fechaLarga(c.fecha)}</p>
                    <p className="text-xs text-muted flex items-center gap-1.5">
                      <span>
                        {variosLocales && `${nombreLocal(c.local_id)} · `}{variasCajas && `${c.caja} · `}{c.turno}
                      </span>
                      {c.evento && <span className="text-accent truncate">· {c.evento}</span>}
                      {bloqueado && <span className="text-faint"><Candado /></span>}
                    </p>
                  </div>
                  <p className="num font-medium shrink-0">{euros(c.totalIngresos - c.totalGastos)}</p>
                </div>
                <p className="text-xs text-muted mt-1" style={{ fontVariantNumeric: 'tabular-nums' }}>{detalle.join(' · ')}</p>
              </Link>
            )
          })}
          <div className="px-4 py-3 bg-bg/60 rounded-b-[10px]">
            <div className="flex items-baseline justify-between gap-3 font-medium">
              <span>Total del mes</span>
              <span className="num">{euros(totales.ingresos - totales.gastos)}</span>
            </div>
            <p className="text-xs text-muted mt-1" style={{ fontVariantNumeric: 'tabular-nums' }}>
              {[
                ...metodosVisibles.filter((m) => totales.porMetodo[m.id]).map((m) => `${m.nombre} ${euros(totales.porMetodo[m.id])}`),
                `Gastos −${euros(totales.gastos)}`,
              ].join(' · ')}
            </p>
          </div>
        </div>

        {/* Escritorio: tabla */}
        <div className="hidden md:block tarjeta overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line text-left">
                <th className="etiqueta font-medium px-4 py-3">Fecha</th>
                <th className="etiqueta font-medium px-4 py-3">{variasCajas ? 'Caja · turno' : 'Turno'}</th>
                {metodosVisibles.map((m) => (
                  <th key={m.id} className="etiqueta font-medium px-4 py-3 text-right">{m.nombre}</th>
                ))}
                <th className="etiqueta font-medium px-4 py-3 text-right">Gastos</th>
                <th className="etiqueta font-medium px-4 py-3 text-right">Neto</th>
                <th className="w-8" />
              </tr>
            </thead>
            <tbody>
              {cierres.map((c) => (
                <tr key={c.id} className="border-b border-line last:border-0 hover:bg-bg">
                  <td className="px-4 py-2.5 whitespace-nowrap">
                    <Link href={`/cierres/${c.id}`} className="inline-block first-letter:uppercase hover:underline">{fechaLarga(c.fecha)}</Link>
                    {c.evento && <span className="block text-xs text-accent">{c.evento}</span>}
                  </td>
                  <td className="px-4 py-2.5 text-muted whitespace-nowrap">
                    {variosLocales && `${nombreLocal(c.local_id)} · `}{variasCajas && `${c.caja} · `}{c.turno}
                  </td>
                  {metodosVisibles.map((m) => (
                    <td key={m.id} className="num px-4 py-2.5">{c.ingresos[m.id] ? euros(c.ingresos[m.id]) : ''}</td>
                  ))}
                  <td className="num px-4 py-2.5 text-neg">{c.totalGastos ? `−${euros(c.totalGastos)}` : ''}</td>
                  <td className="num px-4 py-2.5 font-medium">{euros(c.totalIngresos - c.totalGastos)}</td>
                  <td className="px-2 text-faint" title={perfil.rol === 'admin' || enPlazo(c.fecha) ? 'Editable' : 'Cerrado'}>
                    {perfil.rol === 'admin' || enPlazo(c.fecha) ? '' : <Candado />}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-line-strong font-medium">
                <td className="px-4 py-3" colSpan={2}>Total del mes</td>
                {metodosVisibles.map((m) => (
                  <td key={m.id} className="num px-4 py-3">{euros(totales.porMetodo[m.id])}</td>
                ))}
                <td className="num px-4 py-3 text-neg">−{euros(totales.gastos)}</td>
                <td className="num px-4 py-3">{euros(totales.ingresos - totales.gastos)}</td>
                <td />
              </tr>
            </tfoot>
          </table>
        </div>
        </>
      )}
    </div>
  )
}

function Candado() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-label="Cerrado">
      <rect x="5" y="11" width="14" height="10" rx="2" />
      <path d="M8 11V7a4 4 0 0 1 8 0v4" />
    </svg>
  )
}
