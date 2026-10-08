import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { requireAdmin } from '@/lib/auth'
import { euros, fechaLarga } from '@/lib/format'
import { diferencias, fechaHora, totales, type Snapshot } from '@/lib/historial'

type Entrada = {
  id: number
  cierre_id: string
  local_id: string
  usuario_nombre: string | null
  accion: 'creado' | 'modificado' | 'borrado'
  datos: Snapshot
  created_at: string
}

const ESTILO_ACCION = {
  creado: 'bg-accent-soft text-accent',
  modificado: 'bg-warn-soft text-warn',
  borrado: 'bg-neg-soft text-neg',
}

export default async function HistorialPage({ searchParams }: PageProps<'/historial'>) {
  await requireAdmin()
  const params = await searchParams
  const cierreId = typeof params.cierre === 'string' && /^[0-9a-f-]{36}$/i.test(params.cierre) ? params.cierre : null
  const soloCambios = params.ver !== 'todo' && !cierreId
  const supabase = await createClient()

  let q = supabase.from('historial_cierres').select('*').order('created_at', { ascending: false }).order('id', { ascending: false })
  if (cierreId) q = q.eq('cierre_id', cierreId)
  else {
    if (soloCambios) q = q.neq('accion', 'creado')
    q = q.limit(100)
  }

  const [{ data }, { data: locales }, { count: numCajas }] = await Promise.all([
    q,
    supabase.from('locales').select('id, nombre'),
    supabase.from('cajas').select('id', { count: 'exact', head: true }).eq('activo', true),
  ])
  const variasCajas = (numCajas ?? 0) > 1
  const entradas = (data ?? []) as Entrada[]

  // Versiones anteriores de los cierres mostrados, para poder comparar.
  const ids = [...new Set(entradas.map((e) => e.cierre_id))]
  const { data: todas } = ids.length
    ? await supabase.from('historial_cierres').select('id, cierre_id, datos, created_at').in('cierre_id', ids).order('created_at').order('id')
    : { data: [] }
  const versiones = new Map<string, { id: number; datos: Snapshot }[]>()
  for (const v of (todas ?? []) as { id: number; cierre_id: string; datos: Snapshot }[]) {
    versiones.set(v.cierre_id, [...(versiones.get(v.cierre_id) ?? []), v])
  }
  const anterior = (e: Entrada) => {
    const lista = versiones.get(e.cierre_id) ?? []
    const i = lista.findIndex((v) => v.id === e.id)
    return i > 0 ? lista[i - 1].datos : null
  }
  const variosLocales = (locales?.length ?? 0) > 1
  const nombreLocal = (id: string) => locales?.find((l) => l.id === id)?.nombre ?? ''
  const titulo = entradas[0]?.datos

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          {cierreId && (
            <Link href={`/cierres/${cierreId}`} className="text-sm text-muted hover:text-ink">← Volver al cierre</Link>
          )}
          <h1 className="text-xl font-semibold tracking-tight mt-1">
            {cierreId && titulo ? <span className="first-letter:uppercase inline-block">Historial · {fechaLarga(titulo.fecha)}</span> : 'Historial de cambios'}
          </h1>
          {cierreId && titulo && <p className="text-sm text-muted">{variasCajas && `${titulo.caja} · `}{titulo.turno}{titulo.evento ? ` · ${titulo.evento}` : ''}</p>}
        </div>
        {!cierreId && (
          <div className="flex gap-1 text-sm">
            <Link href="/historial" className={`btn h-9 ${soloCambios ? 'bg-accent-soft text-accent border-accent' : ''}`}>Modificaciones y borrados</Link>
            <Link href="/historial?ver=todo" className={`btn h-9 ${!soloCambios ? 'bg-accent-soft text-accent border-accent' : ''}`}>Todo</Link>
          </div>
        )}
      </div>

      {entradas.length === 0 ? (
        <div className="tarjeta p-10 text-center">
          <p className="font-medium">Sin cambios registrados</p>
          <p className="text-sm text-muted mt-1">Aquí aparecerá cada vez que alguien modifique o borre un cierre.</p>
        </div>
      ) : (
        <ol className="space-y-3">
          {entradas.map((e) => {
            const previo = anterior(e)
            const cambios = e.accion === 'modificado' && previo ? diferencias(previo, e.datos) : []
            const t = totales(e.datos)
            return (
              <li key={e.id} className="tarjeta p-4">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
                  <span className={`text-xs font-medium px-2 py-0.5 rounded ${ESTILO_ACCION[e.accion]}`}>
                    {e.accion === 'creado' ? 'Creado' : e.accion === 'modificado' ? 'Modificado' : 'Borrado'}
                  </span>
                  <span className="font-medium">{e.usuario_nombre ?? 'Desconocido'}</span>
                  <span className="text-muted num">{fechaHora(e.created_at)}</span>
                  {!cierreId && (
                    <span className="text-muted">
                      · cierre del{' '}
                      {e.accion === 'borrado' ? (
                        fechaLarga(e.datos.fecha)
                      ) : (
                        <Link href={`/historial?cierre=${e.cierre_id}`} className="underline hover:text-ink">{fechaLarga(e.datos.fecha)}</Link>
                      )}
                      {' '}· {variosLocales && `${nombreLocal(e.local_id)} · `}{variasCajas && `${e.datos.caja} · `}{e.datos.turno}
                    </span>
                  )}
                </div>

                {e.accion === 'modificado' && (
                  cambios.length ? (
                    <table className="w-full text-sm mt-3">
                      <tbody>
                        {cambios.map((c, i) => (
                          <tr key={i} className="border-t border-line align-top">
                            <td className="py-1.5 pr-3 text-muted w-1/3">{c.texto}</td>
                            <td className="py-1.5 pr-3 text-neg line-through decoration-1">{c.antes}</td>
                            <td className="py-1.5 text-pos">{c.despues}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  ) : (
                    <p className="text-sm text-muted mt-2">Sin versión anterior con la que comparar.</p>
                  )
                )}

                {e.accion !== 'modificado' && (
                  <p className="text-sm text-muted mt-2">
                    Ingresos <span className="num text-ink">{euros(t.ingresos)} €</span> · {e.datos.gastos.length} gastos por{' '}
                    <span className="num text-ink">{euros(t.gastos)} €</span>
                    {e.datos.evento && ` · ${e.datos.evento}`}
                  </p>
                )}
              </li>
            )
          })}
        </ol>
      )}
    </div>
  )
}
