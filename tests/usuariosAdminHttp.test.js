import test from 'node:test'
import assert from 'node:assert/strict'
import {crearAdminUsuariosHttp} from '../supabase/functions/_shared/adminUsuariosHttp.js'
import {configurarOrigenesAdmin} from '../supabase/functions/_shared/adminUsuariosOrigins.js'
import {crearAdminUsuariosHandler} from '../supabase/functions/_shared/adminUsuarios.js'
import {crearAdminUsuariosExecutor} from '../supabase/functions/_shared/adminUsuariosExecutor.js'
const local='http://localhost:5173',production='https://redskyg.com'
const configuracion={allowedOrigins:JSON.stringify([local,production]),inviteRedirectLocal:`${local}/crm/establecer-acceso`,inviteRedirectProduction:`${production}/crm/establecer-acceso`}
const webConfig=configurarOrigenesAdmin(configuracion)
function request({method='POST',origin=local,token='jwt-admin',body={operacion:'listar'},headers={},url='https://edge.example.test/functions/v1/admin-usuarios'}={}){
  return new Request(url,{method,
    headers:{...(origin!==null?{Origin:origin}:{}),...(token?{Authorization:`Bearer ${token}`}:{}) ,'Content-Type':'application/json',...headers},
    ...(method!=='OPTIONS'?{body:JSON.stringify(body)}:{})})
}
function construir({writesEnabled=false}={}){
  const invitaciones=[],comandos=[],cuentas=new Map()
  const authAdmin={
    inviteUserByEmail:async(correo,options)=>{
      // Ceder ejecución permite detectar contaminación entre peticiones concurrentes.
      await new Promise(resolve=>setTimeout(resolve,2))
      const id=`cuenta-${correo}`;cuentas.set(id,{id,email:correo,banned_until:null})
      invitaciones.push({correo,...options});return {data:{user:{id}}}
    },
    updateUserById:async(id,c)=>{const user=cuentas.get(id);user.banned_until=c.ban_duration==='none'?null:'2099-01-01T00:00:00Z';return {data:{user}}},
    getUserById:async id=>({data:{user:cuentas.get(id)}}),
  }
  const ejecutarDb=async c=>{comandos.push(c);return c.operacion==='preflight'?{contrato:'administrar-perfil-existente-v1'}:c.operacion==='crear'?{id:c.usuarioId,...c.usuario}:[]}
  const ejecutar=crearAdminUsuariosExecutor({authAdmin,ejecutarDb})
  const handler=crearAdminUsuariosHandler({enabled:true,writesEnabled,
    authenticate:async token=>['jwt-admin','jwt-supervisor','jwt-ejecutivo','jwt-inactivo'].includes(token)?{id:token}:null,
    cargarPerfil:async id=>({id,rol:id==='jwt-supervisor'?'supervisor':id==='jwt-ejecutivo'?'ejecutivo':'administrador',activo:id!=='jwt-inactivo'}),
    contarAdminsActivos:async()=>2,ejecutar})
  return {http:crearAdminUsuariosHttp({handler,webConfig,configured:true}),invitaciones,comandos}
}
const alta=correo=>({operacion:'crear',usuario:{nombre:'Prueba',apellidos:'Staging',correo,telefono:'',rol:'ejecutivo',activo:true}})

for(const origin of [local,production]){
  test(`OPTIONS refleja únicamente el origen permitido: ${origin}`,async()=>{
    const {http,comandos}=construir()
    const r=await http(request({method:'OPTIONS',origin,token:null}))
    assert.equal(r.status,204);assert.equal(r.headers.get('access-control-allow-origin'),origin)
    assert.equal(r.headers.get('vary'),'Origin')
    assert.equal(r.headers.get('access-control-allow-methods'),'POST, OPTIONS')
    assert.match(r.headers.get('access-control-allow-headers'),/authorization, apikey/)
    assert.equal(comandos.length,0)
  })
  test(`JWT y administrador activo obligatorios desde ${origin}`,async()=>{
    const {http,comandos,invitaciones}=construir({writesEnabled:true})
    for(const token of [null,'jwt-invalido','jwt-supervisor','jwt-ejecutivo','jwt-inactivo']){
      for(const operacion of ['listar','historial','crear','editar','cambiar_estado','eliminar_definitivamente','cambiar_password','crear_con_password']){
        const r=await http(request({origin,token,body:{operacion}}))
        assert.equal(r.status,!token||token==='jwt-invalido'?401:403)
        assert.equal(r.headers.get('access-control-allow-origin'),origin)
        assert.equal(r.headers.get('cache-control'),'no-store')
      }
    }
    assert.equal(comandos.length,0);assert.equal(invitaciones.length,0)
  })
  test(`lectura autorizada y escrituras bloqueadas por configuración desde ${origin}`,async()=>{
    const {http,comandos,invitaciones}=construir()
    assert.equal((await http(request({origin}))).status,200)
    for(const operacion of ['crear','editar','cambiar_estado','eliminar_definitivamente','cambiar_password','crear_con_password']){
      const r=await http(request({origin,body:{operacion}}));assert.equal(r.status,503)
    }
    assert.deepEqual(comandos.map(c=>c.operacion),['listar']);assert.equal(invitaciones.length,0)
  })
  test(`invitación usa URL de servidor y rechaza destinos suministrados desde ${origin}`,async()=>{
    const {http,invitaciones}=construir({writesEnabled:true})
    const body=alta('invitado@example.test')
    for(const campo of ['redirectTo','origin','inviteRedirect','contexto']){
      assert.equal((await http(request({origin,body:{...body,[campo]:'https://ajeno.example.test'}}))).status,400)
    }
    assert.equal((await http(request({origin,body:{...body,usuario:{...body.usuario,redirectTo:'https://ajeno.example.test'}}}))).status,400)
    const r=await http(request({origin,body,url:'https://edge.example.test/functions/v1/admin-usuarios?redirectTo=https://ajeno.example.test&origin=https://ajeno.example.test',headers:{Referer:'https://ajeno.example.test','X-Forwarded-Host':'ajeno.example.test'}}))
    assert.equal(r.status,200)
    assert.equal(invitaciones.length,1)
    assert.equal(invitaciones[0].redirectTo,`${origin}/crm/establecer-acceso`)
  })
}
test('orígenes ajenos, ambiguos o ausentes rechazan POST y OPTIONS sin CORS',async()=>{
  const {http,comandos}=construir({writesEnabled:true})
  for(const origin of [null,'null','https://otro.example.test','https://redskyg.com.evil.test','https://www.redskyg.com','http://localhost:5174','http://127.0.0.1:5173','https://redskyg.com/','https://redskyg.com,http://localhost:5173']){
    for(const method of ['OPTIONS','POST']){
      const r=await http(request({origin,method}))
      assert.equal(r.status,403);assert.equal(r.headers.has('access-control-allow-origin'),false)
    }
  }
  assert.equal(comandos.length,0)
})
test('configuración permite restringir a uno solo de los entornos',async()=>{
  const soloProduccion=configurarOrigenesAdmin({...configuracion,allowedOrigins:JSON.stringify([production])})
  const http=crearAdminUsuariosHttp({webConfig:soloProduccion,configured:true,handler:()=>new Response()})
  assert.equal((await http(request({origin:local}))).status,403)
  assert.equal((await http(request({origin:production}))).status,200)
})
test('configuración inválida o URLs de invitación cruzadas fallan cerradas',()=>{
  for(const allowedOrigins of ['',local,'null','{}','[]',JSON.stringify(['*']),JSON.stringify([local,local]),JSON.stringify([`${production}/`]),JSON.stringify(['https://ajeno.example.test'])]){
    assert.throws(()=>configurarOrigenesAdmin({...configuracion,allowedOrigins}))
  }
  for(const url of ['',`${production}/otra-ruta`,`${production}/crm/establecer-acceso?redirect=otro`,`${production}/crm/establecer-acceso#otra`,`${local}/crm/establecer-acceso`]){
    assert.throws(()=>configurarOrigenesAdmin({...configuracion,inviteRedirectProduction:url}))
  }
  assert.throws(()=>configurarOrigenesAdmin({...configuracion,inviteRedirectLocal:configuracion.inviteRedirectProduction}))
})
test('errores de configuración son explícitos y jamás ejecutan administración',async()=>{
  for(const cfg of [undefined,webConfig]){
    const http=crearAdminUsuariosHttp({webConfig:cfg,configured:false,handler:()=>{throw Error('No ejecutar')}})
    const r=await http(request())
    assert.equal(r.status,503);assert.equal((await r.json()).resultado,undefined)
    assert.equal(r.headers.has('access-control-allow-origin'),!!cfg)
  }
})
test('invitaciones concurrentes conservan el contexto individual del entorno',async()=>{
  const {http,invitaciones}=construir({writesEnabled:true})
  const respuestas=await Promise.all([http(request({origin:local,body:alta('local@example.test')})),http(request({origin:production,body:alta('hosting@example.test')}))])
  assert.ok(respuestas.every(r=>r.status===200))
  assert.equal(invitaciones.find(i=>i.correo==='local@example.test').redirectTo,configuracion.inviteRedirectLocal)
  assert.equal(invitaciones.find(i=>i.correo==='hosting@example.test').redirectTo,configuracion.inviteRedirectProduction)
})
test('executor no invita si se omite el contexto autorizado',async()=>{
  let llamadas=0
  const ejecutar=crearAdminUsuariosExecutor({authAdmin:{inviteUserByEmail:()=>llamadas++},ejecutarDb:()=>llamadas++})
  await assert.rejects(ejecutar({operacion:'crear',usuario:{correo:'no-enviar@example.test'}}),e=>e.status===503)
  assert.equal(llamadas,0)
})
