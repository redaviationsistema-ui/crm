import test from 'node:test'
import assert from 'node:assert/strict'
import { calcularCotizacion } from '../src/domain/cotizaciones.js'
import { evaluarModoCotizaciones } from '../src/config/cotizacionesBackend.js'
import { crearAdaptadorCotizacionesSupabase } from '../src/services/cotizacionesSupabaseAdapter.js'

const usuarioId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const oportunidadId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
const cotizacionId = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc'
const env = {
  DEV: true,
  MODE: 'staging',
  VITE_COTIZACIONES_MODO: 'supabase',
  VITE_SUPABASE_URL: 'https://abcdefghijklmnopqrst.supabase.co',
  VITE_SUPABASE_ANON_KEY: 'sb_publishable_staging_test',
}
const columnas = {
  cotizaciones: {
    id: 'id',
    numero: 'numero',
    oportunidadId: 'oportunidad_id',
    creadoPor: 'creado_por',
    moneda: 'moneda',
    estado: 'estado',
    titulo: 'titulo',
    descripcion: 'descripcion',
    fechaVencimiento: 'fecha_vencimiento',
    fechaCreacion: 'created_at',
    fechaActualizacion: 'updated_at',
  },
  conceptos: {
    id: 'id',
    cotizacionId: 'cotizacion_id',
    orden: 'orden',
    descripcion: 'descripcion',
    cantidad: 'cantidad',
    precioUnitario: 'precio_unitario',
    importe: 'importe',
  },
}
const config = {
  stagingProjectRef: 'abcdefghijklmnopqrst',
  produccionProjectRefs: ['uvwxyzabcdefghijklmn'],
  columnas,
  verificaciones: {
    stagingIndependiente: true,
    columnasYTipos: true,
    pConceptosProbado: true,
    retornoUuidProbado: true,
    lecturaRlsStaging: true,
    rpcCrearStaging: true,
    rpcActualizarStaging: true,
    rolesYAsignacionStaging: true,
    escriturasDirectasDenegadas: true,
    riesgoAuditoriaRevisado: true,
    riesgoConcurrenciaRevisado: true,
  },
}
const modelo = {
  titulo: 'Propuesta de inspección',
  descripcion: 'Inspección y revisión',
  oportunidadId,
  prospectoId: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
  moneda: 'USD',
  estado: 'borrador',
  fecha: '2026-03-01',
  validaHasta: '2026-03-31',
  conceptos: [{ descripcion: 'Inspección', cantidad: '3', precioUnitario: '0.10' }],
}
const oportunidad = {
  id: oportunidadId,
  titulo: 'Compra real bajo RLS',
  clienteId: modelo.prospectoId,
  empresaId: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
  responsableId: usuarioId,
  creadoPorId: usuarioId,
  moneda: 'USD',
}
const catalogo = {
  modo: 'supabase',
  oportunidades: [oportunidad],
  clientes: [{ id: modelo.prospectoId, nombre: 'Prospecto consultado' }],
  empresas: [{ id: oportunidad.empresaId, nombre: 'Empresa consultada' }],
}
const perfil = { id: usuarioId, rol: 'administrador', activo: true }

function cotizacionRow(overrides = {}) {
  return {
    id: cotizacionId,
    numero: 'COT-2026-0001',
    oportunidad_id: oportunidadId,
    creado_por: usuarioId,
    moneda: 'USD',
    estado: 'borrador',
    titulo: modelo.titulo,
    descripcion: modelo.descripcion,
    fecha_vencimiento: '2026-03-31T23:59:59.999Z',
    created_at: '2026-03-01T12:00:00.000Z',
    updated_at: '2026-03-01T12:00:00.000Z',
    ...overrides,
  }
}

function conceptoRows(id = cotizacionId, items = modelo.conceptos) {
  return items.map((item, index) => {
    const importe = calcularCotizacion([item]).conceptos[0].importe
    return {
      id: `ffffffff-ffff-4fff-8fff-${String(index + 1).padStart(12, '0')}`,
      cotizacion_id: id,
      orden: index + 1,
      descripcion: item.descripcion,
      cantidad: Number(item.cantidad).toFixed(3),
      precio_unitario: Number(item.precioUnitario).toFixed(2),
      importe,
    }
  })
}

function crearCliente({ usuario = { id: usuarioId }, perfilActual = perfil, cotizaciones = [], conceptos = [], rpcImpl } = {}) {
  const llamadasRpc = []
  const escriturasDirectas = []
  const cliente = {
    supabaseUrl: env.VITE_SUPABASE_URL,
    auth: { getUser: async () => ({ data: { user: usuario }, error: null }) },
    from(tabla) {
      let filtros = []
      let orden
      let rango = null
      const builder = {
        select() { return builder },
        eq(columna, valor) { filtros.push([columna, valor]); return builder },
        order(columna, opciones) { orden = [columna, opciones]; return builder },
        range(desde, hasta) { rango = [desde, hasta]; return builder },
        single() { return Promise.resolve({ data: perfilActual, error: null }) },
        maybeSingle() {
          const filas = tabla === 'cotizaciones' ? cotizaciones : []
          return Promise.resolve({ data: filas.find(fila => filtros.every(([k, v]) => fila[k] === v)) || null, error: null })
        },
        insert() { escriturasDirectas.push('insert'); throw new Error('No se permiten escrituras directas') },
        update() { escriturasDirectas.push('update'); throw new Error('No se permiten escrituras directas') },
        delete() { escriturasDirectas.push('delete'); throw new Error('No se permiten escrituras directas') },
        then(resolve, reject) {
          try {
            let filas = tabla === 'perfiles' ? [perfilActual] : tabla === 'cotizaciones' ? [...cotizaciones] : [...conceptos]
            filas = filas.filter(fila => filtros.every(([k, v]) => fila[k] === v))
            if (orden) {
              const [campo, opciones] = orden
              filas.sort((a, b) => String(a[campo]).localeCompare(String(b[campo])) * (opciones.ascending ? 1 : -1))
            }
            if (rango) filas = filas.slice(rango[0], rango[1] + 1)
            return Promise.resolve({ data: filas, error: null }).then(resolve, reject)
          } catch (error) {
            return Promise.reject(error).then(resolve, reject)
          }
        },
      }
      return builder
    },
    async rpc(nombre, argumentos) {
      llamadasRpc.push({ nombre, argumentos })
      if (rpcImpl) return rpcImpl({ nombre, argumentos, cotizaciones, conceptos })
      const id = nombre === 'crear_cotizacion' ? cotizacionId : argumentos.p_cotizacion_id
      const oportunidadIdRpc = argumentos.p_oportunidad_id || oportunidadId
      const previo = cotizaciones.find(item => item.id === id)
      const fila = cotizacionRow({
        id,
        oportunidad_id: oportunidadIdRpc,
        titulo: argumentos.p_titulo,
        descripcion: argumentos.p_descripcion || '',
        moneda: argumentos.p_moneda,
        fecha_vencimiento: argumentos.p_fecha_vencimiento,
        updated_at: '2026-03-02T12:00:00.000Z',
        ...(previo ? { numero: previo.numero } : {}),
      })
      if (previo) cotizaciones.splice(cotizaciones.indexOf(previo), 1, fila)
      else cotizaciones.push(fila)
      for (let index = conceptos.length - 1; index >= 0; index -= 1) {
        if (conceptos[index].cotizacion_id === id) conceptos.splice(index, 1)
      }
      conceptos.push(...conceptoRows(id, argumentos.p_conceptos.map(item => ({
        descripcion: item.descripcion,
        cantidad: String(item.cantidad),
        precioUnitario: Number(item.precio_unitario).toFixed(2),
      }))))
      return { data: id, error: null }
    },
  }
  return { cliente, llamadasRpc, escriturasDirectas }
}

function crearAdaptador(cliente, cargarCatalogo = async () => catalogo) {
  return crearAdaptadorCotizacionesSupabase({
    obtenerCliente: async () => cliente,
    cargarOportunidades: cargarCatalogo,
    env,
    config,
  })
}

test('la política solo permite staging configurado y bloquea producción o una variable insuficiente', () => {
  assert.equal(evaluarModoCotizaciones(env, config).habilitado, true)
  assert.equal(evaluarModoCotizaciones({ ...env, MODE: 'production', DEV: false }, config).habilitado, false)
  assert.equal(evaluarModoCotizaciones({ ...env, VITE_COTIZACIONES_MODO: 'disabled' }, config).habilitado, false)
  assert.equal(evaluarModoCotizaciones({ ...env, VITE_SUPABASE_URL: 'https://uvwxyzabcdefghijklmn.supabase.co' }, config).habilitado, false)
})

test('crear usa solo RPC, omite importes derivados y confirma releyendo datos persistidos', async () => {
  const estado = crearCliente()
  const adapter = crearAdaptador(estado.cliente)
  const registro = await adapter.guardar(modelo)
  assert.deepEqual(estado.llamadasRpc.map(item => item.nombre), ['crear_cotizacion'])
  const argumentos = estado.llamadasRpc[0].argumentos
  assert.deepEqual(Object.keys(argumentos).sort(), [
    'p_conceptos', 'p_descripcion', 'p_fecha_vencimiento', 'p_moneda', 'p_oportunidad_id', 'p_titulo',
  ])
  assert.deepEqual(Object.keys(argumentos.p_conceptos[0]).sort(), ['cantidad', 'descripcion', 'orden', 'precio_unitario'])
  assert.equal(argumentos.p_conceptos[0].cantidad, 3)
  assert.equal(argumentos.p_conceptos[0].precio_unitario, 0.1)
  assert.equal(registro.id, cotizacionId)
  assert.equal(registro.clienteNombre, 'Prospecto consultado')
  assert.equal(registro.total, '0.30')
  assert.equal(estado.escriturasDirectas.length, 0)
})

test('consulta devuelve solo datos leídos bajo sesión y comprueba importe generado', async () => {
  const estado = crearCliente({ cotizaciones: [cotizacionRow()], conceptos: conceptoRows() })
  const datos = await crearAdaptador(estado.cliente).cargar()
  assert.equal(datos.cotizaciones[0].folio, 'COT-2026-0001')
  assert.equal(datos.cotizaciones[0].clienteNombre, 'Prospecto consultado')
  assert.equal(datos.cotizaciones[0].conceptos[0].importe, '0.30')
  assert.equal(estado.llamadasRpc.length, 0)

  const incorrecto = crearCliente({ cotizaciones: [cotizacionRow()], conceptos: conceptoRows().map(item => ({ ...item, importe: '0.31' })) })
  await assert.rejects(crearAdaptador(incorrecto.cliente).cargar(), /importe generado por PostgreSQL/)
})

test('editar llama a la RPC exacta y solo acepta borradores de la misma oportunidad', async () => {
  const estado = crearCliente({ cotizaciones: [cotizacionRow()], conceptos: conceptoRows() })
  const adapter = crearAdaptador(estado.cliente)
  const original = {
    ...modelo,
    id: cotizacionId,
    folio: 'COT-2026-0001',
    actualizadoEn: '2026-03-01T12:00:00.000Z',
  }
  const registro = await adapter.guardar({ ...original, titulo: 'Propuesta editada' })
  assert.equal(estado.llamadasRpc[0].nombre, 'actualizar_cotizacion')
  assert.equal(estado.llamadasRpc[0].argumentos.p_cotizacion_id, cotizacionId)
  assert.equal('p_oportunidad_id' in estado.llamadasRpc[0].argumentos, false)
  assert.equal(registro.titulo, 'Propuesta editada')

  estado.cliente.from = () => {
    const builder = { select: () => builder, eq: () => builder, single: async () => ({ data: perfil, error: null }), maybeSingle: async () => ({ data: cotizacionRow({ estado: 'aceptada' }), error: null }) }
    return builder
  }
  await assert.rejects(adapter.guardar({ ...original, titulo: 'No editable' }), /Solo se pueden editar/)
})

test('sesión ausente, perfil inactivo o usuario no autorizado no llaman a RPC', async () => {
  const sinSesion = crearCliente({ usuario: null })
  await assert.rejects(crearAdaptador(sinSesion.cliente).guardar(modelo), /Inicia sesión/)
  assert.equal(sinSesion.llamadasRpc.length, 0)

  const inactivo = crearCliente({ perfilActual: { ...perfil, activo: false } })
  await assert.rejects(crearAdaptador(inactivo.cliente).guardar(modelo), /perfil no está activo/)
  assert.equal(inactivo.llamadasRpc.length, 0)

  const otroResponsable = crearCliente({ perfilActual: { ...perfil, rol: 'ejecutivo' } })
  const catalogoAjeno = { ...catalogo, oportunidades: [{ ...oportunidad, responsableId: 'ffffffff-ffff-4fff-8fff-ffffffffffff', creadoPorId: 'ffffffff-ffff-4fff-8fff-ffffffffffff' }] }
  await assert.rejects(crearAdaptador(otroResponsable.cliente, async () => catalogoAjeno).guardar(modelo), /propias o asignadas/)
  assert.equal(otroResponsable.llamadasRpc.length, 0)
})

test('rechazo explícito se distingue de resultado incierto y este bloquea reintentos', async () => {
  const rechazo = crearCliente({ rpcImpl: async () => ({ data: null, error: { code: '42501', status: 403 } }) })
  await assert.rejects(crearAdaptador(rechazo.cliente).guardar(modelo), /Supabase rechazó/)
  assert.equal(rechazo.llamadasRpc.length, 1)

  const incierto = crearCliente({ rpcImpl: async () => { throw new TypeError('network') } })
  const adapter = crearAdaptador(incierto.cliente)
  await assert.rejects(adapter.guardar(modelo), error => error.confirmacionPendiente === true)
  await assert.rejects(adapter.guardar(modelo), error => error.confirmacionPendiente === true)
  assert.equal(incierto.llamadasRpc.length, 1)
})

test('UUID inválido o lectura posterior discrepante quedan inciertos y no se reenvían', async () => {
  const sinUuid = crearCliente({ rpcImpl: async () => ({ data: { id: cotizacionId }, error: null }) })
  const adapterSinUuid = crearAdaptador(sinUuid.cliente)
  await assert.rejects(adapterSinUuid.guardar(modelo), error => error.confirmacionPendiente === true)
  await assert.rejects(adapterSinUuid.guardar(modelo), error => error.confirmacionPendiente === true)
  assert.equal(sinUuid.llamadasRpc.length, 1)

  const discordante = crearCliente({
    rpcImpl: async ({ cotizaciones, conceptos }) => {
      cotizaciones.push(cotizacionRow({ titulo: 'Otra cotización' }))
      conceptos.push(...conceptoRows())
      return { data: cotizacionId, error: null }
    },
  })
  const adapterDiscordante = crearAdaptador(discordante.cliente)
  await assert.rejects(adapterDiscordante.guardar(modelo), error => error.confirmacionPendiente === true)
  await assert.rejects(adapterDiscordante.guardar(modelo), error => error.confirmacionPendiente === true)
  assert.equal(discordante.llamadasRpc.length, 1)
})

test('doble envío simultáneo ejecuta una sola RPC', async () => {
  let liberar
  const estado = crearCliente({ rpcImpl: async ({ cotizaciones, conceptos }) => {
    await new Promise(resolve => { liberar = resolve })
    cotizaciones.push(cotizacionRow())
    conceptos.push(...conceptoRows())
    return { data: cotizacionId, error: null }
  } })
  const adapter = crearAdaptador(estado.cliente)
  const primero = adapter.guardar(modelo)
  await new Promise(resolve => setImmediate(resolve))
  await assert.rejects(adapter.guardar(modelo), /Ya hay una cotización guardándose/)
  liberar()
  await primero
  assert.equal(estado.llamadasRpc.length, 1)
})
