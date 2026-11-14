export const tablasCotizaciones = Object.freeze({
  cotizaciones: 'cotizaciones',
  conceptos: 'cotizacion_conceptos',
})

export const columnasCotizaciones = Object.freeze({
  cotizaciones: Object.freeze({
    id: 'id',
    numero: 'numero',
    oportunidadId: 'oportunidad_id',
    creadoPor: 'creado_por',
    moneda: 'moneda',
    estado: 'estado',
    titulo: null,
    descripcion: null,
    fechaVencimiento: null,
    fechaCreacion: null,
    fechaActualizacion: null,
  }),
  conceptos: Object.freeze({
    id: 'id',
    cotizacionId: 'cotizacion_id',
    orden: 'orden',
    descripcion: 'descripcion',
    cantidad: 'cantidad',
    precioUnitario: 'precio_unitario',
    importe: 'importe',
  }),
})

export const verificacionesCotizaciones = Object.freeze({
  stagingIndependiente: false,
  columnasYTipos: false,
  pConceptosProbado: false,
  retornoUuidProbado: false,
  lecturaRlsStaging: false,
  rpcCrearStaging: false,
  rpcActualizarStaging: false,
  rolesYAsignacionStaging: false,
  escriturasDirectasDenegadas: false,
  riesgoAuditoriaRevisado: false,
  riesgoConcurrenciaRevisado: false,
})

export const configuracionCotizaciones = Object.freeze({
  stagingProjectRef: '',
  produccionProjectRefs: ['hhlicjgpwcesytziacvc'],
  columnas: columnasCotizaciones,
  verificaciones: verificacionesCotizaciones,
})

const COLUMNAS_CONFIRMADAS = Object.freeze({
  cotizaciones: Object.freeze({
    id: 'id',
    numero: 'numero',
    oportunidadId: 'oportunidad_id',
    creadoPor: 'creado_por',
    moneda: 'moneda',
    estado: 'estado',
  }),
  conceptos: Object.freeze({
    id: 'id',
    cotizacionId: 'cotizacion_id',
    orden: 'orden',
    descripcion: 'descripcion',
    cantidad: 'cantidad',
    precioUnitario: 'precio_unitario',
    importe: 'importe',
  }),
})

const COLUMNAS_REQUERIDAS = Object.freeze({
  cotizaciones: ['id', 'numero', 'oportunidadId', 'creadoPor', 'moneda', 'estado', 'titulo', 'descripcion', 'fechaVencimiento', 'fechaCreacion'],
  conceptos: ['id', 'cotizacionId', 'orden', 'descripcion', 'cantidad', 'precioUnitario', 'importe'],
})

export function validarColumnasCotizaciones(columnas = configuracionCotizaciones.columnas) {
  for (const [tabla, esperadas] of Object.entries(COLUMNAS_CONFIRMADAS)) {
    for (const [campo, columna] of Object.entries(esperadas)) {
      if (columnas?.[tabla]?.[campo] !== columna) {
        throw new Error(`El mapeo confirmado de ${tabla}.${campo} no coincide.`)
      }
    }
  }

  for (const [tabla, campos] of Object.entries(COLUMNAS_REQUERIDAS)) {
    for (const campo of campos) {
      const columna = columnas?.[tabla]?.[campo]
      if (typeof columna !== 'string' || !/^[a-z_][a-z0-9_]*$/.test(columna)) {
        throw new Error(`Falta confirmar la columna ${tabla}.${campo}.`)
      }
    }
  }

  const fechaActualizacion = columnas?.cotizaciones?.fechaActualizacion
  if (fechaActualizacion != null && !/^[a-z_][a-z0-9_]*$/.test(fechaActualizacion)) {
    throw new Error('La columna de actualización de cotizaciones no es válida.')
  }
}

function clavePublicaNoPrivilegiada(key) {
  if (!key || key.startsWith('sb_secret_')) return false
  if (!key.startsWith('sb_publishable_')) {
    if (key.split('.').length !== 3) return false
    try {
      const payload = JSON.parse(globalThis.atob(key.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')))
      return payload.role === 'anon'
    } catch {
      return false
    }
  }
  return true
}

export function evaluarModoCotizaciones(env = {}, config = configuracionCotizaciones) {
  if (env.VITE_COTIZACIONES_MODO !== 'supabase') {
    return { habilitado: false, motivo: 'La persistencia real de cotizaciones sigue deshabilitada.' }
  }
  if (env.DEV !== true || env.MODE !== 'staging') {
    return { habilitado: false, motivo: 'Cotizaciones solo puede validarse localmente contra staging; producción permanece bloqueada.' }
  }

  let url
  try {
    url = new URL(env.VITE_SUPABASE_URL)
  } catch {
    return { habilitado: false, motivo: 'La URL del proyecto staging no es válida.' }
  }

  const ref = config.stagingProjectRef
  if (
    !/^[a-z]{20}$/.test(ref) ||
    config.produccionProjectRefs.includes(ref) ||
    url.origin !== `https://${ref}.supabase.co` ||
    url.pathname !== '/' ||
    url.username ||
    url.password ||
    url.search ||
    url.hash
  ) {
    return { habilitado: false, motivo: 'El cliente no apunta al proyecto staging independiente configurado.' }
  }
  if (!clavePublicaNoPrivilegiada(env.VITE_SUPABASE_ANON_KEY)) {
    return { habilitado: false, motivo: 'Solo se permite una clave pública no privilegiada de staging.' }
  }

  try {
    validarColumnasCotizaciones(config.columnas)
  } catch (error) {
    return { habilitado: false, motivo: error.message }
  }

  const verificaciones = Object.keys(verificacionesCotizaciones)
  if (!verificaciones.every((clave) => config.verificaciones?.[clave] === true)) {
    return { habilitado: false, motivo: 'Faltan pruebas y revisiones de seguridad en staging; las escrituras siguen bloqueadas.' }
  }

  return { habilitado: true, motivo: 'Contrato y operaciones de cotizaciones validados para staging.' }
}
