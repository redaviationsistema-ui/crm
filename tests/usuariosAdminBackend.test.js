import test from 'node:test'
import assert from 'node:assert/strict'
import { crearAdminUsuariosHandler } from '../supabase/functions/_shared/adminUsuarios.js'

const admin = { id: 'admin-verificado', rol: 'administrador', activo: true, correo: 'admin@example.test' }
const ejecutivo = { id: 'ejecutivo-verificado', rol: 'ejecutivo', activo: true }
const supervisor = { id: 'supervisor-verificado', rol: 'supervisor', activo: true }
const usuario = { id: 'usuario-objetivo', rol: 'ejecutivo', activo: true, correo: 'persona@example.test', nombre: 'Persona', apellidos: 'Prueba', telefono: '' }

function crearHandler({ identidad = admin, perfil = admin, totalAdmins = 2, ejecutar = async comando => ({ comando }) } = {}) {
  const comandos = []
  const handler = crearAdminUsuariosHandler({
    enabled: true, writesEnabled:true,
    authenticate: async token => token === 'jwt-valido' ? identidad : null,
    cargarPerfil: async id => id === identidad.id ? perfil : id === usuario.id ? usuario : null,
    contarAdminsActivos: async () => totalAdmins,
    ejecutar: async comando => { comandos.push(comando); return ejecutar(comando) },
  })
  return { handler, comandos }
}
function solicitud(body, token = 'jwt-valido') {
  return new Request('https://staging.example.test/functions/v1/admin-usuarios', {
    method: 'POST', headers: token ? { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } : { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}
async function resultado(handler, body, token) {
  const response = await handler(solicitud(body, token))
  return { status: response.status, body: await response.json() }
}

test('la bandera apagada rechaza toda operación sin autenticar ni ejecutarla', async () => {
  let llamadas = 0
  const handler = crearAdminUsuariosHandler({ enabled: false, authenticate: () => llamadas++, ejecutar: () => llamadas++ })
  const response = await handler(solicitud({ operacion: 'listar' }))
  assert.equal(response.status, 503)
  assert.equal(llamadas, 0)
})

test('exige JWT válido y maneja fallos del servicio de autenticación sin filtrar detalles', async () => {
  const { handler } = crearHandler()
  assert.equal((await resultado(handler, { operacion: 'listar' }, null)).status, 401)
  assert.equal((await resultado(handler, { operacion: 'listar' }, 'jwt-invalido')).status, 401)
  const fallaAuth = crearAdminUsuariosHandler({ enabled: true, authenticate: async () => { throw Error('detalle remoto sensible') } })
  const respuesta = await resultado(fallaAuth, { operacion: 'listar' })
  assert.equal(respuesta.status, 500)
  assert.doesNotMatch(respuesta.body.error, /sensible/)
})

test('rechaza ejecutivos, supervisores y perfiles inactivos aunque soliciten listar', async () => {
  for (const identidad of [ejecutivo, supervisor, { ...admin, activo: false }]) {
    const { handler } = crearHandler({ identidad, perfil: identidad })
    const respuesta = await resultado(handler, { operacion: 'listar' })
    assert.equal(respuesta.status, 403)
  }
})

test('deriva el actor del JWT y rechaza ids de administrador enviados por el cliente', async () => {
  const { handler, comandos } = crearHandler()
  assert.equal((await resultado(handler, { operacion: 'listar', actorId: 'falso-admin' })).status, 400)
  assert.equal(comandos.length, 0)
  const respuesta = await resultado(handler, { operacion: 'listar' })
  assert.equal(respuesta.status, 200)
  assert.equal(comandos[0].actorId, admin.id)
})

test('valida campos y roles en servidor y no reenvía identificadores aportados al crear', async () => {
  const { handler, comandos } = crearHandler()
  const base = { nombre: 'Prueba', apellidos: 'Usuario', correo: 'prueba@example.test', telefono: '', activo: true }
  assert.equal((await resultado(handler, { operacion: 'crear', usuario: { ...base, rol: 'owner' } })).status, 400)
  assert.equal((await resultado(handler, { operacion: 'crear', usuario: { ...base, rol: 'ejecutivo', id: 'id-falso' } })).status, 400)
  assert.equal(comandos.length, 0)
})

test('bloquea cambio del propio rol, desactivación propia y último administrador', async () => {
  const perfilAdminObjetivo = { ...admin, id: 'usuario-objetivo', correo: 'persona@example.test' }
  const crearConObjetivo = totalAdmins => crearAdminUsuariosHandler({
    enabled: true, writesEnabled:true, authenticate: async () => admin,
    cargarPerfil: async id => id === admin.id ? admin : perfilAdminObjetivo,
    contarAdminsActivos: async () => totalAdmins,
    ejecutar: async () => ({ ok: true }),
  })
  const propio = crearAdminUsuariosHandler({ enabled: true, writesEnabled:true, authenticate: async () => admin, cargarPerfil: async () => admin, contarAdminsActivos: async () => 2, ejecutar: async () => ({}) })
  assert.equal((await resultado(propio, { operacion: 'editar', usuarioId: admin.id, cambios: { rol: 'ejecutivo' } })).status, 403)
  assert.equal((await resultado(propio, { operacion: 'cambiar_estado', usuarioId: admin.id, activo: false })).status, 403)
  assert.equal((await resultado(propio, { operacion: 'eliminar_definitivamente', usuarioId: admin.id, confirmacion: admin.correo })).status, 403)
  assert.equal((await resultado(crearConObjetivo(1), { operacion: 'cambiar_estado', usuarioId: 'usuario-objetivo', activo: false })).status, 409)
  assert.equal((await resultado(crearConObjetivo(1), { operacion: 'editar', usuarioId: 'usuario-objetivo', cambios: { rol: 'supervisor' } })).status, 409)
})

test('confirma eliminación explícita y transmite dependencias para que el RPC las aplique', async () => {
  const { handler, comandos } = crearHandler({ ejecutar: async comando => {
    if (comando.operacion === 'eliminar_definitivamente') {
      const error = Error('Relaciones con prospectos, llamadas, oportunidades o auditorías impiden eliminar.')
      error.status = 409
      throw error
    }
  } })
  assert.equal((await resultado(handler, { operacion: 'eliminar_definitivamente', usuarioId: usuario.id, confirmacion: 'incorrecto' })).status, 400)
  const respuesta = await resultado(handler, { operacion: 'eliminar_definitivamente', usuarioId: usuario.id, confirmacion: usuario.correo })
  assert.equal(respuesta.status, 409)
  assert.equal(comandos[0].objetivo.id, usuario.id)
  assert.equal(comandos[0].actorId, admin.id)
})

test('modo de lectura permite listar pero bloquea escrituras sin validar staging',async()=>{
  let operaciones=[]
  const handler=crearAdminUsuariosHandler({enabled:true,writesEnabled:false,authenticate:async()=>admin,cargarPerfil:async()=>admin,ejecutar:async c=>{operaciones.push(c.operacion);return []}})
  assert.equal((await resultado(handler,{operacion:'listar'})).status,200)
  assert.equal((await resultado(handler,{operacion:'crear',usuario:{}})).status,503)
  assert.deepEqual(operaciones,['listar'])
})

test('escrituras desactivadas por defecto aunque se habiliten las lecturas',async()=>{
  let operaciones=0
  const handler=crearAdminUsuariosHandler({enabled:true,authenticate:async()=>admin,cargarPerfil:async()=>admin,ejecutar:async()=>operaciones++})
  assert.equal((await resultado(handler,{operacion:'crear',usuario:{}})).status,503)
  assert.equal(operaciones,0)
})
