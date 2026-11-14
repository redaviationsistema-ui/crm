import test from 'node:test'
import assert from 'node:assert/strict'
import { crearDatosDemostracion, crearOportunidadesService, filtrarOportunidades } from '../src/services/oportunidadesService.js'
function storage() { const datos = new Map(); return { getItem: k => datos.get(k) ?? null, setItem: (k,v) => datos.set(k,v) } }
function opciones(extra={}) { let n=0; return { id: () => `test-${++n}`, ahora: () => '2026-12-01T12:00:00Z', ...extra } }
test('guardar, cerrar ganado, recargar e historial sin exponer referencias mutables', async () => {
  const persistencia=storage(), config=opciones({storage:persistencia})
  const servicio=crearOportunidadesService(config)
  const datos=await servicio.cargar(), base=datos.oportunidades[0]
  const nuevo=await servicio.guardar({...base,id:undefined,version:undefined,valorEstimado:'300.20'})
  assert.equal(nuevo.historial.length,1)
  const ganado=await servicio.guardar({...nuevo,etapaId:'demo-ganada',estado:'ganada'})
  assert.equal(ganado.historial.length,2); assert.equal(ganado.version,2); assert.ok(ganado.cerradoEn)
  ganado.historial.length=0
  const recarga=await crearOportunidadesService(config).cargar()
  assert.equal(recarga.oportunidades.find(o=>o.id===nuevo.id).historial.length,2)
})
test('rechaza edicion obsoleta sin perder cambios previos', async () => {
  const servicio=crearOportunidadesService(opciones()), base=(await servicio.cargar()).oportunidades[0]
  await servicio.guardar({...base,valorEstimado:'10.00'})
  await assert.rejects(servicio.guardar({...base,valorEstimado:'20.00'}),/cambió/)
  assert.equal((await servicio.cargar()).oportunidades[0].valorEstimado,'10.00')
})
test('valida asociaciones, transiciones y motivo de perdida', async () => {
  const servicio=crearOportunidadesService(opciones()), base=(await servicio.cargar()).oportunidades[0]
  for(const cambio of [{clienteId:'real'}, {responsableId:'real'}, {empresaId:'demo-empresa-2'},
    {estado:'ganada'}, {etapaId:'demo-perdida',estado:'perdida'}, {valorEstimado:'NaN'}]) {
    await assert.rejects(servicio.guardar({...base,...cambio}))
  }
  const perdida=await servicio.guardar({...base,etapaId:'demo-perdida',estado:'perdida',motivoPerdida:'Sin presupuesto'})
  assert.equal(perdida.estado,'perdida')
})
test('crea y renombra etapas, impide romper oportunidades o duplicar nombres', async () => {
  const servicio=crearOportunidadesService(opciones())
  const nueva=await servicio.guardarEtapa({nombre:'Negociación',embudoId:'demo-comercial',estado:'abierta',orden:2})
  assert.ok(nueva.id)
  await servicio.guardarEtapa({...nueva,nombre:'Revisión',orden:3})
  const actual=(await servicio.cargar()).etapas.find(e=>e.id==='demo-nueva')
  await assert.rejects(servicio.guardarEtapa({...actual,estado:'ganada'}),/no puede/)
  await assert.rejects(servicio.guardarEtapa({...nueva,id:undefined,nombre:'Nueva'}),/existe/)
})
test('busca y combina filtros de servicio, responsable, estado, moneda y prioridad', async () => {
  const datos=await crearOportunidadesService().cargar()
  assert.equal(filtrarOportunidades(datos,{busqueda:'DEMOSTRACIÓN ALFA',servicio:'aeronaves',moneda:'USD',prioridad:'media',responsableId:'demo-agente-1',estado:'abierta'}).length,1)
  assert.equal(filtrarOportunidades(datos,{moneda:'MXN'}).length,0)
})
test('fallo de almacenamiento no informa exito ni conserva una escritura fallida', async () => {
  const persistencia={getItem:()=>null,setItem:()=>{throw Error('quota')}}
  const servicio=crearOportunidadesService(opciones({storage:persistencia})), base=(await servicio.cargar()).oportunidades[0]
  await assert.rejects(servicio.guardar({...base,valorEstimado:'20'}),/No se guardó/)
  assert.equal((await servicio.cargar()).oportunidades[0].valorEstimado,base.valorEstimado)
})
test('datos corruptos requieren restablecimiento explicito', async () => {
  let raw='mal';const servicio=crearOportunidadesService({storage:{getItem:()=>raw,setItem:(k,v)=>{raw=v}}})
  await assert.rejects(servicio.cargar(),/dañados/)
  await servicio.restablecer()
  assert.equal((await servicio.cargar()).oportunidades.length,1)
})

test('sesión de demostración anterior incorpora los cuatro embudos sin perder ediciones',async()=>{
  const persistencia=storage(),legado=crearDatosDemostracion()
  legado.embudos=legado.embudos.slice(0,1);delete legado.embudos[0].servicio
  legado.etapas=legado.etapas.filter(e=>e.embudoId==='demo-comercial')
  persistencia.setItem('crm-aviacion:oportunidades-demostracion:v1',JSON.stringify(legado))
  const servicio=crearOportunidadesService(opciones({storage:persistencia}))
  await servicio.guardarEtapa({id:'demo-nueva',nombre:'Contacto personalizado',embudoId:'demo-comercial',estado:'abierta',orden:0})
  const datos=await servicio.cargar()
  assert.equal(datos.embudos.length,4)
  assert.equal(datos.etapas.find(e=>e.id==='demo-nueva').nombre,'Contacto personalizado')
})
