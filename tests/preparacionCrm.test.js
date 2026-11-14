import test from 'node:test'
import assert from 'node:assert/strict'
import { crearCambiosContacto } from '../src/domain/contactoPayload.js'
import { crearGuardadoControlado } from '../src/domain/guardarOperacion.js'
import { validarOportunidad } from '../src/domain/oportunidades.js'

test('editar solo notas no borra campos omitidos ni acepta rol o creador', () => {
  assert.deepEqual(crearCambiosContacto({ notas: ' nota ', rol: 'administrador', creado_por: 'otro' }), { notas: 'nota' })
})
test('borrado explicito y telefono internacional se conservan', () => {
  assert.deepEqual(crearCambiosContacto({ correo: '', telefono: '+52 55 1234 5678', presupuesto: 0 }),
    { correo: null, telefono: '+52 55 1234 5678', presupuesto: 0 })
})
test('rechaza presupuestos invalidos y nombre vacio', () => {
  for (const presupuesto of [-1, 'no', Infinity, true]) assert.throws(() => crearCambiosContacto({ presupuesto }))
  assert.throws(() => crearCambiosContacto({ nombre: ' ' }))
})
test('una escritura exitosa con refresco fallido no se reporta como escritura fallida', async () => {
  let veces = 0
  const control = crearGuardadoControlado()
  const resultado = await control.ejecutar(async () => { veces++; return 'id' }, async () => { throw Error('red') })
  assert.equal(resultado.estado, 'guardado-sin-refrescar')
  assert.equal(veces, 1)
  assert.equal(control.guardando, false)
})
test('bloquea doble envio y libera el control despues de error', async () => {
  const control = crearGuardadoControlado()
  let liberar
  const pendiente = control.ejecutar(() => new Promise(resolve => { liberar = resolve }))
  assert.equal((await control.ejecutar(() => { throw Error('no ejecutar') })).estado, 'ocupado')
  liberar('ok'); await pendiente
  await assert.rejects(control.ejecutar(async () => { throw Error('fallo') }))
  assert.equal(control.guardando, false)
})
const base = { clienteId: 'contacto', servicio: 'aeronaves', responsableId: 'usuario', embudoId: 'ventas',
  etapaId: 'nueva', moneda: 'USD', prioridad: 'media', estado: 'abierta', valorEstimado: '125000.00',
  proximoSeguimiento: '2026-12-01T16:00:00Z' }
const etapas = [{ id: 'nueva', embudoId: 'ventas', estado: 'abierta' }, { id: 'perdida', embudoId: 'ventas', estado: 'perdida' }]
test('oportunidad valida y etapa de otro embudo rechazada', () => {
  assert.deepEqual(validarOportunidad(base, etapas), {})
  assert.ok(validarOportunidad({ ...base, embudoId: 'otro' }, etapas).etapaId)
})
test('rechaza importe, cierre o seguimiento ambiguos', () => {
  assert.ok(validarOportunidad({ ...base, valorEstimado: '-1' }, etapas).valorEstimado)
  assert.ok(validarOportunidad({ ...base, proximoSeguimiento: '2026-12-01T12:00:00' }, etapas).proximoSeguimiento)
  assert.ok(validarOportunidad({ ...base, etapaId: 'perdida', estado: 'perdida' }, etapas).motivoPerdida)
})
