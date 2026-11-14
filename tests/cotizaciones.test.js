import test from 'node:test'
import assert from 'node:assert/strict'
import {calcularCotizacion,validarCotizacion} from '../src/domain/cotizaciones.js'
import {crearCotizacionesDemostracionService} from '../src/services/cotizacionesService.js'
const base={titulo:'Propuesta de demostración',oportunidadId:'demo-oportunidad-1',moneda:'USD',estado:'borrador',fecha:'2026-11-12',validaHasta:'2026-12-12',notas:'',conceptos:[{descripcion:'Inspección',cantidad:'3',precioUnitario:'0.10'}]}
function memoria(){const m=new Map();return {getItem:k=>m.get(k)??null,setItem:(k,v)=>m.set(k,v)}}
function opciones(extra={}){let i=0;return {id:()=>`cot-${++i}`,ahora:()=> '2026-11-12T12:00:00Z',...extra}}
test('calculos exactos y redondeo por partida coinciden con el total mostrado',()=>{
  assert.equal(calcularCotizacion(base.conceptos).total,'0.30')
  const redondeo=calcularCotizacion([{descripcion:'A',cantidad:'0.333',precioUnitario:'0.05'},{descripcion:'B',cantidad:'0.333',precioUnitario:'0.05'}])
  assert.deepEqual(redondeo.conceptos.map(c=>c.importe),['0.02','0.02']);assert.equal(redondeo.total,'0.04')
  assert.equal(calcularCotizacion([{cantidad:'1',precioUnitario:'9007199254740993.99'}]).total,'9007199254740993.99')
})
test('rechaza cantidades cero, negativos, importes invalidos y partidas vacias',()=>{
  for(const cambios of [{cantidad:'0'},{cantidad:'-1'},{precioUnitario:'NaN'},{precioUnitario:'1.001'},{cantidad:'1.0001'}])assert.throws(()=>calcularCotizacion([{...base.conceptos[0],...cambios}]))
  assert.throws(()=>calcularCotizacion([]));assert.throws(()=>calcularCotizacion(Array(101).fill(base.conceptos[0])))
  assert.ok(validarCotizacion({...base,moneda:'XXX'}).moneda)
  assert.ok(validarCotizacion({...base,fecha:'2026-02-30'}).fecha)
  assert.ok(validarCotizacion({...base,validaHasta:'2026-11-01'}).validaHasta)
})
test('guarda asociación de demostración, recalcula valores ignorando totales manipulados y persiste',async()=>{
  const storage=memoria(),servicio=crearCotizacionesDemostracionService(opciones({storage}))
  const registro=await servicio.guardar({...base,total:'999',subtotal:'999'})
  assert.equal(registro.total,'0.30');assert.equal(registro.folio,'DEMO-COT-0001')
  assert.equal(registro.clienteNombre,'Cliente de demostración Alfa');assert.ok(registro.oportunidadTitulo)
  const recarga=await crearCotizacionesDemostracionService({storage}).cargar();assert.equal(recarga.cotizaciones[0].id,registro.id)
  const segundo=await servicio.guardar({...base,titulo:'Otra'})
  assert.equal(segundo.folio,'DEMO-COT-0002')
})
test('edicion mantiene folio y detecta concurrencia',async()=>{
  const servicio=crearCotizacionesDemostracionService(opciones()),primera=await servicio.guardar(base)
  const editada=await servicio.guardar({...primera,estado:'preparada',conceptos:[{descripcion:'A',cantidad:'2',precioUnitario:'10.00'}]})
  assert.equal(editada.total,'20.00');assert.equal(editada.folio,primera.folio);assert.equal(editada.version,2)
  await assert.rejects(servicio.guardar({...primera,titulo:'Obsoleta'}),/cambió/)
})
test('cotizacion aceptada conserva propuesta; no permite saltar desde borrador',async()=>{
  const servicio=crearCotizacionesDemostracionService(opciones()),primera=await servicio.guardar(base)
  await assert.rejects(servicio.guardar({...primera,estado:'aceptada'}),/no permitido/)
  const preparada=await servicio.guardar({...primera,estado:'preparada'})
  const aceptada=await servicio.guardar({...preparada,estado:'aceptada'})
  await assert.rejects(servicio.guardar({...aceptada,titulo:'Cambiar acuerdo'}),/cerrada/)
})
test('rechaza asociacion no existente y no guarda datos reales',async()=>{
  const servicio=crearCotizacionesDemostracionService(opciones())
  await assert.rejects(servicio.guardar({...base,oportunidadId:'oportunidad-real'}),/no está disponible/)
  assert.equal((await servicio.cargar()).cotizaciones.length,0)
})
test('errores de almacenamiento no se presentan como guardado y permiten reintentar',async()=>{
  let falla=true;const storage=memoria(),set=storage.setItem
  storage.setItem=(k,v)=>{if(falla)throw Error('quota');set(k,v)}
  const servicio=crearCotizacionesDemostracionService(opciones({storage}))
  await assert.rejects(servicio.guardar(base),/No se guardó/)
  assert.equal((await servicio.cargar()).cotizaciones.length,0)
  falla=false;assert.equal((await servicio.guardar(base)).folio,'DEMO-COT-0001')
})
test('doble envio realiza un solo guardado y restablecer no borra oportunidades',async()=>{
  const storage=memoria(),servicio=crearCotizacionesDemostracionService(opciones({storage}))
  const primera=servicio.guardar(base)
  await assert.rejects(servicio.guardar(base),/guardándose/);await primera
  assert.equal((await servicio.cargar()).cotizaciones.length,1)
  await servicio.restablecer()
  const datos=await servicio.cargar();assert.equal(datos.cotizaciones.length,0);assert.equal(datos.oportunidades.length,1)
})
test('corrupcion exige restablecimiento explicito',async()=>{
  const storage=memoria();storage.setItem('crm-aviacion:cotizaciones-demostracion:v1','invalido')
  const servicio=crearCotizacionesDemostracionService({storage});await assert.rejects(servicio.cargar(),/dañados/)
  await servicio.restablecer();assert.equal((await servicio.cargar()).cotizaciones.length,0)
})

test('dos instancias no sobrescriben una edicion concurrente despues de cargar catalogos',async()=>{
  const storage=memoria(),uno=crearCotizacionesDemostracionService(opciones({storage})),dos=crearCotizacionesDemostracionService(opciones({storage}))
  const original=await uno.guardar(base)
  const resultados=await Promise.allSettled([uno.guardar({...original,titulo:'Uno'}),dos.guardar({...original,titulo:'Dos'})])
  assert.equal(resultados.filter(r=>r.status==='fulfilled').length,1)
  assert.equal(resultados.filter(r=>r.status==='rejected').length,1)
})

test('el servicio navegador real permanece bloqueado y nunca usa cotizaciones u oportunidades de demostración',async()=>{
  const {crearCotizacionesNavegador}=await import('../src/services/cotizacionesService.js')
  const servicio=crearCotizacionesNavegador()
  assert.equal(servicio.modo,'bloqueado')
  assert.match(servicio.backendBloqueado,/deshabilitada/)
  await assert.rejects(servicio.cargar(),/deshabilitada/)
  await assert.rejects(servicio.guardar(base),/deshabilitada/)
  await assert.rejects(servicio.restablecer(),/deshabilitada/)
})
