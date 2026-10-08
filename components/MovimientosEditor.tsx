'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { desplazarMes, euros, parseImporte } from '@/lib/format'
import { TIPOS_MOVIMIENTO } from '@/lib/types'
import type { MovimientoMes, TipoMovimiento } from '@/lib/types'

export function MovimientosEditor({ mes, localId, movimientos }: { mes: string; localId: string; movimientos: MovimientoMes[] }) {
  const router = useRouter()
  const supabase = useMemo(() => createClient(), [])
  const [tipo, setTipo] = useState<TipoMovimiento>('fijo')
  const [concepto, setConcepto] = useState('')
  const [importe, setImporte] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [ocupado, setOcupado] = useState(false)

  async function anadir(e: React.FormEvent) {
    e.preventDefault()
    const n = parseImporte(importe)
    if (!concepto.trim()) return setError('Escribe el concepto.')
    if (!(n > 0)) return setError('El importe no es válido.')
    setOcupado(true)
    setError(null)
    const { error } = await supabase.from('movimientos_mes').insert({ local_id: localId, mes: `${mes}-01`, tipo, concepto: concepto.trim(), importe: n })
    setOcupado(false)
    if (error) return setError('No se ha podido guardar el apunte.')
    setConcepto('')
    setImporte('')
    router.refresh()
  }

  async function borrar(id: string) {
    if (!window.confirm('¿Borrar este apunte?')) return
    const { error } = await supabase.from('movimientos_mes').delete().eq('id', id)
    if (error) return setError('No se ha podido borrar el apunte.')
    router.refresh()
  }

  async function copiarMesAnterior() {
    setOcupado(true)
    setError(null)
    const { data, error } = await supabase
      .from('movimientos_mes')
      .select('tipo, concepto, importe')
      .eq('local_id', localId)
      .eq('mes', `${desplazarMes(mes, -1)}-01`)
      .in('tipo', ['fijo', 'personal'])
    if (error || !data?.length) {
      setOcupado(false)
      return setError('El mes anterior no tiene gastos fijos ni de personal que copiar.')
    }
    const { error: e2 } = await supabase
      .from('movimientos_mes')
      .insert(data.map((m) => ({ ...m, local_id: localId, mes: `${mes}-01` })))
    setOcupado(false)
    if (e2) return setError('No se han podido copiar los apuntes.')
    router.refresh()
  }

  const sinFijos = !movimientos.some((m) => m.tipo === 'fijo' || m.tipo === 'personal')

  return (
    <div className="space-y-4">
      {TIPOS_MOVIMIENTO.map(({ value, label }) => {
        const filas = movimientos.filter((m) => m.tipo === value)
        if (!filas.length) return null
        return (
          <div key={value}>
            <p className="etiqueta mb-1">{label}</p>
            <table className="w-full text-sm">
              <tbody>
                {filas.map((m) => (
                  <tr key={m.id} className="border-b border-line">
                    <td className="py-2">{m.concepto}</td>
                    <td className="num py-2">{euros(m.importe)}</td>
                    <td className="w-8 text-right no-print">
                      <button onClick={() => borrar(m.id)} className="text-faint hover:text-neg px-1" aria-label={`Borrar ${m.concepto}`}>×</button>
                    </td>
                  </tr>
                ))}
                <tr className="font-medium">
                  <td className="py-2 text-muted">Total {label.toLowerCase()}</td>
                  <td className="num py-2">{euros(filas.reduce((s, m) => s + m.importe, 0))}</td>
                  <td />
                </tr>
              </tbody>
            </table>
          </div>
        )
      })}

      {movimientos.length === 0 && <p className="text-sm text-muted">Sin apuntes este mes.</p>}

      <form onSubmit={anadir} className="no-print grid gap-2 grid-cols-2 items-end pt-3 border-t border-line">
        <label className="space-y-1">
          <span className="etiqueta">Tipo</span>
          <select className="campo" value={tipo} onChange={(e) => setTipo(e.target.value as TipoMovimiento)}>
            {TIPOS_MOVIMIENTO.map((t) => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>
        </label>
        <label className="space-y-1">
          <span className="etiqueta">Importe</span>
          <input className="campo num" inputMode="decimal" placeholder="0,00" value={importe} onChange={(e) => setImporte(e.target.value)} />
        </label>
        <label className="space-y-1 col-span-2">
          <span className="etiqueta">Concepto</span>
          <input className="campo" placeholder="Alquiler, nóminas, pedido Mahou…" value={concepto} onChange={(e) => setConcepto(e.target.value)} />
        </label>
        <div className="col-span-2 flex justify-end">
          <button className="btn btn-primario" disabled={ocupado}>Añadir</button>
        </div>
      </form>

      {sinFijos && (
        <button type="button" onClick={copiarMesAnterior} disabled={ocupado} className="no-print text-sm text-accent hover:underline">
          Copiar gastos fijos y personal del mes anterior
        </button>
      )}

      {error && <p className="text-sm text-neg">{error}</p>}
    </div>
  )
}
