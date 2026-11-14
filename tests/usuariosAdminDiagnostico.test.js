import test from 'node:test'
import assert from 'node:assert/strict'
import {diagnosticarConexionUsuarios,esDesarrolloLocalAdmin} from '../src/services/usuariosAdminDiagnostico.js'
const cliente=()=>({supabaseUrl:'https://aaaaaaaaaaaaaaaaaaaa.supabase.co',supabaseKey:'sb_publishable_test',auth:{getUser:async()=>({data:{user:{id:'admin'}}}),getSession:async()=>({data:{session:{user:{id:'admin'},access_token:'jwt-canary'}}})}})
test('diagnóstico usa exclusivamente la sesión existente y envía solo la operación',async()=>{
  let calls=0
  const resultado=await diagnosticarConexionUsuarios({obtenerCliente:cliente,fetchImpl:async(url,options)=>{
    calls++;assert.equal(url,'https://aaaaaaaaaaaaaaaaaaaa.supabase.co/functions/v1/admin-usuarios')
    assert.equal(options.headers.Authorization,'Bearer jwt-canary')
    assert.deepEqual(JSON.parse(options.body),{operacion:'diagnosticar_configuracion'})
    assert.equal(options.method,'POST')
    return Response.json({comprobaciones_fallidas:['POSTGRESQL_PROYECTO','password-canary',{token:'jwt-canary'}],error:'password-canary',clave:'secret-canary'})
  }})
  assert.equal(calls,1)
  assert.deepEqual(resultado,{http:200,comprobaciones_fallidas:['POSTGRESQL_PROYECTO']})
  assert.doesNotMatch(JSON.stringify(resultado),/canary/)
})
for(const status of [401,403,404,503])test(`HTTP ${status} no muestra cuerpos de error ni etiquetas no autorizadas`,async()=>{
  const r=await diagnosticarConexionUsuarios({obtenerCliente:cliente,fetchImpl:async()=>Response.json({error:'password-canary',comprobaciones_fallidas:['POSTGRESQL_PROYECTO']},{status})})
  assert.deepEqual(r,{http:status,comprobaciones_fallidas:[]})
})
test('fallos de red y respuestas no JSON no exponen sus mensajes',async()=>{
  const r=await diagnosticarConexionUsuarios({obtenerCliente:cliente,fetchImpl:async()=>{throw Error('jwt-canary secret-canary')}})
  assert.deepEqual(r,{http:null,comprobaciones_fallidas:[]})
  const html=await diagnosticarConexionUsuarios({obtenerCliente:cliente,fetchImpl:async()=>new Response('password-canary',{status:502})})
  assert.deepEqual(html,{http:502,comprobaciones_fallidas:[]})
})
test('sin sesión verificada, con otra identidad o clave privilegiada no realiza la petición',async()=>{
  for(const c of [
    {...cliente(),auth:{getUser:async()=>({error:Error()}),getSession:async()=>({})}},
    {...cliente(),auth:{...cliente().auth,getSession:async()=>({data:{session:{user:{id:'otro'},access_token:'jwt-canary'}}})}},
    {...cliente(),supabaseKey:'sb_secret_canary'},
  ]){
    let calls=0
    const r=await diagnosticarConexionUsuarios({obtenerCliente:()=>c,fetchImpl:()=>calls++})
    assert.equal(calls,0);assert.deepEqual(r,{http:null,comprobaciones_fallidas:[]})
  }
})
test('control local exige DEV y el origen localhost autorizado',()=>{
  assert.equal(esDesarrolloLocalAdmin(true,'http://localhost:5173'),true)
  for(const [dev,origin] of [[false,'http://localhost:5173'],[true,'https://redskyg.com'],[true,'http://localhost:5174'],[undefined,undefined]])assert.equal(esDesarrolloLocalAdmin(dev,origin),false)
})
