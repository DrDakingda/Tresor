export type Rol = 'encargado' | 'admin'
export type MetodoPago = 'efectivo' | 'tarjeta' | 'transferencia'
export type TipoMovimiento = 'fijo' | 'personal' | 'mercancia' | 'otro'

export type Perfil = { id: string; nombre: string; rol: Rol; local_id: string | null; activo: boolean }
export type Local = { id: string; nombre: string; activo: boolean }
export type Caja = { id: string; local_id: string; nombre: string; orden: number; activo: boolean }
export type Turno = { id: string; nombre: string; orden: number; activo: boolean }
export type MetodoIngreso = { id: string; nombre: string; es_efectivo: boolean; orden: number; activo: boolean }
export type Categoria = { id: string; nombre: string; activo: boolean }
export type Autorizador = { id: string; nombre: string; activo: boolean }
export type Evento = { id: string; nombre: string; activo: boolean }

export type Gasto = {
  id?: string
  metodo: MetodoPago
  categoria_id: string
  concepto: string
  autorizado_id: string
  importe: number
  ticket_path: string | null
}

export type Cierre = {
  id: string
  local_id: string
  caja_id: string
  turno_id: string
  fecha: string
  evento: string | null
  notas: string | null
  ingresos: { metodo_id: string; importe: number }[]
  gastos: Gasto[]
}

export type MovimientoMes = {
  id: string
  local_id: string
  mes: string
  tipo: TipoMovimiento
  concepto: string
  importe: number
}

export const METODOS_PAGO: { value: MetodoPago; label: string }[] = [
  { value: 'efectivo', label: 'Efectivo' },
  { value: 'tarjeta', label: 'Tarjeta' },
  { value: 'transferencia', label: 'Transferencia' },
]

export const TIPOS_MOVIMIENTO: { value: TipoMovimiento; label: string }[] = [
  { value: 'fijo', label: 'Gastos fijos' },
  { value: 'personal', label: 'Personal' },
  { value: 'mercancia', label: 'Mercancía' },
  { value: 'otro', label: 'Otros' },
]
