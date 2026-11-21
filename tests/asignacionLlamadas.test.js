import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { nextTick, reactive } from 'vue'
import { buscar, cargarComponente, montar, texto } from './helpers/vueHarness.js'

const perfiles = [
  { id: 'ejec', nombre: 'Ejecutivo de prueba', rol: 'ejecutivo', activo: true },
  { id: 'super', nombre: 'Supervisor de prueba', rol: 'supervisor', activo: true },
  { id: 'admin', nombre: 'Administrador de prueba', rol: 'administrador', activo: true },
  { id: 'inactivo', nombre: 'Inactivo de prueba', rol: 'ejecutivo', activo: false },
  { id: 'sin-rol', nombre: 'Sin rol', activo: true },
  { nombre: 'Incompleto', rol: 'ejecutivo', activo: true },
]
const Formulario = await cargarComponente('src/components/FormularioLlamada.vue')
const ids = vista => buscar(vista.root, nodo => nodo.tag === 'label' && texto(nodo).startsWith('Asignado a'))
  .flatMap(nodo => buscar(nodo, opcion => opcion.tag === 'option').map(opcion => opcion.props.value))

test('Asignado a refleja altas, cambios de rol y desactivaciones en los perfiles recargados', async () => {
  const props = reactive({ abierto: true, usuarios: perfiles, usuarioActualId: 'admin' })
  const vista = montar(Formulario, props)
  try {
    assert.deepEqual(ids(vista), ['', 'ejec'])
    props.usuarios = [...perfiles, { id: 'alta', nombre: 'Alta de prueba', rol: 'ejecutivo', activo: true }]
    await nextTick()
    assert.deepEqual(ids(vista), ['', 'ejec', 'alta'])
    props.usuarios = props.usuarios.map(usuario => usuario.id === 'ejec' ? { ...usuario, rol: 'supervisor' } : usuario)
    await nextTick()
    assert.deepEqual(ids(vista), ['', 'alta'])
    props.usuarios = props.usuarios.map(usuario => usuario.id === 'alta' ? { ...usuario, activo: false } : usuario)
    await nextTick()
    assert.deepEqual(ids(vista), [''])
  } finally {
    vista.unmount()
  }
})

test('editar una llamada conserva al responsable histórico aunque no sea elegible', () => {
  const guardar = []
  const vista = montar(Formulario, {
    abierto: true,
    modo: 'editar',
    usuarios: perfiles,
    llamada: { asignadoAId: 'super', asignadoANombre: 'Supervisor histórico', prospectoId: 'prospecto',
      motivoId: 'motivo', fechaProgramada: '2026-11-20T17:30:00Z' },
    onGuardar: datos => guardar.push(datos),
  })
  try {
    const campo = buscar(vista.root, nodo => nodo.tag === 'input' && Object.hasOwn(nodo.props, 'readonly'))[0]
    assert.equal(campo.props.value, 'Supervisor histórico')
    assert.deepEqual(ids(vista), [])
    buscar(vista.root, nodo => nodo.tag === 'button' && nodo.props.class === 'primario')[0].props.onClick()
    assert.equal(guardar[0].asignadoAId, 'super')
  } finally {
    vista.unmount()
  }
})

test('el servicio comprueba el perfil vigente antes de insertar o reasignar y no reescribe al editar', async () => {
  let perfil
  const cambios = []
  const consultas = []
  globalThis.__supabaseAsignacion = {
    auth: { getUser: async () => ({ data: { user: { id: 'admin' } } }) },
    from(tabla) {
      const consulta = {
        eq(campo, id) { if (tabla === 'perfiles') consultas.push([campo, id]); return this },
        select() { return this },
        maybeSingle: async () => ({ data: perfil }),
        single: async () => ({ data: {} }),
        insert(payload) { cambios.push(payload); return this },
        update(payload) { cambios.push(payload); return this },
      }
      return consulta
    },
  }
  const origen = fs.readFileSync('src/services/crmSupabaseService.js', 'utf8')
    .replace("import { supabase } from '@/lib/supabase'", 'const supabase = globalThis.__supabaseAsignacion')
    .replace("import { exigirEscriturasStagingHabilitadas } from '@/lib/stagingWriteProtection'", 'const exigirEscriturasStagingHabilitadas = () => {}')
    .replace(/from '@[/]([^']+)'/g, (_, ruta) => 'from ' + JSON.stringify(pathToFileURL(path.resolve('src', ruta) + '.js').href))
  try {
    const servicio = await import(`data:text/javascript;base64,${Buffer.from(origen).toString('base64')}`)
    const formulario = { prospectoId: 'prospecto', motivoId: 'motivo', asignadoAId: 'ejec', fecha: '2026-11-20', hora: '11:30' }
    for (perfil of [null, { ...perfiles[0], rol: 'supervisor' }, { ...perfiles[0], activo: false }]) {
      await assert.rejects(servicio.crearLlamada(formulario), /ejecutivo activo/)
      await assert.rejects(servicio.reasignarLlamada('llamada', 'ejec'), /ejecutivo activo/)
    }
    assert.equal(cambios.length, 0)
    perfil = perfiles[0]
    await servicio.crearLlamada(formulario)
    assert.equal(cambios[0].asignado_a, 'ejec')
    await servicio.reasignarLlamada('llamada', 'ejec')
    assert.equal(cambios[1].asignado_a, 'ejec')
    assert.ok(Number.isFinite(Date.parse(cambios[1].fecha_actualizacion)))
    await servicio.actualizarLlamada('llamada', { ...formulario, asignadoAId: 'super' })
    assert.equal(Object.hasOwn(cambios[2], 'asignado_a'), false)
    assert.ok(Number.isFinite(Date.parse(cambios[2].fecha_actualizacion)))
    await servicio.reprogramarLlamada('llamada', '2026-11-21T18:00:00Z')
    assert.deepEqual(cambios[3], { fecha_programada: '2026-11-21T18:00:00Z' })
    assert.equal(consultas.length, 8)
    assert.ok(consultas.every(([campo, id]) => campo === 'id' && id === 'ejec'))
  } finally {
    delete globalThis.__supabaseAsignacion
  }
})

test('Mis llamadas combina ambos órdenes antes del límite y mantiene agenda e IDs únicos', async () => {
  const filas = Array.from({ length: 101 }, (_, i) => ({
    id: `excluida-${i}`,
    fecha_creacion: '2026-11-20T12:00:00Z',
    fecha_actualizacion: '2026-11-20T12:00:00Z',
    fecha_programada: '2026-11-23T12:00:00Z',
  }))
  const registro = (id, creacion, actualizacion) => ({
    id,
    fecha_creacion: creacion,
    fecha_actualizacion: actualizacion,
    fecha_programada: '2026-12-31T12:00:00Z',
  })
  filas.push(
    registro('actualizada', '2026-01-01T00:00:00Z', '2026-11-19T10:00:00.000002Z'),
    registro('creada', '2026-11-19T10:00:00.000001Z', '2026-01-02T00:00:00Z'),
    registro('a', '2026-11-18T10:00:00Z', null),
    registro('b', null, '2026-11-18T10:00:00Z'),
    registro('antigua', null, null),
  )
  const consultas = []
  globalThis.__supabaseActividad = {
    from(tabla) {
      assert.equal(tabla, 'vista_llamadas_detalle')
      const orden = []
      const filtros = []
      return {
        select() { return this },
        eq(campo, valor) { filtros.push([campo, valor]); return this },
        order(campo, opciones) { orden.push([campo, opciones]); return this },
        async range(desde, hasta) {
          consultas.push({ orden, filtros, desde })
          const campo = orden[0][0]
          const data = [...filas].sort((a, b) => {
            const izquierda = a[campo] || ''
            const derecha = b[campo] || ''
            return izquierda === derecha ? a.id.localeCompare(b.id) : izquierda < derecha ? 1 : -1
          }).slice(desde, hasta + 1)
          return { data, count: filas.length }
        },
      }
    },
  }
  const fuente = fs.readFileSync('src/services/crmSupabaseService.js', 'utf8')
    .replace("import { supabase } from '@/lib/supabase'", 'const supabase = globalThis.__supabaseActividad')
    .replace(/from '@[/]([^']+)'/g, (_, ruta) => 'from ' + JSON.stringify(pathToFileURL(path.resolve('src', ruta) + '.js').href))
  try {
    const { obtenerLlamadasRecientes } = await import(`data:text/javascript;base64,${Buffer.from(fuente).toString('base64')}`)
    const cargar = () => obtenerLlamadasRecientes({ asignadoA: 'ejec' },
      llamada => llamada.fechaProgramada.startsWith('2026-12-31'))
    const resultado = await cargar()
    assert.deepEqual(resultado.map(fila => fila.id), ['actualizada', 'creada', 'a', 'b'])
    assert.deepEqual(await cargar(), resultado)
    assert.ok(resultado.every(fila => fila.fechaProgramada === '2026-12-31T12:00:00Z'))
    assert.ok(consultas.some(consulta => consulta.desde === 100))
    assert.ok(consultas.every(consulta => consulta.orden[1][0] === 'id' &&
      consulta.orden[0][1].nullsFirst === false && consulta.filtros[0][1] === 'ejec'))
  } finally {
    delete globalThis.__supabaseActividad
  }
})
