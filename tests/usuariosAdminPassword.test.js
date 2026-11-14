import test from 'node:test'
import assert from 'node:assert/strict'
import {generarPasswordSegura,validarPasswordAdministrativa} from '../src/domain/passwordUsuario.js'
import {crearAdminUsuariosExecutor} from '../supabase/functions/_shared/adminUsuariosExecutor.js'
import {crearAdminUsuariosHandler,crearLimitePassword} from '../supabase/functions/_shared/adminUsuarios.js'
import {crearUsuariosAdminBackend} from '../src/services/usuariosAdminBackend.js'
import {crearUsuariosAdminNavegador,crearUsuariosAdminService} from '../src/services/usuariosAdminService.js'
import {habilitarPasswordWritesAdmin} from '../supabase/functions/_shared/adminUsuariosPasswordPolicy.js'
const password='Aa9!Bb8@Cc7#Dd6$'
const usuario={nombre:'Prueba',apellidos:'Staging',correo:'prueba@example.test',telefono:'',rol:'ejecutivo',activo:true}
const actor={id:'admin',rol:'administrador',activo:true}
const objetivo={...usuario,id:'destino'}
const request=(body,token='valido')=>new Request('https://edge.example.test',{method:'POST',headers:token?{Authorization:`Bearer ${token}`}:{},body:JSON.stringify(body)})
function handler({writesEnabled=true,passwordWritesEnabled=false,perfil=actor,ejecutar=async()=>({usuarioId:'destino',contrasenaActualizada:true}),...extra}={}){
  return crearAdminUsuariosHandler({enabled:true,writesEnabled,passwordWritesEnabled,authenticate:async t=>t==='valido'?actor:null,cargarPerfil:async id=>id===actor.id?perfil:objetivo,contarAdminsActivos:async()=>2,ejecutar,...extra})
}
test('generación criptográfica y política 12–128; no usa Math.random ni expone valores',()=>{
  const anterior=Math.random;Math.random=()=>{throw Error('No permitido')}
  try{for(let i=0;i<100;i++){const p=generarPasswordSegura();assert.equal(validarPasswordAdministrativa(p,p),'')}}finally{Math.random=anterior}
  for(const p of ['Aa1!abcdEF23','Aa1!'+ 'a'.repeat(124)])assert.equal(validarPasswordAdministrativa(p,p),'')
  for(const p of ['Aa1!abcDEF2','Aa1!'+'a'.repeat(125),'abcdefghijklmnop','Abcdef1234567890'])assert.ok(validarPasswordAdministrativa(p,p))
  assert.match(validarPasswordAdministrativa(password,'otra'),/no coinciden/)
  assert.throws(()=>generarPasswordSegura({}),/generación segura/)
})
test('payloads exactos: editar nunca contiene seguridad, password ni confirmacion',async()=>{
  const payloads=[]
  const backend=crearUsuariosAdminBackend({endpoint:'https://aaaaaaaaaaaaaaaaaaaa.supabase.co/functions/v1/admin-usuarios',obtenerToken:async()=>'jwt-test',fetchImpl:async(_url,options)=>{
    const body=JSON.parse(options.body);payloads.push(body)
    return Response.json({resultado:body.operacion==='cambiar_password'?{usuarioId:'destino',contrasenaActualizada:true}:{id:'destino'}})
  }})
  await backend.editar('destino',usuario,{password,confirmacion:password})
  await backend.crear(usuario,{password,confirmacion:password})
  await backend.cambiarPassword('destino',password)
  await backend.crearConPassword(usuario,password)
  assert.deepEqual(payloads,[{operacion:'editar',usuarioId:'destino',cambios:usuario},{operacion:'crear',usuario},{operacion:'cambiar_password',usuarioId:'destino',password},{operacion:'crear_con_password',usuario,password}])
})
test('el navegador envía cambiar_password solo a admin-usuarios con la sesión vigente',async()=>{
  const llamadas=[]
  const cliente={supabaseUrl:'https://abcdefghijklmnopqrst.supabase.co',supabaseKey:'sb_publishable_test',auth:{
    getUser:async()=>({data:{user:{id:'admin'}},error:null}),
    getSession:async()=>({data:{session:{access_token:'jwt-test',user:{id:'admin'}}},error:null}),
  }}
  const servicio=crearUsuariosAdminNavegador({obtenerCliente:async()=>cliente,fetchImpl:async(url,options)=>{
    llamadas.push({url,options});return Response.json({resultado:{usuarioId:'destino',contrasenaActualizada:true}})
  }})
  assert.deepEqual(await servicio.cambiarPassword(actor,'destino',password),{usuarioId:'destino',contrasenaActualizada:true})
  assert.equal(llamadas.length,1)
  assert.equal(llamadas[0].url,'https://abcdefghijklmnopqrst.supabase.co/functions/v1/admin-usuarios')
  assert.equal(llamadas[0].options.method,'POST')
  assert.equal(llamadas[0].options.headers.Authorization,'Bearer jwt-test')
  assert.deepEqual(JSON.parse(llamadas[0].options.body),{operacion:'cambiar_password',usuarioId:'destino',password})
})
test('el servicio acepta solo una confirmación normalizada para el usuario solicitado',async()=>{
  const service=crearUsuariosAdminService({backend:{cambiarPassword:async()=>({usuarioId:'destino',contrasenaActualizada:true})}})
  assert.deepEqual(await service.cambiarPassword(actor,'destino',password),{usuarioId:'destino',contrasenaActualizada:true})
  const mismatch=crearUsuariosAdminService({backend:{cambiarPassword:async()=>({usuarioId:'otro',contrasenaActualizada:true})}})
  await assert.rejects(mismatch.cambiarPassword(actor,'destino',password),e=>e.tipoResultado==='incierto'&&e.requiereRevision===true&&!e.message.includes(password))
})
test('cambiar_password clasifica confirmación, rechazo, bloqueo y resultado incierto sin exponer secretos',async()=>{
  const backendCon=fetchImpl=>crearUsuariosAdminBackend({endpoint:'https://aaaaaaaaaaaaaaaaaaaa.supabase.co/functions/v1/admin-usuarios',obtenerToken:async()=>'jwt-test',fetchImpl})
  const response=(status,body)=>Response.json(body,{status})
  const confirmado=backendCon(async()=>response(200,{resultado:{usuarioId:'destino',contrasenaActualizada:true}}))
  assert.deepEqual(await confirmado.cambiarPassword('destino',password),{usuarioId:'destino',contrasenaActualizada:true})
  const respuestaPublicadaAnterior=backendCon(async()=>response(200,{resultado:{id:'destino',password_actualizado:true}}))
  assert.deepEqual(await respuestaPublicadaAnterior.cambiarPassword('destino',password),{usuarioId:'destino',contrasenaActualizada:true})
  for(const [status,body,tipo] of [
    [400,{error:password},'rechazado'],
    [503,{error:'Operaciones de contraseña bloqueadas o no disponibles.'},'bloqueado'],
    [503,{error:'Respuesta no reconocida'},'incierto'],
    [409,{error:password,requiereRevision:true},'incierto'],
    [500,{error:password},'incierto'],
  ]){
    const backend=backendCon(async()=>response(status,body))
    await assert.rejects(backend.cambiarPassword('destino',password),e=>{
      assert.equal(e.status,status);assert.equal(e.tipoResultado,tipo);assert.equal(e.message.includes(password),false)
      return true
    })
  }
  const red=backendCon(async()=>{throw Error(password)})
  await assert.rejects(red.cambiarPassword('destino',password),e=>e.tipoResultado==='incierto'&&e.requiereRevision===true&&!e.message.includes(password))
  for(const resultado of [
    {usuarioId:'otro',contrasenaActualizada:true},
    {usuarioId:'destino',contrasenaActualizada:false},
    {id:'otro',password_actualizado:true},
    null,
  ]){
    const incompleto=backendCon(async()=>response(200,{resultado}))
    await assert.rejects(incompleto.cambiarPassword('destino',password),e=>e.tipoResultado==='incierto'&&e.requiereRevision===true&&!e.message.includes(password))
  }
})
test('el backend exige las guardas generales y autorización adicional para producción',()=>{
  const projectRef='hhlicjgpwcesytziacvc'
  assert.equal(habilitarPasswordWritesAdmin({projectRef,writesEnabled:true,passwordWritesValidated:true}),false)
  assert.equal(habilitarPasswordWritesAdmin({projectRef,writesEnabled:true,passwordWritesValidated:true,productionAuthorized:true}),true)
  assert.equal(habilitarPasswordWritesAdmin({projectRef,writesEnabled:false,passwordWritesValidated:true,productionAuthorized:true}),false)
  assert.equal(habilitarPasswordWritesAdmin({projectRef,writesEnabled:true,passwordWritesValidated:false,productionAuthorized:true}),false)
  assert.equal(habilitarPasswordWritesAdmin({projectRef:'abcdefghijklmnopqrst',writesEnabled:true,passwordWritesValidated:true}),true)
  assert.equal(habilitarPasswordWritesAdmin({writesEnabled:true,passwordWritesValidated:true,productionAuthorized:true}),false)
})
for(const operacion of ['cambiar_password','crear_con_password'])test(`${operacion}: JWT, administrador activo y ambos bloqueos son obligatorios`,async()=>{
  const body=operacion==='cambiar_password'?{operacion,usuarioId:'destino',password}:{operacion,usuario,password}
  assert.equal((await handler({passwordWritesEnabled:true})(request(body,null))).status,401)
  for(const perfil of [{...actor,activo:false},{...actor,rol:'ejecutivo'},{...actor,rol:'supervisor'}])assert.equal((await handler({passwordWritesEnabled:true,perfil})(request(body))).status,403)
  assert.equal((await handler()(request(body))).status,503)
  assert.equal((await handler({writesEnabled:false,passwordWritesEnabled:true})(request(body))).status,503)
  assert.equal((await handler({passwordWritesEnabled:true})(request(body))).status,200)
})
test('Edge Function devuelve el contrato de confirmación con el usuario objetivo',async()=>{
  const r=await handler({passwordWritesEnabled:true})(request({operacion:'cambiar_password',usuarioId:'destino',password}))
  assert.deepEqual(await r.json(),{resultado:{usuarioId:'destino',contrasenaActualizada:true}})
})
test('cambiar_password rechaza el cambio propio antes de llamar al executor',async()=>{
  let ejecuciones=0
  const run=handler({passwordWritesEnabled:true,ejecutar:async()=>{ejecuciones++;return {usuarioId:actor.id,contrasenaActualizada:true}}})
  const r=await run(request({operacion:'cambiar_password',usuarioId:actor.id,password}))
  assert.equal(r.status,403)
  assert.equal((await r.json()).error,'No puedes cambiar tu propia contraseña mediante esta operación.')
  assert.equal(ejecuciones,0)
})
test('rechaza contratos antiguos y confirmacion transmitida; errores no contienen secretos',async()=>{
  const run=handler({passwordWritesEnabled:true})
  for(const body of [{operacion:'editar',usuarioId:'destino',cambios:{nombre:'Prueba'},seguridad:{password}},{operacion:'crear',usuario,seguridad:{password}},{operacion:'cambiar_password',usuarioId:'destino',password,confirmacion:password},{operacion:'crear_con_password',usuario,password:'demasiado-corta'}]){
    const r=await run(request(body));assert.equal(r.status,400);assert.equal((await r.text()).includes(password),false)
  }
  const r=await handler({passwordWritesEnabled:true,ejecutar:async()=>{throw Object.assign(Error(password),{status:409})}})(request({operacion:'cambiar_password',usuarioId:'destino',password}))
  assert.equal((await r.text()).includes(password),false)
})
test('límite de intentos cuenta errores, bloquea concurrencia y se recupera tras ventana',async()=>{
  let ahora=0,fin
  const limite=crearLimitePassword({ahora:()=>ahora,maximo:2,ventana:60000})
  const release=limite('admin');assert.throws(()=>limite('admin'),e=>e.status===429);release()
  limite('admin')();assert.throws(()=>limite('admin'),e=>e.status===429)
  ahora=60001;limite('admin')()
  const run=handler({passwordWritesEnabled:true,limitePassword:crearLimitePassword({maximo:1})})
  assert.equal((await run(request({operacion:'cambiar_password',usuarioId:'destino',password:'corta'}))).status,400)
  assert.equal((await run(request({operacion:'cambiar_password',usuarioId:'destino',password}))).status,429)
  const bloqueado=handler({passwordWritesEnabled:true,ejecutar:()=>new Promise(r=>fin=r)})
  const first=bloqueado(request({operacion:'cambiar_password',usuarioId:'destino',password}))
  while(!fin)await new Promise(r=>setTimeout(r,0))
  assert.equal((await bloqueado(request({operacion:'cambiar_password',usuarioId:'destino',password}))).status,429)
  fin({usuarioId:'destino',contrasenaActualizada:true});await first
})
function executor({fallarPerfil=false,fallarAuth=false}={}){
  const sql=[],auth=[],mail=[]
  const run=crearAdminUsuariosExecutor({authAdmin:{
    createUser:async datos=>{auth.push({crear:datos});return {data:{user:{id:'destino'}}}},
    inviteUserByEmail:async(email,options)=>{mail.push({email,options});return {data:{user:{id:'destino'}}}},
    updateUserById:async(id,datos)=>{auth.push({actualizar:datos});return fallarAuth?{error:Error(password)}:{data:{user:{id}}}},
    getUserById:async()=>({data:{user:{id:'destino',email:usuario.correo}}}),
  },ejecutarDb:async c=>{sql.push(c);if(c.operacion==='preflight')return {contrato:'administrar-perfil-existente-v1'};if(fallarPerfil)throw Error('No disponible');return {id:'destino',...usuario}}})
  return {run,sql,auth,mail}
}
test('cambiar_password no escribe perfil y no devuelve secretos; Auth fallido es no confirmado',async()=>{
  const e=executor();const r=await e.run({operacion:'cambiar_password',actorId:'admin',usuarioId:'destino',password})
  assert.deepEqual(r,{usuarioId:'destino',contrasenaActualizada:true});assert.deepEqual(e.sql.map(c=>c.operacion),['preflight'])
  assert.deepEqual(e.auth,[{actualizar:{password}}]);assert.equal(JSON.stringify(e.sql).includes(password),false)
  await assert.rejects(executor({fallarAuth:true}).run({operacion:'cambiar_password',actorId:'admin',usuarioId:'destino',password}),e=>e.requiereRevision===true&&!e.message.includes(password))
})
test('alta directa usa createUser confirmado y bloqueado, jamás invita ni pasa password a PostgreSQL',async()=>{
  const e=executor();const r=await e.run({operacion:'crear_con_password',actorId:'admin',usuario,password})
  assert.equal(e.mail.length,0);assert.equal(e.auth[0].crear.email_confirm,true);assert.equal(e.auth[0].crear.ban_duration,'876000h');assert.equal(e.auth[0].crear.password,password)
  for(const salida of [r,e.sql])assert.equal(JSON.stringify(salida).includes(password),false)
  assert.equal(e.sql.at(-1).operacion,'crear')
})
test('invitación conserva una sola vía; alta parcial queda contenida sin eliminación automática',async()=>{
  const e=executor();await e.run({operacion:'crear',actorId:'admin',usuario},{redirectTo:'https://redskyg.com/crm/establecer-acceso'})
  assert.equal(e.mail.length,1);assert.equal(e.auth.some(c=>c.crear),false)
  const parcial=executor({fallarPerfil:true});await assert.rejects(parcial.run({operacion:'crear_con_password',actorId:'admin',usuario,password}),e=>e.requiereRevision===true)
  assert.deepEqual(parcial.auth.at(-1),{actualizar:{ban_duration:'876000h'}})
})
