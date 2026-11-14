import test from 'node:test'
import assert from 'node:assert/strict'
import {crearAdminUsuariosPostgres,parametrosAdministrarPerfil} from '../supabase/functions/_shared/adminUsuariosPostgres.js'
const actual={id:'destino',nombre:'Antes',apellidos:'Real',correo:'usuario@example.test',telefono:'',rol:'ejecutivo',activo:true}
function base({actor={id:'actor',rol:'administrador',activo:true},rechazarFuncion=false,fks=[]}={}){
  const llamadas=[],estado={...actual}
  const sql=(strings,...values)=>{
    if(!Array.isArray(strings)||!Object.hasOwn(strings,'raw'))return {identificador:strings}
    const query=strings.join('?');llamadas.push({query,values})
    if(query.includes('SET LOCAL'))return Promise.resolve([])
    if(query.includes('FOR SHARE'))return Promise.resolve([actor])
    if(query.includes('FROM pg_proc'))return Promise.resolve([{retorna_void:true,prosecdef:true,parametros:true,ruta_segura:true,permitido:true}])
    if(query.includes('FROM pg_constraint'))return Promise.resolve(fks)
    if(query.includes('SELECT crm_internal.administrar_perfil(')){
      if(rechazarFuncion)throw Object.assign(Error('SQL sensible'),{code:'42501'})
      if(values[2]!==null)estado.rol=values[2]
      if(values[3]!==null)estado.activo=values[3]
      return Promise.resolve([{administrar_perfil:null}]) // void real
    }
    if(query.includes('UPDATE public.perfiles')){Object.assign(estado,values[0].identificador);return Promise.resolve([])}
    if(query.includes('FROM public.perfiles WHERE'))return Promise.resolve([{...estado}])
    throw Error(`Consulta inesperada: ${query}`)
  }
  sql.begin=async fn=>{const antes={...estado};try{return await fn(sql)}catch(e){Object.assign(estado,antes);throw e}}
  return {sql,llamadas,estado}
}
test('firma exacta, null para valor no modificado, actor exclusivo del comando autenticado',()=>{
  assert.deepEqual(parametrosAdministrarPerfil({actorId:'jwt',usuarioId:'destino',cambios:{rol:'supervisor',activo:true}},actual),{
    p_actor_id:'jwt',p_usuario_id:'destino',p_nuevo_rol:'supervisor',p_nuevo_activo:null,
  })
})
test('invoca función privada con cuatro parámetros y relee fila tras retorno void',async()=>{
  const b=base(),db=crearAdminUsuariosPostgres({sql:b.sql})
  const result=await db.ejecutarDb({operacion:'editar',actorId:'actor',usuarioId:actual.id,cambios:{rol:'supervisor'}})
  assert.equal(result.rol,'supervisor')
  const call=b.llamadas.find(c=>c.query.includes('SELECT crm_internal.administrar_perfil('))
  assert.deepEqual(call.values,['actor','destino','supervisor',null])
  assert.match(call.query,/p_nuevo_activo/);assert.doesNotMatch(call.query,/p_solicitud|admin_usuarios_operacion/)
  assert.ok(b.llamadas.at(-1).query.includes('FROM public.perfiles'))
})
test('edición personal propia omite función que prohíbe modificaciones administrativas propias',async()=>{
  const b=base(),db=crearAdminUsuariosPostgres({sql:b.sql})
  await db.ejecutarDb({operacion:'editar',actorId:'actor',usuarioId:'actor',cambios:{nombre:'Nuevo',rol:'ejecutivo',activo:true}})
  assert.equal(b.estado.nombre,'Nuevo')
  assert.equal(b.llamadas.some(c=>c.query.includes('SELECT crm_internal.administrar_perfil(')),false)
})
test('rechazo de la función revierte también datos personales de la transacción',async()=>{
  const b=base({rechazarFuncion:true}),db=crearAdminUsuariosPostgres({sql:b.sql})
  await assert.rejects(db.ejecutarDb({operacion:'editar',actorId:'actor',usuarioId:'destino',cambios:{nombre:'No persistir',rol:'supervisor'}}),e=>e.status===403)
  assert.equal(b.estado.nombre,'Antes')
})
test('administrador inactivo no puede listar ni escribir aunque la conexión sea privilegiada',async()=>{
  const b=base({actor:{rol:'administrador',activo:false}}),db=crearAdminUsuariosPostgres({sql:b.sql})
  await assert.rejects(db.ejecutarDb({operacion:'listar',actorId:'actor'}),e=>e.status===403)
})
test('eliminación bloqueada sin revisión y ante FK con cascada a registros comerciales',async()=>{
  const b=base()
  await assert.rejects(crearAdminUsuariosPostgres({sql:b.sql}).ejecutarDb({operacion:'preparar_eliminacion',actorId:'actor',usuarioId:'destino',confirmacion:actual.correo}),e=>e.status===503)
  const fks=[{es_perfil:true,a_auth:true,columna:'id',referencia:'id',columnas:1,confdeltype:'c'},
    {es_perfil:false,a_auth:false,tabla:'ventas',esquema:'public',columna:'usuario_id',referencia:'id',columnas:1,confdeltype:'c'}]
  const c=base({fks})
  await assert.rejects(crearAdminUsuariosPostgres({sql:c.sql,deletionReviewed:true}).ejecutarDb({operacion:'preparar_eliminacion',actorId:'actor',usuarioId:'destino',confirmacion:actual.correo}),e=>e.status===409)
  assert.equal(c.llamadas.some(c=>c.query.includes('SELECT crm_internal.administrar_perfil(')),false)
})

test('historial consulta exactamente las columnas confirmadas y no fabrica acción/snapshots',async()=>{
  const b=base(),consultas=[]
  const sql=(strings,...values)=>{
    if(!Array.isArray(strings)||!Object.hasOwn(strings,'raw'))return b.sql(strings,...values)
    const query=strings.join('?');consultas.push(query)
    if(query.includes('FROM public.auditoria_usuarios'))return Promise.resolve([{id:'9007199254740993',usuario_id:'destino',realizado_por:'actor',rol_anterior:'ejecutivo',rol_nuevo:'supervisor',activo_anterior:true,activo_nuevo:false,fecha_cambio:'2026-11-13T12:00:00Z'}])
    return b.sql(strings,...values)
  }
  sql.begin=fn=>fn(sql)
  const rows=await crearAdminUsuariosPostgres({sql}).ejecutarDb({operacion:'historial',actorId:'actor'})
  assert.equal(rows[0].id,'9007199254740993')
  assert.equal(rows[0].rol_anterior,'ejecutivo')
  const query=consultas.find(q=>q.includes('FROM public.auditoria_usuarios'))
  for(const col of ['id','usuario_id','realizado_por','rol_anterior','rol_nuevo','activo_anterior','activo_nuevo','fecha_cambio'])assert.match(query,new RegExp(`a.${col}`))
  assert.doesNotMatch(query,/accion|snapshots|antes|despues/)
})
