// Columnas confirmadas por el usuario desde Supabase SQL Editor.
export const columnasOportunidades = Object.freeze(Object.fromEntries(Object.entries({
  oportunidades: { id:'id', clienteId:'prospecto_id', embudoId:'embudo_id', etapaId:'etapa_id', titulo:'titulo',
    descripcion:'descripcion', responsableId:'responsable_id', creadoPor:'creado_por', valorEstimado:'valor_estimado',
    moneda:'moneda', prioridad:'prioridad', estado:'estado', proximoSeguimiento:'proximo_seguimiento',
    cerradoEn:'fecha_cierre', creadoEn:'fecha_creacion', actualizadoEn:'fecha_actualizacion' },
  embudos: { id:'id', nombre:'nombre', descripcion:'descripcion', activo:'activo', creadoEn:'fecha_creacion' },
  etapas: { id:'id', embudoId:'embudo_id', nombre:'nombre', orden:'orden', tipo:'tipo', activo:'activo' },
  eventos: { id:'id', oportunidadId:'oportunidad_id', actor:'usuario_id', tipo:'tipo',
    anteriores:'datos_anteriores', nuevos:'datos_nuevos', fecha:'fecha_creacion' },
}).map(([tabla,mapa]) => [tabla,Object.freeze(mapa)])))

// No habilitar mediante una variable VITE_ aislada. Requiere revisión de este registro.
// No contiene secretos ni sustituye Auth/RLS. Se valida solo desarrollo local en staging.
export const configuracionOportunidades = Object.freeze({
  stagingProjectRef: '',
  produccionProjectRefs: ['hhlicjgpwcesytziacvc'],
  verificaciones: {
    stagingIndependiente: false, columnas: true, rpc: false, rlsYGrants: false,
    escrituraDirectaDenegada: false, jwtAdministrador: false, jwtEjecutivo: false,
    asignacionAjenaDenegada: false, actualizacionAjenaDenegada: false,
    supervisorLimitado: false, inactivoDenegado: false, historial: false,
  },
  columnas: columnasOportunidades,
})

export function evaluarModoOportunidades(env = {}, config = configuracionOportunidades) {
  if (env.VITE_OPORTUNIDADES_MODO !== 'supabase') return { habilitado: false, motivo: 'Supabase permanece desactivado hasta verificar staging y seguridad.' }
  if (env.DEV !== true || env.MODE !== 'staging') return { habilitado: false, motivo: 'El modo Supabase solo se permite en desarrollo local con modo staging.' }
  let url
  try { url = new URL(env.VITE_SUPABASE_URL) } catch { return { habilitado: false, motivo: 'URL de staging inválida.' } }
  const ref = config.stagingProjectRef
  if (!/^[a-z]{20}$/.test(ref) || config.produccionProjectRefs.includes(ref) ||
      url.origin !== `https://${ref}.supabase.co` || url.pathname !== '/' || url.username || url.password || url.search || url.hash) {
    return { habilitado: false, motivo: 'El destino no coincide con el proyecto staging independiente revisado.' }
  }
  const key = env.VITE_SUPABASE_ANON_KEY || ''
  let privilegiada = key.startsWith('sb_secret_')
  if (key.split('.').length === 3) {
    try {
      const payload = JSON.parse(globalThis.atob(key.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')))
      privilegiada ||= payload.role !== 'anon'
    } catch { privilegiada = true }
  } else if (!key.startsWith('sb_publishable_')) privilegiada = true
  if (!key || privilegiada) return { habilitado: false, motivo: 'Se requiere una clave pública de staging; nunca service_role.' }
  const requeridas = Object.keys(configuracionOportunidades.verificaciones)
  if (!config.columnas || !requeridas.every(k => config.verificaciones?.[k] === true)) {
    return { habilitado: false, motivo: 'Faltan columnas, permisos o pruebas con JWT auténticos; modo real bloqueado.' }
  }
  return { habilitado: true, motivo: 'Staging revisado; operaciones autenticadas mediante RPC.' }
}
