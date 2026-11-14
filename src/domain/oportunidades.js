// Contrato propuesto; no crea tablas ni se conecta al backend.
export const SERVICIOS = Object.freeze(['aeronaves', 'motores', 'refacciones', 'vuelos'])
export const ESTADOS_OPORTUNIDAD = Object.freeze(['abierta', 'ganada', 'perdida'])
export function validarOportunidad(oportunidad, etapas = [], { modoSupabase = false } = {}) {
  const errores = {}
  const campos = ['clienteId','responsableId','embudoId','etapaId','moneda','prioridad']
  if (!modoSupabase) campos.push('servicio','estado')
  for (const campo of campos) {
    if (typeof oportunidad[campo] !== 'string' || !oportunidad[campo].trim()) errores[campo] = 'Obligatorio'
  }
  if (!modoSupabase && !SERVICIOS.includes(oportunidad.servicio)) errores.servicio = 'Servicio invalido'
  if (!modoSupabase && !ESTADOS_OPORTUNIDAD.includes(oportunidad.estado)) errores.estado = 'Estado invalido'
  if (!['alta', 'media', 'baja'].includes(oportunidad.prioridad)) errores.prioridad = 'Prioridad invalida'
  if (!/^[A-Z]{3}$/.test(oportunidad.moneda || '')) errores.moneda = 'Usa codigo monetario de tres letras'
  // Decimal como texto: evitar operaciones monetarias binarias en este contrato.
  if (typeof oportunidad.valorEstimado !== 'string' || !(modoSupabase ? /^\d+(\.\d+)?$/ : /^\d{1,16}(\.\d{1,2})?$/).test(oportunidad.valorEstimado)) {
    errores.valorEstimado = modoSupabase ? 'Importe decimal no negativo requerido' : 'Importe no negativo con hasta dos decimales'
  }
  const etapa = etapas.find(e => e.id === oportunidad.etapaId && e.embudoId === oportunidad.embudoId)
  if (!etapa || (!modoSupabase && etapa.estado !== oportunidad.estado)) errores.etapaId = 'Etapa incompatible con embudo o estado'
  if (!modoSupabase && oportunidad.estado === 'abierta' && !oportunidad.proximoSeguimiento) errores.proximoSeguimiento = 'Obligatorio para abiertas'
  if (oportunidad.proximoSeguimiento && (
    !/T.*(?:Z|[+-]\d{2}:\d{2})$/.test(oportunidad.proximoSeguimiento) ||
    !Number.isFinite(Date.parse(oportunidad.proximoSeguimiento)))) errores.proximoSeguimiento = 'Fecha con zona horaria requerida'
  if (!modoSupabase && oportunidad.estado === 'perdida' && !oportunidad.motivoPerdida?.trim()) errores.motivoPerdida = 'Indica el motivo'
  return errores
}
