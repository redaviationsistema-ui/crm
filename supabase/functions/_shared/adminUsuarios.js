import {validarPasswordAdministrativa} from './passwordPolicy.js'
const ROLES=new Set(['administrador','supervisor','ejecutivo'])
const CAMPOS=new Set(['nombre','apellidos','correo','telefono','rol','activo'])
const EMAIL=/^[^\s@]+@[^\s@]+\.[^\s@]+$/
const fail=(status,message)=>{throw Object.assign(Error(message),{status})}
const response=(status,body)=>new Response(JSON.stringify(body),{status,headers:{'Content-Type':'application/json; charset=utf-8'}})
function validar(datos,completo=false){
  if(!datos||typeof datos!=='object'||Array.isArray(datos)||!Object.keys(datos).length||Object.keys(datos).some(k=>!CAMPOS.has(k)))fail(400,'Datos o campos de usuario no permitidos.')
  if(completo&&[...CAMPOS].some(k=>!Object.hasOwn(datos,k)))fail(400,'Faltan datos del usuario.')
  for(const k of ['nombre','apellidos'])if(k in datos&&(typeof datos[k]!=='string'||!datos[k].trim()||datos[k].length>100))fail(400,'Nombre o apellidos no válidos.')
  if('correo' in datos&&(typeof datos.correo!=='string'||datos.correo.length>254||!EMAIL.test(datos.correo.trim())))fail(400,'Correo no válido.')
  if('telefono' in datos&&(typeof datos.telefono!=='string'||datos.telefono.length>40))fail(400,'Teléfono no válido.')
  if('rol' in datos&&!ROLES.has(datos.rol))fail(400,'Rol no permitido.')
  if('activo' in datos&&typeof datos.activo!=='boolean')fail(400,'Estado no válido.')
  return Object.fromEntries(Object.entries(datos).map(([k,v])=>[k,typeof v==='string'?(k==='correo'?v.trim().toLowerCase():v.trim()):v]))
}
// Límite por instancia. Requiere protección distribuida verificada antes de activar producción.
export function crearLimitePassword({ahora=()=>Date.now(),maximo=5,ventana=60000}={}){
  const actores=new Map()
  return actor=>{
    const tiempo=ahora()
    for(const [id,estado] of actores)if(!estado.ocupado&&estado.hasta<=tiempo)actores.delete(id)
    let estado=actores.get(actor)
    if(!estado){if(actores.size>=10000)fail(429,'Límite de intentos alcanzado.');estado={intentos:0,hasta:tiempo+ventana,ocupado:false};actores.set(actor,estado)}
    if(estado.ocupado||estado.intentos>=maximo)fail(429,'Límite de intentos alcanzado.')
    estado.intentos++;estado.ocupado=true
    return ()=>{estado.ocupado=false}
  }
}
export function crearAdminUsuariosHandler({enabled=false,writesEnabled=false,passwordWritesEnabled=false,limitePassword=crearLimitePassword(),authenticate,cargarPerfil,contarAdminsActivos,ejecutar}){
  return async (request,contexto={})=>{
    if(!enabled)return response(503,{error:'La administración real de usuarios está desactivada.'})
    if(request.method!=='POST')return response(405,{error:'Método no permitido.'})
    const token=(request.headers.get('Authorization')||'').match(/^Bearer\s+(\S+)$/i)?.[1]
    if(!token)return response(401,{error:'Autenticación requerida.'})
    let liberar=()=>{},operacion=''
    try{
      const identity=await authenticate(token)
      if(!identity?.id)fail(401,'La sesión no es válida.')
      const actor=await cargarPerfil(identity.id)
      if(actor?.rol!=='administrador'||actor?.activo!==true)fail(403,'Se requiere un administrador activo.')
      let b;try{b=await request.json()}catch{fail(400,'Solicitud JSON no válida.')}
      if(!b||typeof b!=='object'||Array.isArray(b))fail(400,'Solicitud no válida.')
      const op=b.operacion;operacion=op
      const fields={listar:['operacion'],historial:['operacion'],crear:['operacion','usuario'],crear_con_password:['operacion','usuario','password'],cambiar_password:['operacion','usuarioId','password'],editar:['operacion','usuarioId','cambios'],cambiar_estado:['operacion','usuarioId','activo'],eliminar_definitivamente:['operacion','usuarioId','confirmacion']}
      if(!Object.hasOwn(fields,op))fail(400,'Operación no permitida.')
      if(Object.keys(b).some(k=>!fields[op].includes(k)))fail(400,'La solicitud contiene campos no permitidos.')
      if(op==='cambiar_password'&&b.usuarioId===identity.id){
        throw Object.assign(Error('No puedes cambiar tu propia contraseña mediante esta operación.'),{status:403,codigo:'SELF_PASSWORD_CHANGE'})
      }
      if(!writesEnabled&&!['listar','historial'].includes(op))fail(503,'Las escrituras administrativas están bloqueadas hasta validar el contrato y staging.')
      const c={operacion:op,actorId:identity.id}
      if(['cambiar_password','crear_con_password'].includes(op)){
        if(!passwordWritesEnabled)fail(503,'Las operaciones de contraseña están bloqueadas hasta validar staging y permisos.')
        liberar=limitePassword(identity.id)
        const errorPassword=validarPasswordAdministrativa(b.password,b.password)
        if(errorPassword)fail(400,errorPassword)
        c.password=b.password
      }
      if(['crear','crear_con_password'].includes(op))c.usuario=validar(b.usuario,true)
      if(['editar','cambiar_estado','eliminar_definitivamente','cambiar_password'].includes(op)){
        if(typeof b.usuarioId!=='string'||!b.usuarioId)fail(400,'Identificador no válido.')
        const objetivo=await cargarPerfil(b.usuarioId)
        if(!objetivo)fail(404,'El usuario solicitado no existe.')
        c.usuarioId=objetivo.id;c.objetivo=objetivo
        if(op==='editar')c.cambios=validar(b.cambios)
        if(op==='cambiar_estado')c.cambios=validar({activo:b.activo})
        if(op==='eliminar_definitivamente'){
          if(b.confirmacion!==objetivo.correo)fail(400,'La confirmación no coincide con el correo.')
          if(c.usuarioId===identity.id)fail(403,'No puedes eliminar tu propia cuenta.')
          c.confirmacion=b.confirmacion
        }
        const cambios=c.cambios||{}
        if(c.usuarioId===identity.id&&((cambios.rol!==undefined&&cambios.rol!==objetivo.rol)||cambios.activo===false))fail(403,'No puedes cambiar tu propio rol ni desactivar tu cuenta.')
        const pierdeAdmin=objetivo.rol==='administrador'&&objetivo.activo===true&&((cambios.rol!==undefined&&cambios.rol!=='administrador')||cambios.activo===false||op==='eliminar_definitivamente')
        if(pierdeAdmin&&await contarAdminsActivos()<=1)fail(409,'No se puede modificar al último administrador activo.')
      }
      return response(200,{resultado:await ejecutar(c,contexto)})
    }catch(e){
      const status=Number.isInteger(e?.status)&&e.status>=400&&e.status<=599?e.status:500
      const mensajesPassword={400:'Datos de contraseña no válidos.',403:'Se requiere un administrador activo.',404:'El usuario solicitado no está disponible.',409:'No se confirmó la operación. Revisa Auth y perfil antes de repetir.',429:'Límite de intentos alcanzado.',503:'Operaciones de contraseña bloqueadas o no disponibles.'}
      const mensaje=['cambiar_password','crear_con_password'].includes(operacion)
        ?e?.codigo==='SELF_PASSWORD_CHANGE'?'No puedes cambiar tu propia contraseña mediante esta operación.':mensajesPassword[status]||'No se confirmó la operación de contraseña.'
        :status===500?'No se pudo completar la operación administrativa.':e.message
      return response(status,{error:mensaje,requiereRevision:e?.requiereRevision===true})
    }finally{liberar()}
  }
}
