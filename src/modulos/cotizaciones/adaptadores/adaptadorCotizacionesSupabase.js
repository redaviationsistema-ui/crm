import { calcularCotizacion, fechaCotizacionValida, validarCotizacion } from '../dominio/cotizaciones.js'
import { evaluarModoCotizaciones, tablasCotizaciones, validarColumnasCotizaciones } from '../esquemas/contratoCotizacionesSupabase.js'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const ESTADOS = new Set(['borrador', 'enviada', 'aceptada', 'rechazada', 'vencida', 'cancelada'])
const ROLES = new Set(['administrador', 'supervisor', 'ejecutivo'])

function errorSeguro(error) {
  const mensajes = {
    '42501': 'Supabase rechazó la operación: no tienes permisos para esta oportunidad o cotización.',
    '23503': 'La oportunidad o uno de sus registros relacionados ya no está disponible.',
    '23514': 'Los datos no cumplen las restricciones de la cotización.',
    '23505': 'Supabase detectó un conflicto con el folio o el orden de los conceptos.',
    PGRST202: 'No se encontró la firma publicada de la RPC. No se confirmó la operación.',
  }
  const resultado = new Error(mensajes[error?.code] || 'Supabase no confirmó la operación. Revisa la sesión y recarga antes de continuar.')
  resultado.code = error?.code
  return resultado
}

function errorIncierto(mensaje, causa) {
  const error = new Error(mensaje)
  error.confirmacionPendiente = true
  if (causa?.code) error.code = causa.code
  return error
}

function enteroDecimal(valor, escala, campo) {
  const texto = String(valor ?? '').trim()
  const patron = new RegExp(`^(?:0|[1-9]\\d*)(?:\\.\\d{1,${escala}})?$`)
  if (!patron.test(texto)) throw new Error(`${campo} no tiene un formato decimal válido.`)
  const [entero, fraccion = ''] = texto.split('.')
  return BigInt(entero + fraccion.padEnd(escala, '0'))
}

function numeroJsonExacto(valor, escala, campo) {
  const original = enteroDecimal(valor, escala, campo)
  const numero = Number(valor)
  if (!Number.isFinite(numero) || BigInt(numero.toFixed(escala).replace('.', '').replace(/^0+(?=\d)/, '')) !== original) {
    throw new Error(`${campo} excede la precisión numérica que puede enviarse sin pérdida.`)
  }
  return numero
}

function serializarConceptos(conceptos) {
  return conceptos.map((concepto, indice) => ({
    orden: indice + 1,
    descripcion: concepto.descripcion.trim(),
    cantidad: numeroJsonExacto(concepto.cantidad, 3, `Cantidad del concepto ${indice + 1}`),
    precio_unitario: numeroJsonExacto(concepto.precioUnitario, 2, `Precio del concepto ${indice + 1}`),
  }))
}

function fechaVencimientoIso(fecha) {
  if (!fecha) return null
  if (!fechaCotizacionValida(fecha)) {
    throw new Error('La fecha de vencimiento no es válida.')
  }
  return `${fecha}T23:59:59.999Z`
}

function fechaSolo(valor) {
  if (valor == null || valor === '') return ''
  const fecha = String(valor).slice(0, 10)
  if (!fechaCotizacionValida(fecha)) throw new Error('La cotización contiene una fecha inválida.')
  return fecha
}

function decimalPersistido(valor, escala, campo) {
  const texto = typeof valor === 'number' ? String(valor) : String(valor ?? '')
  enteroDecimal(texto, escala, campo)
  return texto
}

function exigirCatalogoReal(catalogo) {
  if (catalogo?.modo !== 'supabase' || !Array.isArray(catalogo.oportunidades) || !Array.isArray(catalogo.clientes)) {
    throw new Error('No se pudo verificar el catálogo real de oportunidades bajo RLS.')
  }
  return catalogo
}

function convertirRegistro(fila, conceptosRows, catalogo, columnas) {
  const cabecera = columnas.cotizaciones
  const lineas = columnas.conceptos
  const id = fila?.[cabecera.id]
  const oportunidadId = fila?.[cabecera.oportunidadId]
  if (!UUID.test(String(id || '')) || !UUID.test(String(oportunidadId || ''))) {
    throw new Error('La respuesta de lectura no contiene identificadores verificables.')
  }
  const oportunidad = catalogo.oportunidades.find((item) => item.id === oportunidadId)
  if (!oportunidad?.clienteId) {
    throw new Error('La oportunidad o su prospecto no están disponibles bajo los permisos actuales.')
  }

  const estado = fila[cabecera.estado]
  if (!ESTADOS.has(estado)) throw new Error('La cotización contiene un estado no reconocido.')
  const conceptosOrdenados = [...conceptosRows]
    .sort((a, b) => Number(a[lineas.orden]) - Number(b[lineas.orden]))
    .map((item, indice) => {
      if (Number(item[lineas.orden]) !== indice + 1) {
        throw new Error('El orden persistido de los conceptos no es consecutivo.')
      }
      return {
        id: item[lineas.id],
        descripcion: String(item[lineas.descripcion] ?? ''),
        cantidad: decimalPersistido(item[lineas.cantidad], 3, `Cantidad del concepto ${indice + 1}`),
        precioUnitario: decimalPersistido(item[lineas.precioUnitario], 2, `Precio del concepto ${indice + 1}`),
      }
    })
  const calculo = calcularCotizacion(conceptosOrdenados)
  for (let indice = 0; indice < calculo.conceptos.length; indice += 1) {
    const importePersistido = enteroDecimal(
      conceptosRows.find((item) => Number(item[lineas.orden]) === indice + 1)?.[lineas.importe],
      2,
      `Importe del concepto ${indice + 1}`,
    )
    if (importePersistido !== enteroDecimal(calculo.conceptos[indice].importe, 2, `Importe calculado ${indice + 1}`)) {
      throw new Error('El importe generado por PostgreSQL no coincide con el cálculo del PDF.')
    }
  }
  const registro = {
    id,
    folio: String(fila[cabecera.numero] ?? ''),
    oportunidadId,
    oportunidadTitulo: oportunidad.titulo || '',
    prospectoId: oportunidad.clienteId,
    clienteId: oportunidad.clienteId,
    clienteNombre: catalogo.clientes.find((item) => item.id === oportunidad.clienteId)?.nombre || '',
    empresaNombre: catalogo.empresas.find((item) => item.id === oportunidad.empresaId)?.nombre || '',
    titulo: String(fila[cabecera.titulo] ?? ''),
    descripcion: String(fila[cabecera.descripcion] ?? ''),
    moneda: fila[cabecera.moneda],
    estado,
    fecha: fechaSolo(fila[cabecera.fechaCreacion]),
    validaHasta: fechaSolo(fila[cabecera.fechaVencimiento]),
    creadoPor: fila[cabecera.creadoPor] ?? null,
    actualizadoEn: cabecera.fechaActualizacion ? fila[cabecera.fechaActualizacion] ?? null : null,
    version: null,
    notas: '',
    ...calculo,
  }
  if (!registro.folio || !registro.titulo || !registro.fecha || !['USD', 'MXN', 'EUR'].includes(registro.moneda)) {
    throw new Error('La cotización recuperada no cumple el contrato requerido por la interfaz.')
  }
  return registro
}

export function crearAdaptadorCotizacionesSupabase({ obtenerCliente, cargarOportunidades, env, config }) {
  const evaluacion = evaluarModoCotizaciones(env, config)
  if (!evaluacion.habilitado) throw new Error(evaluacion.motivo)
  validarColumnasCotizaciones(config.columnas)
  if (typeof obtenerCliente !== 'function' || typeof cargarOportunidades !== 'function') {
    throw new Error('Falta el cliente autenticado o el catálogo real de oportunidades.')
  }

  const columnas = config.columnas
  let usuarioInicial = null
  let guardando = false
  let confirmacionPendiente = false

  async function contexto() {
    if (!evaluarModoCotizaciones(env, config).habilitado) {
      throw new Error('La validación de staging se desactivó; las operaciones de cotización quedaron bloqueadas.')
    }
    const cliente = await obtenerCliente()
    let destino
    try {
      destino = new URL(cliente.supabaseUrl).origin
    } catch {
      throw new Error('No se pudo verificar el proyecto Supabase de la sesión.')
    }
    if (destino !== new URL(env.VITE_SUPABASE_URL).origin) {
      throw new Error('El cliente Supabase no apunta al proyecto staging validado.')
    }

    const { data: sesion, error: errorSesion } = await cliente.auth.getUser()
    const usuario = sesion?.user
    if (errorSesion || !usuario?.id) throw new Error('Inicia sesión con una cuenta válida de staging.')
    if (usuarioInicial && usuarioInicial !== usuario.id) {
      throw new Error('La identidad de la sesión cambió. Recarga Cotizaciones antes de continuar.')
    }

    const { data: perfil, error: errorPerfil } = await cliente
      .from('perfiles')
      .select('id,rol,activo')
      .eq('id', usuario.id)
      .single()
    if (errorPerfil || perfil?.id !== usuario.id || perfil.activo !== true || !ROLES.has(perfil.rol)) {
      throw new Error('El perfil no está activo o no tiene un rol comercial autorizado.')
    }
    usuarioInicial = usuario.id
    return { cliente, usuario, perfil }
  }

  async function leerPaginado(cliente, tabla, columnaOrden) {
    const filas = []
    const limite = 200
    for (let desde = 0; desde < 100000; desde += limite) {
      const { data, error } = await cliente
        .from(tabla)
        .select('*')
        .order(columnaOrden, { ascending: true })
        .range(desde, desde + limite - 1)
      if (error) throw errorSeguro(error)
      if (!Array.isArray(data)) throw new Error('Supabase devolvió una respuesta de lectura inválida.')
      filas.push(...data)
      if (data.length < limite) return filas
    }
    throw new Error('La consulta excede el límite local de paginación.')
  }

  async function leerCabecera(cliente, id) {
    const { data, error } = await cliente
      .from(tablasCotizaciones.cotizaciones)
      .select('*')
      .eq(columnas.cotizaciones.id, id)
      .maybeSingle()
    if (error) throw errorSeguro(error)
    if (!data) throw new Error('La cotización no existe o no está autorizada por RLS.')
    return data
  }

  async function leerConceptos(cliente, cotizacionId) {
    const { data, error } = await cliente
      .from(tablasCotizaciones.conceptos)
      .select('*')
      .eq(columnas.conceptos.cotizacionId, cotizacionId)
      .order(columnas.conceptos.orden, { ascending: true })
    if (error) throw errorSeguro(error)
    if (!Array.isArray(data)) throw new Error('Supabase devolvió conceptos en un formato inválido.')
    return data
  }

  async function obtenerCatalogo() {
    return exigirCatalogoReal(await cargarOportunidades())
  }

  async function recuperarConfirmacion(cliente, id, catalogo, esperado) {
    let fila
    let conceptosRows
    try {
      fila = await leerCabecera(cliente, id)
      conceptosRows = await leerConceptos(cliente, id)
      const registro = convertirRegistro(fila, conceptosRows, catalogo, columnas)
      if (registro.id !== id || registro.estado !== 'borrador' ||
          registro.oportunidadId !== esperado.oportunidadId ||
          registro.titulo !== esperado.titulo.trim() ||
          registro.descripcion !== (esperado.descripcion?.trim() || '') ||
          registro.moneda !== esperado.moneda ||
          registro.validaHasta !== (esperado.validaHasta || '') ||
          registro.conceptos.length !== esperado.conceptos.length) {
        throw new Error('La lectura posterior no coincide con los datos enviados.')
      }
      for (let indice = 0; indice < esperado.conceptos.length; indice += 1) {
        const guardado = registro.conceptos[indice]
        const enviado = esperado.conceptos[indice]
        if (guardado.descripcion !== enviado.descripcion.trim() ||
            Number(guardado.cantidad) !== Number(enviado.cantidad) ||
            Number(guardado.precioUnitario) !== Number(enviado.precioUnitario)) {
          throw new Error('Los conceptos leídos no coinciden con los enviados.')
        }
      }
      return registro
    } catch (error) {
      throw errorIncierto(
        'La RPC respondió, pero no se pudo confirmar la cotización guardada. No la reenvíes; recarga la lista y revisa Supabase.',
        error,
      )
    }
  }

  return {
    modo: 'supabase',
    persistencia: 'Supabase staging',
    backendBloqueado: '',
    concurrenciaDisponible: false,

    async cargar() {
      const { cliente } = await contexto()
      const catalogo = await obtenerCatalogo()
      const [cotizaciones, conceptos] = await Promise.all([
        leerPaginado(cliente, tablasCotizaciones.cotizaciones, columnas.cotizaciones.id),
        leerPaginado(cliente, tablasCotizaciones.conceptos, columnas.conceptos.cotizacionId),
      ])
      const conceptosPorCotizacion = new Map()
      for (const concepto of conceptos) {
        const id = concepto[columnas.conceptos.cotizacionId]
        const grupo = conceptosPorCotizacion.get(id) || []
        grupo.push(concepto)
        conceptosPorCotizacion.set(id, grupo)
      }
      return {
        cotizaciones: cotizaciones.map((fila) => convertirRegistro(
          fila,
          conceptosPorCotizacion.get(fila[columnas.cotizaciones.id]) || [],
          catalogo,
          columnas,
        )),
        oportunidades: catalogo.oportunidades.map((oportunidad) => ({
          ...oportunidad,
          clienteNombre: catalogo.clientes.find((cliente) => cliente.id === oportunidad.clienteId)?.nombre || '',
          empresaNombre: catalogo.empresas.find((empresa) => empresa.id === oportunidad.empresaId)?.nombre || '',
        })),
      }
    },

    async guardar(modelo) {
      if (confirmacionPendiente) {
        throw errorIncierto('Ya existe una operación sin confirmar en esta sesión. No reenvíes la cotización; verifica el resultado en Supabase antes de volver a iniciar el módulo.')
      }
      if (guardando) throw new Error('Ya hay una cotización guardándose.')
      guardando = true
      try {
        const { cliente, usuario, perfil } = await contexto()
        const catalogo = await obtenerCatalogo()
        const errores = validarCotizacion({ ...modelo, estado: modelo.id ? modelo.estado : 'borrador' })
        if (Object.keys(errores).length) throw new Error(Object.values(errores).join(' '))
        if (!modelo.titulo?.trim()) throw new Error('Escribe el título de la cotización.')
        if (modelo.id && modelo.estado !== 'borrador') {
          throw new Error('Solo se pueden editar cotizaciones en estado borrador.')
        }
        const oportunidad = catalogo.oportunidades.find((item) => item.id === modelo.oportunidadId)
        if (!oportunidad?.clienteId) throw new Error('Selecciona una oportunidad real disponible bajo RLS.')
        if (modelo.prospectoId && modelo.prospectoId !== oportunidad.clienteId) {
          throw new Error('El prospecto no corresponde a la oportunidad seleccionada.')
        }
        if (perfil.rol !== 'administrador' &&
            oportunidad.responsableId !== usuario.id &&
            oportunidad.creadoPor !== usuario.id &&
            oportunidad.creadoPorId !== usuario.id) {
          throw new Error('El backend permite operar solo sobre oportunidades propias o asignadas.')
        }

        if (modelo.id) {
          const existente = await leerCabecera(cliente, modelo.id)
          if (existente[columnas.cotizaciones.estado] !== 'borrador') {
            throw new Error('Solo se pueden editar cotizaciones en estado borrador.')
          }
          if (existente[columnas.cotizaciones.oportunidadId] !== modelo.oportunidadId) {
            throw new Error('La oportunidad de una cotización existente no se puede cambiar.')
          }
          if (columnas.cotizaciones.fechaActualizacion && modelo.actualizadoEn &&
              existente[columnas.cotizaciones.fechaActualizacion] !== modelo.actualizadoEn) {
            throw new Error('La cotización cambió desde que se abrió. Recarga antes de editarla.')
          }
        }

        const calculo = calcularCotizacion(modelo.conceptos.map((item) => ({
          descripcion: item.descripcion.trim(),
          cantidad: item.cantidad,
          precioUnitario: item.precioUnitario,
        })))
        const conceptosRpc = serializarConceptos(calculo.conceptos)
        const comunes = {
          p_titulo: modelo.titulo.trim(),
          p_descripcion: modelo.descripcion?.trim() || null,
          p_moneda: modelo.moneda,
          p_fecha_vencimiento: fechaVencimientoIso(modelo.validaHasta),
          p_conceptos: conceptosRpc,
        }
        const nombreRpc = modelo.id ? 'actualizar_cotizacion' : 'crear_cotizacion'
        const argumentos = modelo.id
          ? { p_cotizacion_id: modelo.id, ...comunes }
          : { p_oportunidad_id: modelo.oportunidadId, ...comunes }
        let respuesta
        try {
          respuesta = await cliente.rpc(nombreRpc, argumentos)
        } catch (error) {
          throw errorIncierto('No se pudo confirmar la respuesta de Supabase. No reenvíes la operación; recarga y revisa la lista.', error)
        }
        if (!respuesta || typeof respuesta !== 'object') {
          throw errorIncierto('Supabase devolvió una respuesta inválida. No reenvíes la operación; recarga y revisa la lista.')
        }
        const { data, error } = respuesta
        if (error) {
          const estado = Number(error.status)
          if (error.code || (estado >= 400 && estado < 500)) throw errorSeguro(error)
          throw errorIncierto('Supabase no confirmó el resultado de la RPC. No reenvíes la operación; recarga y revisa la lista.', error)
        }
        if (typeof data !== 'string' || !UUID.test(data)) {
          throw errorIncierto('La RPC respondió sin un UUID verificable. No reenvíes la operación; recarga y revisa Supabase.')
        }

        return await recuperarConfirmacion(cliente, data, catalogo, {
          ...modelo,
          titulo: modelo.titulo.trim(),
          descripcion: modelo.descripcion?.trim() || '',
          moneda: modelo.moneda,
          validaHasta: modelo.validaHasta || '',
          oportunidadId: modelo.oportunidadId,
          conceptos: calculo.conceptos,
        })
      } catch (error) {
        if (error?.confirmacionPendiente) confirmacionPendiente = true
        throw error
      } finally {
        guardando = false
      }
    },

    async restablecer() {
      throw new Error('No se permite eliminar ni restablecer cotizaciones persistidas.')
    },
  }
}
