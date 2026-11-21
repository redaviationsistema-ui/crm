const PROJECTO_STAGING = 'cpwknzvrikuapsrsybka'
const METODOS_LECTURA = new Set(['GET', 'HEAD', 'OPTIONS'])
const RPC_LECTURA_O_PERSONAL = new Set(['mi_contexto_crm', 'marcar_notificacion_leida'])

export function esStagingObjetivo(url = import.meta.env?.VITE_SUPABASE_URL) {
  try {
    return new URL(url).hostname === `${PROJECTO_STAGING}.supabase.co`
  } catch {
    return false
  }
}

export function escriturasStagingBloqueadas(env = import.meta.env || {}) {
  return esStagingObjetivo(env.VITE_SUPABASE_URL) && env.VITE_CRM_STAGING_WRITES_ENABLED !== 'true'
}

export function exigirEscriturasStagingHabilitadas(operacion) {
  if (!escriturasStagingBloqueadas()) return

  const error = new Error(`Escritura bloqueada en Supabase Staging durante la fase de conexión: ${operacion}.`)
  error.code = 'CRM_STAGING_WRITE_BLOCKED'
  error.status = 403
  throw error
}

function mutacionBloqueada(url, metodo) {
  if (METODOS_LECTURA.has(metodo)) return false

  const ruta = url.pathname
  if (ruta.startsWith('/auth/v1/')) return false
  if (ruta === '/rest/v1/rpc/mi_contexto_crm' || ruta === '/rest/v1/rpc/marcar_notificacion_leida') return false

  if (ruta.startsWith('/rest/v1/')) return true
  if (ruta.startsWith('/functions/v1/')) return true
  if (ruta.startsWith('/storage/v1/object/') && !ruta.includes('/object/sign/')) return true
  return false
}

export function crearFetchConBloqueoEscriturasStaging(fetchImpl = globalThis.fetch, env = import.meta.env || {}) {
  return (input, init) => {
    if (!escriturasStagingBloqueadas(env)) return fetchImpl(input, init)

    let url
    try {
      url = new URL(input instanceof Request ? input.url : String(input), env.VITE_SUPABASE_URL)
    } catch {
      return fetchImpl(input, init)
    }

    const metodo = String(init?.method || input?.method || 'GET').toUpperCase()
    if (url.origin !== new URL(env.VITE_SUPABASE_URL).origin || !mutacionBloqueada(url, metodo)) {
      return fetchImpl(input, init)
    }

    return Promise.resolve(new Response(JSON.stringify({
      message: 'Las escrituras están bloqueadas en Supabase Staging durante la fase de conexión.',
      code: 'CRM_STAGING_WRITE_BLOCKED',
    }), {
      status: 403,
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
    }))
  }
}
