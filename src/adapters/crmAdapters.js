function nombreCompleto(...partes) {
  return partes.filter(Boolean).join(' ').trim()
}

function valorEtiqueta(row, candidatos) {
  for (const campo of candidatos) {
    if (row?.[campo]) {
      return row[campo]
    }
  }

  return ''
}

export function adaptarPerfilDesdeSupabase(row) {
  if (!row) return null

  return {
    id: row.id,
    nombre: row.nombre || '',
    apellidos: row.apellidos || '',
    nombreCompleto: nombreCompleto(row.nombre, row.apellidos),
    correo: row.correo || '',
    telefono: row.telefono || '',
    avatarUrl: row.avatar_url || '',
    rol: row.rol || '',
    activo: row.activo === true,
  }
}

export function adaptarProspectoDesdeSupabase(row) {
  if (!row) return null

  const responsableNombre =
    nombreCompleto(row.responsable_nombre, row.responsable_apellidos) || ''

  return {
    id: row.id,
    nombre: nombreCompleto(row.nombre, row.apellidos) || row.nombre || '',
    nombres: row.nombre || '',
    apellidos: row.apellidos || '',
    empresa: row.empresa || '',
    cargo: row.cargo || '',
    telefono: row.telefono || '',
    whatsapp: row.whatsapp || '',
    correo: row.correo || '',
    mercado: row.tipo_mercado || '',
    pais: row.pais || '',
    estado: row.estado || '',
    ciudad: row.ciudad || '',
    fabricanteInteres: row.fabricante_interes || '',
    modeloInteres: row.modelo_interes || '',
    presupuesto: row.presupuesto ?? null,
    moneda: row.moneda || 'USD',
    prioridad: row.prioridad || 'media',
    responsableId: row.usuario_responsable_id || null,
    responsableNombre,
    creadoPorId: row.creado_por || null,
    notas: row.notas || '',
    activo: row.activo === true,
    fechaCreacion: row.fecha_creacion || null,
    fechaActualizacion: row.fecha_actualizacion || null,
    ultimaLlamada: row.ultima_llamada || null,
    proximaLlamada: row.proxima_llamada || null,
  }
}

export function adaptarLlamadaDesdeSupabase(row) {
  if (!row) return null

  return {
    id: row.id,
    prospectoId: row.prospecto_id,
    llamadaPadreId: row.llamada_padre_id,
    cliente: {
      id: row.prospecto_id,
      nombre: nombreCompleto(row.prospecto_nombre, row.prospecto_apellidos) || row.prospecto_nombre || '',
      apellidos: row.prospecto_apellidos || '',
      empresa: row.empresa || '',
      telefono: row.telefono || '',
      whatsapp: row.whatsapp || '',
      correo: row.correo || '',
      tipoMercado: row.tipo_mercado || '',
      pais: row.pais || '',
      estado: row.prospecto_estado || row.estado_prospecto || '',
      ciudad: row.ciudad || '',
      fabricanteInteres: row.fabricante_interes || '',
      modeloInteres: row.modelo_interes || '',
      presupuesto: row.presupuesto ?? null,
      moneda: row.moneda || 'USD',
    },
    motivoId: row.motivo_id || null,
    motivo: row.motivo || '',
    motivoPersonalizado: row.motivo_personalizado || '',
    descripcion: row.descripcion || '',
    prioridad: row.prioridad || 'media',
    creadoPorId: row.creado_por || null,
    creadoPorNombre: nombreCompleto(row.creador_nombre, row.creador_apellidos),
    asignadoAId: row.asignado_a || null,
    asignadoANombre: nombreCompleto(row.asignado_nombre, row.asignado_apellidos),
    fechaProgramada: row.fecha_programada || null,
    fechaInicio: row.fecha_inicio || null,
    fechaFin: row.fecha_fin || null,
    duracion: row.duracion_segundos != null ? Math.round(Number(row.duracion_segundos) / 60) : null,
    duracionSegundos: row.duracion_segundos ?? null,
    contesto: row.contesto,
    resultadoId: row.resultado_id || null,
    resultado: row.resultado || '',
    notas: row.notas_resultado || row.notas || '',
    notasResultado: row.notas_resultado || '',
    requiereSeguimiento: row.requiere_seguimiento === true,
    estado: row.estado || 'pendiente',
    vencida: row.vencida === true,
    fechaCompletado: row.fecha_completado || null,
    fechaCreacion: row.fecha_creacion || null,
    fechaActualizacion: row.fecha_actualizacion || null,
  }
}

export function adaptarHistorialDesdeSupabase(row) {
  if (!row) return null

  return {
    id: row.id,
    llamadaId: row.llamada_id,
    usuarioId: row.usuario_id || row.perfil?.id || null,
    tipoEvento: row.tipo_evento || '',
    estadoAnterior: row.estado_anterior || '',
    estadoNuevo: row.estado_nuevo || '',
    titulo: row.tipo_evento || 'Evento',
    descripcion: row.descripcion || '',
    datosAdicionales: row.datos_adicionales || null,
    fecha: row.fecha_creacion || null,
    usuarioNombre: nombreCompleto(row.perfil?.nombre, row.perfil?.apellidos),
  }
}

export function adaptarNotificacionDesdeSupabase(row) {
  if (!row) return null

  return {
    id: row.id,
    usuarioId: row.usuario_id || null,
    titulo: valorEtiqueta(row, ['titulo', 'asunto', 'tipo']),
    descripcion: valorEtiqueta(row, ['descripcion', 'mensaje', 'detalle']),
    leida: row.leida === true,
    fechaCreacion: row.fecha_creacion || null,
    data: row,
  }
}

export function adaptarMotivoDesdeSupabase(row) {
  if (!row) return null

  return {
    id: row.id,
    nombre: valorEtiqueta(row, ['nombre', 'motivo', 'descripcion']),
    activo: row.activo !== false,
    data: row,
  }
}

export function adaptarResultadoDesdeSupabase(row) {
  if (!row) return null

  return {
    id: row.id,
    nombre: valorEtiqueta(row, ['nombre', 'resultado', 'descripcion']),
    activo: row.activo !== false,
    contesto: row.contesto,
    data: row,
  }
}

export function adaptarImagenDesdeSupabase(row) {
  if (!row) return null

  return {
    id: row.id,
    llamadaId: row.llamada_id || null,
    rutaStorage: row.ruta_storage || row.storage_path || row.path || '',
    nombreArchivo: row.nombre_archivo || row.filename || '',
    tipoMime: row.tipo_mime || row.mime_type || '',
    tamanoBytes: row.tamano_bytes || row.size_bytes || null,
    fechaCreacion: row.fecha_creacion || null,
    subidoPor: row.subido_por || row.usuario_id || null,
    data: row,
  }
}

export function crearPayloadLlamada(formulario, usuarioId) {
  return {
    prospecto_id: formulario.prospectoId,
    llamada_padre_id: formulario.llamadaPadreId || null,
    creado_por: usuarioId,
    asignado_a: formulario.asignadoAId,
    motivo_id: formulario.motivoId || null,
    motivo_personalizado: formulario.motivoPersonalizado || null,
    descripcion: formulario.descripcion || null,
    prioridad: formulario.prioridad,
    fecha_programada: formulario.fechaProgramada || null,
    estado: 'pendiente',
  }
}
