// SOLO staging aislado, cuentas/buzón autorizados. No carga .env ni modifica flags.
import test from 'node:test'
import assert from 'node:assert/strict'
import {generarPasswordSegura} from '../src/domain/passwordUsuario.js'
const enabled=process.env.CRM_RUN_PASSWORD_STAGING==='STAGING_AUTHORIZED_PASSWORD_WRITES'
test('contrato real de alta directa, perfil y reemplazo Auth separados en staging',{skip:!enabled},async()=>{
  const e=process.env,ref=e.CRM_STAGING_PROJECT_REF
  assert.match(ref||'',/^[a-z]{20}$/);assert.notEqual(ref,'hhlicjgpwcesytziacvc','Proyecto predeterminado excluido')
  assert.equal(e.CRM_ADMIN_USERS_FIXTURES_CONFIRMED,'DISPOSABLE_CRM_ADMIN_TEST_ONLY')
  assert.equal(e.CRM_ADMIN_TEST_EMAIL_CONFIRMED,'CONTROLLED_TEST_MAILBOX')
  assert.ok(['http://localhost:5173','https://redskyg.com'].includes(e.CRM_ADMIN_TEST_ORIGIN))
  const url=new URL(e.CRM_ADMIN_USERS_FUNCTION_URL||'')
  assert.equal(url.origin,`https://${ref}.supabase.co`);assert.equal(url.pathname,'/functions/v1/admin-usuarios')
  assert.equal(url.search+url.hash+url.username+url.password,'')
  assert.ok(e.CRM_ADMIN_JWT&&e.CRM_STAGING_ANON_KEY)
  const correo=(e.CRM_ADMIN_TEST_EMAIL||'').trim().toLowerCase();assert.match(correo,/^[^\s@]+@[^\s@]+\.[^\s@]+$/)
  const headers={Origin:e.CRM_ADMIN_TEST_ORIGIN,apikey:e.CRM_STAGING_ANON_KEY,Authorization:`Bearer ${e.CRM_ADMIN_JWT}`,'Content-Type':'application/json'}
  async function op(operacion,datos={}){const r=await fetch(url,{method:'POST',headers,body:JSON.stringify({operacion,...datos}),signal:AbortSignal.timeout(30000)});return {status:r.status,body:await r.json().catch(()=>null)}}
  const identidad=await fetch(`${url.origin}/auth/v1/user`,{headers,signal:AbortSignal.timeout(10000)})
  assert.equal(identidad.status,200);const identity=await identidad.json()
  const lista=await op('listar');assert.equal(lista.status,200)
  const actor=lista.body.resultado.find(u=>u.id===identity.id)
  assert.ok(actor?.nombre.startsWith('CRM_TEST_'));assert.equal(actor.rol,'administrador');assert.equal(actor.activo,true)
  assert.equal(lista.body.resultado.some(u=>u.correo.toLowerCase()===correo),false,'No tocar cuenta previa')
  let id,password=generarPasswordSegura(),nueva
  const login=async p=>{
    const r=await fetch(`${url.origin}/auth/v1/token?grant_type=password`,{method:'POST',headers:{apikey:e.CRM_STAGING_ANON_KEY,'Content-Type':'application/json'},body:JSON.stringify({email:correo,password:p}),signal:AbortSignal.timeout(15000)})
    const b=await r.json().catch(()=>null)
    return {status:r.status,id:b?.user?.id} // No conservar ni imprimir tokens.
  }
  try{
    const alta=await op('crear_con_password',{usuario:{nombre:'CRM_TEST_PASSWORD',apellidos:'Staging',correo,telefono:'',rol:'ejecutivo',activo:true},password})
    assert.equal(alta.status,200,'Alta no confirmada: reconciliar Dashboard, no repetir automáticamente')
    id=alta.body.resultado.id;assert.ok(id)
    const creado=await op('listar');assert.ok(creado.body.resultado.some(u=>u.id===id&&u.correo===correo&&u.activo===true))
    assert.equal((await login(password)).id,id,'Auth no confirmó acceso inicial')
    const editado=await op('editar',{usuarioId:id,cambios:{nombre:'CRM_TEST_PASSWORD_EDITADO'}})
    assert.equal(editado.status,200);assert.equal((await login(password)).id,id,'Editar perfil alteró credencial')
    nueva=generarPasswordSegura()
    const cambio=await op('cambiar_password',{usuarioId:id,password:nueva})
    assert.equal(cambio.status,200,'No confirmar cambio sin revisar Auth')
    assert.deepEqual(cambio.body.resultado,{usuarioId:id,contrasenaActualizada:true})
    assert.equal(JSON.stringify(cambio.body).includes(nueva),false)
    assert.equal((await login(nueva)).id,id,'Auth no confirmó reemplazo')
    assert.equal((await login(password)).status,400,'La credencial previa todavía permite entrar')
  }finally{
    password=undefined;nueva=undefined
    // Contención de la cuenta NUEVA confirmada. No eliminar historial ni repetir altas.
    if(id)assert.equal((await op('cambiar_estado',{usuarioId:id,activo:false})).status,200,'Requiere contención manual en Dashboard')
  }
})
