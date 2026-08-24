export const ESTADOS_CIERRE = ['completada', 'cancelada']

export function normalizarTexto(valor) {
  return String(valor || '').trim().toLowerCase()
}

export function normalizarCorreo(valor) {
  return String(valor || '').trim().toLowerCase()
}

export function normalizarTelefono(valor) {
  const soloDigitos = String(valor || '').replace(/\D/g, '')

  if (!soloDigitos) {
    return ''
  }

  if (soloDigitos.length === 13 && soloDigitos.startsWith('521')) {
    return soloDigitos.slice(3)
  }

  if (soloDigitos.length === 12 && soloDigitos.startsWith('52')) {
    return soloDigitos.slice(2)
  }

  if (soloDigitos.length === 11 && soloDigitos.startsWith('1')) {
    return soloDigitos.slice(1)
  }

  return soloDigitos
}

export function esLlamadaVencida(estado, fechaProgramada) {
  if (!fechaProgramada || ESTADOS_CIERRE.includes(normalizarTexto(estado))) {
    return false
  }

  return new Date(fechaProgramada).getTime() < Date.now()
}

export function resolverEstadoLlamada(llamada) {
  if (!llamada) {
    return 'pendiente'
  }

  if (esLlamadaVencida(llamada.estado, llamada.fechaProgramada)) {
    return 'vencida'
  }

  return normalizarTexto(llamada.estado) || 'pendiente'
}

export function formatearFecha(fecha, opciones = {}) {
  if (!fecha) {
    return 'Sin definir'
  }

  return new Intl.DateTimeFormat('es-MX', {
    dateStyle: 'medium',
    timeStyle: opciones.incluirHora ? 'short' : undefined,
  }).format(new Date(fecha))
}

export function formatearHora(fecha) {
  if (!fecha) {
    return '--:--'
  }

  return new Intl.DateTimeFormat('es-MX', {
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(fecha))
}

export function formatearDuracion(minutos) {
  if (!minutos && minutos !== 0) {
    return 'Sin registro'
  }

  return `${minutos} min`
}

export function obtenerEtiquetaMercado(tipo) {
  if (!tipo) {
    return 'Mercado no definido'
  }

  return normalizarTexto(tipo) === 'internacional' ? '🌎 Internacional' : '🇲🇽 Nacional'
}

export function obtenerIniciales(nombre = '') {
  return nombre
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((parte) => parte[0])
    .join('')
    .toUpperCase()
}

export function construirFechaProgramada(fecha, hora) {
  if (!fecha) {
    throw new Error('Selecciona la fecha de la llamada.')
  }

  if (!hora) {
    throw new Error('Selecciona la hora de la llamada.')
  }

  const fechaProgramada = new Date(`${fecha}T${hora}:00`)

  if (Number.isNaN(fechaProgramada.getTime())) {
    throw new Error('La fecha u hora de la llamada no es válida.')
  }

  return fechaProgramada.toISOString()
}

export function crearEstadoCrmBase() {
  return {
    usuarioActual: {
      id: null,
      nombre: '',
      rol: '',
    },
    usuarios: [],
    prospectos: [],
    llamadas: [],
    historial: [],
  }
}

export function normalizarEstadoCrm(estado = {}) {
  const base = crearEstadoCrmBase()

  return {
    ...base,
    ...estado,
    usuarioActual: {
      ...base.usuarioActual,
      ...(estado.usuarioActual || {}),
    },
    usuarios: Array.isArray(estado.usuarios) ? estado.usuarios : base.usuarios,
    prospectos: Array.isArray(estado.prospectos) ? estado.prospectos : base.prospectos,
    llamadas: Array.isArray(estado.llamadas) ? estado.llamadas : base.llamadas,
    historial: Array.isArray(estado.historial) ? estado.historial : base.historial,
  }
}

export function esMismaFechaLocal(fechaIso, fechaComparacion = new Date()) {
  if (!fechaIso) {
    return false
  }

  const fecha = new Date(fechaIso)

  return (
    fecha.getFullYear() === fechaComparacion.getFullYear() &&
    fecha.getMonth() === fechaComparacion.getMonth() &&
    fecha.getDate() === fechaComparacion.getDate()
  )
}
