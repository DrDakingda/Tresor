import { createClient } from '@/lib/supabase/server'
import { requireAdmin } from '@/lib/auth'
import { cargarInforme } from '@/lib/informe'
import { BarraImpresion } from '@/components/BarraImpresion'
import { esMesValido, euros, fechaCorta, mesActual, nombreMes } from '@/lib/format'
import { fechaHora } from '@/lib/historial'

export default async function InformePage({ searchParams }: PageProps<'/informe'>) {
  await requireAdmin()
  const params = await searchParams
  const mes = typeof params.mes === 'string' && esMesValido(params.mes) ? params.mes : mesActual()
  const supabase = await createClient()
  const { data: locales } = await supabase.from('locales').select('id, nombre').order('created_at')
  const local = locales?.find((l) => l.id === params.local) ?? locales?.[0]
  if (!local) return null

  const p = await cargarInforme(supabase, mes, local.id)
  const gastosTotales = p.actual.gastosCaja + p.actual.movimientos
  const variacion = p.anterior.flujo !== 0 ? ((p.actual.flujo - p.anterior.flujo) / Math.abs(p.anterior.flujo)) * 100 : null
  const metodos = p.ingresosPorMetodo

  return (
    <>
      <BarraImpresion volver={`/panel?mes=${mes}${locales && locales.length > 1 ? `&local=${local.id}` : ''}`} />
      <article className="hoja">
        <header className="flex items-start justify-between border-b-2 border-ink pb-3">
          <div>
            <p className="text-xs text-muted uppercase tracking-wider">Informe mensual</p>
            <h1 className="text-2xl font-semibold tracking-tight capitalize">{nombreMes(mes)}</h1>
            <p className="text-sm text-muted">{local.nombre}</p>
          </div>
          <div className="text-right text-xs text-muted">
            <p className="font-semibold text-ink text-sm">Tresor</p>
            <p>Generado el {fechaHora(new Date().toISOString())}</p>
            <p>{p.cierresMes.length} cierres</p>
          </div>
        </header>

        <section className="grid grid-cols-4 gap-3 mt-5 bloque">
          <Cifra etiqueta="Ingresos" valor={euros(p.actual.ingresos)} />
          <Cifra etiqueta="Gastos totales" valor={euros(gastosTotales)} />
          <Cifra etiqueta="Flujo de caja" valor={euros(p.actual.flujo)} destacado negativo={p.actual.flujo < 0} />
          <Cifra
            etiqueta={`Vs. ${nombreMes(p.anterior.mes).split(' ')[0]}`}
            valor={variacion === null ? '—' : `${variacion >= 0 ? '+' : ''}${variacion.toFixed(1).replace('.', ',')} %`}
            negativo={variacion !== null && variacion < 0}
          />
        </section>

        <div className="bloque">
          <h2>Ingresos por día</h2>
          <div className="grafico" dangerouslySetInnerHTML={{ __html: p.graficos.diario }} />
        </div>

        <div className="bloque">
          <h2>Ingresos por forma de cobro</h2>
          <div className="grafico" dangerouslySetInnerHTML={{ __html: p.graficos.reparto }} />
          <table className="mt-2">
            <tbody>
              {metodos.map((m) => (
                <tr key={m.id}>
                  <td>{m.nombre}</td>
                  <td className="num text-muted">{p.actual.ingresos ? `${Math.round((m.importe / p.actual.ingresos) * 100)} %` : ''}</td>
                  <td className="num">{euros(m.importe)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td>Total ingresos</td>
                <td />
                <td className="num">{euros(p.actual.ingresos)}</td>
              </tr>
            </tfoot>
          </table>
        </div>

        <div className="bloque">
          <h2>Gastos por partida</h2>
          {p.graficos.partidas ? (
            <div className="grafico" dangerouslySetInnerHTML={{ __html: p.graficos.partidas }} />
          ) : (
            <p className="text-sm text-muted">Sin gastos este mes.</p>
          )}
          <table className="mt-2">
            <tbody>
              <tr>
                <td>Gastos de caja</td>
                <td className="num">{euros(p.actual.gastosCaja)}</td>
              </tr>
              {p.movimientosPorTipo.map((m) => (
                <tr key={m.tipo}>
                  <td>{{ fijo: 'Gastos fijos', personal: 'Personal', mercancia: 'Mercancía', otro: 'Otros' }[m.tipo]}</td>
                  <td className="num">{euros(m.importe)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td>Total gastos</td>
                <td className="num">{euros(gastosTotales)}</td>
              </tr>
            </tfoot>
          </table>
        </div>

        <section className="bloque mt-6 flex items-baseline justify-between border-y-2 border-ink py-3">
          <span className="font-semibold">Flujo de caja del mes</span>
          <span className={`num text-2xl font-semibold ${p.actual.flujo < 0 ? 'text-neg' : ''}`}>{euros(p.actual.flujo)} €</span>
        </section>

        {p.eventosMes.length > 0 && (
          <div className="bloque">
            <h2>Por evento</h2>
            <table>
              <thead>
                <tr>
                  <th>Evento</th>
                  <th className="num">Cierres</th>
                  <th className="num">Ingresos</th>
                  <th className="num">Gastos</th>
                  <th className="num">Neto</th>
                </tr>
              </thead>
              <tbody>
                {p.eventosMes.map((e) => (
                  <tr key={e.nombre}>
                    <td>{e.nombre}</td>
                    <td className="num">{e.cierres}</td>
                    <td className="num">{euros(e.ingresos)}</td>
                    <td className="num">{euros(e.gastos)}</td>
                    <td className="num">{euros(e.neto)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="bloque">
          <h2>Últimos 6 meses</h2>
          <div className="grafico" dangerouslySetInnerHTML={{ __html: p.graficos.meses }} />
          <table className="mt-2">
            <thead>
              <tr>
                <th>Mes</th>
                <th className="num">Ingresos</th>
                <th className="num">Gastos</th>
                <th className="num">Flujo</th>
              </tr>
            </thead>
            <tbody>
              {[...p.historico].reverse().map((h) => (
                <tr key={h.mes} className={h.mes === mes ? 'font-semibold' : ''}>
                  <td className="capitalize">{nombreMes(h.mes)}</td>
                  <td className="num">{euros(h.ingresos)}</td>
                  <td className="num">{euros(h.gastosCaja + h.movimientos)}</td>
                  <td className={`num ${h.flujo < 0 ? 'text-neg' : ''}`}>{euros(h.flujo)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {p.cierresMes.length > 0 && (
          <div className="salto">
            <h2>Detalle de cierres</h2>
            <table>
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Turno</th>
                  <th>Evento</th>
                  {metodos.map((m) => (
                    <th key={m.id} className="num">{m.nombre}</th>
                  ))}
                  <th className="num">Gastos</th>
                  <th className="num">Neto</th>
                </tr>
              </thead>
              <tbody>
                {[...p.cierresMes].reverse().map((c) => (
                  <tr key={c.id}>
                    <td className="num text-left!">{fechaCorta(c.fecha)}</td>
                    <td>{c.turno}</td>
                    <td className="text-muted">{c.evento ?? ''}</td>
                    {metodos.map((m) => (
                      <td key={m.id} className="num">{c.ingresos[m.id] ? euros(c.ingresos[m.id]) : '—'}</td>
                    ))}
                    <td className="num">{c.totalGastos ? euros(c.totalGastos) : '—'}</td>
                    <td className="num">{euros(c.totalIngresos - c.totalGastos)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </article>
    </>
  )
}

function Cifra({ etiqueta, valor, destacado, negativo }: { etiqueta: string; valor: string; destacado?: boolean; negativo?: boolean }) {
  return (
    <div className={`rounded-md px-3 py-2.5 ${destacado ? 'bg-accent-soft' : 'border border-line'}`}>
      <p className="text-[11px] text-muted">{etiqueta}</p>
      <p className={`num text-left text-lg font-semibold ${negativo ? 'text-neg' : destacado ? 'text-accent' : ''}`}>{valor}</p>
    </div>
  )
}
