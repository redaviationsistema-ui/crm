import {crearOportunidadesService,crearServicioOportunidadesNavegador} from './oportunidadesService.js'
import {calcularCotizacion,validarCotizacion,TRANSICIONES_COTIZACION} from '../domain/cotizaciones.js'
import {configuracionCotizaciones, evaluarModoCotizaciones} from '../config/cotizacionesBackend.js'
import {configuracionOportunidades} from '../config/oportunidadesBackend.js'
import {crearAdaptadorCotizacionesSupabase} from './cotizacionesSupabaseAdapter.js'
const CLAVE='crm-aviacion:cotizaciones-demostracion:v1'
const copia=valor=>structuredClone(valor)
const inicial=()=>({version:1,secuencia:0,cotizaciones:[]})
const BLOQUEO_PERSISTENCIA='La persistencia de cotizaciones sigue bloqueada hasta verificar el contrato PostgreSQL, las relaciones y los permisos RLS en staging.'
export function crearCotizacionesDemostracionService({storage=null,ahora=()=>new Date().toISOString(),id=()=>crypto.randomUUID(),oportunidadesService=crearOportunidadesService({storage})}={}) {
  let memoria=inicial(),guardando=false
  function leer(){
    if(!storage)return copia(memoria)
    let raw
    try{raw=storage.getItem(CLAVE)}catch{throw Error('No se puede leer la demostración local de cotizaciones.')}
    if(!raw)return inicial()
    try{
      const datos=JSON.parse(raw)
      if(datos.version!==1 || !Array.isArray(datos.cotizaciones) || !Number.isSafeInteger(datos.secuencia) || datos.secuencia<0)throw Error()
      return datos
    }catch{throw Error('Los datos locales de cotizaciones están dañados. Usa Restablecer cotizaciones para recuperarlos.')}
  }
  function persistir(datos){
    try{storage?.setItem(CLAVE,JSON.stringify(datos))}catch{throw Error('No se guardó la cotización: almacenamiento lleno o bloqueado. Conserva el formulario.')}
    memoria=copia(datos)
  }
  return {
    modo:'demostracion',persistencia:storage?'sesión del navegador':'memoria temporal',
    async cargar(){
      const catalogo=await oportunidadesService.cargar()
      return {...leer(),oportunidades:catalogo.oportunidades.map(o=>({...o,clienteNombre:catalogo.clientes.find(c=>c.id===o.clienteId)?.nombre || 'Cliente de demostración no disponible',empresaNombre:catalogo.empresas.find(e=>e.id===catalogo.clientes.find(c=>c.id===o.clienteId)?.empresaId)?.nombre || ''}))}
    },
    async guardar(modelo){
      if(guardando)throw Error('Ya hay una cotización guardándose.')
      guardando=true
      try{
        const errores=validarCotizacion(modelo)
        if(Object.keys(errores).length)throw Error(Object.values(errores).join(' '))
        const catalogo=await oportunidadesService.cargar()
        const datos=leer(),anterior=modelo.id?datos.cotizaciones.find(c=>c.id===modelo.id):null
        if(modelo.id&&!anterior)throw Error('La cotización ya no existe. Recarga la lista.')
        if(anterior && anterior.version!==modelo.version)throw Error('La cotización cambió. Cierra y vuelve a abrirla antes de guardar.')
        if(anterior && !['borrador','preparada'].includes(anterior.estado))throw Error('Esta cotización está cerrada y conserva sus valores. Crea otra para una nueva propuesta.')
        if(anterior && !TRANSICIONES_COTIZACION[anterior.estado].includes(modelo.estado))throw Error('Cambio de estado no permitido.')
        if(!anterior && !['borrador','preparada'].includes(modelo.estado))throw Error('Una cotización nueva debe ser borrador o preparada.')
        const oportunidad=catalogo.oportunidades.find(o=>o.id===modelo.oportunidadId)
        if(!oportunidad)throw Error('La oportunidad de demostración ya no está disponible. Selecciona otra.')
        const cliente=catalogo.clientes.find(c=>c.id===oportunidad.clienteId)
        if(!cliente)throw Error('El cliente de demostración asociado no está disponible.')
        const calculo=calcularCotizacion(modelo.conceptos.map(c=>({descripcion:c.descripcion.trim(),cantidad:c.cantidad,precioUnitario:c.precioUnitario})))
        const fecha=ahora()
        if(!anterior)datos.secuencia++
        const registro={id:anterior?.id || id(),folio:anterior?.folio || `DEMO-COT-${String(datos.secuencia).padStart(4,'0')}`,
          titulo:modelo.titulo.trim(),descripcion:modelo.descripcion?.trim() || '',oportunidadId:oportunidad.id,oportunidadTitulo:oportunidad.titulo || 'Oportunidad de demostración',
          clienteNombre:cliente.nombre,empresaNombre:catalogo.empresas.find(e=>e.id===cliente.empresaId)?.nombre || '',
          moneda:modelo.moneda,estado:modelo.estado,fecha:modelo.fecha,validaHasta:modelo.validaHasta || null,notas:modelo.notas?.trim() || '',
          ...calculo,version:(anterior?.version || 0)+1,creadoEn:anterior?.creadoEn || fecha,actualizadoEn:fecha,
          historial:[...(anterior?.historial || []),{fecha,tipo:anterior?'actualizada':'creada',estado:modelo.estado,version:(anterior?.version || 0)+1}]}
        datos.cotizaciones=anterior?datos.cotizaciones.map(c=>c.id===registro.id?registro:c):[registro,...datos.cotizaciones]
        persistir(datos)
        return copia(registro)
      }finally{guardando=false}
    },
    async restablecer(){if(guardando)throw Error('Espera a que termine el guardado.');persistir(inicial());return inicial()},
  }
}
function servicioCotizacionesBloqueado(motivo = BLOQUEO_PERSISTENCIA) {
  const bloqueado=()=>{throw new Error(motivo)}
  return {
    modo:'bloqueado',
    persistencia:'pendiente de validar contrato PostgreSQL',
    backendBloqueado:motivo,
    cargar:async()=>bloqueado(),
    guardar:async()=>bloqueado(),
    restablecer:async()=>bloqueado(),
  }
}

export function crearCotizacionesNavegador({
  obtenerCliente,
  env = import.meta.env || {},
  config = configuracionCotizaciones,
  configOportunidades = configuracionOportunidades,
} = {}) {
  const evaluacion = evaluarModoCotizaciones(env, config)
  if (!evaluacion.habilitado) return servicioCotizacionesBloqueado(evaluacion.motivo)
  if (typeof obtenerCliente !== 'function') {
    return servicioCotizacionesBloqueado('No se proporcionó el cliente Supabase autenticado.')
  }

  const oportunidades = crearServicioOportunidadesNavegador({
    env,
    config: configOportunidades,
    obtenerCliente,
  })
  if (oportunidades.modo !== 'supabase') {
    return servicioCotizacionesBloqueado(
      'El acceso a oportunidades reales no está habilitado; Cotizaciones no usará el catálogo de demostración.',
    )
  }

  try {
    return crearAdaptadorCotizacionesSupabase({
      obtenerCliente,
      env,
      config,
      cargarOportunidades: async () => ({
        ...await oportunidades.cargar(),
        modo: oportunidades.modo,
      }),
    })
  } catch (error) {
    return servicioCotizacionesBloqueado(error.message)
  }
}
