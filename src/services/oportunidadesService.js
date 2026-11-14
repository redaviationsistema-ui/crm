import { configuracionOportunidades, evaluarModoOportunidades } from '../config/oportunidadesBackend.js'
import { crearAdaptadorOportunidadesSupabase } from './oportunidadesSupabaseAdapter.js'
import { validarOportunidad } from '../domain/oportunidades.js'

const CLAVE = 'crm-aviacion:oportunidades-demostracion:v1'
const copia = valor => structuredClone(valor)
export function crearDatosDemostracion() {
  return {
    version: 1,
    clientes: [{ id: 'demo-cliente-1', nombre: 'Cliente de demostración Alfa', empresaId: 'demo-empresa-1' },
      { id: 'demo-cliente-2', nombre: 'Cliente de demostración Beta', empresaId: 'demo-empresa-2' }],
    empresas: [{ id: 'demo-empresa-1', nombre: 'Empresa de demostración Alfa' }, { id: 'demo-empresa-2', nombre: 'Empresa de demostración Beta' }],
    responsables: [{ id: 'demo-agente-1', nombre: 'Asesora de demostración Ana' }, { id: 'demo-agente-2', nombre: 'Asesor de demostración Luis' }],
    embudos: [
      { id: 'demo-comercial', nombre: 'Venta de aeronaves', servicio: 'aeronaves' },
      { id: 'demo-motores', nombre: 'Venta de motores', servicio: 'motores' },
      { id: 'demo-refacciones', nombre: 'Venta de refacciones', servicio: 'refacciones' },
      { id: 'demo-vuelos', nombre: 'Vuelos privados', servicio: 'vuelos' },
    ],
    etapas: [
      ...['motores','refacciones','vuelos'].flatMap(servicio => [
        { id: `demo-${servicio}-nueva`, embudoId: `demo-${servicio}`, nombre: 'Nueva', estado: 'abierta', orden: 0 },
        { id: `demo-${servicio}-ganada`, embudoId: `demo-${servicio}`, nombre: 'Ganada', estado: 'ganada', orden: 1 },
        { id: `demo-${servicio}-perdida`, embudoId: `demo-${servicio}`, nombre: 'Perdida', estado: 'perdida', orden: 2 },
      ]),
      { id: 'demo-nueva', embudoId: 'demo-comercial', nombre: 'Nueva', estado: 'abierta', orden: 0 },
      { id: 'demo-propuesta', embudoId: 'demo-comercial', nombre: 'Propuesta', estado: 'abierta', orden: 1 },
      { id: 'demo-ganada', embudoId: 'demo-comercial', nombre: 'Ganada', estado: 'ganada', orden: 2 },
      { id: 'demo-perdida', embudoId: 'demo-comercial', nombre: 'Perdida', estado: 'perdida', orden: 3 },
    ],
    oportunidades: [{ titulo: 'Compra de demostración de aeronave', descripcion: '', id: 'demo-oportunidad-1', clienteId: 'demo-cliente-1', empresaId: 'demo-empresa-1', servicio: 'aeronaves',
      responsableId: 'demo-agente-1', embudoId: 'demo-comercial', etapaId: 'demo-nueva', estado: 'abierta',
      valorEstimado: '125000.00', moneda: 'USD', prioridad: 'media', proximoSeguimiento: '2026-12-01T16:00:00Z',
      motivoPerdida: '', version: 1, actualizadoEn: '2026-11-12T12:00:00Z',
      historial: [{ id: 'demo-evento-1', tipo: 'creada', fecha: '2026-11-12T12:00:00Z', actor: 'Usuario de demostración', cambios: {} }] }],
  }
}

// Adaptador exclusivamente local. Nunca importa Supabase ni recibe datos/clientes reales.
export function crearOportunidadesService({ storage = null, ahora = () => new Date().toISOString(), id = () => crypto.randomUUID() } = {}) {
  function leer() {
    let raw
    try { raw = storage?.getItem(CLAVE) }
    catch { throw new Error('No se puede acceder a los datos locales de demostración.') }
    if (!raw) return crearDatosDemostracion()
    try {
      const datos = JSON.parse(raw)
      if (datos.version !== 1 || !['clientes', 'empresas', 'responsables', 'embudos', 'etapas', 'oportunidades'].every(k => Array.isArray(datos[k]))) throw Error()
      // Ampliar catálogos de demostración antiguos sin borrar ediciones del usuario.
      const semilla = crearDatosDemostracion()
      for (const embudo of semilla.embudos) {
        const existente = datos.embudos.find(e => e.id === embudo.id)
        if (!existente) datos.embudos.push(embudo)
        else if (!existente.servicio) existente.servicio = embudo.servicio
      }
      for (const etapa of semilla.etapas) {
        if (!datos.etapas.some(e => e.id === etapa.id)) datos.etapas.push(etapa)
      }
      return datos
    } catch { throw new Error('Los datos locales están dañados. Usa Restablecer demostración para recuperarlos.') }
  }
  let memoria = crearDatosDemostracion()
  const actual = () => storage ? leer() : copia(memoria)
  function persistir(datos) {
    if (storage) {
      try { storage.setItem(CLAVE, JSON.stringify(datos)) }
      catch { throw new Error('No se guardó: el almacenamiento local está lleno o bloqueado. Conserva el formulario e inténtalo de nuevo.') }
    }
    memoria = copia(datos)
  }
  function validar(modelo, datos) {
    const errores = validarOportunidad(modelo, datos.etapas)
    if (Object.keys(errores).length) throw new Error(Object.values(errores).join('. '))
    const cliente = datos.clientes.find(c => c.id === modelo.clienteId)
    if (!cliente || !datos.responsables.some(r => r.id === modelo.responsableId)) throw new Error('Selecciona un cliente y responsable de demostración válidos.')
    if (modelo.empresaId && (!datos.empresas.some(e => e.id === modelo.empresaId) || cliente.empresaId !== modelo.empresaId)) throw new Error('La empresa no corresponde al cliente seleccionado.')
  }
  const campos = ['titulo', 'descripcion', 'clienteId', 'empresaId', 'servicio', 'responsableId', 'embudoId', 'etapaId', 'estado', 'valorEstimado', 'moneda', 'prioridad', 'proximoSeguimiento', 'motivoPerdida']
  return {
    modo: 'demostracion', permiteGestionEtapas: true,
    persistencia: storage ? 'sesión del navegador' : 'memoria temporal',
    async cargar() { return copia(actual()) },
    async obtenerHistorial(id) { return copia(actual().oportunidades.find(o => o.id === id)?.historial || []) },
    async guardar(modelo) {
      const datos = actual()
      validar(modelo, datos)
      const anterior = modelo.id ? datos.oportunidades.find(o => o.id === modelo.id) : null
      if (modelo.id && !anterior) throw new Error('La oportunidad ya no existe. Recarga la lista.')
      if (anterior && modelo.version !== anterior.version) throw new Error('La oportunidad cambió. Cierra el formulario y vuelve a abrirla antes de guardar.')
      const cambios = Object.fromEntries(campos.filter(c => modelo[c] !== anterior?.[c]).map(c => [c, { antes: anterior?.[c] ?? null, despues: modelo[c] ?? null }]))
      if (anterior && !Object.keys(cambios).length) return copia(anterior)
      const fecha = ahora()
      const registro = { ...Object.fromEntries(campos.map(c => [c, modelo[c] ?? ''])), id: anterior?.id || id(),
        version: (anterior?.version || 0) + 1, actualizadoEn: fecha,
        cerradoEn: modelo.estado === 'abierta' ? null : anterior?.estado === modelo.estado ? anterior.cerradoEn : fecha,
        historial: [...(anterior?.historial || []), { id: id(), tipo: anterior ? 'actualizada' : 'creada', fecha, actor: 'Usuario de demostración', cambios }] }
      datos.oportunidades = anterior ? datos.oportunidades.map(o => o.id === registro.id ? registro : o) : [...datos.oportunidades, registro]
      persistir(datos)
      return copia(registro)
    },
    async guardarEtapa(modelo) {
      const datos = actual()
      const nombre = modelo.nombre?.trim()
      if (!nombre || nombre.length > 80) throw new Error('La etapa requiere un nombre de hasta 80 caracteres.')
      if (!datos.embudos.some(e => e.id === modelo.embudoId)) throw new Error('Embudo inválido.')
      if (!['abierta', 'ganada', 'perdida'].includes(modelo.estado)) throw new Error('Estado de etapa inválido.')
      if (!Number.isInteger(Number(modelo.orden)) || Number(modelo.orden) < 0) throw new Error('Orden de etapa inválido.')
      const anterior = datos.etapas.find(e => e.id === modelo.id)
      if (modelo.id && !anterior) throw new Error('La etapa ya no existe.')
      if (datos.etapas.some(e => e.id !== modelo.id && e.embudoId === modelo.embudoId && e.nombre.toLowerCase() === nombre.toLowerCase())) throw new Error('Ya existe una etapa con ese nombre.')
      if (anterior && datos.oportunidades.some(o => o.etapaId === anterior.id) && (modelo.estado !== anterior.estado || modelo.embudoId !== anterior.embudoId)) throw new Error('Una etapa con oportunidades no puede cambiar de estado ni de embudo.')
      const etapa = { id: anterior?.id || id(), nombre, embudoId: modelo.embudoId, estado: modelo.estado, orden: Number(modelo.orden) }
      datos.etapas = anterior ? datos.etapas.map(e => e.id === etapa.id ? etapa : e) : [...datos.etapas, etapa]
      persistir(datos)
      return copia(etapa)
    },
    async restablecer() { persistir(crearDatosDemostracion()); return copia(actual()) },
  }
}
export function crearServicioOportunidadesNavegador({ env = import.meta.env || {}, config = configuracionOportunidades, obtenerCliente } = {}) {
  const evaluacion = evaluarModoOportunidades(env, config)
  if (evaluacion.habilitado) {
    try {
      if (typeof obtenerCliente !== 'function') throw new Error('Falta proporcionar el cliente autenticado del CRM.')
      return crearAdaptadorOportunidadesSupabase({env,config,obtenerCliente})
    } catch (error) {
      evaluacion.habilitado = false
      evaluacion.motivo = error.message
    }
  }
  let storage = null
  try { storage = globalThis.sessionStorage ?? null } catch { /* Modo temporal visible. */ }
  return { ...crearOportunidadesService({ storage }), backendBloqueado: evaluacion.motivo }
}

export function filtrarOportunidades(datos, filtros = {}) {
  const texto = valor => String(valor || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
  return datos.oportunidades.filter(o => {
    if (['embudoId', 'responsableId', 'servicio', 'estado', 'etapaId', 'moneda', 'prioridad'].some(c => filtros[c] && filtros[c] !== o[c])) return false
    const cliente = datos.clientes.find(c => c.id === o.clienteId)
    const empresa = datos.empresas.find(e => e.id === o.empresaId)
    return texto([o.titulo, o.descripcion, cliente?.nombre, empresa?.nombre, o.servicio, o.id].join(' ')).includes(texto(filtros.busqueda).trim())
  }).map(o => ({ ...o, clienteNombre: datos.clientes.find(c => c.id === o.clienteId)?.nombre || 'Cliente no disponible' }))
}
