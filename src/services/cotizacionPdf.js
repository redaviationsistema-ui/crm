import {calcularCotizacion,validarCotizacion} from '../domain/cotizaciones.js'

export const EMPRESA_COTIZACIONES = Object.freeze({nombre:'Red Sky Group LLC'})
export function prepararCotizacionPdf(cotizacion) {
  if (!cotizacion || typeof cotizacion!=='object') throw Error('Selecciona una cotización guardada.')
  const errores=validarCotizacion(cotizacion)
  if(Object.keys(errores).length) throw Error(`No se puede generar el PDF: ${Object.values(errores).join(' ')}`)
  for(const campo of ['id','folio','clienteNombre']) {
    if(typeof cotizacion[campo]!=='string'||!cotizacion[campo].trim()) throw Error(`No se puede generar el PDF: falta ${campo}. Guarda y revisa la cotización.`)
  }
  const calculo=calcularCotizacion(cotizacion.conceptos)
  if(calculo.total!==cotizacion.total||calculo.subtotal!==cotizacion.subtotal||calculo.conceptos.some((c,i)=>c.importe!==cotizacion.conceptos[i].importe)) {
    throw Error('Los importes guardados no coinciden con los conceptos. Revisa la cotización antes de generar el PDF.')
  }
  // Copia inmutable para que cambiar selección/editar durante la carga no cambie el PDF.
  return structuredClone(cotizacion)
}
export async function cargarRecursosPdf({fetchImpl=globalThis.fetch,base=import.meta.env?.BASE_URL || '/'}={}) {
  const rutas={logo:'logoo.png',regular:'fonts/NotoSans-Regular.ttf',bold:'fonts/NotoSans-Bold.ttf'}
  try {
    const entries=await Promise.all(Object.entries(rutas).map(async([nombre,ruta])=>{
      const respuesta=await fetchImpl(`${base}${ruta}`,{signal:AbortSignal.timeout(15000)})
      if(!respuesta.ok)throw Error()
      const bytes=new Uint8Array(await respuesta.arrayBuffer())
      if(!bytes.length)throw Error()
      return [nombre,bytes]
    }))
    return Object.fromEntries(entries)
  }catch{throw Error('No se pudieron cargar el logotipo y las fuentes del PDF. Revisa la conexión e inténtalo de nuevo.')}
}
function base64(bytes) {
  let binario=''
  for(let i=0;i<bytes.length;i+=32768)binario+=String.fromCharCode(...bytes.subarray(i,i+32768))
  return globalThis.btoa(binario)
}
export async function generarCotizacionPdf(cotizacion,{recursos,cargarRecursos=cargarRecursosPdf,modoDemostracion=false}={}) {
  const modelo=prepararCotizacionPdf(cotizacion)
  const [{jsPDF},{autoTable},assets]=await Promise.all([import('jspdf'),import('jspdf-autotable'),recursos || cargarRecursos()])
  const doc=new jsPDF({unit:'mm',format:'a4',compress:true,putOnlyUsedFonts:true})
  try {
    doc.addFileToVFS('NotoSans-Regular.ttf',base64(assets.regular))
    doc.addFileToVFS('NotoSans-Bold.ttf',base64(assets.bold))
    doc.addFont('NotoSans-Regular.ttf','NotoSans','normal')
    doc.addFont('NotoSans-Bold.ttf','NotoSans','bold')
    doc.setFont('NotoSans')
    // Comprobar la imagen antes de generar el documento; nunca omitirla silenciosamente.
    const imagen=doc.getImageProperties(assets.logo)
    doc.setProperties({title:`${modelo.folio} · ${modelo.titulo}`,author:EMPRESA_COTIZACIONES.nombre,subject:modoDemostracion?'Cotización de demostración':'Cotización comercial',creator:'CRM-AVIACION'})
    const margen={left:15,right:15,top:46,bottom:22}
    const comunes={margin:margen,styles:{font:'NotoSans',fontSize:9,cellPadding:3,overflow:'linebreak',textColor:[25,41,62],lineColor:[218,225,233]},rowPageBreak:'avoid'}
    autoTable(doc,{...comunes,startY:46,theme:'plain',columnStyles:{0:{cellWidth:36,fontStyle:'bold'},1:{cellWidth:144}},body:[
      ['Propuesta',modelo.titulo],['Folio',modelo.folio],['Cliente',modelo.clienteNombre],
      ...(modelo.empresaNombre?[['Empresa',modelo.empresaNombre]]:[]),
      ...(modelo.oportunidadTitulo?[['Oportunidad',modelo.oportunidadTitulo]]:[]),
      ...(modelo.descripcion?[['Descripción',modelo.descripcion]]:[]),
      ['Fecha',modelo.fecha],['Vigencia',modelo.validaHasta || 'No indicada'],['Estado',modelo.estado],['Moneda',modelo.moneda],
    ]})
    autoTable(doc,{...comunes,startY:doc.lastAutoTable.finalY+5,theme:'grid',showHead:'everyPage',
      head:[['Concepto','Cantidad',`Precio unitario (${modelo.moneda})`,`Importe (${modelo.moneda})`]],
      headStyles:{fillColor:[24,54,89],textColor:255,fontStyle:'bold'},bodyStyles:{fillColor:255},
      columnStyles:{0:{cellWidth:78},1:{cellWidth:24,halign:'right'},2:{cellWidth:39,halign:'right'},3:{cellWidth:39,halign:'right'}},
      body:modelo.conceptos.map(c=>[c.descripcion,c.cantidad,c.precioUnitario,c.importe]),
    })
    // Bloque independiente: si no cabe, AutoTable lo continúa en otra página.
    autoTable(doc,{...comunes,startY:doc.lastAutoTable.finalY+5,theme:'plain',pageBreak:'avoid',
      columnStyles:{0:{cellWidth:132,halign:'right'},1:{cellWidth:48,halign:'right',fontStyle:'bold'}},
      body:[['Subtotal',`${modelo.subtotal} ${modelo.moneda}`],['Total',`${modelo.total} ${modelo.moneda}`]],
    })
    if(modelo.notas) autoTable(doc,{...comunes,startY:doc.lastAutoTable.finalY+5,theme:'plain',head:[['Notas registradas']],headStyles:{fillColor:255,textColor:[24,54,89],fontStyle:'bold'},body:[[modelo.notas]]})
    const paginas=doc.getNumberOfPages()
    for(let pagina=1;pagina<=paginas;pagina++) {
      doc.setPage(pagina)
      doc.addImage(assets.logo,'PNG',15,5,44,44*imagen.height/imagen.width,'logo-corporativo')
      doc.setFont('NotoSans','bold').setFontSize(16).setTextColor(24,54,89)
      doc.text(EMPRESA_COTIZACIONES.nombre,68,18)
      doc.setFontSize(11).text('COTIZACIÓN COMERCIAL',68,26)
      doc.setFont('NotoSans','normal').setFontSize(8).setTextColor(105,78,20)
      if(modoDemostracion)doc.text('DEMOSTRACIÓN: COPIA LOCAL',68,34)
      doc.setDrawColor(190,202,217).line(15,40,195,40)
      doc.setTextColor(80,94,111).setFontSize(8)
      doc.line(15,278,195,278)
      doc.text(doc.splitTextToSize(modelo.folio,125).slice(0,2),15,283)
      doc.text(`Página ${pagina} de ${paginas}`,195,283,{align:'right'})
    }
    const nombreArchivo=`${modelo.folio.normalize('NFKD').replace(/[^a-zA-Z0-9_-]/g,'_').slice(0,90)}.pdf`
    return {blob:doc.output('blob'),nombreArchivo,paginas}
  }catch{throw Error('No se pudo generar el PDF. Verifica el logotipo, las fuentes y los datos de la cotización.')}
}
export function descargarBlobPdf({blob,nombreArchivo},{documento=globalThis.document,url=globalThis.URL}={}) {
  if(!documento?.createElement||!url?.createObjectURL)throw Error('La descarga PDF requiere un navegador compatible.')
  const enlace=documento.createElement('a'),destino=url.createObjectURL(blob)
  try {
    enlace.href=destino;enlace.download=nombreArchivo;enlace.style.display='none';documento.body.appendChild(enlace);enlace.click()
  }finally{
    enlace.remove()
    setTimeout(()=>url.revokeObjectURL(destino),1000)
  }
}
export function crearDescargadorPdf({generar=generarCotizacionPdf,descargar=descargarBlobPdf,modoDemostracion=false}={}) {
  let ocupado=false
  return {
    async ejecutar(cotizacion) {
      if(ocupado)return {estado:'ocupado'}
      ocupado=true
      try {const archivo=await generar(prepararCotizacionPdf(cotizacion),{modoDemostracion});await descargar(archivo);return {estado:'descargado',nombreArchivo:archivo.nombreArchivo}}
      finally{ocupado=false}
    },
  }
}
