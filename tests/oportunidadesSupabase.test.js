import test from 'node:test'
import assert from 'node:assert/strict'
import { columnasOportunidades, evaluarModoOportunidades, configuracionOportunidades } from '../src/modulos/oportunidades/esquemas/contratoOportunidadesSupabase.js'
import { normalizarImporte, fechaSupabase, validarColumnasOportunidades, crearAdaptadorOportunidadesSupabase } from '../src/modulos/oportunidades/adaptadores/adaptadorOportunidadesSupabase.js'
import { crearServicioOportunidadesNavegador } from '../src/modulos/oportunidades/servicios/servicioOportunidades.js'

// El esquema del doble reproduce las columnas confirmadas por el usuario.
const columnas=columnasOportunidades
const env={DEV:true,MODE:'staging',VITE_OPORTUNIDADES_MODO:'supabase',VITE_SUPABASE_URL:`https://${'a'.repeat(20)}.supabase.co`,VITE_SUPABASE_ANON_KEY:'sb_publishable_synthetic'}
function config(){return {stagingProjectRef:'a'.repeat(20),produccionProjectRefs:['hhlicjgpwcesytziacvc'],columnas,verificaciones:Object.fromEntries(Object.keys(configuracionOportunidades.verificaciones).map(k=>[k,true]))}}
const uuid='11111111-1111-4111-8111-111111111111'
const modelo={id:uuid,titulo:'Prueba de demostración',descripcion:'Descripción',clienteId:'cliente-1',embudoId:'embudo-1',etapaId:'etapa-1',responsableId:'agente-1',servicio:'aeronaves',estado:'abierta',valorEstimado:'125000.50',moneda:'USD',prioridad:'media',proximoSeguimiento:'2026-12-01T16:00:00Z',actualizadoEn:'2026-11-12T12:00:00Z'}
function fixture(){
  const estado={usuario:'agente-1',activo:true,errorRPC:null,respuesta:uuid,espera:null}, llamadas=[]
  const tablas={
    oportunidades:[{id:uuid,prospecto_id:'cliente-1',embudo_id:'embudo-1',etapa_id:'etapa-1',titulo:'Prueba de demostración',descripcion:'Descripción',responsable_id:'agente-1',creado_por:'agente-1',valor_estimado:'125000.50',moneda:'USD',prioridad:'media',estado:'abierta',proximo_seguimiento:modelo.proximoSeguimiento,fecha_actualizacion:modelo.actualizadoEn,fecha_creacion:'2026-11-12T10:00:00Z',fecha_cierre:null}],
    embudos:[{id:'embudo-1',nombre:'Venta aeronaves',descripcion:null,activo:true,fecha_creacion:'2026-11-12T10:00:00Z'}],
    etapas:[{id:'etapa-1',embudo_id:'embudo-1',nombre:'Nueva',orden:0,tipo:'abierta',activo:true}],
    prospectos:[{id:'cliente-1',nombre:'CRM_TEST_Ana',apellidos:'De demostración',empresa:'Empresa sintética'}],
    perfiles:[{id:'agente-1',nombre:'CRM_TEST_Agente',apellidos:'De demostración',activo:true}],
    eventos_oportunidad:[{id:'evento-1',oportunidad_id:uuid,tipo:'creada',fecha_creacion:'2026-11-12T12:00:00Z',usuario_id:'agente-1',datos_anteriores:null,datos_nuevos:{titulo:'Prueba de demostración'}}],
  }
  const cliente={supabaseUrl:env.VITE_SUPABASE_URL,auth:{getUser:async()=>({data:{user:estado.usuario?{id:estado.usuario}:null},error:null})},from(tabla){
    const filtros=[];let select
    return {select(c){
      const permitidas = new Set(columnas[({eventos_oportunidad:'eventos'})[tabla] || tabla] ? Object.values(columnas[({eventos_oportunidad:'eventos'})[tabla] || tabla]) : tabla==='perfiles' ? ['id','nombre','apellidos','activo'] : ['id','nombre','apellidos','empresa'])
      for (const campo of c.split(',')) assert.ok(permitidas.has(campo.replace('::text','')), `Columna inexistente: ${tabla}.${campo}`)
      select=c;llamadas.push({tabla,select:c});return this},eq(c,v){filtros.push([c,v]);llamadas.push({tabla,filtro:[c,v]});return this},order(c){llamadas.push({tabla,orden:c});return this},
      async single(){return {data:{id:estado.usuario,activo:estado.activo},error:null}},
      async range(desde,hasta){const rows=tablas[tabla].filter(f=>filtros.every(([k,v])=>f[k]===v));return {data:rows.slice(desde,hasta+1),count:rows.length,error:null}},
    }
  },async rpc(nombre,args){
    llamadas.push({nombre,args});if(estado.espera)await estado.espera
    if (!estado.errorRPC) Object.assign(tablas.oportunidades[0],{titulo:args.p_titulo,descripcion:args.p_descripcion,valor_estimado:args.p_valor,moneda:args.p_moneda,prioridad:args.p_prioridad,etapa_id:args.p_etapa,responsable_id:args.p_responsable,proximo_seguimiento:args.p_seguimiento,fecha_actualizacion:'2026-11-12T12:00:01.123456+00:00'})
    return {data:estado.errorRPC?null:estado.respuesta,error:estado.errorRPC}
  }}
  return {estado,llamadas,tablas,cliente,servicio:crearAdaptadorOportunidadesSupabase({obtenerCliente:async()=>cliente,env,config:config()})}
}
test('modo real bloqueado por defecto, en produccion, destino productivo y evidencia incompleta',()=>{
  assert.equal(evaluarModoOportunidades(env).habilitado,false)
  assert.equal(evaluarModoOportunidades({...env,DEV:false},config()).habilitado,false)
  const cfg=config();cfg.stagingProjectRef='hhlicjgpwcesytziacvc'
  assert.equal(evaluarModoOportunidades({...env,VITE_SUPABASE_URL:'https://hhlicjgpwcesytziacvc.supabase.co'},cfg).habilitado,false)
  assert.equal(evaluarModoOportunidades(env,{...config(),columnas:null}).habilitado,false)
  assert.equal(evaluarModoOportunidades(env,config()).habilitado,true)
})
test('rechaza service_role y claves secretas en frontend',()=>{
  for(const key of ['sb_secret_no_permitida',`a.${Buffer.from(JSON.stringify({role:'service_role'})).toString('base64url')}.b`]){
    assert.equal(evaluarModoOportunidades({...env,VITE_SUPABASE_ANON_KEY:key},config()).habilitado,false)
  }
})
test('factory no crea cliente real cuando faltan verificaciones',()=>{
  let clienteCreado=false
  const servicio=crearServicioOportunidadesNavegador({env,config:configuracionOportunidades,obtenerCliente:()=>{clienteCreado=true}})
  assert.equal(servicio.modo,'bloqueado');assert.equal(clienteCreado,false);assert.ok(servicio.backendBloqueado)
})
test('carga datos autorizados y conserva valores decimales e historial',async()=>{
  const f=fixture(),datos=await f.servicio.cargar()
  assert.equal(datos.oportunidades[0].valorEstimado,'125000.50')
  assert.equal(datos.oportunidades[0].embudoNombre,'Venta aeronaves')
  assert.equal(datos.oportunidades[0].empresaId,'Empresa sintética')
  assert.equal((await f.servicio.obtenerHistorial(uuid))[0].tipo,'creada')
  assert.ok(f.llamadas.some(c=>c.tabla==='eventos_oportunidad'))
})
test('crear llama exactamente la firma RPC confirmada y recibe uuid',async()=>{
  const f=fixture(),nuevo={...modelo};delete nuevo.id
  const resultado=await f.servicio.guardar(nuevo)
  assert.equal(resultado.id,uuid)
  assert.deepEqual(f.llamadas.find(c=>c.nombre),{nombre:'crear_oportunidad',args:{p_prospecto:'cliente-1',p_embudo:'embudo-1',p_titulo:'Prueba de demostración',p_descripcion:'Descripción',p_valor:'125000.50',p_moneda:'USD',p_prioridad:'media',p_etapa:'etapa-1',p_responsable:'agente-1',p_seguimiento:modelo.proximoSeguimiento}})
})
test('editar envía fecha esperada original sin escritura directa ni atributos de autorización',async()=>{
  const f=fixture();await f.servicio.guardar({...modelo,rol:'administrador',creado_por:'ajeno'})
  const rpc=f.llamadas.find(c=>c.nombre)
  assert.equal(rpc.nombre,'actualizar_oportunidad');assert.equal(rpc.args.p_fecha_esperada,modelo.actualizadoEn)
  assert.equal(Object.keys(rpc.args).length,10);assert.equal(rpc.args.rol,undefined);assert.equal(rpc.args.p_prospecto,undefined)
})
test('rechazo de autorización no devuelve éxito ni reintenta RPC',async()=>{
  const f=fixture();f.estado.errorRPC={code:'42501'}
  await assert.rejects(f.servicio.guardar(modelo),/no tienes permisos/)
  assert.equal(f.llamadas.filter(c=>c.nombre).length,1)
})
test('sesion ausente, inactiva o cambiada bloquea operaciones antes de RPC',async()=>{
  for(const cambio of [{usuario:null},{activo:false}]){
    const f=fixture();Object.assign(f.estado,cambio)
    await assert.rejects(f.servicio.guardar(modelo));assert.equal(f.llamadas.some(c=>c.nombre),false)
  }
  const f=fixture();await f.servicio.cargar();f.estado.usuario='otro'
  await assert.rejects(f.servicio.guardar(modelo),/identidad cambió/)
})
test('edicion no cambia cliente/embudo ni omite token de concurrencia',async()=>{
  for(const cambio of [{clienteId:'ajeno'},{actualizadoEn:null}]){
    const f=fixture();await assert.rejects(f.servicio.guardar({...modelo,...cambio}))
    assert.equal(f.llamadas.some(c=>c.nombre),false)
  }
})
test('respuesta RPC inesperada queda pendiente de confirmación',async()=>{
  const f=fixture();f.estado.respuesta=null
  await assert.rejects(f.servicio.guardar(modelo),e=>e.confirmacionPendiente===true)
})
test('doble envio no ejecuta dos RPC',async()=>{
  const f=fixture();let liberar;f.estado.espera=new Promise(r=>liberar=r)
  const primero=f.servicio.guardar(modelo)
  await assert.rejects(f.servicio.guardar(modelo),/en curso/)
  liberar();await primero
  assert.equal(f.llamadas.filter(c=>c.nombre).length,1)
})
test('no permite administrar etapas ni restablecer Supabase desde la interfaz',async()=>{
  const f=fixture()
  await assert.rejects(f.servicio.guardarEtapa({}),/solo la consulta/)
  await assert.rejects(f.servicio.restablecer(),/No se pueden/)
})

test('cliente de otro proyecto no consulta identidad ni escribe',async()=>{
  const f=fixture();f.cliente.supabaseUrl='https://hhlicjgpwcesytziacvc.supabase.co'
  await assert.rejects(f.servicio.cargar(),/no apunta al staging/)
  assert.equal(f.llamadas.length,0)
})

test('mapeo definitivo no admite servicio de embudo ni estado de etapa de demostración',()=>{
  assert.doesNotThrow(()=>validarColumnasOportunidades(columnas))
  assert.equal(columnas.embudos.servicio,undefined)
  assert.equal(columnas.etapas.tipo,'tipo')
  assert.equal(columnas.oportunidades.estado,'estado')
  assert.throws(()=>validarColumnasOportunidades({...columnas,etapas:{...columnas.etapas,estado:'estado'}}),/no coincide/)
})
test('consulta embudos activos y ordena etapas conservando estado real independiente de tipo',async()=>{
  const f=fixture()
  f.tablas.embudos.push({...f.tablas.embudos[0],id:'inactivo',activo:false})
  f.tablas.etapas.push({...f.tablas.etapas[0],id:'etapa-2',orden:5,tipo:'ganada'})
  f.tablas.oportunidades[0].estado='estado_del_servidor'
  const datos=await f.servicio.cargar()
  assert.equal(datos.embudos.length,1)
  assert.deepEqual(datos.etapas.map(e=>e.orden),[0,5])
  assert.equal(datos.etapas[0].tipo,'abierta');assert.equal(datos.etapas[0].estado,undefined)
  assert.equal(datos.oportunidades[0].estado,'estado_del_servidor')
  assert.ok(f.llamadas.some(c=>c.tabla==='embudos' && c.filtro?.[0]==='activo' && c.filtro[1]===true))
  assert.ok(f.llamadas.some(c=>c.tabla==='etapas' && c.orden==='orden'))
  assert.ok(f.llamadas.some(c=>c.select?.includes('valor_estimado::text')))
})
test('numeric conserva precisión, ceros y decimales sin redondear',()=>{
  for(const valor of ['9007199254740993.123456789','0.00000000001','0','125000.5000']) assert.equal(normalizarImporte(valor),valor)
  assert.equal(normalizarImporte(12.5),'12.5')
  for(const valor of [null,Infinity,NaN,-1,'NaN','1e30',Number.MAX_SAFE_INTEGER+1]) assert.throws(()=>normalizarImporte(valor))
})
test('nullable y timestamptz preservan offset y microsegundos; seguimiento puede borrarse',async()=>{
  const fecha='2026-11-12T06:00:00.123456-06:00'
  assert.equal(fechaSupabase(fecha),fecha);assert.equal(fechaSupabase(null),null)
  assert.throws(()=>fechaSupabase('2026-11-12T06:00:00'))
  const f=fixture()
  Object.assign(f.tablas.oportunidades[0],{descripcion:null,proximo_seguimiento:null,fecha_cierre:null,fecha_actualizacion:fecha})
  const registro=(await f.servicio.cargar()).oportunidades[0]
  assert.equal(registro.descripcion,null);assert.equal(registro.proximoSeguimiento,null)
  const confirmado=await f.servicio.guardar({...registro,descripcion:'',proximoSeguimiento:''})
  const rpc=f.llamadas.find(c=>c.nombre)
  assert.equal(rpc.args.p_fecha_esperada,fecha);assert.equal(rpc.args.p_seguimiento,null);assert.equal(rpc.args.p_descripcion,null)
  assert.equal(confirmado.proximoSeguimiento,null)
})
test('guardar recarga el registro: devuelve fecha/estado/valores de servidor, no el borrador',async()=>{
  const f=fixture()
  const resultado=await f.servicio.guardar({...modelo,estado:'inventado',titulo:' Título modificado '})
  assert.equal(resultado.titulo,'Título modificado')
  assert.equal(resultado.estado,'abierta')
  assert.equal(resultado.actualizadoEn,'2026-11-12T12:00:01.123456+00:00')
  assert.notEqual(resultado.actualizadoEn,modelo.actualizadoEn)
  assert.equal(resultado.historial.length,1)
  const rpcIndice=f.llamadas.findIndex(c=>c.nombre)
  assert.ok(f.llamadas.slice(rpcIndice+1).some(c=>c.tabla==='oportunidades'))
})
test('conflicto de concurrencia conserva código y no vuelve a ejecutar RPC',async()=>{
  const f=fixture();f.estado.errorRPC={code:'40001'}
  await assert.rejects(f.servicio.guardar(modelo),e=>e.code==='40001' && /cambió/.test(e.message))
  assert.equal(f.llamadas.filter(c=>c.nombre).length,1)
})
test('historial transforma snapshots nullable y usuario no registrado sin inventar columnas',async()=>{
  const f=fixture()
  f.tablas.eventos_oportunidad.push({id:'evento-2',oportunidad_id:uuid,usuario_id:null,tipo:'actualizada',datos_anteriores:{titulo:'Antes',descripcion:'Igual'},datos_nuevos:{titulo:'Después',descripcion:'Igual'},fecha_creacion:'2026-11-12T13:00:00Z'})
  const historial=await f.servicio.obtenerHistorial(uuid)
  assert.deepEqual(historial[0].cambios.titulo,{antes:null,despues:'Prueba de demostración'})
  assert.deepEqual(historial[1].cambios,{titulo:{antes:'Antes',despues:'Después'}})
  assert.equal(historial[1].usuarioId,null);assert.equal(historial[1].actor,'Sin usuario registrado')
})
test('RPC exitosa sin registro legible no devuelve un guardado de demostración ni reintenta escritura',async()=>{
  const f=fixture();f.estado.respuesta='22222222-2222-4222-8222-222222222222'
  await assert.rejects(f.servicio.guardar(modelo),e=>e.confirmacionPendiente && e.registroId===f.estado.respuesta)
  assert.equal(f.llamadas.filter(c=>c.nombre).length,1)
})

test('la fábrica distingue demo, adaptador real simulado y fallo de construcción', async () => {
  const f = fixture()
  const construir = (opciones) => crearServicioOportunidadesNavegador({ env, config: config(), ...opciones })
  const demo = construir({ env: { ...env, VITE_OPORTUNIDADES_MODO: 'demo' } })
  assert.equal(demo.modo, 'demostracion')
  assert.ok((await demo.cargar()).oportunidades.length)
  const real = construir({ obtenerCliente: () => f.cliente })
  assert.equal(real.modo, 'supabase')
  assert.equal((await real.cargar()).oportunidades[0].id, uuid)
  for (const opciones of [{}, { obtenerCliente: () => f.cliente, config: { ...config(), columnas: {} } }]) {
    const bloqueado = construir(opciones)
    assert.equal(bloqueado.modo, 'bloqueado')
    assert.equal(bloqueado.permiteGestionEtapas, false)
    await assert.rejects(bloqueado.cargar(), /cliente autenticado|mapeo/)
    await assert.rejects(bloqueado.guardar(modelo))
  }
})

test('un timeout de creación permite recargar y bloquea reenvíos incluso desde otro adaptador', async () => {
  const f = fixture()
  let rpc = 0
  f.cliente.rpc = async () => { rpc++; return { error: { code: 'GATEWAY_TIMEOUT' }, status: 408 } }
  const alta = { ...modelo, id: null }
  await assert.rejects(f.servicio.guardar(alta), { confirmacionPendiente: true })
  await f.servicio.cargar()
  const otro = crearAdaptadorOportunidadesSupabase({ obtenerCliente: () => f.cliente, env, config: config() })
  await assert.rejects(otro.guardar(alta), { confirmacionPendiente: true })
  assert.equal(rpc, 1)
})

test('alta real usa moneda y prioridad confirmadas y solo una etapa abierta del mismo embudo', async () => {
  const f = fixture()
  f.tablas.etapas.push({ ...f.tablas.etapas[0], id: 'cerrada', tipo: 'ganada' })
  f.tablas.etapas.push({ ...f.tablas.etapas[0], id: 'ajena', embudo_id: 'otro' })
  for (const cambios of [{ moneda: 'GBP' }, { prioridad: 'crítica' }, { etapaId: 'cerrada' }, { etapaId: 'ajena' }, { titulo: ' ' }]) {
    await assert.rejects(f.servicio.guardar({ ...modelo, id: null, ...cambios }))
  }
  assert.equal(f.llamadas.filter(c => c.nombre).length, 0)
  await f.servicio.guardar({ ...modelo, id: null, moneda: 'EUR', prioridad: 'urgente' })
  assert.equal(f.llamadas.find(c => c.nombre).args.p_prioridad, 'urgente')
})

test('se eliminan etapas repetidas sin perder la asociación con el embudo', async () => {
  const f = fixture()
  f.tablas.etapas.push({ ...f.tablas.etapas[0] }, { ...f.tablas.etapas[0], id: 'ajena', embudo_id: 'otro' })
  const datos = await f.servicio.cargar()
  assert.deepEqual(datos.etapas.map(e => [e.id, e.embudoId]), [['ajena', 'otro'], ['etapa-1', 'embudo-1']])
  assert.equal(datos.clientes[0].id, f.tablas.prospectos[0].id)
})
