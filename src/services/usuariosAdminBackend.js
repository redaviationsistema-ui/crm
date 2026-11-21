import { exigirEscriturasStagingHabilitadas } from '../lib/stagingWriteProtection.js'

const OPERACIONES = new Set(['listar','crear','editar','cambiar_estado','eliminar_definitivamente','historial','cambiar_password','crear_con_password'])
const MENSAJES_PASSWORD = {
  400:'Datos de contraseña no válidos.',
  401:'La sesión no es válida. Inicia sesión nuevamente.',
  403:'Se requiere un administrador activo.',
  404:'El usuario solicitado no está disponible.',
  429:'Límite de intentos alcanzado.',
  503:'Operaciones de contraseña bloqueadas o no disponibles.',
}
const PASSWORD_DESHABILITADA=MENSAJES_PASSWORD[503]
function errorPassword(mensaje,tipoResultado,status,requiereRevision=false){
  return Object.assign(Error(mensaje),{status,tipoResultado,requiereRevision})
}
function confirmarCambioPassword(resultado,usuarioId){
  if(resultado?.usuarioId===usuarioId&&resultado?.contrasenaActualizada===true){
    return {usuarioId,contrasenaActualizada:true}
  }
  if(resultado?.id===usuarioId&&resultado?.password_actualizado===true){
    return {usuarioId,contrasenaActualizada:true}
  }
  return null
}
export function crearUsuariosAdminBackend({obtenerToken,obtenerConexion,fetchImpl=globalThis.fetch,habilitado=true,endpoint,apiKey}={}) {
  async function solicitar(operacion,datos={}) {
    if(!habilitado)throw Error('La gestión real de usuarios está desactivada por configuración del servidor.')
    if(!OPERACIONES.has(operacion))throw Error('Operación administrativa no permitida.')
    if(!['listar','historial'].includes(operacion))exigirEscriturasStagingHabilitadas(`administrar usuarios: ${operacion}`)
    const conexion=obtenerConexion?await obtenerConexion():{token:await obtenerToken?.(),endpoint,apiKey}
    if(!conexion?.token)throw Error('Inicia sesión nuevamente para gestionar usuarios reales.')
    let destino
    try{destino=new URL(conexion.endpoint)}catch{throw Error('Supabase no está configurado: falta la URL real de la Edge Function admin-usuarios.')}
    if(destino.protocol!=='https:'||destino.pathname!=='/functions/v1/admin-usuarios'||destino.username||destino.password||destino.search||destino.hash)throw Error('La URL del backend administrativo no es válida.')
    let respuesta
    try{
      respuesta=await fetchImpl(destino.href,{method:'POST',headers:{Authorization:`Bearer ${conexion.token}`,'Content-Type':'application/json',...(conexion.apiKey?{apikey:conexion.apiKey}:{})},
        body:JSON.stringify({operacion,...datos}),signal:AbortSignal.timeout(30000)})
    }catch{
      if(['cambiar_password','crear_con_password'].includes(operacion))throw errorPassword('No se pudo confirmar la operación de contraseña. Revisa Auth antes de repetirla.','incierto',undefined,true)
      throw Error('No se pudo confirmar la operación con Supabase. Revisa el listado y la auditoría antes de repetirla.')
    }
    const body=await respuesta.json().catch(()=>null)
    if(!respuesta.ok) {
      if(['cambiar_password','crear_con_password'].includes(operacion)){
        const bloqueoConfirmado=respuesta.status===503&&body?.error===PASSWORD_DESHABILITADA
        const requiereRevision=body?.requiereRevision===true||respuesta.status===409||respuesta.status>=500&&!bloqueoConfirmado
        const tipoResultado=requiereRevision?'incierto':bloqueoConfirmado?'bloqueado':'rechazado'
        const mensaje=requiereRevision?'No se confirmó la operación de contraseña. Revisa Auth antes de repetir.':MENSAJES_PASSWORD[respuesta.status]||'El servidor rechazó la operación de contraseña.'
        throw errorPassword(mensaje,tipoResultado,respuesta.status,requiereRevision)
      }
      const error=new Error(respuesta.status===404 && !body?.error ? 'La Edge Function admin-usuarios no está desplegada en el proyecto configurado.' : body?.error || 'El backend rechazó la operación administrativa.')
      error.status=respuesta.status;error.requiereRevision=body?.requiereRevision===true
      throw error
    }
    const resultado=body?.resultado
    if(operacion==='cambiar_password'){
      const confirmado=confirmarCambioPassword(resultado,datos.usuarioId)
      if(!confirmado)throw errorPassword('El backend no confirmó el resultado de la operación. Revisa Auth antes de repetirla.','incierto',respuesta.status,true)
      return confirmado
    }
    const valido=['listar','historial'].includes(operacion)?Array.isArray(resultado)
      :resultado&&typeof resultado==='object'&&typeof resultado.id==='string'&&(operacion!=='eliminar_definitivamente'||resultado.eliminado===true)
    if(!valido){
      if(operacion==='crear_con_password')throw errorPassword('El backend no confirmó el resultado de la operación. Revisa Auth antes de repetirla.','incierto',respuesta.status,true)
      throw Error('El backend no devolvió un resultado verificable. Recarga los datos; no se confirmó la operación.')
    }
    return resultado
  }
  return {
    modo:'supabase',persistencia:'Supabase Auth y PostgreSQL',
    listar:()=>solicitar('listar'),historial:()=>solicitar('historial'),
    crear:usuario=>solicitar('crear',{usuario}),editar:(usuarioId,cambios)=>solicitar('editar',{usuarioId,cambios}),
    cambiarPassword:(usuarioId,password)=>solicitar('cambiar_password',{usuarioId,password}),
    crearConPassword:(usuario,password)=>solicitar('crear_con_password',{usuario,password}),
    cambiarEstado:(usuarioId,activo)=>solicitar('cambiar_estado',{usuarioId,activo}),
    eliminarDefinitivamente:(usuarioId,confirmacion)=>solicitar('eliminar_definitivamente',{usuarioId,confirmacion}),
  }
}
