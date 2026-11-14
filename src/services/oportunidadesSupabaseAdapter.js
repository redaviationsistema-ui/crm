import { validarOportunidad } from '../domain/oportunidades.js'
import { columnasOportunidades, evaluarModoOportunidades } from '../config/oportunidadesBackend.js'
function errorSesion(mensaje) { const error = new Error(mensaje); error.sesionInvalida = true; return error }
export function validarColumnasOportunidades(columnas) {
  for (const [tabla,mapa] of Object.entries(columnasOportunidades)) {
    if (Object.keys(columnas?.[tabla] || {}).length !== Object.keys(mapa).length ||
        Object.entries(mapa).some(([campo,columna]) => columnas?.[tabla]?.[campo] !== columna)) {
      throw new Error(`El mapeo de ${tabla} no coincide con las columnas confirmadas.`)
    }
  }
}
export function normalizarImporte(valor) {
  if (typeof valor === 'number' && (!Number.isFinite(valor) || Math.abs(valor) > Number.MAX_SAFE_INTEGER)) throw new Error('Importe numérico inseguro; se requiere texto decimal.')
  const texto = String(valor ?? '').trim()
  if (!/^\d+(\.\d+)?$/.test(texto)) throw new Error('El importe debe ser un decimal no negativo.')
  return texto
}
export function fechaSupabase(valor, { nullable = true } = {}) {
  if (valor == null || valor === '') {
    if (nullable) return null
    throw new Error('Falta una fecha obligatoria del registro.')
  }
  if (typeof valor !== 'string' || !/T.*(?:Z|[+-]\d{2}:\d{2})$/.test(valor) || !Number.isFinite(Date.parse(valor))) throw new Error('Fecha Supabase inválida o sin zona horaria.')
  // Conservar offset y microsegundos para p_fecha_esperada; no usar toISOString().
  return valor
}
function normalizarEvento(fila, mapa) {
  const evento = proyectar(fila,mapa)
  const antes = evento.anteriores, despues = evento.nuevos
  const objeto = valor => valor && typeof valor === 'object' && !Array.isArray(valor)
  const cambios = {}
  if (objeto(antes) || objeto(despues)) {
    for (const campo of new Set([...Object.keys(antes || {}),...Object.keys(despues || {})])) {
      if (JSON.stringify(antes?.[campo] ?? null) !== JSON.stringify(despues?.[campo] ?? null)) {
        cambios[campo] = { antes: antes?.[campo] ?? null, despues: despues?.[campo] ?? null }
      }
    }
  } else if (JSON.stringify(antes) !== JSON.stringify(despues)) cambios.datos = { antes:antes ?? null, despues:despues ?? null }
  return { ...evento, fecha:fechaSupabase(evento.fecha,{nullable:false}), usuarioId:evento.actor ?? null, actor:evento.actor || 'Sin usuario registrado', cambios }
}
export function errorOportunidades(error) {
  const mensajes = {
    '42501': 'Supabase rechazó la operación: no tienes permisos para este recurso.',
    PGRST202: 'La firma RPC no coincide con la publicada en Supabase. No se confirmó el guardado.',
    '23503': 'El cliente, responsable o etapa ya no está disponible.',
    '23505': 'El registro entra en conflicto con otro existente.',
    '23514': 'Los datos no cumplen las restricciones comerciales.',
    '40001': 'La oportunidad cambió. Recarga antes de volver a editar.',
  }
  const resultado = new Error(mensajes[error?.code] || 'Supabase no confirmó la operación. Revisa tu sesión y recarga antes de repetir el guardado.')
  resultado.code = error?.code
  return resultado
}
const proyectar = (fila, mapa) => Object.fromEntries(Object.entries(mapa).map(([campo,columna]) => [campo, fila[columna]]))
const seleccion = mapa => [...new Set(Object.entries(mapa).map(([campo,columna]) => campo === 'valorEstimado' ? `${columna}::text` : columna))].join(',')

export function crearAdaptadorOportunidadesSupabase({ obtenerCliente, env, config }) {
  const estadoModo = evaluarModoOportunidades(env, config)
  if (!estadoModo.habilitado) throw new Error(estadoModo.motivo)
  validarColumnasOportunidades(config.columnas)
  const columnas = config.columnas
  let usuarioInicial = null, guardando = false
  async function contexto() {
    // Verificar el destino de nuevo antes de cada acceso, incluso si cambia la configuración.
    if (!evaluarModoOportunidades(env, config).habilitado) throw new Error('El acceso a staging fue desactivado.')
    const cliente = await obtenerCliente()
    let destino
    try { destino = new URL(cliente.supabaseUrl).origin } catch { throw new Error('No se pudo verificar el destino del cliente Supabase.') }
    if (destino !== new URL(env.VITE_SUPABASE_URL).origin) throw new Error('El cliente Supabase no apunta al staging revisado.')
    const { data, error } = await cliente.auth.getUser()
    if (error || !data?.user) throw errorSesion('Inicia sesión con una cuenta de staging válida.')
    if (usuarioInicial && usuarioInicial !== data.user.id) throw errorSesion('La identidad cambió. Recarga el módulo antes de continuar.')
    const perfil = await cliente.from('perfiles').select('id,activo').eq('id',data.user.id).single()
    if (perfil.error || perfil.data?.activo !== true) throw errorSesion('El usuario no tiene un perfil CRM activo.')
    usuarioInicial = data.user.id
    return cliente
  }
  async function leer(cliente, tabla, mapa, filtro = null) {
    const filas = [], porPagina = 200
    for (let desde = 0; desde < 100000; desde += porPagina) {
      let query = cliente.from(tabla).select(seleccion(mapa), { count: 'exact' })
      if (filtro) query = query.eq(filtro[0], filtro[1])
      if (tabla === 'etapas') query = query.order(mapa.orden,{ascending:true})
      const { data, error, count } = await query.order(mapa.id, { ascending:true }).range(desde,desde+porPagina-1)
      if (error) throw errorOportunidades(error)
      if (!Array.isArray(data)) throw new Error('Respuesta de consulta no válida.')
      filas.push(...data)
      if ((count != null && filas.length >= count) || (count == null && data.length < porPagina)) return filas
      if (!data.length) throw new Error('No se pudo completar la lectura. Recarga los datos.')
    }
    throw new Error('La consulta supera el límite local. Se requiere paginación adicional.')
  }
  function adaptar(fila, {clientes = [],embudos = []} = {}) {
    const o = proyectar(fila,columnas.oportunidades)
    if (!o.id || !o.clienteId || !o.embudoId || !o.etapaId || !o.estado) throw new Error('La oportunidad no coincide con las columnas confirmadas.')
    return { ...o, descripcion:o.descripcion ?? null, valorEstimado:normalizarImporte(o.valorEstimado),
      actualizadoEn:fechaSupabase(o.actualizadoEn,{nullable:false}), creadoEn:fechaSupabase(o.creadoEn,{nullable:false}),
      cerradoEn:fechaSupabase(o.cerradoEn), proximoSeguimiento:fechaSupabase(o.proximoSeguimiento),
      embudoNombre:embudos.find(e=>e.id===o.embudoId)?.nombre || '',
      empresaId:clientes.find(c=>c.id===o.clienteId)?.empresaId || '', historial:[] }
  }
  async function registroConfirmado(cliente,id) {
    const filas = await leer(cliente,'oportunidades',columnas.oportunidades,[columnas.oportunidades.id,id])
    if (filas.length !== 1) throw new Error('No se pudo recuperar la oportunidad confirmada bajo tu acceso actual.')
    return adaptar(filas[0])
  }
  return {
    modo:'supabase', persistencia:'Supabase staging', permiteGestionEtapas:false,
    async cargar() {
      const cliente = await contexto()
      const [filas, embudosRaw, etapasRaw, contactos, perfiles] = await Promise.all([
        leer(cliente,'oportunidades',columnas.oportunidades), leer(cliente,'embudos',columnas.embudos,['activo',true]),
        leer(cliente,'etapas',columnas.etapas),
        leer(cliente,'prospectos',{ id:'id',nombre:'nombre',apellidos:'apellidos',empresa:'empresa' }),
        leer(cliente,'perfiles',{ id:'id',nombre:'nombre',apellidos:'apellidos',activo:'activo' }),
      ])
      const embudos=embudosRaw.map(f=>proyectar(f,columnas.embudos)), etapas=etapasRaw.map(f=>proyectar(f,columnas.etapas)).sort((a,b)=>a.orden-b.orden || a.id.localeCompare(b.id))
      const clientes=contactos.map(f=>({id:f.id,nombre:[f.nombre,f.apellidos].filter(Boolean).join(' '),empresaId:f.empresa || ''}))
      const empresas=[...new Set(contactos.map(f=>f.empresa).filter(Boolean))].map(nombre=>({id:nombre,nombre}))
      const oportunidades=filas.map(f=>adaptar(f,{clientes,embudos}))
      return {clientes,empresas,embudos,etapas,oportunidades,responsables:perfiles.filter(p=>p.activo).map(p=>({id:p.id,nombre:[p.nombre,p.apellidos].filter(Boolean).join(' ')}))}
    },
    async obtenerHistorial(id) {
      const cliente=await contexto()
      const filas=await leer(cliente,'eventos_oportunidad',columnas.eventos,[columnas.eventos.oportunidadId,id])
      return filas.map(f=>normalizarEvento(f,columnas.eventos)).sort((a,b)=>new Date(a.fecha)-new Date(b.fecha))
    },
    async guardar(modelo) {
      if (guardando) throw new Error('Ya hay un guardado en curso.')
      guardando=true
      try {
        const cliente=await contexto()
        const etapas=(await leer(cliente,'etapas',columnas.etapas)).map(f=>proyectar(f,columnas.etapas))
        const errores=validarOportunidad(modelo,etapas,{modoSupabase:true})
        if (Object.keys(errores).length) throw new Error(Object.values(errores).join('. '))
        if (!modelo.titulo?.trim()) throw new Error('El título es obligatorio.')
        if (modelo.id) fechaSupabase(modelo.actualizadoEn,{nullable:false})
        if (modelo.id) {
          const originales = await leer(cliente,'oportunidades',columnas.oportunidades,[columnas.oportunidades.id,modelo.id])
          if (originales.length !== 1) throw new Error('La oportunidad no existe o no está autorizada.')
          const original = proyectar(originales[0],columnas.oportunidades)
          if (original.clienteId !== modelo.clienteId || original.embudoId !== modelo.embudoId) throw new Error('No se puede cambiar el cliente ni el embudo de una oportunidad existente mediante esta RPC.')
        }
        const comunes={p_titulo:modelo.titulo.trim(),p_descripcion:modelo.descripcion?.trim() || null,
          p_valor:normalizarImporte(modelo.valorEstimado),p_moneda:modelo.moneda,p_prioridad:modelo.prioridad,
          p_etapa:modelo.etapaId,p_responsable:modelo.responsableId,p_seguimiento:fechaSupabase(modelo.proximoSeguimiento)}
        const nombre=modelo.id?'actualizar_oportunidad':'crear_oportunidad'
        const args=modelo.id?{p_id:modelo.id,...comunes,p_fecha_esperada:modelo.actualizadoEn}
          :{p_prospecto:modelo.clienteId,p_embudo:modelo.embudoId,...comunes}
        // No se envían actor, rol, estado, creador ni campos administrativos del formulario.
        const {data,error}=await cliente.rpc(nombre,args)
        if(error) throw errorOportunidades(error)
        if(typeof data!=='string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(data)) {
          const pendiente=new Error('La RPC respondió sin un UUID verificable. Recarga antes de repetir la operación.')
          pendiente.confirmacionPendiente=true; throw pendiente
        }
        try {
          const registro = await registroConfirmado(cliente,data)
          const eventos = await leer(cliente,'eventos_oportunidad',columnas.eventos,[columnas.eventos.oportunidadId,data])
          registro.historial = eventos.map(f=>normalizarEvento(f,columnas.eventos)).sort((a,b)=>new Date(a.fecha)-new Date(b.fecha))
          return registro
        } catch (error) {
          const pendiente = new Error('Supabase aceptó el guardado, pero no se pudo recargar el registro y su historial. Recarga antes de volver a editar; no repitas la creación.')
          pendiente.confirmacionPendiente=true; pendiente.registroId=data
          throw pendiente
        }
      } finally {guardando=false}
    },
    async guardarEtapa(){throw new Error('La configuración de etapas se administra en Supabase; este módulo solo la consulta.')},
    async restablecer(){throw new Error('No se pueden restablecer datos de Supabase desde la demostración.')},
  }
}
