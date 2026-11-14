import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import {prepararCotizacionPdf,generarCotizacionPdf,crearDescargadorPdf,cargarRecursosPdf,descargarBlobPdf} from '../src/services/cotizacionPdf.js'
import {calcularCotizacion} from '../src/domain/cotizaciones.js'
const recursos=Object.fromEntries([['logo','public/logoo.png'],['regular','public/fonts/NotoSans-Regular.ttf'],['bold','public/fonts/NotoSans-Bold.ttf']].map(([k,p])=>[k,new Uint8Array(fs.readFileSync(p))]))
function cotizacion(n=1){
  const conceptos=Array.from({length:n},(_,i)=>({descripcion:`Concepto ${i+1}: inspección técnica de aeronave`,cantidad:'3',precioUnitario:'0.10'}))
  return {id:'pdf-1',folio:'DEMO-COT-0001',titulo:'Propuesta aeronáutica',oportunidadId:'demo-oportunidad-1',clienteNombre:'Cliente de demostración Álvarez',empresaNombre:'Empresa de demostración',oportunidadTitulo:'Aeronave de demostración',fecha:'2026-11-12',validaHasta:null,estado:'borrador',moneda:'EUR',notas:'Información proporcionada por el cliente.',...calcularCotizacion(conceptos)}
}
test('genera PDF real con logo, fuente y una partida sin alterar datos',async()=>{
  const modelo=cotizacion(),antes=structuredClone(modelo)
  const archivo=await generarCotizacionPdf(modelo,{recursos})
  assert.equal(archivo.nombreArchivo,'DEMO-COT-0001.pdf');assert.equal(archivo.paginas,1)
  const bytes=new Uint8Array(await archivo.blob.arrayBuffer())
  assert.equal(new TextDecoder().decode(bytes.slice(0,5)),'%PDF-')
  assert.ok(bytes.length>10000);assert.deepEqual(modelo,antes)
})
test('cien partidas, descripcion larga y notas producen multiples paginas',async()=>{
  const modelo=cotizacion(100);modelo.conceptos[0].descripcion='Descripción técnica detallada. '.repeat(120)
  modelo.notas='Notas registradas: información de demostración. '.repeat(100)
  const archivo=await generarCotizacionPdf(modelo,{recursos})
  assert.ok(archivo.paginas>=4);assert.ok(archivo.blob.size>10000)
})
test('rechaza campos obligatorios incompletos y totales distintos del registro',()=>{
  for(const campo of ['id','folio','clienteNombre','titulo','fecha','moneda','oportunidadId'])assert.throws(()=>prepararCotizacionPdf({...cotizacion(),[campo]:''}))
  assert.throws(()=>prepararCotizacionPdf({...cotizacion(),total:'999.00'}),/no coinciden/)
  const modelo=cotizacion();modelo.conceptos[0].importe='10.00';assert.throws(()=>prepararCotizacionPdf(modelo),/no coinciden/)
})
test('vigencia nullable se conserva y la copia no comparte conceptos',()=>{
  const modelo=cotizacion(),copia=prepararCotizacionPdf(modelo)
  assert.equal(copia.validaHasta,null);copia.conceptos[0].descripcion='Otra';assert.notEqual(modelo.conceptos[0].descripcion,'Otra')
})
test('respeta ruta base para recursos y muestra error si no hay logotipo',async()=>{
  const rutas=[]
  const cargados=await cargarRecursosPdf({base:'/crm/',fetchImpl:async ruta=>{rutas.push(ruta);return {ok:true,arrayBuffer:async()=>new Uint8Array([1,2]).buffer}}})
  assert.equal(rutas[0],'/crm/logoo.png');assert.equal(cargados.regular.length,2)
  await assert.rejects(cargarRecursosPdf({fetchImpl:async()=>({ok:false})}),/logotipo/)
})
test('bloquea descargas duplicadas y conserva la cotizacion seleccionada',async()=>{
  let liberar,generaciones=0,descargas=0
  const controlador=crearDescargadorPdf({generar:async modelo=>{generaciones++;await new Promise(r=>liberar=r);assert.equal(modelo.folio,'DEMO-COT-0001');return {nombreArchivo:'prueba.pdf'}},descargar:async()=>descargas++})
  const modelo=cotizacion(),primero=controlador.ejecutar(modelo)
  modelo.folio='CAMBIADA'
  assert.equal((await controlador.ejecutar(cotizacion())).estado,'ocupado')
  liberar();assert.equal((await primero).estado,'descargado');assert.equal(generaciones,1);assert.equal(descargas,1)
})
test('fallo de generacion no descarga y permite un siguiente intento',async()=>{
  let veces=0,descargas=0
  const controlador=crearDescargadorPdf({generar:async()=>{if(!veces++)throw Error('Fuente no disponible');return {nombreArchivo:'ok.pdf'}},descargar:()=>descargas++})
  await assert.rejects(controlador.ejecutar(cotizacion()),/Fuente/)
  assert.equal(descargas,0);await controlador.ejecutar(cotizacion());assert.equal(descargas,1)
})
test('el modo real omite la marca de demostración y el modo de prueba puede conservarla',async()=>{
  const opciones=[]
  const controlador=crearDescargadorPdf({generar:async(_modelo,configuracion)=>{opciones.push(configuracion);return {nombreArchivo:'prueba.pdf'}},descargar:async()=>{}})
  await controlador.ejecutar(cotizacion())
  assert.deepEqual(opciones,[{modoDemostracion:false}])
  const demostracion=crearDescargadorPdf({modoDemostracion:true,generar:async(_modelo,configuracion)=>{opciones.push(configuracion);return {nombreArchivo:'demo.pdf'}},descargar:async()=>{}})
  await demostracion.ejecutar(cotizacion())
  assert.deepEqual(opciones[1],{modoDemostracion:true})
})
test('descarga usa el nombre del PDF, clic en enlace y elimina el elemento temporal',()=>{
  let clic=false,eliminado=false
  const enlace={style:{},click(){clic=true},remove(){eliminado=true}}
  descargarBlobPdf({blob:new Blob(['pdf']),nombreArchivo:'DEMO-COT-0001.pdf'},{documento:{createElement:()=>enlace,body:{appendChild(){}}},url:{createObjectURL:()=> 'blob:demo',revokeObjectURL(){}}})
  assert.equal(enlace.download,'DEMO-COT-0001.pdf');assert.equal(clic,true);assert.equal(eliminado,true)
})
