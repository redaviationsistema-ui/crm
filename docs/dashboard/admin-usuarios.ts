// @ts-nocheck
// JavaScript generado desde módulos .js; comprobar fuentes con deno check y tests Node.
// GENERADO. Copiar COMPLETO al editor de admin-usuarios en Supabase Dashboard.
// Fuentes: supabase/functions. Regenerar: node scripts/prepararAdminUsuariosDashboard.mjs

const {validarPasswordAdministrativa}=(()=>{
// Política compartida entre formulario y Edge. No devuelve valores sensibles.
function validarPasswordAdministrativa(password,confirmacion){
  if(typeof password!=='string'||password.length<12||password.length>128)return 'La contraseña debe tener entre 12 y 128 caracteres.'
  if(!/^[!-~]+$/.test(password)||!/[A-Z]/.test(password)||!/[a-z]/.test(password)||!/[0-9]/.test(password)||!/[\W_]/.test(password))return 'Incluye mayúsculas, minúsculas, números y símbolos, sin espacios.'
  if(password!==confirmacion)return 'Las contraseñas no coinciden.'
  return ''
}

return {validarPasswordAdministrativa}
})();

const {evaluarConfiguracionAdmin,crearDiagnosticoConfiguracionAdmin}=(()=>{
// Solo etiquetas fijas. Nunca devolver entradas, excepciones ni valores secretos.
function evaluarConfiguracionAdmin({url,dbUrl,projectRef,anon,service,fallasWeb=/** @type {readonly string[]} */ ([])}){
  const fallidas=[...fallasWeb]
  const refValida=/^[a-z]{20}$/.test(projectRef)
  if(!refValida)fallidas.push('REFERENCIA_PROYECTO_FORMATO')
  let api,db
  try{api=new URL(url)}catch{fallidas.push('URL_SUPABASE_FORMATO')}
  if(api&&refValida&&(api.origin!==`https://${projectRef}.supabase.co`||api.pathname!=='/'))fallidas.push('URL_SUPABASE_PROYECTO')
  if(!anon)fallidas.push('CLAVE_PUBLICA_DISPONIBLE')
  if(!service)fallidas.push('CLAVE_SERVIDOR_DISPONIBLE')
  try{db=new URL(dbUrl)}catch{fallidas.push('POSTGRESQL_URL_FORMATO')}
  if(db){
    if(!['postgres:','postgresql:'].includes(db.protocol))fallidas.push('POSTGRESQL_PROTOCOLO')
    if(refValida){
      let matches=false
      try{matches=db.hostname===`db.${projectRef}.supabase.co`||(db.hostname.endsWith('.pooler.supabase.com')&&decodeURIComponent(db.username).endsWith(`.${projectRef}`))}catch{/*Etiqueta fija, sin excepción original.*/}
      if(!matches)fallidas.push('POSTGRESQL_PROYECTO')
    }
    if(!db.password)fallidas.push('POSTGRESQL_PASSWORD_PRESENTE')
  }
  return Object.freeze({valida:fallidas.length===0,fallidas:Object.freeze(fallidas)})
}
function crearDiagnosticoConfiguracionAdmin({fallidas,autenticarAdmin}){
  return async request=>{
    const generic=(status)=>Response.json({error:status===401?'Autenticación requerida o sesión no válida.':status===403?'Se requiere un administrador activo.':'No fue posible verificar la autorización del diagnóstico.'},{status})
    if(request.method!=='POST')return new Response(null,{status:405})
    const token=(request.headers.get('Authorization')||'').match(/^Bearer\s+(\S+)$/i)?.[1]
    if(!token)return generic(401)
    try{
      const status=await autenticarAdmin(token)
      if(status!==200)return generic([401,403].includes(status)?status:503)
      const body=await request.json()
      if(!body||body.operacion!=='diagnosticar_configuracion'||Object.keys(body).some(k=>k!=='operacion'))return Response.json({error:'Solicitud de diagnóstico no válida.'},{status:400})
      return Response.json({comprobaciones_fallidas:fallidas})
    }catch{return generic(503)}
  }
}

return {evaluarConfiguracionAdmin,crearDiagnosticoConfiguracionAdmin}
})();

const {configurarOrigenesAdmin,revisarOrigenesAdmin}=(()=>{
// Lista cerrada de entornos solicitados. Ningún valor se obtiene del cuerpo,
// Referer, Host o X-Forwarded-* de la solicitud.
function revisarOrigenesAdmin({allowedOrigins,inviteRedirectLocal,inviteRedirectProduction}){
  const fallidas=[]
  let origins
  try{origins=JSON.parse(allowedOrigins)}catch{/*No registrar el valor ni el error de JSON.*/}
  const destinos={
    'http://localhost:5173':'http://localhost:5173/crm/establecer-acceso',
    'https://redskyg.com':'https://redskyg.com/crm/establecer-acceso',
  }
  const listaValida=Array.isArray(origins)&&origins.length>0&&new Set(origins).size===origins.length&&
    origins.every(origin=>typeof origin==='string'&&Object.hasOwn(destinos,origin))
  if(!listaValida)fallidas.push('LISTA_ORIGENES')
  if(inviteRedirectLocal!==destinos['http://localhost:5173'])fallidas.push('URL_INVITACION_LOCAL')
  if(inviteRedirectProduction!==destinos['https://redskyg.com'])fallidas.push('URL_INVITACION_PRODUCTION')
  return {fallidas,origins:listaValida?Object.freeze([...origins]):[],destinos}
}
function configurarOrigenesAdmin(opciones){
  const revision=revisarOrigenesAdmin(opciones)
  if(revision.fallidas.length)throw Error('Configuración de orígenes o invitaciones inválida.')
  const {origins,destinos}=revision
  const redirects=Object.freeze(Object.fromEntries(origins.map(origin=>[origin,destinos[origin]])))
  return Object.freeze({origins,redirects})
}

return {configurarOrigenesAdmin,revisarOrigenesAdmin}
})();

const {crearAdminUsuariosHttp}=(()=>{
function crearAdminUsuariosHttp({handler,webConfig,configured,diagnosticar,diagnosticOrigins=/** @type {readonly string[]} */ ([])}){
  return async request=>{
    const origin=request.headers.get('Origin')
    const baseHeaders={'Vary':'Origin','Cache-Control':'no-store'}
    const allowedOrigins=webConfig?.origins||diagnosticOrigins
    const generic='Configuración administrativa incompleta o inconsistente. Revisa los secretos del mismo proyecto.'
    if(!allowedOrigins.length)return Response.json({error:generic},{status:503,headers:baseHeaders})
    // Origin es una condición adicional de acceso, no una identidad autenticada.
    // Tampoco se selecciona producción por defecto cuando el encabezado falta.
    if(!origin||!allowedOrigins.includes(origin))return new Response('Origen no permitido.',{status:403,headers:baseHeaders})
    const headers={...baseHeaders,'Access-Control-Allow-Origin':origin,'Access-Control-Allow-Headers':'authorization, apikey, content-type, x-client-info','Access-Control-Allow-Methods':'POST, OPTIONS'}
    if(request.method==='OPTIONS')return new Response(null,{status:204,headers})
    if(request.method==='POST'&&diagnosticar){
      const body=await request.clone().json().catch(()=>null)
      if(body?.operacion==='diagnosticar_configuracion'){
        const response=await diagnosticar(request)
        const diagnosticHeaders=new Headers(response.headers)
        for(const [k,v] of Object.entries(headers))diagnosticHeaders.set(k,v)
        return new Response(response.body,{status:response.status,headers:diagnosticHeaders})
      }
    }
    if(!configured||!webConfig)return Response.json({error:generic},{status:503,headers})
    let response
    try{
      // Contexto interno por petición: no mutar un executor global compartido.
      response=await handler(request,Object.freeze({redirectTo:webConfig.redirects[origin]}))
    }catch{return Response.json({error:'No se pudo completar la operación administrativa.'},{status:500,headers})}
    const resultHeaders=new Headers(response.headers)
    for(const [k,v] of Object.entries(headers))resultHeaders.set(k,v)
    return new Response(response.body,{status:response.status,headers:resultHeaders})
  }
}

return {crearAdminUsuariosHttp}
})();

const {crearAdminUsuariosHandler,crearLimitePassword}=(()=>{
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
function crearLimitePassword({ahora=()=>Date.now(),maximo=5,ventana=60000}={}){
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
function crearAdminUsuariosHandler({enabled=false,writesEnabled=false,passwordWritesEnabled=false,limitePassword=crearLimitePassword(),authenticate,cargarPerfil,contarAdminsActivos,ejecutar}){
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

return {crearAdminUsuariosHandler,crearLimitePassword}
})();

const {crearAdminUsuariosExecutor}=(()=>{
const parcial=mensaje=>Object.assign(Error(mensaje),{status:409,requiereRevision:true})
function verificarPerfil(p,id,cambios){
  if(!p||p.id!==id||Object.keys(cambios).some(k=>p[k]!==cambios[k]))throw parcial('PostgreSQL no confirmó los datos enviados. Revisa el perfil antes de repetir.')
}
function verificarEstado(user,activo){
  if(typeof activo!=='boolean')return true
  const hasta=user.banned_until?Date.parse(user.banned_until):0
  return Number.isFinite(hasta)&&(activo?hasta<=Date.now():hasta>Date.now())
}
function crearAdminUsuariosExecutor({authAdmin,ejecutarDb,eliminarConAuth}){
  return async (entrada,contexto={})=>{
    // El secreto nunca forma parte de comandos SQL, preflight, auditoría o perfiles.
    const {password,...c}=entrada
    if(password!==undefined&&!['cambiar_password','crear_con_password'].includes(c.operacion))throw Object.assign(Error('Contrato de contraseña no permitido.'),{status:400})
    if(['cambiar_password','crear_con_password'].includes(c.operacion)&&typeof password!=='string')throw Object.assign(Error('Falta una contraseña válida.'),{status:400})
    if(['listar','historial'].includes(c.operacion))return ejecutarDb(c)
    if(c.operacion==='crear'&&!contexto.redirectTo)throw Object.assign(Error('No hay URL de invitación autorizada para esta solicitud.'),{status:503})
    const contrato=await ejecutarDb({...c,operacion:'preflight'})
    if(contrato?.contrato!=='administrar-perfil-existente-v1')throw Object.assign(Error('No se verificó la función administrativa existente. No se modificó Auth.'),{status:503})
    if(c.operacion==='cambiar_password'){
      try{
        const r=await authAdmin.updateUserById(c.usuarioId,{password})
        if(r.error||r.data?.user?.id!==c.usuarioId)throw Error('No confirmado')
        return {usuarioId:c.usuarioId,contrasenaActualizada:true}
      }catch{throw parcial('No se confirmó la contraseña. Revisa Auth antes de repetir; esta operación no guarda datos del perfil.')}
    }
    if(['crear','crear_con_password'].includes(c.operacion)){
      let alta
      try{
        alta=c.operacion==='crear'
          ?await authAdmin.inviteUserByEmail(c.usuario.correo,{redirectTo:contexto.redirectTo,data:{nombre:c.usuario.nombre,apellidos:c.usuario.apellidos}})
          :await authAdmin.createUser({email:c.usuario.correo,password,email_confirm:true,ban_duration:'876000h',user_metadata:{nombre:c.usuario.nombre,apellidos:c.usuario.apellidos}})
      }catch{throw parcial('Auth no confirmó el alta. Revisa Dashboard antes de repetir.')}
      if(alta.error||!alta.data?.user?.id)throw parcial('Auth no confirmó el alta. Revisa Dashboard antes de repetir.')
      const id=alta.data.user.id
      try{
        const ban=await authAdmin.updateUserById(id,{ban_duration:'876000h'})
        if(ban.error)throw Error('Ban pendiente')
        const p=await ejecutarDb({...c,operacion:'crear',usuarioId:id})
        verificarPerfil(p,id,c.usuario)
        if(c.usuario.activo){const activar=await authAdmin.updateUserById(id,{ban_duration:'none'});if(activar.error)throw Error('Activación pendiente')}
        const a=await authAdmin.getUserById(id)
        if(a.error||a.data?.user?.id!==id||a.data.user.email?.toLowerCase()!==c.usuario.correo||!verificarEstado(a.data.user,c.usuario.activo))throw Error('Verificación Auth pendiente')
        return p
      }catch{
        await authAdmin.updateUserById(id,{ban_duration:'876000h'}).catch(()=>null)
        throw parcial('Alta incompleta. Revisa y reconcilia Auth y perfil en Dashboard; no repitas ni elimines automáticamente la cuenta.')
      }
    }
    if(c.operacion==='eliminar_definitivamente'){
      if(!eliminarConAuth)throw Object.assign(Error('Eliminación segura no configurada.'),{status:503})
      await ejecutarDb({...c,operacion:'preparar_eliminacion'})
      const ban=await authAdmin.updateUserById(c.usuarioId,{ban_duration:'876000h'})
      if(ban.error)throw parcial('Perfil desactivado; Auth no confirmó el bloqueo. Eliminación detenida.')
      let borradoIntentado=false
      try{await eliminarConAuth(c,async()=>{
        borradoIntentado=true
        const r=await authAdmin.deleteUser(c.usuarioId)
        if(r.error)throw parcial('Auth rechazó la eliminación. Se conserva la desactivación; revisa dependencias en Dashboard.')
      })}catch(e){
        if(!borradoIntentado||e.requiereRevision)throw e
        throw parcial('La eliminación requiere revisión en Auth y PostgreSQL; no se confirmó el resultado final.')
      }
      const auth=await authAdmin.getUserById(c.usuarioId)
      if(auth.data?.user||auth.error?.status!==404)throw parcial('Auth no confirmó la ausencia del usuario. Revisa Dashboard antes de repetir.')
      try{return await ejecutarDb({...c,operacion:'verificar_eliminacion'})}catch{throw parcial('Auth eliminó la cuenta pero falta confirmar PostgreSQL. Revisa Dashboard antes de repetir.')}
    }
    const p=await ejecutarDb(c)
    verificarPerfil(p,c.usuarioId,c.cambios||{})
    const cambios=c.cambios||{},authCambios={}
    if(cambios.correo!==undefined&&cambios.correo!==c.objetivo.correo)authCambios.email=cambios.correo
    if(cambios.activo!==undefined)authCambios.ban_duration=cambios.activo?'none':'876000h'
    if(Object.keys(authCambios).length){
      try{
      const r=await authAdmin.updateUserById(c.usuarioId,authCambios)
      if(r.error)throw parcial('Perfil actualizado; sincronización Auth pendiente. Revisa Dashboard antes de repetir.')
      const a=await authAdmin.getUserById(c.usuarioId)
      if(a.error||a.data?.user?.id!==c.usuarioId||!verificarEstado(a.data.user,cambios.activo)||(authCambios.email&&a.data.user.email?.toLowerCase()!==authCambios.email))throw parcial('No se pudo verificar la sincronización Auth. Revisión administrativa necesaria.')
      }catch(e){if(e.requiereRevision)throw e;throw parcial('Perfil actualizado; no se pudo confirmar Auth. Revisa Dashboard antes de repetir.')}
    }
    return p
  }
}

return {crearAdminUsuariosExecutor}
})();

const {parametrosAdministrarPerfil,crearAdminUsuariosPostgres}=(()=>{
// SQL parametrizado SOLO en Edge. No crea funciones, tablas, triggers ni políticas.
const CAMPOS=['id','nombre','apellidos','correo','telefono','avatar_url','rol','activo','fecha_creacion','fecha_actualizacion']
const PERSONAL=['nombre','apellidos','correo','telefono']
const fallo=(status,mensaje)=>Object.assign(Error(mensaje),{status})
function parametrosAdministrarPerfil(c,actual){
  const cambios=c.usuario||c.cambios||{}
  return {p_actor_id:c.actorId,p_usuario_id:c.usuarioId,
    p_nuevo_rol:cambios.rol!==undefined&&cambios.rol!==actual.rol?cambios.rol:null,
    p_nuevo_activo:cambios.activo!==undefined&&cambios.activo!==actual.activo?cambios.activo:null}
}
function crearAdminUsuariosPostgres({sql,deletionReviewed=false}){
  async function autorizar(tx,id){
    const [actor]=await tx`SELECT id,rol,activo FROM public.perfiles WHERE id=${id}::uuid FOR SHARE`
    if(actor?.rol!=='administrador'||actor?.activo!==true)throw fallo(403,'Se requiere un administrador activo.')
  }
  async function perfil(tx,id){const [row]=await tx`SELECT ${tx(CAMPOS)} FROM public.perfiles WHERE id=${id}::uuid`;return row||null}
  async function contrato(tx){
    const [f]=await tx`SELECT p.prorettype='void'::regtype AS retorna_void,p.prosecdef,
      p.proargnames[1:4]=ARRAY['p_actor_id','p_usuario_id','p_nuevo_rol','p_nuevo_activo'] AS parametros,
      coalesce(p.proconfig @> ARRAY['search_path=""'],false) AS ruta_segura,
      has_function_privilege(current_user,p.oid,'EXECUTE') AS permitido
      FROM pg_proc p WHERE p.oid=to_regprocedure('crm_internal.administrar_perfil(uuid,uuid,text,boolean)')`
    if(!f?.retorna_void||!f.prosecdef||!f.parametros||!f.ruta_segura||!f.permitido)throw fallo(503,'Revisar firma, SECURITY DEFINER, search_path y EXECUTE de administrar_perfil.')
  }
  async function cambiarAcceso(tx,c,actual){
    const p=parametrosAdministrarPerfil(c,actual)
    if(p.p_nuevo_rol===null&&p.p_nuevo_activo===null)return
    if(c.actorId===c.usuarioId)throw fallo(403,'No puedes modificar tu propio acceso.')
    // Retorno void: releer el perfil después, nunca interpretar el retorno como fila.
    await tx`SELECT crm_internal.administrar_perfil(
      p_actor_id => ${p.p_actor_id}::uuid,p_usuario_id => ${p.p_usuario_id}::uuid,
      p_nuevo_rol => ${p.p_nuevo_rol}::text,p_nuevo_activo => ${p.p_nuevo_activo}::boolean)`
  }
  async function dependencias(tx,id){
    if(!deletionReviewed)throw fallo(503,'Eliminación bloqueada: revisar FK, triggers, Storage y dependencias en Dashboard.')
    const fks=await tx`SELECT n.nspname AS esquema,t.relname AS tabla,c.confdeltype,c.condeferrable,
      c.conrelid='public.perfiles'::regclass AS es_perfil,c.confrelid='auth.users'::regclass AS a_auth,
      cardinality(c.conkey) AS columnas,a.attname AS columna,r.attname AS referencia
      FROM pg_constraint c JOIN pg_class t ON t.oid=c.conrelid JOIN pg_namespace n ON n.oid=t.relnamespace
      JOIN pg_attribute a ON a.attrelid=c.conrelid AND a.attnum=c.conkey[1]
      JOIN pg_attribute r ON r.attrelid=c.confrelid AND r.attnum=c.confkey[1]
      WHERE c.contype='f' AND c.confrelid IN ('public.perfiles'::regclass,'auth.users'::regclass) AND n.nspname<>'auth'`
    const cascada=f=>f.es_perfil&&f.a_auth&&f.columna==='id'&&f.referencia==='id'&&f.columnas===1&&f.confdeltype==='c'
    if(!fks.some(cascada))throw fallo(409,'Revisar FK perfiles.id a auth.users.id ON DELETE CASCADE.')
    for(const fk of fks){
      if(cascada(fk))continue
      // RESTRICT/NO ACTION protege también de referencias creadas después de esta lectura.
      if(fk.columnas!==1||fk.referencia!=='id'||fk.condeferrable||!['a','r'].includes(fk.confdeltype))throw fallo(409,'Hay FK con propagación de cambios o estructura no verificada. Eliminación bloqueada.')
      const [row]=await tx`SELECT EXISTS(SELECT 1 FROM ${tx(fk.esquema)}.${tx(fk.tabla)} WHERE ${tx(fk.columna)}=${id}::uuid) AS existe`
      if(row.existe)throw fallo(409,'El usuario tiene registros vinculados. Desactívalo para conservarlos.')
    }
  }
  async function ejecutarDb(c){
    try{return await sql.begin(async tx=>{
      await tx`SET LOCAL statement_timeout='15s'`
      await tx`SET LOCAL lock_timeout='5s'`
      await autorizar(tx,c.actorId)
      if(c.operacion==='listar')return tx`SELECT ${tx(CAMPOS)} FROM public.perfiles ORDER BY nombre,id`
      if(c.operacion==='historial'){
        // Esquema confirmado desde Dashboard: no snapshots JSON ni nombres supuestos.
        return tx`SELECT a.id,a.usuario_id,a.realizado_por,a.rol_anterior,a.rol_nuevo,
          a.activo_anterior,a.activo_nuevo,a.fecha_cambio,
          actor.nombre AS actor_nombre,actor.apellidos AS actor_apellidos,
          objetivo.correo AS usuario_correo
          FROM public.auditoria_usuarios a
          LEFT JOIN public.perfiles actor ON actor.id=a.realizado_por
          LEFT JOIN public.perfiles objetivo ON objetivo.id=a.usuario_id
          ORDER BY a.fecha_cambio DESC,a.id DESC LIMIT 200`
      }
      await contrato(tx)
      if(c.operacion==='preflight'){
        if(c.usuario){const [r]=await tx`SELECT EXISTS(SELECT 1 FROM auth.users WHERE lower(email)=lower(${c.usuario.correo})) AS existe`
          if(r.existe)throw fallo(409,'El correo ya tiene una cuenta Auth. No se creará otra cuenta.')}
        return {contrato:'administrar-perfil-existente-v1'}
      }
      if(c.operacion==='crear'){
        const [auth]=await tx`SELECT id,email FROM auth.users WHERE id=${c.usuarioId}::uuid`
        if(!auth||auth.email?.toLowerCase()!==c.usuario.correo)throw fallo(409,'Auth no confirmó la cuenta invitada.')
        await tx`INSERT INTO public.perfiles (id,nombre,apellidos,correo,telefono,rol,activo)
          VALUES (${c.usuarioId}::uuid,${c.usuario.nombre},${c.usuario.apellidos},${c.usuario.correo},${c.usuario.telefono},'ejecutivo',false)
          ON CONFLICT(id) DO NOTHING`
      }
      const actual=await perfil(tx,c.usuarioId)
      if(c.operacion==='verificar_eliminacion'){
        const [auth]=await tx`SELECT id FROM auth.users WHERE id=${c.usuarioId}::uuid`
        if(actual||auth)throw fallo(409,'Eliminación no confirmada en PostgreSQL.')
        return {id:c.usuarioId,eliminado:true}
      }
      if(!actual)throw fallo(404,'El perfil solicitado no existe.')
      if(c.operacion==='preparar_eliminacion'){
        if(c.usuarioId===c.actorId)throw fallo(403,'No puedes eliminar tu propia cuenta.')
        if(actual.correo!==c.confirmacion)throw fallo(409,'El correo cambió; recarga el listado.')
        await dependencias(tx,c.usuarioId)
        if(actual.activo!==false)throw fallo(409,'Desactiva primero al usuario. Su historial y referencias se conservarán.')
        return {id:c.usuarioId,preparado:true}
      }
      if(!['crear','editar','cambiar_estado'].includes(c.operacion))throw fallo(400,'Operación no permitida.')
      const cambios=c.usuario||c.cambios||{}
      const personal=Object.fromEntries(PERSONAL.filter(k=>Object.hasOwn(cambios,k)).map(k=>[k,cambios[k]]))
      if(Object.keys(personal).length)await tx`UPDATE public.perfiles SET ${tx(personal,...Object.keys(personal))},fecha_actualizacion=now() WHERE id=${c.usuarioId}::uuid`
      await cambiarAcceso(tx,c,actual)
      return perfil(tx,c.usuarioId)
    })}catch(e){
      if(e.status)throw e
      const conflicto=['23503','23505','23514','P0001','40001','40P01','55P03'].includes(e.code)
      throw fallo(e.code==='42501'?403:conflicto?409:503,conflicto?'La base de datos rechazó el cambio por reglas administrativas, dependencias o concurrencia. Recarga el listado.':'PostgreSQL rechazó la operación. Revisa permisos y contrato en Dashboard.')
    }
  }
  return {ejecutarDb,eliminarConAuth:async(c,borrar)=>sql.begin(async tx=>{
    await tx`SET LOCAL statement_timeout='15s'`
    await tx`SET LOCAL lock_timeout='5s'`
    await autorizar(tx,c.actorId)
    const actual=await perfil(tx,c.usuarioId)
    if(c.actorId===c.usuarioId||!actual||actual.activo!==false||actual.correo!==c.confirmacion)throw fallo(409,'Recarga el perfil y confirma que permanece inactivo antes de eliminar.')
    await dependencias(tx,c.usuarioId)
    // El actor permanece activo bajo FOR SHARE hasta terminar Auth. No se bloquea
    // el perfil objetivo, pues Auth necesita borrarlo mediante su FK CASCADE.
    return borrar()
  }),perfilPorId:id=>perfil(sql,id),contarAdminsActivos:async()=>{
    const [r]=await sql`SELECT count(*)::integer AS total FROM public.perfiles WHERE rol='administrador' AND activo=true`;return r.total}}
}

return {parametrosAdministrarPerfil,crearAdminUsuariosPostgres}
})();

import { createClient } from 'npm:@supabase/supabase-js@2.112.4'
import postgres from 'npm:postgres@3.4.7'


const env=(name:string)=>Deno.env.get(name)||''
const url=env('SUPABASE_URL'),anon=env('SUPABASE_ANON_KEY'),service=env('SUPABASE_SERVICE_ROLE_KEY')
const dbUrl=env('CRM_ADMIN_DATABASE_URL')
const projectRef=env('CRM_ADMIN_PROJECT_REF')
const opcionesWeb={allowedOrigins:env('CRM_ADMIN_ALLOWED_ORIGINS'),inviteRedirectLocal:env('CRM_ADMIN_INVITE_REDIRECT_LOCAL'),inviteRedirectProduction:env('CRM_ADMIN_INVITE_REDIRECT_PRODUCTION')}
const revisionWeb=revisarOrigenesAdmin(opcionesWeb)
let webConfig: ReturnType<typeof configurarOrigenesAdmin> | undefined
if(!revisionWeb.fallidas.length)webConfig=configurarOrigenesAdmin(opcionesWeb)
// Diagnóstico estático equivalente a las guardas previas; no prueba conexiones.
const revision=evaluarConfiguracionAdmin({url,dbUrl,projectRef,anon,service,fallasWeb:revisionWeb.fallidas})
function configuracionValida(){return revision.valida}
// Solo logs privados de Edge/Dashboard, nunca valores ni excepciones originales.
if(revision.fallidas.length)console.error(JSON.stringify({comprobaciones_fallidas:revision.fallidas}))
const configured=configuracionValida()
const enabled=configured&&env('CRM_ADMIN_USERS_ENABLED')==='true'
const writesEnabled=enabled&&env('CRM_ADMIN_USERS_STAGING_VALIDATED')==='true'&&env('CRM_ADMIN_DB_CONTRACT_VERIFIED')==='true'
const sql=configured?postgres(dbUrl,{prepare:false,max:1,ssl:'require',connect_timeout:10,idle_timeout:20}):null
const db=sql?crearAdminUsuariosPostgres({sql,deletionReviewed:env('CRM_ADMIN_DELETE_DEPENDENCIES_VERIFIED')==='true'}):null
const opts={auth:{persistSession:false,autoRefreshToken:false}}
const auth=configured?createClient(url,anon,opts):null
const admin=configured?createClient(url,service,opts):null
const ejecutar=crearAdminUsuariosExecutor({authAdmin:admin?.auth.admin,ejecutarDb:db?.ejecutarDb,eliminarConAuth:db?.eliminarConAuth})
const passwordWritesEnabled=habilitarPasswordWritesAdmin({
  projectRef,writesEnabled,passwordWritesValidated:env('CRM_ADMIN_PASSWORD_WRITES_VALIDATED')==='true',
  productionAuthorized:env('CRM_ADMIN_PASSWORD_PRODUCTION_AUTHORIZED')==='true',
})
const handler=crearAdminUsuariosHandler({enabled,writesEnabled,passwordWritesEnabled,
  authenticate:async(token:string)=>{if(!auth)return null;const {data,error}=await auth.auth.getUser(token);return error?null:data.user},
  cargarPerfil:db?.perfilPorId,contarAdminsActivos:db?.contarAdminsActivos,ejecutar})
// Independiente del pool PostgreSQL para diagnosticarlo incluso si falta su URL.
// Auth y RLS verifican el perfil real con el JWT del solicitante, sin usar Auth Admin.
let authDiagnostico: ReturnType<typeof createClient> | undefined
try{if(url&&anon)authDiagnostico=createClient(url,anon,opts)}catch{/*No exponer URL/clave ni excepciones.*/}
const diagnosticar=crearDiagnosticoConfiguracionAdmin({fallidas:revision.fallidas,autenticarAdmin:async(token:string)=>{
  if(!authDiagnostico)return 503
  const identity=await authDiagnostico.auth.getUser(token)
  if(identity.error||!identity.data.user)return 401
  const caller=createClient(url,anon,{...opts,global:{headers:{Authorization:`Bearer ${token}`}}})
  const {data,error}=await caller.from('perfiles').select('id,rol,activo').eq('id',identity.data.user.id).maybeSingle()
  if(error)return 503
  return data?.id===identity.data.user.id&&data?.rol==='administrador'&&data?.activo===true?200:403
}})
Deno.serve(crearAdminUsuariosHttp({handler,webConfig,configured,diagnosticar,diagnosticOrigins:revisionWeb.origins}))
