// SOLO staging desechable. No forma parte de npm test. Nunca carga .env.
import test from 'node:test'
import assert from 'node:assert/strict'
const enabled = process.env.CRM_RUN_SECURITY_WRITES === 'STAGING_SYNTHETIC_ONLY'
test('perfiles: matriz REST de columnas protegidas en staging', { skip: !enabled }, async () => {
  const env = process.env
  const ref = env.CRM_STAGING_PROJECT_REF
  assert.match(ref || '', /^[a-z]{20}$/)
  assert.notEqual(ref, 'hhlicjgpwcesytziacvc', 'Destino predeterminado del CRM prohibido')
  const url = new URL(env.CRM_STAGING_URL)
  assert.equal(url.protocol, 'https:')
  assert.equal(url.host, `${ref}.supabase.co`)
  assert.equal(url.pathname, '/')
  assert.equal(url.search + url.hash + url.username + url.password, '')
  assert.equal(env.CRM_FIXTURES_CONFIRMED, 'DISPOSABLE_CRM_TEST_ONLY')
  const key = env.CRM_STAGING_ANON_KEY
  assert.ok(key, 'Falta clave publica de staging')
  const actores = ['ADMIN', 'SUPERVISOR', 'EJECUTIVO'].map((name, index) => ({
    name, rol: ['administrador', 'supervisor', 'ejecutivo'][index],
    id: env[`CRM_${name}_ID`], token: env[`CRM_${name}_JWT`],
  }))
  for (const actor of actores) {
    assert.match(actor.id || '', /^[0-9a-f-]{36}$/i)
    assert.ok(actor.token, 'Falta JWT de usuario sintetico')
  }
  assert.equal(new Set(actores.map(a => a.id)).size, 3)
  async function request(actor, path, method = 'GET', body) {
    try {
      const response = await fetch(`${url.origin}${path}`, {
        method, headers: { apikey: key, Authorization: `Bearer ${actor.token}`,
          'Content-Type': 'application/json', Prefer: 'return=representation' },
        body: body === undefined ? undefined : JSON.stringify(body), signal: AbortSignal.timeout(10000),
      })
      const data = await response.json().catch(() => null)
      return { status: response.status, data }
    } catch { throw new Error('Fallo de transporte en staging; detalle omitido para proteger credenciales') }
  }
  const path = id => `/rest/v1/perfiles?id=eq.${encodeURIComponent(id)}&select=id,nombre,rol,activo`
  const admin = actores[0]
  // Toda la prevalidacion sucede antes del primer PATCH.
  for (const actor of actores) {
    const identity = await request(actor, '/auth/v1/user')
    assert.equal(identity.status, 200, 'JWT no valido')
    assert.equal(identity.data?.id, actor.id, 'JWT/fixture no coinciden')
    const profile = await request(actor, path(actor.id))
    assert.equal(profile.status, 200)
    assert.equal(profile.data?.length, 1)
    assert.ok(profile.data[0].nombre?.startsWith('CRM_TEST_'), 'Fixture no marcado como sintetico')
    assert.equal(profile.data[0].rol, actor.rol)
    assert.equal(profile.data[0].activo, true)
    const auditor = await request(admin, path(actor.id))
    assert.equal(auditor.status, 200)
    assert.equal(auditor.data?.length, 1, 'Admin necesita visibilidad del fixture para verificar efectos')
    actor.profile = profile.data[0]
  }
  for (const actor of actores) {
    // Control positivo: permite UPDATE ordinario propio bajo las politicas actuales.
    const positive = await request(actor, path(actor.id), 'PATCH', { nombre: actor.profile.nombre })
    assert.equal(positive.status, 200, 'Edicion ordinaria no disponible')
    assert.equal(positive.data?.length, 1, 'Cero filas no prueba actualizacion')
    for (const target of actores) {
      for (const body of [
        { rol: target.rol === 'administrador' ? 'ejecutivo' : 'administrador' },
        { activo: false },
        { id: '00000000-0000-4000-8000-000000000099' },
        { nombre: 'CRM_TEST_NO_DEBE_PERSISTIR', activo: false },
      ]) {
        const result = await request(actor, path(target.id), 'PATCH', body)
        // Un constraint, timeout o cero filas no acredita la proteccion de columna.
        assert.equal(result.data?.code, '42501', 'Proteccion no acreditada: detener y restaurar fixtures')
        assert.ok([401, 403].includes(result.status), 'Denegacion HTTP inesperada')
        const after = await request(admin, path(target.id))
        assert.equal(after.status, 200)
        assert.deepEqual(after.data, [target.profile], 'Fixture cambio pese a la denegacion')
      }
    }
  }
})
