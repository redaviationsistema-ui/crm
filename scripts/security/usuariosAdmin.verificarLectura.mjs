// Lectura exclusivamente. No imprime JWT ni datos personales. No carga claves privilegiadas.
// Ejecutar con variables del proyecto y JWT de un administrador activo.
import assert from 'node:assert/strict'
import { createClient } from '@supabase/supabase-js'

const url = process.env.VITE_SUPABASE_URL
const key = process.env.VITE_SUPABASE_ANON_KEY
const token = process.env.CRM_ADMIN_JWT
const origin = process.env.CRM_ADMIN_TEST_ORIGIN
assert.ok(['http://localhost:5173','https://redskyg.com'].includes(origin), 'Se requiere CRM_ADMIN_TEST_ORIGIN autorizado.')
assert.ok(url && key && token, 'Se requieren VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY y CRM_ADMIN_JWT.')
const base = new URL(url)
assert.equal(base.protocol, 'https:')
assert.equal(base.pathname + base.search + base.hash, '/')
assert.equal(base.username + base.password, '')
const role = (() => { try { return JSON.parse(Buffer.from(key.split('.')[1], 'base64url')).role } catch { return null } })()
assert.ok(key.startsWith('sb_publishable_') || role === 'anon', 'Usa exclusivamente la clave pública.')
const client = createClient(base.origin, key, {
  auth: { persistSession: false, autoRefreshToken: false },
  global: { headers: { Authorization: `Bearer ${token}` } },
})
const identity = await client.auth.getUser(token)
assert.ok(!identity.error && identity.data.user, 'JWT no válido.')
const columns = 'id,nombre,apellidos,correo,telefono,avatar_url,rol,activo,fecha_creacion,fecha_actualizacion'
const rows = []
for (let from = 0; ; from += 200) {
  const { data, error } = await client.from('perfiles').select(columns).order('id').range(from, from + 199)
  assert.ok(!error, 'Consulta autorizada a public.perfiles rechazada; revisar permisos/RLS.')
  rows.push(...data)
  if (data.length < 200) break
}
const actor = rows.find(row => row.id === identity.data.user.id)
assert.ok(actor?.activo === true && actor.rol === 'administrador', 'Se requiere administrador activo.')
const response = await fetch(`${base.origin}/functions/v1/admin-usuarios`, {
  method: 'POST',
  headers: { Origin: origin, apikey: key, Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({ operacion: 'listar' }),
  signal: AbortSignal.timeout(30000),
})
assert.equal(response.status, 200, `Edge Function devolvió HTTP ${response.status}.`)
const body = await response.json()
assert.ok(Array.isArray(body.resultado), 'Respuesta administrativa no válida.')
const canonical = list => list.map(row => Object.fromEntries(columns.split(',').map(c => [c, row[c]]))).sort((a,b) => a.id.localeCompare(b.id))
assert.ok(JSON.stringify(canonical(body.resultado)) === JSON.stringify(canonical(rows)), 'El listado no coincide con public.perfiles visible por RLS; comprobar políticas o cambios concurrentes.')
console.log(JSON.stringify({ verificado: true, origen: 'public.perfiles', filasCoincidentes: rows.length, escrituras: 0 }))
