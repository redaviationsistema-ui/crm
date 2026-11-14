import test from 'node:test'
import assert from 'node:assert/strict'

const habilitado = process.env.CRM_RUN_USERS_JWT_STAGING === 'STAGING_SYNTHETIC_READ_ONLY'
test('JWT reales de administrador/supervisor/ejecutivo contra Edge Function aislada de staging', { skip: !habilitado }, async () => {
  const env = process.env
  const ref = env.CRM_STAGING_PROJECT_REF
  assert.match(ref || '', /^[a-z]{20}$/)
  assert.notEqual(ref, 'hhlicjgpwcesytziacvc', 'Destino productivo del CRM prohibido')
  assert.equal(env.CRM_ADMIN_USERS_FIXTURES_CONFIRMED, 'DISPOSABLE_CRM_ADMIN_TEST_ONLY')
  const url = new URL(env.CRM_ADMIN_USERS_FUNCTION_URL || '')
  assert.equal(url.protocol, 'https:')
  assert.equal(url.host, `${ref}.supabase.co`)
  assert.equal(url.pathname, '/functions/v1/admin-usuarios')
  assert.equal(url.search + url.hash + url.username + url.password, '')
  assert.ok(['http://localhost:5173','https://redskyg.com'].includes(env.CRM_ADMIN_TEST_ORIGIN),'Falta CRM_ADMIN_TEST_ORIGIN permitido')
  const anonKey = env.CRM_STAGING_ANON_KEY
  assert.ok(anonKey)
  const actores = ['ADMIN', 'SUPERVISOR', 'EJECUTIVO'].map((nombre, indice) => ({
    nombre,
    rol: ['administrador', 'supervisor', 'ejecutivo'][indice],
    token: env[`CRM_${nombre}_JWT`],
  }))
  for (const actor of actores) assert.ok(actor.token, `Falta JWT sintético de ${actor.rol}`)

  async function listar(actor) {
    const response = await fetch(url, {
      method: 'POST',
      headers: { Origin:env.CRM_ADMIN_TEST_ORIGIN,apikey: anonKey, Authorization: `Bearer ${actor.token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ operacion: 'listar' }),
      signal: AbortSignal.timeout(10000),
    })
    return { status: response.status, body: await response.json().catch(() => null) }
  }
  assert.equal((await listar(actores[0])).status, 200)
  assert.equal((await listar(actores[1])).status, 403)
  assert.equal((await listar(actores[2])).status, 403)
})

const escribir = process.env.CRM_RUN_USERS_CRUD_STAGING === 'STAGING_DISPOSABLE_ACCOUNT_WRITES'
test('CRUD real Auth/perfil/auditoria en staging con cuenta nueva de buzón controlado', { skip: !escribir }, async () => {
  const e=process.env,ref=e.CRM_STAGING_PROJECT_REF
  assert.match(ref||'',/^[a-z]{20}$/)
  assert.notEqual(ref,'hhlicjgpwcesytziacvc','Proyecto predeterminado no autorizado para pruebas')
  assert.equal(e.CRM_ADMIN_USERS_FIXTURES_CONFIRMED,'DISPOSABLE_CRM_ADMIN_TEST_ONLY')
  assert.equal(e.CRM_ADMIN_TEST_EMAIL_CONFIRMED,'CONTROLLED_TEST_MAILBOX')
  const url=new URL(e.CRM_ADMIN_USERS_FUNCTION_URL || '')
  assert.equal(url.origin,`https://${ref}.supabase.co`);assert.equal(url.pathname,'/functions/v1/admin-usuarios')
  assert.equal(url.search+url.hash+url.username+url.password,'')
  assert.ok(e.CRM_STAGING_ANON_KEY);assert.ok(e.CRM_ADMIN_JWT)
  const correo=(e.CRM_ADMIN_TEST_EMAIL || '').trim().toLowerCase()
  assert.match(correo,/^[^\s@]+@[^\s@]+\.[^\s@]+$/)
  assert.ok(['http://localhost:5173','https://redskyg.com'].includes(e.CRM_ADMIN_TEST_ORIGIN),'Falta CRM_ADMIN_TEST_ORIGIN permitido')
  const headers={Origin:e.CRM_ADMIN_TEST_ORIGIN,apikey:e.CRM_STAGING_ANON_KEY,Authorization:`Bearer ${e.CRM_ADMIN_JWT}`,'Content-Type':'application/json'}
  async function solicitar(operacion,datos={}){
    const r=await fetch(url,{method:'POST',headers,body:JSON.stringify({operacion,...datos}),signal:AbortSignal.timeout(30000)})
    return {status:r.status,body:await r.json()}
  }
  const identity=await fetch(`${url.origin}/auth/v1/user`,{headers,signal:AbortSignal.timeout(10000)})
  assert.equal(identity.status,200)
  const identidad=await identity.json(),lista=await solicitar('listar')
  assert.equal(lista.status,200)
  const actor=lista.body.resultado.find(u=>u.id===identidad.id)
  assert.ok(actor?.nombre.startsWith('CRM_TEST_'),'Administrador de pruebas no acreditado')
  assert.equal(actor.rol,'administrador');assert.equal(actor.activo,true)
  assert.equal(lista.body.resultado.some(u=>u.correo.toLowerCase()===correo),false,'El buzón ya tiene cuenta; no tocarla')
  let creado
  try{
    const alta=await solicitar('crear',{usuario:{nombre:'CRM_TEST_NUEVO',apellidos:'Integración',correo,telefono:'',rol:'ejecutivo',activo:true}})
    assert.equal(alta.status,200,'Alta real no confirmada; consultar auditoria antes de repetir')
    creado=alta.body.resultado
    assert.match(creado.id,/^[0-9a-f-]{36}$/i)
    const despues=await solicitar('listar');assert.ok(despues.body.resultado.some(u=>u.id===creado.id&&u.correo===correo))
    const edicion=await solicitar('editar',{usuarioId:creado.id,cambios:{nombre:'CRM_TEST_EDITADO',rol:'supervisor'}})
    assert.equal(edicion.status,200);assert.equal(edicion.body.resultado.rol,'supervisor')
    for(const activo of [false,true]){
      const cambio=await solicitar('cambiar_estado',{usuarioId:creado.id,activo})
      assert.equal(cambio.status,200);assert.equal(cambio.body.resultado.activo,activo)
    }
    const audit=await solicitar('historial');assert.equal(audit.status,200)
    assert.ok(audit.body.resultado.some(v=>v.usuario_id===creado.id),'Sin evento administrativo verificable')
    const inactivar=await solicitar('cambiar_estado',{usuarioId:creado.id,activo:false})
    assert.equal(inactivar.status,200)
    const borrado=await solicitar('eliminar_definitivamente',{usuarioId:creado.id,confirmacion:correo})
    if(borrado.status===409){
      const final=await solicitar('listar')
      assert.ok(final.body.resultado.some(u=>u.id===creado.id&&u.activo===false),'Debe conservar el perfil inactivo vinculado')
      const auditFinal=await solicitar('historial')
      assert.ok(auditFinal.body.resultado.some(v=>v.usuario_id===creado.id),'Debe conservar la auditoría')
    }else{
      assert.equal(borrado.status,200,'Eliminación no confirmada; revisar dependencias reales')
      assert.equal(borrado.body.resultado.eliminado,true)
      const final=await solicitar('listar');assert.equal(final.body.resultado.some(u=>u.id===creado.id),false)
    }
    creado=null
  }finally{
    // No repetir eliminaciones fallidas ni eliminar cuentas previas. Contención de la NUEVA cuenta únicamente.
    if(creado){const contencion=await solicitar('cambiar_estado',{usuarioId:creado.id,activo:false});assert.equal(contencion.status,200,'La cuenta de prueba requiere contención manual')}
  }
})
