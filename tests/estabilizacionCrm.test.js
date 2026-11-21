import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { cargarComponente, montar, buscar, texto } from './helpers/vueHarness.js'
import { nextTick } from 'vue'
import { limitesDiaLocal } from '../src/lib/crm.js'
import { pathToFileURL } from 'node:url'
const servicio = {}
globalThis.__crmServiceTest = servicio
let code = fs.readFileSync('src/composables/useCrm.js','utf8')
code = code.replace("import * as crmSupabaseService from '@/services/crmSupabaseService'", 'const crmSupabaseService = globalThis.__crmServiceTest')
code = code.replace("import { supabase } from '@/lib/supabase'", "const supabase = { auth: { getUser: async () => ({ data: { user: { id: 'actor' } } }) }, channel: () => ({ on() { return this }, subscribe() { return this } }) }")
code = code.replace(/from\s+(['"])([^'"]+)\1/g,(_,q,spec)=>{
  const destino=spec.startsWith('@/') ? pathToFileURL(path.resolve('src',spec.slice(2))+(path.extname(spec)?'':'.js')).href
    : spec.startsWith('.') ? pathToFileURL(path.resolve('src/composables',spec)+(path.extname(spec)?'':'.js')).href : import.meta.resolve(spec)
  return `from ${JSON.stringify(destino)}`
})
const {useCrm} = await import(`data:text/javascript;base64,${Buffer.from(code).toString('base64')}`)

function prepararServicios() {
  const vacio = async () => []
  Object.assign(servicio, {
    obtenerPerfilActual: async () => ({ id: 'actor', activo: true }),
    obtenerContextoCrm: async () => ({}),
    obtenerProspectos: async () => [{ id: 'contacto' }],
    obtenerPerfiles: vacio,
    obtenerMotivos: vacio,
    obtenerResultados: vacio,
    obtenerLlamadas: async () => ({ datos: [], total: 0 }),
    obtenerLlamadasRecientes: vacio,
    obtenerLlamadasHoy: vacio,
    obtenerLlamadasVencidas: vacio,
    obtenerNotificaciones: vacio,
    obtenerLlamada: async id => ({ id, estado: 'completada' }),
    obtenerHistorial: vacio,
  })
}

test('Contactos sigue disponible con una sesión válida si Llamadas falla', async () => {
  prepararServicios()
  servicio.obtenerLlamadas = async () => { throw Error('Llamadas no disponible') }
  const crm = useCrm()
  crm.vistaActiva.value = 'contactos'
  await crm.inicializarCrm()
  const shell = fs.readFileSync('src/views/CrmShellView.vue', 'utf8')
  const condicion = /<ProspectosView\s+v-else-if="([^"]+)"/.exec(shell)[1]
  assert.equal(crm.estado.prospectos[0].id, 'contacto')
  assert.equal(Function('crm', 'return ' + condicion)(crm), true)
  assert.match(crm.estado.error, /Llamadas no disponible/)
  assert.equal(crm.estado.errorContactos, null)
  assert.match(crm.estado.errorHistorialContactos, /Llamadas no disponible/)
})

test('filtrar por el día visible incluye una llamada que cambia de día en UTC', () => {
  const zonaAnterior = process.env.TZ
  try {
    process.env.TZ = 'America/Mexico_City'
    const crm = useCrm()
    crm.estado.llamadas = [{ id: 'noche', fechaProgramada: '2026-11-20T05:30:00Z' }]
    crm.filtros.value.fecha = '2026-11-19'
    assert.deepEqual(crm.llamadasFiltradas.value.map(llamada => llamada.id), ['noche'])
  } finally {
    if (zonaAnterior === undefined) delete process.env.TZ
    else process.env.TZ = zonaAnterior
  }
})

test('finalizar conserva duración y distingue confirmación del error de lectura', async () => {
  prepararServicios()
  let payload
  servicio.finalizarLlamada = async datos => { payload = datos }
  servicio.obtenerLlamadas = async () => { throw Error('Lectura no disponible') }
  const crm = useCrm()
  await crm.finalizarLlamada({ llamadaId: 'llamada', contesto: true, duracion: 47 })
  assert.equal(payload.duracion, 47)
  assert.equal(crm.estado.errorOperacion, null)
  assert.equal(crm.estado.finalizaciones.get('llamada').confirmada, true)
  assert.equal(crm.estado.finalizaciones.get('llamada').errorLectura, true)

  servicio.obtenerLlamadas = async () => ({ datos: [], total: 0 })
  servicio.finalizarLlamada = async () => { assert.fail('La lectura no debe repetir la escritura') }
  await crm.reintentarLecturaFinalizacion('llamada')
  await crm.finalizarLlamada({ llamadaId: 'llamada', contesto: true, duracion: 47 })
  assert.equal(crm.estado.finalizaciones.get('llamada').errorLectura, false)
})

test('Contactos termina de cargar aunque una consulta de Llamadas siga pendiente', async () => {
  prepararServicios()
  let completarLlamadas
  const pendiente = new Promise(resolve => { completarLlamadas = resolve })
  servicio.obtenerLlamadas = () => pendiente
  const crm = useCrm()
  const inicio = crm.inicializarCrm()
  try {
    await new Promise(resolve => setImmediate(resolve))
    assert.equal(crm.estado.cargandoContactos, false)
    assert.equal(crm.estado.cargando, true)
    assert.equal(crm.estado.prospectos[0].id, 'contacto')
  } finally {
    completarLlamadas({ datos: [], total: 0 })
    await inicio
  }
})

test('la confirmación exitosa se registra antes de sincronizar y se ignora el doble envío', async () => {
  prepararServicios()
  let escrituras = 0
  let confirmar
  servicio.finalizarLlamada = () => {
    escrituras++
    if (escrituras > 1) return Promise.resolve()
    return new Promise(resolve => { confirmar = resolve })
  }
  const crm = useCrm()
  crm.estado.llamadaSeleccionada = { id: 'llamada', estado: 'pendiente' }
  const payload = { llamadaId: 'llamada', contesto: true, duracion: 0 }
  const finalizacion = crm.finalizarLlamada(payload)
  await crm.finalizarLlamada(payload)
  // Otra operación del CRM puede liberar el indicador compartido.
  crm.estado.guardando = false
  await crm.finalizarLlamada(payload)
  confirmar()
  await finalizacion
  assert.equal(escrituras, 1)
  assert.equal(crm.estado.finalizaciones.get('llamada').confirmada, true)
  assert.equal(crm.estado.finalizaciones.get('llamada').errorLectura, false)
  assert.equal(crm.estado.llamadaSeleccionada.estado, 'completada')
})

test('un rechazo de permisos presenta el error y no recarga', async () => {
  prepararServicios()
  servicio.finalizarLlamada = async () => { throw { code: '42501' } }
  servicio.obtenerLlamadas = async () => assert.fail('No debe recargar tras un rechazo explícito')
  const crm = useCrm()
  await crm.finalizarLlamada({ llamadaId: 'llamada', contesto: false })
  assert.match(crm.estado.errorOperacion, /permisos/)
  assert.equal(crm.estado.finalizaciones.has('llamada'), false)
})

test('una finalización incierta permite leer sin afirmar éxito ni repetir la RPC', async () => {
  prepararServicios()
  let escrituras = 0
  servicio.finalizarLlamada = async () => { escrituras++; throw Error('timeout') }
  const crm = useCrm()
  crm.estado.llamadaSeleccionada = { id: 'llamada', estado: 'pendiente' }
  const payload = { llamadaId: 'llamada', contesto: true }
  await crm.finalizarLlamada(payload)
  await crm.reintentarLecturaFinalizacion('llamada')
  await crm.finalizarLlamada(payload)
  assert.equal(escrituras, 1)
  assert.equal(crm.estado.finalizaciones.get('llamada').confirmada, false)
  assert.equal(crm.estado.finalizaciones.get('llamada').completadaEnLectura, true)
  assert.equal(crm.estado.errorOperacion, null)
})

test('el formulario entrega duración entera al servicio, conserva cero y rechaza fracciones', async () => {
  prepararServicios()
  const datos = []
  servicio.finalizarLlamada = async payload => { datos.push(payload) }
  const formulario = await cargarComponente('src/components/FormularioResultado.vue')
  for (const entrada of ['47', '0', '', '1.5', '-1']) {
    const crm = useCrm()
    const vista = montar(formulario, { llamada: { id: 'llamada' }, onFinalizar: crm.finalizarLlamada })
    try {
      const campo = buscar(vista.root, nodo => nodo.props.placeholder === 'Minutos')[0]
      campo.props['onUpdate:modelValue'](entrada)
      const boton = buscar(vista.root, nodo => nodo.tag === 'button' && texto(nodo) === 'Finalizar')[0]
      boton.props.onClick()
      await nextTick()
      if (['1.5', '-1'].includes(entrada)) assert.match(texto(vista.root), /minutos enteros/)
    } finally {
      vista.unmount()
    }
  }
  assert.deepEqual(datos.map(valor => valor.duracion), [47, 0, null])
})

test('límites del día incluyen su inicio y excluyen el siguiente en varias zonas y DST', () => {
  const anterior = process.env.TZ
  const casos = [
    ['UTC', '2026-11-19', '2026-11-19T00:00:00.000Z', '2026-11-20T00:00:00.000Z'],
    ['America/Mexico_City', '2026-11-19', '2026-11-19T06:00:00.000Z', '2026-11-20T06:00:00.000Z'],
    ['Europe/Madrid', '2026-11-19', '2026-11-18T23:00:00.000Z', '2026-11-19T23:00:00.000Z'],
    ['America/New_York', '2026-03-08', '2026-03-08T05:00:00.000Z', '2026-03-09T04:00:00.000Z'],
    ['America/New_York', '2026-11-01', '2026-11-01T04:00:00.000Z', '2026-11-02T05:00:00.000Z'],
  ]
  try {
    for (const [zona, fecha, inicio, fin] of casos) {
      process.env.TZ = zona
      const crm = useCrm()
      const limites = limitesDiaLocal(fecha)
      assert.deepEqual(limites, { inicio: Date.parse(inicio), fin: Date.parse(fin) })
      crm.filtros.value.fecha = fecha
      crm.estado.llamadas = [
        { id: 1, fechaProgramada: new Date(limites.inicio - 1).toISOString() },
        { id: 2, fechaProgramada: inicio },
        { id: 3, fechaProgramada: new Date(limites.fin - 1).toISOString() },
        { id: 4, fechaProgramada: fin },
      ]
      assert.deepEqual(crm.llamadasFiltradas.value.map(llamada => llamada.id), [2, 3])
    }
    assert.equal(limitesDiaLocal('2026-02-30'), null)
  } finally {
    if (anterior === undefined) delete process.env.TZ
    else process.env.TZ = anterior
  }
})

test('el servicio valida minutos y conserva la firma RPC ante éxito y pérdida de respuesta', async () => {
  const peticiones = []
  let respuesta = { data: 'confirmada', error: null, status: 200 }
  globalThis.__rpcEstabilizacion = async (...args) => { peticiones.push(args); return respuesta }
  const source = fs.readFileSync('src/services/crmSupabaseService.js', 'utf8')
    .replace("import { supabase } from '@/lib/supabase'", 'const supabase = { rpc: globalThis.__rpcEstabilizacion }')
    .replace("import { exigirEscriturasStagingHabilitadas } from '@/lib/stagingWriteProtection'", 'const exigirEscriturasStagingHabilitadas = () => {}')
    .replace(/from '@[/]([^']+)'/g, (_, ruta) => 'from ' + JSON.stringify(pathToFileURL(path.resolve('src', ruta) + '.js').href))
  const { finalizarLlamada } = await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`)
  try {
    const datos = { llamadaId: 'llamada', contesto: false, resultadoId: 'resultado', notas: '', duracion: 47 }
    await assert.rejects(finalizarLlamada({ ...datos, duracion: -1 }), /minutos enteros/)
    assert.equal(await finalizarLlamada(datos), 'confirmada')
    assert.deepEqual(peticiones, [['finalizar_llamada', {
      p_llamada_id: 'llamada', p_contesto: false, p_resultado_id: 'resultado', p_notas: null,
    }]])
    respuesta = { data: null, error: { code: '', message: 'Failed to fetch' }, status: 0 }
    await assert.rejects(finalizarLlamada(datos), { resultadoIncierto: true })
    respuesta = { data: null, error: { code: 'GATEWAY_TIMEOUT' }, status: 408 }
    await assert.rejects(finalizarLlamada(datos), { resultadoIncierto: true })
    assert.equal(peticiones.length, 3)
  } finally {
    delete globalThis.__rpcEstabilizacion
  }
})

test('cerrar el detalle libera la columna de escritorio e ignora una lectura pendiente', async () => {
  prepararServicios()
  const crm = useCrm()
  await crm.seleccionarLlamada({ id: 'anterior' })
  assert.equal(crm.estado.llamadaSeleccionada.id, 'anterior')

  let responder
  servicio.obtenerLlamada = () => new Promise(resolve => { responder = resolve })
  const lectura = crm.seleccionarLlamada({ id: 'pendiente' })
  crm.cerrarDetalleLlamada()
  assert.equal(crm.drawerAbierto.value, false)
  assert.equal(crm.estado.llamadaSeleccionada, null)
  assert.deepEqual(crm.estado.historial, [])

  responder({ id: 'pendiente' })
  await lectura
  assert.equal(crm.estado.llamadaSeleccionada, null)
  const shell = fs.readFileSync('src/views/CrmShellView.vue', 'utf8')
  assert.match(shell, /<DetalleLlamadaDrawer[\s\S]*?@cerrar="crm\.cerrarDetalleLlamada"/)
})

const fechaReprogramada = '2026-11-21T18:00:00.000Z'

test('reprogramar actualiza el detalle, listado e indicadores y conserva filtros', async () => {
  prepararServicios()
  const crm = useCrm()
  const llamada = { id: 'llamada', estado: 'pendiente', fechaProgramada: '2026-11-20T18:00:00.000Z' }
  const guardada = { ...llamada, fechaProgramada: fechaReprogramada }
  crm.estado.llamadaSeleccionada = llamada
  crm.estado.llamadas = [llamada]
  crm.estado.resumenLlamadas = [llamada]
  crm.estado.llamadasVencidas = [llamada]
  crm.filtros.value.prioridad = 'alta'
  let escrituras = 0
  servicio.reprogramarLlamada = async () => { escrituras++; return { fecha_programada: fechaReprogramada } }
  servicio.obtenerLlamadas = async () => ({ datos: [guardada], total: 1 })
  crm.solicitarReprogramacion(llamada)
  await crm.confirmarReprogramacion({ fechaProgramada: fechaReprogramada })
  assert.equal(escrituras, 1)
  assert.equal(crm.estado.llamadaSeleccionada.fechaProgramada, fechaReprogramada)
  assert.equal(crm.estado.llamadas[0].fechaProgramada, fechaReprogramada)
  assert.equal(crm.estado.resumenLlamadas[0].fechaProgramada, fechaReprogramada)
  assert.equal(crm.indicadores.value.find(item => item.titulo === 'Atrasadas').valor, 0)
  assert.equal(crm.seguimientoAgrupado.value.atrasadas.length, 0)
  assert.equal(crm.filtros.value.prioridad, 'alta')
  assert.equal(crm.modalReprogramacion.value, false)
})

test('403 conserva el modal y muestra el rechazo sin recargar', async () => {
  prepararServicios()
  const crm = useCrm()
  let lecturas = 0
  servicio.obtenerLlamadas = async () => { lecturas++; return { datos: [], total: 0 } }
  servicio.reprogramarLlamada = async () => { throw { code: '42501' } }
  crm.solicitarReprogramacion({ id: 'llamada' })
  await crm.confirmarReprogramacion({ fechaProgramada: fechaReprogramada })
  assert.match(crm.estado.errorOperacion, /permisos/)
  assert.equal(crm.modalReprogramacion.value, true)
  assert.equal(crm.estado.reprogramacion, null)
  assert.equal(lecturas, 0)
})

test('una escritura confirmada conserva el éxito aunque falle la recarga', async () => {
  prepararServicios()
  const crm = useCrm()
  crm.estado.llamadaSeleccionada = { id: 'llamada' }
  let escrituras = 0
  servicio.reprogramarLlamada = async () => { escrituras++; return { fecha_programada: fechaReprogramada } }
  servicio.obtenerLlamadas = async () => { throw new Error('lectura no disponible') }
  await crm.reprogramarLlamada({ id: 'llamada' }, fechaReprogramada)
  assert.equal(crm.estado.reprogramacion.estado, 'confirmada')
  assert.equal(crm.estado.reprogramacion.errorLectura, true)
  assert.equal(crm.estado.errorOperacion, null)
  assert.equal(crm.estado.llamadaSeleccionada.fechaProgramada, fechaReprogramada)
  await crm.consultarReprogramacion()
  assert.equal(escrituras, 1)
})

test('un timeout impide reenviar y consultar solo reconcilia la fecha observada', async () => {
  prepararServicios()
  const crm = useCrm()
  let escrituras = 0
  servicio.reprogramarLlamada = async () => { escrituras++; throw new Error('timeout') }
  servicio.obtenerLlamada = async id => ({ id, fechaProgramada: '2026-11-20T18:00:00.000Z' })
  const llamada = { id: 'llamada' }
  await crm.reprogramarLlamada(llamada, fechaReprogramada)
  await crm.consultarReprogramacion()
  await crm.reprogramarLlamada(llamada, fechaReprogramada)
  assert.equal(crm.estado.reprogramacion.estado, 'incierta')
  servicio.obtenerLlamada = async id => ({ id, fechaProgramada: fechaReprogramada })
  await crm.consultarReprogramacion()
  assert.equal(crm.estado.reprogramacion.estado, 'observada')
  assert.equal(escrituras, 1)
})
