import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
const servicio = {}
globalThis.__crmServiceTest = servicio
let code = fs.readFileSync('src/composables/useCrm.js','utf8')
code = code.replace("import * as crmSupabaseService from '@/services/crmSupabaseService'", 'const crmSupabaseService = globalThis.__crmServiceTest')
code = code.replace("import { supabase } from '@/lib/supabase'", 'const supabase = {}')
code = code.replace(/from\s+(['"])([^'"]+)\1/g,(_,q,spec)=>{
  const destino=spec.startsWith('@/') ? pathToFileURL(path.resolve('src',spec.slice(2))+(path.extname(spec)?'':'.js')).href
    : spec.startsWith('.') ? pathToFileURL(path.resolve('src/composables',spec)+(path.extname(spec)?'':'.js')).href : import.meta.resolve(spec)
  return `from ${JSON.stringify(destino)}`
})
const {useCrm} = await import(`data:text/javascript;base64,${Buffer.from(code).toString('base64')}`)
const anterior={id:'c-1',nombres:'Ana',nombre:'Ana Pérez',notas:'Antes'}
test('edicion real del composable actualiza lista, cierra formulario y recarga',async()=>{
  const crm=useCrm(), cambios={notas:'Después'};let recibido
  servicio.actualizarProspecto=async(id,payload)=>{recibido={id,payload};return {...anterior,...payload}}
  servicio.obtenerProspectos=async()=>[{...anterior,...cambios}]
  crm.estado.prospectos=[anterior];crm.abrirFormularioContacto(anterior)
  await crm.crearContacto(cambios)
  assert.deepEqual(recibido,{id:'c-1',payload:cambios})
  assert.equal(crm.estado.prospectos[0].notas,'Después')
  assert.equal(crm.formularioContactoAbierto.value,false);assert.equal(crm.estado.guardando,false)
})
test('fallo de escritura conserva contacto/formulario y presenta error sin rechazar evento',async()=>{
  const crm=useCrm();servicio.actualizarProspecto=async()=>{throw {code:'42501'}}
  crm.estado.prospectos=[anterior];crm.abrirFormularioContacto(anterior)
  await crm.crearContacto({notas:'Nueva'})
  assert.equal(crm.formularioContactoAbierto.value,true)
  assert.equal(crm.contactoEnEdicion.value.id,'c-1')
  assert.equal(crm.estado.prospectos[0].notas,'Antes')
  assert.match(crm.estado.errorOperacion,/permisos/)
})
test('fallo de refresco conserva guardado y explica que no debe repetirse',async()=>{
  const crm=useCrm();let escrituras=0
  servicio.actualizarProspecto=async()=>{escrituras++;return {...anterior,notas:'Guardada'}}
  servicio.obtenerProspectos=async()=>{throw Error('sin red')}
  crm.estado.prospectos=[anterior];crm.abrirFormularioContacto(anterior)
  await crm.crearContacto({notas:'Guardada'})
  assert.equal(escrituras,1);assert.equal(crm.estado.errorOperacion,null)
  assert.equal(crm.estado.prospectos[0].notas,'Guardada');assert.match(crm.estado.aviso,/sin repetir/)
})
test('dos envios simultaneos causan una sola escritura',async()=>{
  const crm=useCrm();let liberar,escrituras=0
  servicio.crearProspecto=()=>{escrituras++;return new Promise(resolve=>{liberar=()=>resolve(anterior)})}
  servicio.obtenerProspectos=async()=>[anterior]
  crm.abrirFormularioContacto()
  const pendiente=crm.crearContacto({nombre:'Ana'})
  await crm.crearContacto({nombre:'Ana'})
  assert.equal(escrituras,1);liberar();await pendiente
  assert.equal(crm.estado.prospectos.length,1)
})
