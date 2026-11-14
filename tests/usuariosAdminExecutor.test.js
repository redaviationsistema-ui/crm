import test from 'node:test'
import assert from 'node:assert/strict'
import {crearAdminUsuariosExecutor as crearExecutor} from '../supabase/functions/_shared/adminUsuariosExecutor.js'
const crearAdminUsuariosExecutor=opciones=>{
  const run=crearExecutor({...opciones,ejecutarDb:comando=>comando.operacion==='preflight'?Promise.resolve({contrato:'administrar-perfil-existente-v1'}):opciones.ejecutarDb(comando),eliminarConAuth:async(_c,borrar)=>borrar()})
  return c=>run(c,{redirectTo:'https://redskyg.com/crm/establecer-acceso'})
}
const objetivo={id:'objetivo',correo:'persona@example.test',activo:true}
function auth(extra={}){return {inviteUserByEmail:async()=>({data:{user:{id:'nuevo'}}}),updateUserById:async()=>({data:{user:{id:'objetivo'}}}),getUserById:async id=>({data:{user:{id,email:'nuevo@example.test'}}}),deleteUser:async()=>({error:null}),...extra}}
test('fallo Auth de invitacion no crea perfil',async()=>{
  let llamadas=0
  const run=crearAdminUsuariosExecutor({authAdmin:auth({inviteUserByEmail:async()=>({error:{message:'dato sensible'}})}),ejecutarDb:async()=>llamadas++})
  await assert.rejects(run({operacion:'crear',usuario:{correo:'nuevo@example.test'}}),/no confirmó/);assert.equal(llamadas,0)
})
test('crea Auth, inicializa perfil real y confirma cuenta antes de informar exito',async()=>{
  const llamadas=[]
  const run=crearAdminUsuariosExecutor({authAdmin:auth(),ejecutarDb:async c=>{llamadas.push(c);return {id:c.usuarioId,...c.usuario}}})
  const r=await run({operacion:'crear',actorId:'admin',usuario:{correo:'nuevo@example.test',activo:true}})
  assert.equal(r.id,'nuevo');assert.equal(llamadas[0].usuarioId,'nuevo');assert.equal(llamadas[0].actorId,'admin')
})
test('SQL rechazado no modifica Auth durante edicion',async()=>{
  let llamadas=0
  const run=crearAdminUsuariosExecutor({authAdmin:auth({updateUserById:async()=>llamadas++}),ejecutarDb:async()=>{throw Error('último administrador')}})
  await assert.rejects(run({operacion:'editar',usuarioId:objetivo.id,objetivo,cambios:{activo:false}}),/último administrador/)
  assert.equal(llamadas,0)
})
test('desactivacion incluida en editar sincroniza ban, sin restaurar un perfil inactivo si Auth falla',async()=>{
  const cambios=[],comandos=[]
  const run=crearAdminUsuariosExecutor({authAdmin:auth({updateUserById:async(id,c)=>{cambios.push(c);return {error:Error('proveedor')}}}),ejecutarDb:async c=>{comandos.push(c);return {id:objetivo.id,activo:false}}})
  await assert.rejects(run({operacion:'editar',usuarioId:objetivo.id,objetivo,cambios:{activo:false}}),e=>e.requiereRevision===true)
  assert.deepEqual(cambios,[{ban_duration:'876000h'}]);assert.equal(comandos.length,1)
})
test('borrado no elimina previamente perfil y verifica ausencia Auth y auditoria SQL',async()=>{
  const comandos=[]
  const run=crearAdminUsuariosExecutor({authAdmin:auth({getUserById:async()=>({data:{user:null},error:{status:404}})}),ejecutarDb:async c=>{comandos.push(c.operacion);return {id:objetivo.id,eliminado:c.operacion==='verificar_eliminacion'}}})
  const r=await run({operacion:'eliminar_definitivamente',usuarioId:objetivo.id,objetivo})
  assert.equal(r.eliminado,true);assert.deepEqual(comandos,['preparar_eliminacion','verificar_eliminacion'])
})
test('dependencias SQL impiden llamar deleteUser',async()=>{
  let eliminaciones=0
  const run=crearAdminUsuariosExecutor({authAdmin:auth({deleteUser:async()=>eliminaciones++}),ejecutarDb:async()=>{throw Error('dependencias')}})
  await assert.rejects(run({operacion:'eliminar_definitivamente',usuarioId:objetivo.id,objetivo}),/dependencias/);assert.equal(eliminaciones,0)
})

test('falta de contrato SQL impide crear la cuenta Auth',async()=>{
  let invitaciones=0
  const run=crearExecutor({authAdmin:auth({inviteUserByEmail:async()=>invitaciones++}),ejecutarDb:async()=>({})})
  await assert.rejects(run({operacion:'crear',usuario:{correo:'prueba@example.test'}},{redirectTo:'https://redskyg.com/crm/establecer-acceso'}),/función administrativa existente/)
  assert.equal(invitaciones,0)
})

test('un ban no aplicado por Auth nunca se informa como desactivacion completa',async()=>{
  const run=crearAdminUsuariosExecutor({authAdmin:auth({getUserById:async()=>({data:{user:{id:objetivo.id,banned_until:null}}})}),ejecutarDb:async()=>({id:objetivo.id,activo:false})})
  await assert.rejects(run({operacion:'cambiar_estado',usuarioId:objetivo.id,objetivo,cambios:{activo:false}}),e=>e.requiereRevision===true)
})

// Una respuesta SQL con datos anteriores no acredita persistencia aunque rol/estado coincidan.
test('no confirma edición cuando PostgreSQL devuelve nombre o correo sin persistir',async()=>{
  for(const cambios of [{nombre:'Actualizado'},{correo:'actualizado@example.test'}]){
    const run=crearAdminUsuariosExecutor({authAdmin:auth(),ejecutarDb:async()=>({...objetivo,nombre:'Anterior'})})
    await assert.rejects(run({operacion:'editar',usuarioId:objetivo.id,objetivo,cambios}),e=>e.requiereRevision===true)
  }
})
