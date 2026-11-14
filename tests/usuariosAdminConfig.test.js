import test from 'node:test'
import assert from 'node:assert/strict'
import {evaluarConfiguracionAdmin,crearDiagnosticoConfiguracionAdmin} from '../supabase/functions/_shared/adminUsuariosConfig.js'
import {revisarOrigenesAdmin,configurarOrigenesAdmin} from '../supabase/functions/_shared/adminUsuariosOrigins.js'
import {crearAdminUsuariosHttp} from '../supabase/functions/_shared/adminUsuariosHttp.js'
const ref='a'.repeat(20)
const config={url:`https://${ref}.supabase.co`,dbUrl:`postgresql://postgres:password-canary@db.${ref}.supabase.co:5432/postgres`,projectRef:ref,anon:'public-key-canary',service:'service-key-canary'}
const web={allowedOrigins:'["http://localhost:5173","https://redskyg.com"]',inviteRedirectLocal:'http://localhost:5173/crm/establecer-acceso',inviteRedirectProduction:'https://redskyg.com/crm/establecer-acceso'}
const evaluar=(c,w=web)=>evaluarConfiguracionAdmin({...c,fallasWeb:revisarOrigenesAdmin(w).fallidas})
for(const [nombre,cambio,etiquetas] of [
  ['referencia', {projectRef:'ref-invalida'},['REFERENCIA_PROYECTO_FORMATO']],
  ['URL API ausente',{url:''},['URL_SUPABASE_FORMATO']],
  ['URL API de otro proyecto',{url:`https://${'b'.repeat(20)}.supabase.co`},['URL_SUPABASE_PROYECTO']],
  ['ruta API incorrecta',{url:`${config.url}/rest/v1`},['URL_SUPABASE_PROYECTO']],
  ['clave pública ausente',{anon:''},['CLAVE_PUBLICA_DISPONIBLE']],
  ['clave servidor ausente',{service:''},['CLAVE_SERVIDOR_DISPONIBLE']],
  ['URL DB ausente',{dbUrl:''},['POSTGRESQL_URL_FORMATO']],
  ['protocolo DB',{dbUrl:config.dbUrl.replace('postgresql:','https:')},['POSTGRESQL_PROTOCOLO']],
  ['DB de otro proyecto',{dbUrl:config.dbUrl.replace(`db.${ref}`,`db.${'b'.repeat(20)}`)},['POSTGRESQL_PROYECTO']],
  ['password DB ausente',{dbUrl:config.dbUrl.replace(':password-canary','')},['POSTGRESQL_PASSWORD_PRESENTE']],
  ['usuario pooler sin referencia',{dbUrl:'postgresql://postgres:password-canary@aws.pooler.supabase.com:6543/postgres'},['POSTGRESQL_PROYECTO']],
  ['usuario pooler mal codificado',{dbUrl:'postgresql://postgres%ZZ:password-canary@aws.pooler.supabase.com:6543/postgres'},['POSTGRESQL_PROYECTO']],
]){
  test(`diagnóstico independiente: ${nombre}`,()=>{
    const result=evaluar({...config,...cambio})
    assert.equal(result.valida,false);assert.deepEqual(result.fallidas,etiquetas)
    const serial=JSON.stringify(result)
    for(const value of ['password-canary','public-key-canary','service-key-canary',config.dbUrl,config.url])assert.equal(serial.includes(value),false)
  })
}
test('guarda equivalente acepta cadena directa y pooler válidos sin afirmar conexión real',()=>{
  assert.deepEqual(evaluar(config),{valida:true,fallidas:[]})
  assert.equal(evaluar({...config,dbUrl:`postgresql://postgres.${ref}:password-canary@aws.pooler.supabase.com:6543/postgres`}).valida,true)
  // No abre conexiones ni verifica credenciales; solo conserva las guardas originales.
})
for(const [key,value,code] of [['allowedOrigins','no-es-json','LISTA_ORIGENES'],['inviteRedirectLocal','url-invalida','URL_INVITACION_LOCAL'],['inviteRedirectProduction','url-invalida','URL_INVITACION_PRODUCTION']]){
  test(`diagnóstico independiente: ${code}`,()=>assert.deepEqual(evaluar(config,{...web,[key]:value}).fallidas,[code]))
}
test('acumula fallos independientes sin perder los posteriores al primer error',()=>{
  assert.deepEqual(evaluar({...config,projectRef:'',url:'',dbUrl:'',anon:'',service:''},{allowedOrigins:'',inviteRedirectLocal:'',inviteRedirectProduction:''}).fallidas,
    ['LISTA_ORIGENES','URL_INVITACION_LOCAL','URL_INVITACION_PRODUCTION','REFERENCIA_PROYECTO_FORMATO','URL_SUPABASE_FORMATO','CLAVE_PUBLICA_DISPONIBLE','CLAVE_SERVIDOR_DISPONIBLE','POSTGRESQL_URL_FORMATO'])
})
function request({origin='https://redskyg.com',token='admin-valido',body={operacion:'diagnosticar_configuracion'}}={}){
  return new Request('https://edge.example.test/functions/v1/admin-usuarios',{method:'POST',headers:{Origin:origin,...(token?{Authorization:`Bearer ${token}`}:{})},body:JSON.stringify(body)})
}
function http({auth=async token=>token==='admin-valido'?200:token==='no-admin'?403:401,webConfig=configurarOrigenesAdmin(web),diagnosticOrigins=[]}={}){
  let crud=0
  const diagnosticar=crearDiagnosticoConfiguracionAdmin({fallidas:['POSTGRESQL_PROYECTO'],autenticarAdmin:auth})
  return {handle:crearAdminUsuariosHttp({configured:false,webConfig,diagnosticOrigins,diagnosticar,handler:()=>{crud++;throw Error('No ejecutar CRUD')}}),crud:()=>crud}
}
for(const origin of ['http://localhost:5173','https://redskyg.com']){
  test(`solo administrador verificado recibe etiquetas desde ${origin}`,async()=>{
    const {handle,crud}=http()
    const r=await handle(request({origin}));assert.equal(r.status,200)
    assert.deepEqual(await r.json(),{comprobaciones_fallidas:['POSTGRESQL_PROYECTO']})
    assert.equal(r.headers.get('cache-control'),'no-store')
    assert.equal(r.headers.get('access-control-allow-origin'),origin)
    assert.equal(crud(),0)
  })
  test(`sin identidad autorizada no hay etiquetas ni secretos desde ${origin}`,async()=>{
    const {handle,crud}=http()
    for(const [token,status] of [[null,401],['invalido',401],['no-admin',403]]){
      const r=await handle(request({origin,token}));assert.equal(r.status,status)
      const body=await r.text();assert.doesNotMatch(body,/comprobaciones_fallidas|POSTGRESQL_PROYECTO|canary/)
    }
    assert.equal(crud(),0)
  })
}
test('errores o imposibilidad de verificar admin nunca exponen diagnóstico ni excepción',async()=>{
  for(const auth of [async()=>503,async()=>{throw Error('service-key-canary password-canary')}]){
    const {handle}=http({auth})
    const r=await handle(request());assert.equal(r.status,503)
    assert.doesNotMatch(await r.text(),/canary|comprobaciones_fallidas|POSTGRESQL_PROYECTO/)
  }
})
test('URLs de invitación inválidas no impiden diagnóstico con lista CORS válida',async()=>{
  const revision=revisarOrigenesAdmin({...web,inviteRedirectLocal:''})
  const {handle}=http({webConfig:null,diagnosticOrigins:revision.origins})
  assert.equal((await handle(request())).status,200)
  const normal=await handle(request({body:{operacion:'listar'}}))
  assert.equal(normal.status,503);assert.doesNotMatch(await normal.text(),/comprobaciones_fallidas|POSTGRESQL_PROYECTO/)
})
test('lista inválida u origen ajeno no permite eludir CORS para diagnosticar',async()=>{
  const invalid=http({webConfig:null})
  const r=await invalid.handle(request());assert.equal(r.status,503);assert.equal(r.headers.has('access-control-allow-origin'),false)
  assert.doesNotMatch(await r.text(),/comprobaciones_fallidas|POSTGRESQL_PROYECTO/)
  assert.equal((await http().handle(request({origin:'https://ajeno.example.test'}))).status,403)
})
test('actor y etiquetas no pueden ser suministrados por el navegador',async()=>{
  const r=await http().handle(request({body:{operacion:'diagnosticar_configuracion',actorId:'admin',comprobaciones_fallidas:['inventada']}}))
  assert.equal(r.status,400);assert.doesNotMatch(await r.text(),/POSTGRESQL_PROYECTO|inventada/)
})
