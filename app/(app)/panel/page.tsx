import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { requireAdmin } from '@/lib/auth'
import { cargarPanel } from '@/lib/resumen'
import { MesSelector } from '@/components/MesSelector'
import { MovimientosEditor } from '@/components/MovimientosEditor'
import { BotonImprimir } from '@/components/BotonImprimir'
import { esMesValido, euros, mesActual, nombreMes } from '@/lib/format'
import { TIPOS_MOVIMIENTO } from '@/lib/types'

export default async function PanelPage({ searchParams }: PageProps<'/panel'>) {
  await requireAdmin()
  const params = await searchParams
  const mes = typeof params.mes === 'string' && esMesValido(params.mes) ? params.mes : mesActual()
  const supabase = await createClient()

  const { data: locales } = await supabase.from('locales').select('id, nombre').order('created_at')
  const localId = (typeof params.local === 'string' && locales?.some((l) => l.id === params.local) ? params.local : locales?.[0]?.id) ?? ''

  const p = await cargarPanel(supabase, mes, localId)
  const gastosTotales = p.actual.gastosCaja + p.actual.movimientos
  const variacion = p.anterior.flujo !== 0 ? ((p.actual.flujo - p.anterior.flujo) / Math.abs(p.anterior.flujo)) * 100 : null
  const sufijo = locales && locales.length > 1 ? `&local=${localId}` : ''

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Resumen</h1>
          <p className="text-sm text-muted capitalize print:block">
            {nombreMes(mes)}
            {locales && locales.length > 1 && ` · ${locales.find((l) => l.id === localId)?.nombre}`}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 no-print">
          {locales && locales.length > 1 && (
            <div className="flex gap-1">
              {locales.map((l) => (
                <Link key={l.id} href={`/panel?mes=${mes}&local=${l.id}`} className={`btn h-9 ${l.id === localId ? 'bg-accent-soft text-accent border-accent' : ''}`}>
                  {l.nombre}
                </Link>
              ))}
            </div>
          )}
          <MesSelector mes={mes} ruta="/panel" />
          <a href={`/api/export?mes=${mes}${sufijo}`} className="btn">Excel</a>
          <BotonImprimir />
        </div>
      </div>

      {/* Cifras clave */}
      <section className="grid gap-3 grid-cols-2 lg:grid-cols-4">
        <Cifra etiqueta="Ingresos" valor={p.actual.ingresos} />
        <Cifra etiqueta="Gastos totales" valor={-gastosTotales} />
        <Cifra etiqueta="Flujo de caja" valor={p.actual.flujo} destacado />
        <div className="tarjeta px-4 py-3">
          <p className="text-xs text-muted">Vs. {nombreMes(p.anterior.mes).split(' ')[0]}</p>
          <p className={`num text-left text-xl font-medium ${variacion === null ? 'text-faint' : variacion >= 0 ? 'text-pos' : 'text-neg'}`}>
            {variacion === null ? '—' : `${variacion >= 0 ? '+' : ''}${variacion.toFixed(1).replace('.', ',')} %`}
          </p>
          <p className="text-xs text-faint">Flujo anterior: {euros(p.anterior.flujo)}</p>
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        {/* Ingresos */}
        <div className="tarjeta p-4 sm:p-5">
          <h2 className="etiqueta mb-2">Ingresos del mes</h2>
          <table className="w-full text-sm">
            <tbody>
              {p.ingresosPorMetodo.map((m) => (
                <tr key={m.id} className="border-b border-line">
                  <td className="py-2">{m.nombre}</td>
                  <td className="num py-2 text-muted text-xs w-16">{p.actual.ingresos ? `${Math.round((m.importe / p.actual.ingresos) * 100)} %` : ''}</td>
                  <td className="num py-2">{euros(m.importe)}</td>
                </tr>
              ))}
              <tr className="font-medium">
                <td className="py-2.5">Total</td>
                <td />
                <td className="num py-2.5">{euros(p.actual.ingresos)}</td>
              </tr>
            </tbody>
          </table>
          <p className="text-xs text-faint mt-2">{p.cierresMes.length} cierres registrados</p>
        </div>

        {/* Gastos */}
        <div className="tarjeta p-4 sm:p-5">
          <h2 className="etiqueta mb-2">Gastos del mes</h2>
          <table className="w-full text-sm">
            <tbody>
              <tr className="border-b border-line">
                <td className="py-2">Gastos de caja</td>
                <td className="num py-2">{euros(p.actual.gastosCaja)}</td>
              </tr>
              {p.movimientosPorTipo.map((m) => (
                <tr key={m.tipo} className="border-b border-line">
                  <td className="py-2">{TIPOS_MOVIMIENTO.find((t) => t.value === m.tipo)?.label}</td>
                  <td className="num py-2">{euros(m.importe)}</td>
                </tr>
              ))}
              <tr className="font-medium">
                <td className="py-2.5">Total</td>
                <td className="num py-2.5">{euros(gastosTotales)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      {/* Flujo */}
      <section className="tarjeta p-4 sm:p-5 flex items-baseline justify-between border-line-strong">
        <span className="font-medium">Flujo de caja de {nombreMes(mes)}</span>
        <span className={`num text-2xl font-medium ${p.actual.flujo < 0 ? 'text-neg' : 'text-pos'}`}>{euros(p.actual.flujo)}</span>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        {/* Gastos de caja por categoría */}
        <div className="tarjeta p-4 sm:p-5 overflow-x-auto">
          <h2 className="etiqueta mb-2">Gastos de caja por categoría</h2>
          {p.gastosPorCategoria.length === 0 ? (
            <p className="text-sm text-muted">Sin gastos de caja este mes.</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-line text-xs text-muted">
                  <th className="text-left font-normal py-1.5">Categoría</th>
                  <th className="text-right font-normal py-1.5">Efectivo</th>
                  <th className="text-right font-normal py-1.5">Tarjeta</th>
                  <th className="text-right font-normal py-1.5">Transf.</th>
                  <th className="text-right font-normal py-1.5">Total</th>
                </tr>
              </thead>
              <tbody>
                {p.gastosPorCategoria.map((c) => (
                  <tr key={c.nombre} className="border-b border-line last:border-0">
                    <td className="py-2">{c.nombre}</td>
                    <td className="num py-2 text-muted">{c.efectivo ? euros(c.efectivo) : '—'}</td>
                    <td className="num py-2 text-muted">{c.tarjeta ? euros(c.tarjeta) : '—'}</td>
                    <td className="num py-2 text-muted">{c.transferencia ? euros(c.transferencia) : '—'}</td>
                    <td className="num py-2 font-medium">{euros(c.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Apuntes de responsables */}
        <div className="tarjeta p-4 sm:p-5">
          <h2 className="etiqueta mb-3">Fijos, personal y mercancía</h2>
          <MovimientosEditor mes={mes} localId={localId} movimientos={p.movimientosMes} />
        </div>
      </section>

      {/* Por evento */}
      {p.eventosMes.length > 0 && (
        <section className="tarjeta p-4 sm:p-5 overflow-x-auto">
          <h2 className="etiqueta mb-2">Por evento</h2>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line text-xs text-muted">
                <th className="text-left font-normal py-1.5">Evento</th>
                <th className="text-right font-normal py-1.5">Cierres</th>
                <th className="text-right font-normal py-1.5">Ingresos</th>
                <th className="text-right font-normal py-1.5">Gastos</th>
                <th className="text-right font-normal py-1.5">Neto</th>
              </tr>
            </thead>
            <tbody>
              {p.eventosMes.map((e) => (
                <tr key={e.nombre} className="border-b border-line last:border-0">
                  <td className="py-2">{e.nombre}</td>
                  <td className="num py-2 text-muted">{e.cierres}</td>
                  <td className="num py-2">{euros(e.ingresos)}</td>
                  <td className="num py-2 text-muted">{euros(e.gastos)}</td>
                  <td className="num py-2 font-medium">{euros(e.neto)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      {/* Comparativa */}
      <section className="tarjeta p-4 sm:p-5 overflow-x-auto">
        <h2 className="etiqueta mb-2">Últimos 6 meses</h2>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-line text-xs text-muted">
              <th className="text-left font-normal py-1.5">Mes</th>
              <th className="text-right font-normal py-1.5">Ingresos</th>
              <th className="text-right font-normal py-1.5">Gastos caja</th>
              <th className="text-right font-normal py-1.5">Fijos, personal…</th>
              <th className="text-right font-normal py-1.5">Flujo</th>
            </tr>
          </thead>
          <tbody>
            {p.historico.map((h) => (
              <tr key={h.mes} className={`border-b border-line last:border-0 ${h.mes === mes ? 'font-medium' : ''}`}>
                <td className="py-2 capitalize">
                  <Link href={`/panel?mes=${h.mes}${sufijo}`} className="hover:underline">{nombreMes(h.mes)}</Link>
                </td>
                <td className="num py-2">{euros(h.ingresos)}</td>
                <td className="num py-2 text-muted">{euros(h.gastosCaja)}</td>
                <td className="num py-2 text-muted">{euros(h.movimientos)}</td>
                <td className={`num py-2 ${h.flujo < 0 ? 'text-neg' : ''}`}>{euros(h.flujo)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  )
}

function Cifra({ etiqueta, valor, destacado }: { etiqueta: string; valor: number; destacado?: boolean }) {
  return (
    <div className={`rounded-[10px] px-4 py-3 ${destacado ? 'bg-accent-soft' : 'tarjeta'}`}>
      <p className="text-xs text-muted">{etiqueta}</p>
      <p className={`num text-left text-xl font-medium ${valor < 0 ? 'text-neg' : destacado ? 'text-accent' : ''}`}>{euros(valor)}</p>
    </div>
  )
}
