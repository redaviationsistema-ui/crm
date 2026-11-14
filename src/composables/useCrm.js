import { computed, reactive, ref } from 'vue'
import { supabase } from '@/lib/supabase'
import { contarRespuestasLlamadas } from '@/lib/crmMetrics'
import * as crmSupabaseService from '@/services/crmSupabaseService'
import { esMismaFechaLocal, formatearFecha, normalizarTexto, resolverEstadoLlamada } from '../lib/crm'

export function normalizarError(error) {
  if (String(error?.message || '').includes('fecha_programada')) {
    return 'Selecciona la fecha y hora de la llamada.'
  }

  if (error?.code === '42501') {
    return 'No tienes permisos para realizar esta acción.'
  }

  if (/failed to fetch|networkerror|network request|timeout/i.test(error?.message || '')) return 'No se pudo conectar. Revisa tu conexión; tus datos siguen en el formulario.'

  if (error?.code === '23505') return 'Ya existe un registro con esos datos. Revisa el correo o teléfono.'

  if (error?.code === '23503') {
    return 'Existe un problema con un registro relacionado.'
  }

  if (error?.code === '23514') {
    return 'Uno de los datos enviados no es válido.'
  }

  return error?.message || 'Ocurrió un error inesperado.'
}

export function useCrm() {
  const estado = reactive({
    usuario: null,
    perfil: null,
    contexto: null,
    llamadas: [],
    resumenLlamadas: [],
    llamadasHoy: [],
    llamadasVencidas: [],
    prospectos: [],
    usuarios: [],
    motivos: [],
    resultados: [],
    notificaciones: [],
    historial: [],
    llamadaSeleccionada: null,
    totalLlamadas: 0,
    cargando: false,
    guardando: false,
    error: null,
    errorOperacion: null,
    aviso: null,
  })

  const vistaActiva = ref('panel')
  const sidebarAbierto = ref(false)
  const drawerAbierto = ref(false)
  const formularioAbierto = ref(false)
  const formularioContactoAbierto = ref(false)
  const contactoEnEdicion = ref(null)
  const contactoDestacado = ref({ id: '', nonce: 0 })
  const modalCancelacion = ref(false)
  const modalReprogramacion = ref(false)
  const modalReasignacion = ref(false)
  const modoFormularioLlamada = ref('crear')
  const prospectoPreseleccionadoId = ref('')
  const llamadaEnEdicion = ref(null)
  const llamadaPendienteCancelacion = ref(null)
  const llamadaPendienteReprogramacion = ref(null)
  const llamadaPendienteReasignacion = ref(null)
  const canalRealtime = ref(null)

  const filtros = ref({
    tab: 'todas',
    mercado: 'todos',
    estado: 'todos',
    prioridad: 'todas',
    responsableId: '',
    fecha: '',
    busqueda: '',
  })

  const tituloVista = computed(
    () =>
      ({
        panel: 'Panel general',
        contactos: 'Contactos',
        oportunidades: 'Oportunidades',
        cotizaciones: 'Cotizaciones',
        llamadas: 'Llamadas',
        seguimientos: 'Seguimientos',
        historial: 'Historial de llamadas',
        reportes: 'Reportes',
        equipo: 'Equipo',
        usuarios: 'Usuarios',
        configuracion: 'Configuración',
      })[vistaActiva.value],
  )

  const descripcionVista = computed(
    () =>
      ({
        panel: 'Resumen general del trabajo comercial y operativo.',
        cotizaciones: 'Propuestas comerciales y vista previa.',
        oportunidades: 'Pipeline comercial de demostración local.',
        contactos: 'Personas y empresas interesadas en adquirir una aeronave.',
        llamadas: 'Consulta y administra las llamadas registradas en el CRM.',
        seguimientos: 'Llamadas que deben realizarse próximamente.',
        historial: 'Consulta las llamadas ya realizadas y su resultado.',
        reportes: 'Indicadores del rendimiento comercial y del seguimiento.',
        equipo: 'Audita el avance operativo del equipo comercial.',
        usuarios: 'Gestiona acceso, roles y estado de los usuarios.',
        configuracion: 'Ajustes del perfil y configuración del CRM.',
      })[vistaActiva.value],
  )

  const llamadasFiltradas = computed(() => {
    const busqueda = normalizarTexto(filtros.value.busqueda)

    return estado.llamadas.filter((llamada) => {
      if (filtros.value.fecha && !llamada.fechaProgramada?.startsWith(filtros.value.fecha)) {
        return false
      }

      if (!busqueda) {
        return true
      }

      const contenido = [
        llamada.cliente?.nombre,
        llamada.cliente?.empresa,
        llamada.cliente?.telefono,
        llamada.motivo,
        llamada.motivoPersonalizado,
      ]
        .join(' ')
        .toLowerCase()

      return contenido.includes(busqueda)
    })
  })

  const historialSeleccionado = computed(() => estado.historial)

  const indicadores = computed(() => {
    const llamadas = estado.resumenLlamadas

    return [
      {
        titulo: 'Pendientes',
        valor: llamadas.filter((item) => resolverEstadoLlamada(item) === 'pendiente').length,
        ayuda: 'Por atender',
        tono: 'primario',
      },
      {
        titulo: 'Hoy',
        valor: estado.llamadasHoy.length,
        ayuda: 'Llamadas para hoy',
      },
      {
        titulo: 'En seguimiento',
        valor: llamadas.filter((item) => resolverEstadoLlamada(item) === 'en seguimiento').length,
        ayuda: 'Con continuidad activa',
      },
      {
        titulo: 'Atrasadas',
        valor: estado.llamadasVencidas.length,
        ayuda: 'Requieren atención',
        tono: 'alerta',
      },
      {
        titulo: 'Completadas',
        valor: llamadas.filter((item) => resolverEstadoLlamada(item) === 'completada').length,
        ayuda: 'Llamadas completadas',
      },
      {
        titulo: 'Nacionales',
        valor: llamadas.filter((item) => normalizarTexto(item.cliente?.tipoMercado) === 'nacional')
          .length,
        ayuda: 'Mercado México',
      },
      {
        titulo: 'Internacionales',
        valor: llamadas.filter(
          (item) => normalizarTexto(item.cliente?.tipoMercado) === 'internacional',
        ).length,
        ayuda: 'Mercado global',
      },
    ]
  })

  const seguimientoAgrupado = computed(() => ({
    hoy: estado.resumenLlamadas.filter((llamada) => esMismaFechaLocal(llamada.fechaProgramada)),
    proximas: estado.resumenLlamadas.filter(
      (llamada) =>
        llamada.fechaProgramada &&
        !esMismaFechaLocal(llamada.fechaProgramada) &&
        new Date(llamada.fechaProgramada).getTime() >= Date.now() &&
        resolverEstadoLlamada(llamada) !== 'vencida',
    ),
    atrasadas: estado.llamadasVencidas,
    completadas: estado.resumenLlamadas.filter(
      (llamada) => resolverEstadoLlamada(llamada) === 'completada',
    ),
  }))

  const promedioDuracion = computed(() => {
    const duraciones = estado.resumenLlamadas
      .map((item) => item.duracionSegundos)
      .filter((valor) => typeof valor === 'number' && !Number.isNaN(valor))

    if (!duraciones.length) {
      return 'Sin datos'
    }

    const promedio = duraciones.reduce((total, valor) => total + valor, 0) / duraciones.length
    return `${Math.round(promedio / 60)} min`
  })

  const respuestasLlamadas = computed(() => contarRespuestasLlamadas(estado.resumenLlamadas))

  const reportes = computed(() => [
    {
      titulo: 'Llamadas registradas',
      valor: respuestasLlamadas.value.registradas,
      ayuda: 'Base actual visible',
    },
    {
      titulo: 'Contestadas',
      valor: respuestasLlamadas.value.contestadas,
      ayuda: 'Respuesta afirmativa registrada',
    },
    {
      titulo: 'No contestadas',
      valor: respuestasLlamadas.value.noContestadas,
      ayuda: 'Intentos sin contacto',
    },
    {
      titulo: 'Pendientes',
      valor: indicadores.value[0]?.valor || 0,
      ayuda: 'Sin iniciar',
    },
    {
      titulo: 'Atrasadas',
      valor: indicadores.value[3]?.valor || 0,
      ayuda: 'Fuera de tiempo',
      tono: 'alerta',
    },
    {
      titulo: 'Completadas',
      valor: indicadores.value[4]?.valor || 0,
      ayuda: 'Llamadas completadas',
    },
    {
      titulo: 'Promedio duración',
      valor: promedioDuracion.value,
      ayuda: 'Calculado sobre llamadas con duración registrada',
    },
    {
      titulo: 'Requieren seguimiento',
      valor: estado.resumenLlamadas.filter((item) => item.requiereSeguimiento).length,
      ayuda: 'Marcadas para dar seguimiento',
    },
  ])

  function filtrosRemotosActuales() {
    const usuarioId = estado.usuario?.id || estado.perfil?.id || null
    const tab = filtros.value.tab
    const estadoDesdeTab =
      tab === 'en-seguimiento'
        ? 'en seguimiento'
        : tab === 'completadas'
          ? 'completada'
          : tab === 'vencida'
            ? 'vencida'
            : tab === 'asignadas'
              ? 'pendiente'
              : null

    return {
      asignadoA:
        tab === 'asignadas' || tab === 'en-seguimiento' || tab === 'completadas' || tab === 'vencida'
          ? usuarioId
          : filtros.value.responsableId || null,
      creadoPor: tab === 'creadas' ? usuarioId : null,
      mercado: filtros.value.mercado !== 'todos' ? filtros.value.mercado : null,
      estado: estadoDesdeTab || (filtros.value.estado !== 'todos' ? filtros.value.estado : null),
      prioridad: filtros.value.prioridad !== 'todas' ? filtros.value.prioridad : null,
    }
  }

  async function cargarUsuario() {
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser()

    if (error) throw error
    if (!user) throw new Error('No existe una sesión activa')

    estado.usuario = user
    return user
  }

  async function cargarPerfil() {
    estado.perfil = await crmSupabaseService.obtenerPerfilActual()
    return estado.perfil
  }

  async function cargarContexto() {
    estado.contexto = await crmSupabaseService.obtenerContextoCrm()
    return estado.contexto
  }

  async function cargarUsuarios() {
    estado.usuarios = await crmSupabaseService.obtenerPerfiles()
    return estado.usuarios
  }

  async function cargarProspectos() {
    estado.prospectos = await crmSupabaseService.obtenerProspectos()
    return estado.prospectos
  }

  async function cargarMotivos() {
    estado.motivos = await crmSupabaseService.obtenerMotivos()
    return estado.motivos
  }

  async function cargarResultados() {
    estado.resultados = await crmSupabaseService.obtenerResultados()
    return estado.resultados
  }

  async function cargarLlamadas() {
    const { datos, total } = await crmSupabaseService.obtenerLlamadas({
      porPagina: 100,
      ...filtrosRemotosActuales(),
    })

    estado.llamadas = datos
    estado.totalLlamadas = total

    if (estado.llamadaSeleccionada?.id) {
      const actualizada = datos.find((item) => item.id === estado.llamadaSeleccionada.id)
      if (actualizada) {
        estado.llamadaSeleccionada = actualizada
      }
    }

    return datos
  }

  async function cargarResumenLlamadas() {
    const [todas, hoy, vencidas] = await Promise.all([
      crmSupabaseService.obtenerLlamadas({ porPagina: 200 }),
      crmSupabaseService.obtenerLlamadasHoy(),
      crmSupabaseService.obtenerLlamadasVencidas(),
    ])

    estado.resumenLlamadas = todas.datos
    estado.llamadasHoy = hoy
    estado.llamadasVencidas = vencidas
  }

  async function cargarNotificaciones() {
    const usuarioId = estado.usuario?.id || estado.perfil?.id

    if (!usuarioId) {
      estado.notificaciones = []
      return []
    }

    estado.notificaciones = await crmSupabaseService.obtenerNotificaciones(usuarioId)
    return estado.notificaciones
  }

  async function cargarHistorial(llamadaId) {
    if (!llamadaId) {
      estado.historial = []
      return []
    }

    estado.historial = await crmSupabaseService.obtenerHistorial(llamadaId)
    return estado.historial
  }

  async function refrescarTablero() {
    await Promise.all([cargarLlamadas(), cargarResumenLlamadas(), cargarNotificaciones()])

    if (estado.llamadaSeleccionada?.id) {
      await cargarHistorial(estado.llamadaSeleccionada.id)
    }
  }

  async function inicializarCrm() {
    estado.cargando = true
    estado.error = null
    estado.errorOperacion = null

    try {
      await cargarUsuario()
      await cargarPerfil()
      await cargarContexto()

      await Promise.all([
        cargarUsuarios(),
        cargarProspectos(),
        cargarMotivos(),
        cargarResultados(),
        cargarLlamadas(),
        cargarResumenLlamadas(),
        cargarNotificaciones(),
      ])

      try {
        iniciarRealtime()
      } catch (error) {
        console.error('No se pudo iniciar Realtime del CRM.', error)
      }
    } catch (error) {
      estado.error = normalizarError(error)
    } finally {
      estado.cargando = false
    }
  }

  async function seleccionarLlamada(llamada) {
    if (!llamada?.id) return

    drawerAbierto.value = true
    estado.llamadaSeleccionada = await crmSupabaseService.obtenerLlamada(llamada.id)
    await cargarHistorial(llamada.id)
  }

  async function crearLlamada(formulario) {
    estado.guardando = true
    estado.errorOperacion = null

    try {
      if (modoFormularioLlamada.value === 'editar' && llamadaEnEdicion.value?.id) {
        await crmSupabaseService.actualizarLlamada(llamadaEnEdicion.value.id, formulario)
      } else {
        await crmSupabaseService.crearLlamada(formulario)
      }

      formularioAbierto.value = false
      prospectoPreseleccionadoId.value = ''
      modoFormularioLlamada.value = 'crear'
      llamadaEnEdicion.value = null
      vistaActiva.value = 'llamadas'
      await refrescarTablero()
    } catch (error) {
      console.error('No fue posible programar la llamada.', error)
      estado.errorOperacion = normalizarError(error)
      throw error
    } finally {
      estado.guardando = false
    }
  }

  async function crearContacto(formulario) {
    if (estado.guardando) return
    estado.guardando = true
    estado.errorOperacion = null
    estado.aviso = null
    try {
      const contacto = contactoEnEdicion.value
        ? await crmSupabaseService.actualizarProspecto(contactoEnEdicion.value.id, formulario)
        : await crmSupabaseService.crearProspecto(formulario)
      const indice = estado.prospectos.findIndex(item => item.id === contacto.id)
      if (indice < 0) estado.prospectos.unshift(contacto)
      else estado.prospectos.splice(indice, 1, contacto)
      formularioContactoAbierto.value = false
      contactoEnEdicion.value = null
      estado.aviso = 'Contacto guardado correctamente.'
      try { await cargarProspectos() }
      catch { estado.aviso = 'El contacto se guardó. No se pudo recargar la lista; puedes volver a cargar la página sin repetir el guardado.' }
    } catch (error) {
      estado.errorOperacion = normalizarError(error)
    } finally {
      estado.guardando = false
    }
  }

  function abrirFormularioContacto(contacto = null) {
    if (estado.guardando) return
    estado.errorOperacion = null
    estado.aviso = null
    contactoEnEdicion.value = contacto?.id ? { ...contacto } : null
    formularioContactoAbierto.value = true
  }

  function destacarContacto(contactoId) {
    contactoDestacado.value = {
      id: contactoId || '',
      nonce: Date.now(),
    }
  }

  async function iniciarLlamada(llamada) {
    if (!llamada?.id) return

    estado.guardando = true
    estado.errorOperacion = null

    try {
      await crmSupabaseService.iniciarLlamada(llamada.id)
      await Promise.all([cargarLlamadas(), cargarResumenLlamadas()])
      await seleccionarLlamada({ id: llamada.id })
    } catch (error) {
      console.error('No fue posible iniciar la llamada.', error)
      estado.errorOperacion = normalizarError(error)
    } finally {
      estado.guardando = false
    }
  }

  async function finalizarLlamada(payload) {
    estado.guardando = true
    estado.errorOperacion = null

    try {
      await crmSupabaseService.finalizarLlamada({
        llamadaId: payload.llamadaId,
        contesto: payload.contesto,
        resultadoId: payload.resultadoId,
        notas: payload.notas,
      })

      await Promise.all([cargarLlamadas(), cargarResumenLlamadas(), cargarNotificaciones()])
      await seleccionarLlamada({ id: payload.llamadaId })
    } catch (error) {
      console.error('No fue posible finalizar la llamada.', error)
      estado.errorOperacion = normalizarError(error)
    } finally {
      estado.guardando = false
    }
  }

  async function crearSeguimiento(payload) {
    estado.guardando = true
    estado.errorOperacion = null

    try {
      await crmSupabaseService.crearSeguimiento({
        llamadaPadreId: payload.llamadaId,
        fecha: payload.fechaProxima,
        hora: payload.horaProxima,
        asignadoAId: payload.asignadoAId,
        prioridad: payload.prioridad,
        motivoId: payload.motivoId,
        motivoPersonalizado: payload.motivoPersonalizado,
        descripcion: payload.descripcion,
      })

      await Promise.all([cargarLlamadas(), cargarResumenLlamadas(), cargarNotificaciones()])
      await seleccionarLlamada({ id: payload.llamadaId })
    } catch (error) {
      console.error('No fue posible crear el seguimiento.', error)
      estado.errorOperacion = normalizarError(error)
      throw error
    } finally {
      estado.guardando = false
    }
  }

  async function reasignarLlamada(llamada, nuevoUsuarioId) {
    if (!llamada?.id || !nuevoUsuarioId) return

    estado.guardando = true
    estado.errorOperacion = null

    try {
      await crmSupabaseService.reasignarLlamada(llamada.id, nuevoUsuarioId)
      await refrescarTablero()
    } catch (error) {
      console.error('No fue posible reasignar la llamada.', error)
      estado.errorOperacion = normalizarError(error)
    } finally {
      estado.guardando = false
    }
  }

  async function reprogramarLlamada(llamada, nuevaFecha) {
    if (!llamada?.id || !nuevaFecha) return

    estado.guardando = true
    estado.errorOperacion = null

    try {
      await crmSupabaseService.reprogramarLlamada(llamada.id, nuevaFecha)
      await refrescarTablero()
    } catch (error) {
      console.error('No fue posible reprogramar la llamada.', error)
      estado.errorOperacion = normalizarError(error)
    } finally {
      estado.guardando = false
    }
  }

  function solicitarCancelacion(llamada) {
    llamadaPendienteCancelacion.value = llamada
    modalCancelacion.value = true
  }

  function solicitarReprogramacion(llamada) {
    llamadaPendienteReprogramacion.value = llamada
    modalReprogramacion.value = true
  }

  function solicitarReasignacion(llamada) {
    llamadaPendienteReasignacion.value = llamada
    modalReasignacion.value = true
  }

  function editarLlamada(llamada) {
    prospectoPreseleccionadoId.value = llamada?.prospectoId || ''
    llamadaEnEdicion.value = llamada
    modoFormularioLlamada.value = 'editar'
    formularioAbierto.value = true
  }

  function programarLlamada(prospecto = null) {
    prospectoPreseleccionadoId.value =
      typeof prospecto === 'string' ? prospecto : prospecto?.id || prospecto?.prospectoId || ''
    llamadaEnEdicion.value = null
    modoFormularioLlamada.value = 'crear'
    formularioAbierto.value = true
  }

  async function confirmarCancelacion(motivo) {
    if (!llamadaPendienteCancelacion.value?.id) return

    estado.guardando = true
    estado.errorOperacion = null

    try {
      await crmSupabaseService.cancelarLlamada(llamadaPendienteCancelacion.value.id, motivo)
      modalCancelacion.value = false
      llamadaPendienteCancelacion.value = null
      await refrescarTablero()
    } catch (error) {
      console.error('No fue posible cancelar la llamada.', error)
      estado.errorOperacion = normalizarError(error)
    } finally {
      estado.guardando = false
    }
  }

  async function confirmarReprogramacion(payload) {
    if (!llamadaPendienteReprogramacion.value?.id || !payload?.fechaProgramada) return

    await reprogramarLlamada(llamadaPendienteReprogramacion.value, payload.fechaProgramada)
    modalReprogramacion.value = false
    llamadaPendienteReprogramacion.value = null
  }

  async function confirmarReasignacion(usuarioId) {
    if (!llamadaPendienteReasignacion.value?.id || !usuarioId) return

    await reasignarLlamada(llamadaPendienteReasignacion.value, usuarioId)
    modalReasignacion.value = false
    llamadaPendienteReasignacion.value = null
  }

  async function marcarNotificacionLeida(notificacionId) {
    try {
      await crmSupabaseService.marcarNotificacionLeida(notificacionId)
      await cargarNotificaciones()
    } catch (error) {
      console.error('No fue posible marcar la notificación como leída.', error)
      estado.errorOperacion = normalizarError(error)
    }
  }

  async function actualizarFiltros(nuevosFiltros) {
    filtros.value = {
      ...filtros.value,
      ...nuevosFiltros,
    }

    try {
      await cargarLlamadas()
    } catch (error) {
      estado.errorOperacion = normalizarError(error)
    }
  }

  function iniciarRealtime() {
    if (canalRealtime.value) {
      return canalRealtime.value
    }

    const canal = supabase
      .channel('crm-realtime')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'llamadas',
        },
        async () => {
          await Promise.all([cargarLlamadas(), cargarResumenLlamadas()])
          if (estado.llamadaSeleccionada?.id) {
            await seleccionarLlamada({ id: estado.llamadaSeleccionada.id })
          }
        },
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'notificaciones',
        },
        async () => {
          await cargarNotificaciones()
        },
      )
      .subscribe()

    canalRealtime.value = canal
    return canal
  }

  function detenerRealtime() {
    if (!canalRealtime.value) return
    supabase.removeChannel(canalRealtime.value)
    canalRealtime.value = null
  }

  return {
    estado,
    vistaActiva,
    sidebarAbierto,
    drawerAbierto,
    formularioAbierto,
    formularioContactoAbierto,
    contactoEnEdicion,
    contactoDestacado,
    modalCancelacion,
    modalReprogramacion,
    modalReasignacion,
    modoFormularioLlamada,
    prospectoPreseleccionadoId,
    filtros,
    tituloVista,
    descripcionVista,
    llamadasFiltradas,
    historialSeleccionado,
    indicadores,
    seguimientoAgrupado,
    reportes,
    inicializarCrm,
    cargarLlamadas,
    actualizarFiltros,
    seleccionarLlamada,
    crearLlamada,
    crearContacto,
    abrirFormularioContacto,
    destacarContacto,
    programarLlamada,
    editarLlamada,
    iniciarLlamada,
    finalizarLlamada,
    crearSeguimiento,
    reasignarLlamada,
    reprogramarLlamada,
    solicitarCancelacion,
    solicitarReprogramacion,
    solicitarReasignacion,
    confirmarCancelacion,
    confirmarReprogramacion,
    confirmarReasignacion,
    marcarNotificacionLeida,
    detenerRealtime,
    formatearFecha,
    llamadaEnEdicion,
    llamadaPendienteReprogramacion,
    llamadaPendienteReasignacion,
  }
}
