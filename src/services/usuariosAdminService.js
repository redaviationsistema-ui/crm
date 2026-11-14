import {crearUsuariosAdminBackend} from './usuariosAdminBackend.js'
import {validarUsuarioAdmin} from '../domain/usuariosAdmin.js'

// Exclusivamente backend real. No semillas, storage ni fallback de demostración.
export function crearUsuariosAdminService({backend}={}) {
  if(!backend)throw Error('Falta configurar la conexión real del servicio de usuarios.')
  let ocupado=false
  async function escribir(operacion) {
    if(ocupado)throw Error('Ya hay una operación administrativa en curso.')
    ocupado=true
    try{return await operacion()}finally{ocupado=false}
  }
  return {
    modo:'supabase',persistencia:'Supabase Auth y PostgreSQL',
    listar:()=>backend.listar(),historial:()=>backend.historial(),
    async crear(_actor,usuario){
      const errores=validarUsuarioAdmin(usuario)
      if(Object.keys(errores).length)throw Error(Object.values(errores).join(' '))
      return escribir(()=>backend.crear(usuario))
    },
    editar:(_actor,id,cambios)=>escribir(()=>backend.editar(id,cambios)),
    async cambiarPassword(_actor,id,password){
      return escribir(async()=>{
        const resultado=await backend.cambiarPassword(id,password)
        if(resultado?.usuarioId!==id||resultado?.contrasenaActualizada!==true){
          throw Object.assign(Error('El backend no confirmó el resultado de la operación. Revisa Auth antes de repetirla.'),{tipoResultado:'incierto',requiereRevision:true})
        }
        return {usuarioId:id,contrasenaActualizada:true}
      })
    },
    crearConPassword:(_actor,usuario,password)=>{const errores=validarUsuarioAdmin(usuario);if(Object.keys(errores).length)throw Error(Object.values(errores).join(' '));return escribir(()=>backend.crearConPassword(usuario,password))},
    cambiarEstado:(_actor,id,activo)=>escribir(()=>backend.cambiarEstado(id,activo)),
    eliminarDefinitivamente:(_actor,id,confirmacion)=>escribir(()=>backend.eliminarDefinitivamente(id,confirmacion)),
  }
}
export function crearUsuariosAdminNavegador({obtenerCliente,fetchImpl=globalThis.fetch}={}) {
  const backend=crearUsuariosAdminBackend({fetchImpl,obtenerConexion:async()=>{
    let cliente
    try{if(typeof obtenerCliente!=='function')throw Error();cliente=await obtenerCliente()}catch{throw Error('Supabase no está configurado. Revisa la URL y la clave pública del proyecto.')}
    let base
    try{base=new URL(cliente.supabaseUrl)}catch{throw Error('No hay un proyecto Supabase válido configurado.')}
    if(base.protocol!=='https:'||base.pathname!=='/'||base.username||base.password||base.search||base.hash)throw Error('El destino Supabase no es válido.')
    const key=cliente.supabaseKey || ''
    let publica=key.startsWith('sb_publishable_')
    if(key.split('.').length===3){try{publica=JSON.parse(globalThis.atob(key.split('.')[1].replace(/-/g,'+').replace(/_/g,'/'))).role==='anon'}catch{publica=false}}
    if(!publica)throw Error('Configura una clave pública de Supabase; las claves privilegiadas no se utilizan en Vue.')
    const identidad=await cliente.auth.getUser()
    const sesion=await cliente.auth.getSession()
    if(identidad.error||sesion.error||!identidad.data?.user||!sesion.data?.session?.access_token||sesion.data.session.user.id!==identidad.data.user.id)throw Error('La sesión no es válida. Inicia sesión nuevamente.')
    return {endpoint:`${base.origin}/functions/v1/admin-usuarios`,token:sesion.data.session.access_token,apiKey:cliente.supabaseKey}
  }})
  return crearUsuariosAdminService({backend})
}
