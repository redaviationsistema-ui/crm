import { crearCambiosContacto } from '@/domain/contactoPayload'
import {
  adaptarHistorialDesdeSupabase,
  adaptarImagenDesdeSupabase,
  adaptarLlamadaDesdeSupabase,
  adaptarMotivoDesdeSupabase,
  adaptarNotificacionDesdeSupabase,
  adaptarPerfilDesdeSupabase,
  adaptarProspectoDesdeSupabase,
  adaptarResultadoDesdeSupabase,
  crearPayloadLlamada,
} from '@/adapters/crmAdapters'
import { construirFechaProgramada, duracionLlamadaValida, esEjecutivoActivo, normalizarCorreo, normalizarTelefono } from '@/lib/crm'
import { supabase } from '@/lib/supabase'
import { exigirEscriturasStagingHabilitadas } from '@/lib/stagingWriteProtection'

const BUCKET_IMAGENES = 'crm-llamadas-imagenes'

async function obtenerUsuarioAutenticado() {
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()

  if (error) throw error
  if (!user) {
    throw new Error('No existe una sesión activa')
  }

  return user
}

export async function obtenerPerfilActual() {
  const user = await obtenerUsuarioAutenticado()

  const { data, error } = await supabase
    .from('perfiles')
    .select(
      `
        id,
        nombre,
        apellidos,
        correo,
        telefono,
        avatar_url,
        rol,
        activo
      `,
    )
    .eq('id', user.id)
    .single()

  if (error) throw error
  if (!data) {
    throw new Error('El usuario autenticado no tiene un perfil CRM asociado.')
  }
  if (data.activo !== true) {
    throw new Error('El perfil CRM del usuario no está activo.')
  }

  return adaptarPerfilDesdeSupabase(data)
}

export async function obtenerContextoCrm() {
  const { data, error } = await supabase.rpc('mi_contexto_crm')

  if (error) throw error

  return data
}

export async function obtenerPerfiles() {
  const { data, error } = await supabase
    .from('perfiles')
    .select(
      `
        id,
        nombre,
        apellidos,
        correo,
        telefono,
        avatar_url,
        rol,
        activo
      `,
    )
    .eq('activo', true)
    .order('nombre', { ascending: true })

  if (error) throw error

  return (data || []).map(adaptarPerfilDesdeSupabase)
}

export async function obtenerProspectos() {
  const { data, error } = await supabase
    .from('prospectos')
    .select(
      `
        id,
        nombre,
        apellidos,
        empresa,
        cargo,
        telefono,
        whatsapp,
        correo,
        tipo_mercado,
        pais,
        estado,
        ciudad,
        fabricante_interes,
        modelo_interes,
        presupuesto,
        moneda,
        prioridad,
        usuario_responsable_id,
        notas,
        activo,
        creado_por,
        fecha_creacion,
        fecha_actualizacion
      `,
    )
    .eq('activo', true)
    .order('fecha_creacion', { ascending: false })

  if (error) throw error

  return (data || []).map(adaptarProspectoDesdeSupabase)
}

export async function obtenerProspecto(id) {
  const { data, error } = await supabase
    .from('prospectos')
    .select('*')
    .eq('id', id)
    .single()

  if (error) throw error

  return adaptarProspectoDesdeSupabase(data)
}

export async function crearProspecto(formulario) {
  exigirEscriturasStagingHabilitadas('crear prospecto')
  const user = await obtenerUsuarioAutenticado()
  const telefono = normalizarTelefono(formulario.telefono)
  const whatsapp = normalizarTelefono(formulario.whatsapp)
  const correo = normalizarCorreo(formulario.correo)
  const presupuesto =
    formulario.presupuesto !== '' && formulario.presupuesto != null
      ? Math.max(0, Number(formulario.presupuesto) || 0)
      : null

  const payload = {
    nombre: formulario.nombre.trim(),
    apellidos: formulario.apellidos?.trim() || null,
    empresa: formulario.empresa?.trim() || null,
    cargo: formulario.cargo?.trim() || null,
    telefono,
    whatsapp: whatsapp || null,
    correo: correo || null,
    tipo_mercado: formulario.tipoMercado,
    pais: formulario.pais?.trim() || null,
    estado: formulario.estado?.trim() || null,
    ciudad: formulario.ciudad?.trim() || null,
    fabricante_interes: formulario.fabricanteInteres || null,
    modelo_interes: formulario.modeloInteres || null,
    presupuesto,
    moneda: formulario.moneda || 'USD',
    prioridad: formulario.prioridad || 'media',
    usuario_responsable_id: formulario.usuarioResponsableId || user.id,
    notas: formulario.notas?.trim() || null,
    creado_por: user.id,
  }

  const { data, error } = await supabase.from('prospectos').insert(payload).select().single()

  if (error) throw error

  return adaptarProspectoDesdeSupabase(data)
}

export async function actualizarProspecto(id, cambios) {
  exigirEscriturasStagingHabilitadas('editar prospecto')
  const payload = crearCambiosContacto(cambios)
  if (!Object.keys(payload).length) throw new Error('No hay cambios para guardar.')

  const { data, error } = await supabase
    .from('prospectos')
    .update(payload)
    .eq('id', id)
    .select()
    .single()

  if (error) throw error

  return adaptarProspectoDesdeSupabase(data)
}

export async function obtenerLlamadas({
  pagina = 1,
  porPagina = 25,
  asignadoA = null,
  creadoPor = null,
  mercado = null,
  estado = null,
  prioridad = null,
  orden = 'fecha_programada',
} = {}) {
  const desde = (pagina - 1) * porPagina
  const hasta = desde + porPagina - 1

  let query = supabase.from('vista_llamadas_detalle').select('*', { count: 'exact' })

  if (asignadoA) query = query.eq('asignado_a', asignadoA)
  if (creadoPor) query = query.eq('creado_por', creadoPor)
  if (mercado) query = query.eq('tipo_mercado', mercado)
  if (estado) query = query.eq('estado', estado)
  if (prioridad) query = query.eq('prioridad', prioridad)

  const porActividad = orden === 'fecha_creacion' || orden === 'fecha_actualizacion'
  if (porActividad) {
    query = query.order(orden, { ascending: false, nullsFirst: false }).order('id', { ascending: true })
  } else {
    query = query.order('fecha_programada', { ascending: true })
  }
  const { data, error, count } = await query.range(desde, hasta)

  if (error) throw error

  return {
    datos: (data || []).map(adaptarLlamadaDesdeSupabase),
    total: count || 0,
  }
}

function actividadLlamada(llamada) {
  return Math.max(...[llamada.fechaCreacion, llamada.fechaActualizacion].map(fecha => {
    const instante = Date.parse(fecha)
    if (!Number.isFinite(instante)) return -Infinity
    // Date.parse conserva milisegundos. PostgreSQL puede distinguir microsegundos.
    const fraccion = /\.(\d+)/.exec(fecha)?.[1] || ''
    return instante * 1000 + Number(fraccion.padEnd(6, '0').slice(3, 6))
  }))
}

function compararActividad(a, b) {
  return (actividadLlamada(b) - actividadLlamada(a)) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)
}

export async function obtenerLlamadasRecientes(filtros, coincide) {
  const limite = 4
  async function obtenerCandidatas(orden) {
    const candidatas = new Map()
    const porPagina = coincide ? 100 : limite
    for (let pagina = 1; candidatas.size < limite; pagina++) {
      const { datos } = await obtenerLlamadas({ ...filtros, orden, pagina, porPagina })
      for (const llamada of datos) {
        if ((!coincide || coincide(llamada)) && !candidatas.has(llamada.id)) candidatas.set(llamada.id, llamada)
      }
      if (datos.length < porPagina) break
    }
    return [...candidatas.values()].slice(0, limite)
  }

  // Toda fila del top global está entre las primeras cuatro de al menos una de las dos fechas.
  const grupos = await Promise.all([
    obtenerCandidatas('fecha_creacion'),
    obtenerCandidatas('fecha_actualizacion'),
  ])
  const porId = new Map()
  for (const llamada of grupos.flat()) {
    const anterior = porId.get(llamada.id)
    if (!anterior || compararActividad(llamada, anterior) < 0) porId.set(llamada.id, llamada)
  }
  return [...porId.values()].sort(compararActividad).slice(0, limite)
}

export async function obtenerLlamada(id) {
  const { data, error } = await supabase
    .from('vista_llamadas_detalle')
    .select('*')
    .eq('id', id)
    .single()

  if (error) throw error

  return adaptarLlamadaDesdeSupabase(data)
}

export async function obtenerLlamadasHoy() {
  const { data, error } = await supabase
    .from('vista_llamadas_hoy')
    .select('*')
    .order('fecha_programada', { ascending: true })

  if (error) throw error

  return (data || []).map(adaptarLlamadaDesdeSupabase)
}

export async function obtenerLlamadasVencidas() {
  const { data, error } = await supabase
    .from('vista_llamadas_vencidas')
    .select('*')
    .order('fecha_programada', { ascending: true })

  if (error) throw error

  return (data || []).map(adaptarLlamadaDesdeSupabase)
}

async function verificarResponsableLlamada(id) {
  if (typeof id !== 'string' || !id.trim()) throw new Error('Selecciona un ejecutivo activo.')

  const { data, error } = await supabase
    .from('perfiles')
    .select('id,rol,activo')
    .eq('id', id)
    .maybeSingle()

  if (error) throw error
  if (data?.id !== id || !esEjecutivoActivo(data)) {
    throw new Error('El responsable debe ser un ejecutivo activo y estar disponible para asignación.')
  }
}

export async function crearLlamada(formulario) {
  exigirEscriturasStagingHabilitadas('crear llamada')
  const user = await obtenerUsuarioAutenticado()
  if (!formulario.prospectoId) {
    throw new Error('Selecciona un contacto.')
  }

  if (!formulario.asignadoAId) {
    throw new Error('Selecciona un responsable.')
  }

  if (!formulario.motivoId) {
    throw new Error('Selecciona un motivo.')
  }

  const fechaProgramada = construirFechaProgramada(formulario.fecha, formulario.hora)
  const payload = crearPayloadLlamada(
    {
      ...formulario,
      fechaProgramada,
    },
    user.id,
  )

  await verificarResponsableLlamada(formulario.asignadoAId)
  const { data, error } = await supabase.from('llamadas').insert(payload).select().single()

  if (error) throw error

  return data
}

export async function actualizarLlamada(llamadaId, cambios) {
  exigirEscriturasStagingHabilitadas('editar llamada')
  const payload = {
    motivo_id: cambios.motivoId || null,
    motivo_personalizado: cambios.motivoPersonalizado || null,
    descripcion: cambios.descripcion || null,
    prioridad: cambios.prioridad || 'media',
    fecha_actualizacion: new Date().toISOString(),
  }

  const { data, error } = await supabase
    .from('llamadas')
    .update(payload)
    .eq('id', llamadaId)
    .select()
    .single()

  if (error) throw error

  return data
}

export async function iniciarLlamada(llamadaId) {
  exigirEscriturasStagingHabilitadas('iniciar llamada')
  const { data, error } = await supabase.rpc('iniciar_llamada', {
    p_llamada_id: llamadaId,
  })

  if (error) throw error

  return data
}

export async function finalizarLlamada({ llamadaId, contesto, resultadoId, notas, duracion = null }) {
  exigirEscriturasStagingHabilitadas('finalizar llamada')
  if (!duracionLlamadaValida(duracion)) {
    throw new Error('Indica una duración en minutos enteros no negativos.')
  }

  // La RPC existente no admite duración manual. Conservar su firma evita una segunda escritura no atómica.
  let respuesta
  try {
    respuesta = await supabase.rpc('finalizar_llamada', {
      p_llamada_id: llamadaId,
      p_contesto: contesto,
      p_resultado_id: resultadoId,
      p_notas: notas || null,
    })
  } catch (error) {
    throw Object.assign(new Error('No se recibió la confirmación de finalización.', { cause: error }), {
      resultadoIncierto: true,
    })
  }

  const { data, error, status } = respuesta
  if (error) {
    if (status === 0 || status === 408 || status >= 500 || !error.code) {
      throw Object.assign(new Error('No se recibió la confirmación de finalización.', { cause: error }), {
        resultadoIncierto: true,
      })
    }
    throw error
  }

  return data
}

export async function crearSeguimiento(formulario) {
  exigirEscriturasStagingHabilitadas('crear seguimiento')
  if (!formulario.llamadaPadreId) {
    throw new Error('No fue posible identificar la llamada base del seguimiento.')
  }

  if (!formulario.asignadoAId) {
    throw new Error('Selecciona un responsable.')
  }

  const fechaProgramada = construirFechaProgramada(formulario.fecha, formulario.hora)
  const payload = {
    p_llamada_padre_id: formulario.llamadaPadreId,
    p_fecha_programada: fechaProgramada,
    p_asignado_a: formulario.asignadoAId,
    p_prioridad: formulario.prioridad,
    p_motivo_id: formulario.motivoId || null,
    p_motivo_personalizado: formulario.motivoPersonalizado || null,
    p_descripcion: formulario.descripcion || null,
  }

  await verificarResponsableLlamada(formulario.asignadoAId)
  const { data, error } = await supabase.rpc('crear_seguimiento_llamada', {
    ...payload,
  })

  if (error) throw error

  return data
}

export async function reasignarLlamada(llamadaId, nuevoUsuarioId) {
  exigirEscriturasStagingHabilitadas('reasignar llamada')
  await verificarResponsableLlamada(nuevoUsuarioId)
  const { data, error } = await supabase
    .from('llamadas')
    .update({
      asignado_a: nuevoUsuarioId,
      fecha_actualizacion: new Date().toISOString(),
    })
    .eq('id', llamadaId)
    .select()
    .single()

  if (error) throw error

  return data
}

export async function reprogramarLlamada(llamadaId, nuevaFecha) {
  exigirEscriturasStagingHabilitadas('reprogramar llamada')
  let respuesta
  try {
    respuesta = await supabase
      .from('llamadas')
      .update({ fecha_programada: nuevaFecha })
      .eq('id', llamadaId)
      .select()
      .single()
  } catch (error) {
    throw Object.assign(new Error('No se recibió la confirmación de reprogramación.', { cause: error }), {
      resultadoIncierto: true,
    })
  }

  const { data, error, status } = respuesta
  if (error) {
    if (status === 0 || status === 408 || status >= 500) {
      throw Object.assign(new Error('No se recibió la confirmación de reprogramación.', { cause: error }), {
        resultadoIncierto: true,
      })
    }
    if (status === 403 && !error.code) throw Object.assign(new Error('No tienes permisos para realizar esta acción.'), { code: '42501' })
    throw error
  }
  return data
}

export async function cancelarLlamada(llamadaId, motivo) {
  exigirEscriturasStagingHabilitadas('cancelar llamada')
  const user = await obtenerUsuarioAutenticado()

  const { data, error } = await supabase
    .from('llamadas')
    .update({
      estado: 'cancelada',
      fecha_actualizacion: new Date().toISOString(),
      cancelada_por: user.id,
      fecha_cancelacion: new Date().toISOString(),
      motivo_cancelacion: motivo || null,
    })
    .eq('id', llamadaId)
    .select()
    .single()

  if (error) throw error

  return data
}

export async function obtenerMotivos() {
  const { data, error } = await supabase
    .from('catalogo_motivos_llamada')
    .select('*')
    .order('id', { ascending: true })

  if (error) throw error

  return (data || []).map(adaptarMotivoDesdeSupabase).filter((item) => item.activo)
}

export async function obtenerResultados() {
  const { data, error } = await supabase
    .from('catalogo_resultados_llamada')
    .select('*')
    .order('id', { ascending: true })

  if (error) throw error

  return (data || []).map(adaptarResultadoDesdeSupabase).filter((item) => item.activo)
}

export async function obtenerHistorial(llamadaId) {
  const { data, error } = await supabase
    .from('historial_llamadas')
    .select(
      `
        id,
        llamada_id,
        usuario_id,
        tipo_evento,
        estado_anterior,
        estado_nuevo,
        descripcion,
        datos_adicionales,
        fecha_creacion,
        perfil:usuario_id (
          id,
          nombre,
          apellidos
        )
      `,
    )
    .eq('llamada_id', llamadaId)
    .order('fecha_creacion', { ascending: false })

  if (error) throw error

  return (data || []).map(adaptarHistorialDesdeSupabase)
}

export async function obtenerNotificaciones(usuarioId) {
  const { data, error } = await supabase
    .from('notificaciones')
    .select('*')
    .eq('usuario_id', usuarioId)
    .order('fecha_creacion', { ascending: false })

  if (error) throw error

  return (data || []).map(adaptarNotificacionDesdeSupabase)
}

export async function marcarNotificacionLeida(notificacionId) {
  const { error } = await supabase.rpc('marcar_notificacion_leida', {
    p_notificacion_id: notificacionId,
  })

  if (error) throw error
}

export async function obtenerImagenes(llamadaId) {
  const { data, error } = await supabase
    .from('imagenes_llamadas')
    .select('*')
    .eq('llamada_id', llamadaId)
    .order('fecha_creacion', { ascending: false })

  if (error) throw error

  return (data || []).map(adaptarImagenDesdeSupabase)
}

export async function subirImagen(llamadaId, file) {
  exigirEscriturasStagingHabilitadas('subir imagen de llamada')
  const user = await obtenerUsuarioAutenticado()
  const extension = file.name.includes('.') ? file.name.split('.').pop() : 'bin'
  const nombreSeguro = `${crypto.randomUUID()}.${extension}`
  const rutaStorage = `${llamadaId}/${nombreSeguro}`

  const { error: uploadError } = await supabase.storage
    .from(BUCKET_IMAGENES)
    .upload(rutaStorage, file, {
      upsert: false,
      contentType: file.type || 'application/octet-stream',
    })

  if (uploadError) throw uploadError

  const payload = {
    llamada_id: llamadaId,
    ruta_storage: rutaStorage,
    nombre_archivo: file.name,
    tipo_mime: file.type || 'application/octet-stream',
    tamano_bytes: file.size,
    subido_por: user.id,
  }

  const { data, error } = await supabase
    .from('imagenes_llamadas')
    .insert(payload)
    .select('*')
    .single()

  if (error) throw error

  return adaptarImagenDesdeSupabase(data)
}

export async function eliminarImagen(imagen) {
  exigirEscriturasStagingHabilitadas('eliminar imagen de llamada')
  const rutaStorage = imagen.rutaStorage || imagen.ruta_storage || imagen.path

  if (rutaStorage) {
    const { error: storageError } = await supabase.storage.from(BUCKET_IMAGENES).remove([rutaStorage])
    if (storageError) throw storageError
  }

  const { error } = await supabase.from('imagenes_llamadas').delete().eq('id', imagen.id)

  if (error) throw error
}

export async function crearUrlFirmada(rutaStorage, expiraEnSegundos = 3600) {
  const { data, error } = await supabase.storage
    .from(BUCKET_IMAGENES)
    .createSignedUrl(rutaStorage, expiraEnSegundos)

  if (error) throw error

  return data?.signedUrl || null
}
