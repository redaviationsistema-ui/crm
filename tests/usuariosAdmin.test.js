import test from 'node:test'
import assert from 'node:assert/strict'
import {crearUsuariosAdminService,crearUsuariosAdminNavegador} from '../src/services/usuariosAdminService.js'
import {crearUsuariosAdminBackend} from '../src/services/usuariosAdminBackend.js'
import {validarCambioUsuarioAdmin} from '../src/domain/usuariosAdmin.js'
const usuario={nombre:'Prueba',apellidos:'Usuario',correo:'persona@example.test',telefono:'',rol:'ejecutivo',activo:true}
function backend(fetchImpl,extra={}){return crearUsuariosAdminBackend({endpoint:'https://proyecto.supabase.co/functions/v1/admin-usuarios',obtenerToken:async()=>'jwt-de-prueba',fetchImpl,...extra})}
test('sin backend o conexion valida no hay fallback ni usuarios sinteticos',async()=>{
  assert.throws(()=>crearUsuariosAdminService(),/Falta configurar/)
  const servicio=crearUsuariosAdminNavegador({obtenerCliente:async()=>{throw Error('sin config')}})
  await assert.rejects(servicio.listar(),/Supabase no está configurado/)
})
test('lista reales mediante JWT y extrae envoltura resultado del servidor',async()=>{
  let solicitud
  const b=backend(async(url,opciones)=>{solicitud={url,opciones};return {ok:true,json:async()=>({resultado:[{...usuario,id:'id-real'}]})}})
  const servicio=crearUsuariosAdminService({backend:b})
  assert.equal((await servicio.listar())[0].id,'id-real')
  assert.equal(solicitud.opciones.headers.Authorization,'Bearer jwt-de-prueba')
  assert.deepEqual(JSON.parse(solicitud.opciones.body),{operacion:'listar'})
})
test('HTTP 200 vacio o error remoto no se convierte en exito',async()=>{
  await assert.rejects(backend(async()=>({ok:true,json:async()=>({})})).crear(usuario),/no devolvió/)
  await assert.rejects(backend(async()=>({ok:false,status:403,json:async()=>({error:'Administrador requerido'})})).listar(),/Administrador requerido/)
})
test('doble envio realiza una llamada y no envia el actor proporcionado por Vue',async()=>{
  let liberar,llamadas=0,payload
  const b=backend(async(_url,opciones)=>{llamadas++;payload=JSON.parse(opciones.body);await new Promise(r=>liberar=r);return {ok:true,json:async()=>({resultado:{id:'nuevo'}})}})
  const servicio=crearUsuariosAdminService({backend:b}),pendiente=servicio.crear({id:'actor-falso'},usuario)
  await assert.rejects(servicio.crear(null,usuario),/en curso/)
  await new Promise(r=>setImmediate(r));liberar();await pendiente
  assert.equal(llamadas,1);assert.equal(payload.actorId,undefined)
})
test('configuracion apagada o sesion ausente no realiza fetch',async()=>{
  let llamadas=0
  await assert.rejects(backend(()=>llamadas++,{habilitado:false}).listar(),/desactivada/)
  await assert.rejects(backend(()=>llamadas++,{obtenerToken:async()=>null}).listar(),/Inicia sesión/)
  assert.equal(llamadas,0)
})
test('validaciones de dominio conservan proteccion propia y ultimo administrador',()=>{
  const admin={...usuario,id:'admin',rol:'administrador'}
  assert.throws(()=>validarCambioUsuarioAdmin({actor:admin,usuarios:[admin],actual:admin,cambios:{activo:false}}),/propia cuenta/)
  assert.throws(()=>validarCambioUsuarioAdmin({actor:{...admin,id:'otro'},usuarios:[admin],actual:admin,cambios:{rol:'ejecutivo'}}),/último administrador/)
})

test('navegador utiliza proyecto y JWT actuales sin credenciales privilegiadas',async()=>{
  let solicitud
  const cliente={supabaseUrl:'https://proyecto.supabase.co',supabaseKey:'sb_publishable_test',auth:{getUser:async()=>({data:{user:{id:'admin'}}}),getSession:async()=>({data:{session:{user:{id:'admin'},access_token:'JWT_de_usuario'}}})}}
  const servicio=crearUsuariosAdminNavegador({obtenerCliente:async()=>cliente,fetchImpl:async(url,opciones)=>{solicitud={url,opciones};return {ok:true,json:async()=>({resultado:[]})}}})
  assert.deepEqual(await servicio.listar(),[])
  assert.equal(solicitud.url,'https://proyecto.supabase.co/functions/v1/admin-usuarios')
  assert.equal(solicitud.opciones.headers.apikey,'sb_publishable_test')
  assert.equal(solicitud.opciones.headers.Authorization,'Bearer JWT_de_usuario')
  cliente.supabaseKey='sb_secret_no_permitida'
  await assert.rejects(servicio.listar(),/clave pública/)
})
