export const MONEDAS_COTIZACION = Object.freeze(['USD','MXN','EUR'])
export const ESTADOS_COTIZACION = Object.freeze(['borrador','preparada','enviada','aceptada','rechazada','vencida','cancelada'])
export const TRANSICIONES_COTIZACION = Object.freeze({
  borrador:['borrador','preparada','cancelada'], preparada:['preparada','borrador','aceptada','rechazada','cancelada'],
  enviada:['enviada','aceptada','rechazada','vencida','cancelada'], aceptada:['aceptada'],
  rechazada:['rechazada'], vencida:['vencida'], cancelada:['cancelada'],
})
function decimalEntero(valor, decimales, digitos, campo) {
  if (typeof valor !== 'string' || !new RegExp(`^\\d{1,${digitos}}(?:\\.\\d{1,${decimales}})?$`).test(valor)) {
    throw new Error(`${campo}: usa un decimal no negativo con hasta ${decimales} decimales.`)
  }
  const [entera,fraccion=''] = valor.split('.')
  return BigInt(entera + fraccion.padEnd(decimales,'0'))
}
function importeTexto(centavos) {
  const texto=centavos.toString().padStart(3,'0')
  return `${texto.slice(0,-2)}.${texto.slice(-2)}`
}
export function calcularCotizacion(conceptos) {
  if (!Array.isArray(conceptos) || conceptos.length<1 || conceptos.length>100) throw new Error('Agrega entre 1 y 100 conceptos.')
  let suma=0n
  const partidas=conceptos.map((concepto,indice)=>{
    const cantidad=decimalEntero(concepto.cantidad,3,9,`Cantidad del concepto ${indice+1}`)
    if(cantidad===0n) throw new Error(`La cantidad del concepto ${indice+1} debe ser mayor que cero.`)
    const precio=decimalEntero(concepto.precioUnitario,2,16,`Precio del concepto ${indice+1}`)
    // Redondeo comercial half-up por partida; sumar lo que muestra el documento.
    const importe=(cantidad*precio+500n)/1000n
    suma+=importe
    return {...concepto,importe:importeTexto(importe)}
  })
  return {conceptos:partidas,subtotal:importeTexto(suma),total:importeTexto(suma)}
}
export function fechaCotizacionValida(fecha) {
  if(typeof fecha!=='string' || !/^\d{4}-\d{2}-\d{2}$/.test(fecha))return false
  const valor=new Date(`${fecha}T12:00:00Z`)
  return Number.isFinite(valor.getTime()) && valor.toISOString().slice(0,10)===fecha
}
export function validarCotizacion(modelo) {
  const errores={}
  if(!modelo.titulo?.trim()) errores.titulo='Escribe el título de la cotización.'
  if(!modelo.oportunidadId) errores.oportunidadId='Selecciona una oportunidad válida.'
  if(!MONEDAS_COTIZACION.includes(modelo.moneda)) errores.moneda='Selecciona USD, MXN o EUR.'
  if(!ESTADOS_COTIZACION.includes(modelo.estado)) errores.estado='Estado no válido.'
  if(!fechaCotizacionValida(modelo.fecha)) errores.fecha='Selecciona una fecha válida.'
  if(modelo.validaHasta && (!fechaCotizacionValida(modelo.validaHasta) || modelo.validaHasta<modelo.fecha)) errores.validaHasta='La vigencia no puede terminar antes de la fecha de cotización.'
  try {calcularCotizacion(modelo.conceptos)} catch(e){errores.conceptos=e.message}
  if(modelo.conceptos?.some(c=>!c.descripcion?.trim())) errores.descripcion='Todos los conceptos requieren descripción.'
  return errores
}
