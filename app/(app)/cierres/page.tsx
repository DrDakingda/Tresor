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
  const [{ metodos, locales }, cierres] = await Promise.all([
    cargarCatalogos(supabase),
    cierresDelMes(supabase, desde, hasta),
  ])

  const metodosVisibles = metodos.filter((m) => m.activo || cierres.some((c) => c.ingresos[m.id]))
  const variosLocales = locales.length > 1
  const nombreLocal = (id: string) => locales.find((l) => l.id === id)?.nombre ?? ''

  const totales = {
    porMetodo: Object.fromEntries(metodosVisibles.map((m) => [m.id, cierres.reduce((s, c) => s + (c.ingresos[m.id] ?? 0), 0)])),
    ingresos: cierres.reduce((s, c) => s + c.totalIngresos, 0),
    gastos: cierres.reduce((s, c) => s + c.totalGastos, 0),
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold tracking-tight">Cierres de caja</h1>
        <div className="flex items-center gap-3">
          <MesSelector mes={mes} ruta="/cierres" />
          <Link href="/cierres/nuevo" className="btn btn-primario">Nuevo cierre</Link>
        </div>
      </div>

      {cierres.length === 0 ? (
        <div className="tarjeta p-10 text-center">
          <p className="font-medium">Sin cierres este mes</p>
          <p className="text-sm text-muted mt-1">Cuando hagas el primer cierre aparecerá aquí.</p>
        </div>
      ) : (
        <div className="tarjeta overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line text-left">
                <th className="etiqueta font-medium px-4 py-3">Fecha</th>
                <th className="etiqueta font-medium px-4 py-3">Caja · turno</th>
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
                    <Link href={`/cierres/${c.id}`} className="capitalize hover:underline">{fechaLarga(c.fecha)}</Link>
                    {c.evento && <span className="block text-xs text-accent">{c.evento}</span>}
                  </td>
                  <td className="px-4 py-2.5 text-muted whitespace-nowrap">
                    {variosLocales && `${nombreLocal(c.local_id)} · `}{c.caja} · {c.turno}
                  </td>
                  {metodosVisibles.map((m) => (
                    <td key={m.id} className="num px-4 py-2.5">{c.ingresos[m.id] ? euros(c.ingresos[m.id]) : '—'}</td>
                  ))}
                  <td className="num px-4 py-2.5 text-neg">{c.totalGastos ? `−${euros(c.totalGastos)}` : '—'}</td>
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
