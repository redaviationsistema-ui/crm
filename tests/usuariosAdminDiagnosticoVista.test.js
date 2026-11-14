import test from 'node:test'
import assert from 'node:assert/strict'
import {nextTick,reactive} from 'vue'
import {cargarComponente,montar,buscar,texto} from './helpers/vueHarness.js'
const Dev=await cargarComponente('src/views/UsuariosAdminView.vue',{DEV:true})
const Prod=await cargarComponente('src/views/UsuariosAdminView.vue',{DEV:false})
const admin={id:'admin',rol:'administrador',activo:true}
const boton=root=>buscar(root,n=>n.tag==='button'&&texto(n)==='Diagnosticar conexión')[0]
async function ticks(){for(let i=0;i<12;i++)await nextTick()}
async function conOrigen(origin,fn){const anterior=globalThis.location;globalThis.location={origin};try{await fn()}finally{if(anterior===undefined)delete globalThis.location;else globalThis.location=anterior}}
for(const [nombre,Component,origin,actor,visible] of [
  ['administrador local',Dev,'http://localhost:5173',admin,true],
  ['supervisor local',Dev,'http://localhost:5173',{...admin,rol:'supervisor'},false],
  ['ejecutivo local',Dev,'http://localhost:5173',{...admin,rol:'ejecutivo'},false],
  ['administrador inactivo',Dev,'http://localhost:5173',{...admin,activo:false},false],
  ['hosting en desarrollo',Dev,'https://redskyg.com',admin,false],
  ['build de producción',Prod,'http://localhost:5173',admin,false],
])test(`visibilidad del botón: ${nombre}`,async()=>conOrigen(origin,async()=>{
  const vista=montar(Component,{actor,servicioInyectado:{listar:async()=>[]}})
  try{await ticks();assert.equal(!!boton(vista.root),visible)}finally{vista.unmount()}
}))
test('botón ejecuta diagnóstico con cliente existente y muestra solo HTTP y etiquetas',async()=>conOrigen('http://localhost:5173',async()=>{
  const anterior=globalThis.fetch
  let calls=0
  globalThis.fetch=async(_url,options)=>{
    calls++;assert.deepEqual(JSON.parse(options.body),{operacion:'diagnosticar_configuracion'})
    assert.equal(options.headers.Authorization,'Bearer jwt-canary')
    return Response.json({comprobaciones_fallidas:['POSTGRESQL_PROYECTO','secret-canary'],jwt:'jwt-canary',password:'password-canary'})
  }
  const cliente={supabaseUrl:'https://aaaaaaaaaaaaaaaaaaaa.supabase.co',supabaseKey:'sb_publishable_canary',auth:{getUser:async()=>({data:{user:{id:'admin'}}}),getSession:async()=>({data:{session:{user:{id:'admin'},access_token:'jwt-canary'}}})}}
  const vista=montar(Dev,{actor:admin,servicioInyectado:{listar:async()=>[]},obtenerClienteSupabase:()=>cliente})
  try{
    await ticks();await boton(vista.root).props.onClick();await ticks()
    assert.equal(calls,1)
    assert.match(texto(vista.root),/HTTP: 200/)
    assert.match(texto(vista.root),/\["POSTGRESQL_PROYECTO"\]/)
    assert.doesNotMatch(texto(vista.root),/canary/)
  }finally{vista.unmount();globalThis.fetch=anterior}
}))
test('cambio de sesión descarta un diagnóstico pendiente y evita doble petición',async()=>conOrigen('http://localhost:5173',async()=>{
  const anterior=globalThis.fetch
  let resolver,calls=0
  globalThis.fetch=()=>{calls++;return new Promise(resolve=>resolver=resolve)}
  const actor=reactive({...admin})
  const cliente={supabaseUrl:'https://aaaaaaaaaaaaaaaaaaaa.supabase.co',supabaseKey:'sb_publishable_canary',auth:{getUser:async()=>({data:{user:{id:'admin'}}}),getSession:async()=>({data:{session:{user:{id:'admin'},access_token:'jwt-canary'}}})}}
  const vista=montar(Dev,{actor,servicioInyectado:{listar:async()=>[]},obtenerClienteSupabase:()=>cliente})
  try{
    await ticks();const b=boton(vista.root)
    const pending=b.props.onClick();await ticks();await b.props.onClick();assert.equal(calls,1)
    actor.rol='supervisor';await ticks()
    resolver(Response.json({comprobaciones_fallidas:['POSTGRESQL_PROYECTO']}));await pending;await ticks()
    assert.equal(boton(vista.root),undefined)
    assert.doesNotMatch(texto(vista.root),/HTTP:|POSTGRESQL_PROYECTO/)
  }finally{vista.unmount();globalThis.fetch=anterior}
}))
