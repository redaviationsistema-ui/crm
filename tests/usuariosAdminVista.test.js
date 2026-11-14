import test from 'node:test'
import assert from 'node:assert/strict'
import { nextTick } from 'vue'
import { cargarComponente, montar, buscar, texto } from './helpers/vueHarness.js'
import { backendUsuariosPrueba } from './fixtures/usuariosAdmin.js'
import { crearUsuariosAdminService } from '../src/services/usuariosAdminService.js'

const Component = await cargarComponente('src/views/UsuariosAdminView.vue')
const admin = { id: 'admin-prueba', nombre: 'Admin Demo', rol: 'administrador', activo: true }
async function ticks() { for (let i = 0; i < 8; i++) await nextTick() }
function boton(root, etiqueta) { return buscar(root, node => node.tag === 'button' && texto(node).includes(etiqueta))[0] }
function campo(root, etiqueta, tag = 'input') {
  const label = buscar(root, node => node.tag === 'label' && texto(node).includes(etiqueta))[0]
  return buscar(label, node => node.tag === tag)[0]
}

test('la pantalla lista usuarios y filtra por nombre/correo, rol y estado', async () => {
  const vista = montar(Component, { actor: admin, servicioInyectado: crearUsuariosAdminService({backend:backendUsuariosPrueba()}) })
  try {
    await ticks()
    assert.match(texto(vista.root), /Administración de usuarios/)
    assert.match(texto(vista.root), /ejecutivo@example.test/)
    campo(vista.root, 'Buscar por nombre o correo').props['onUpdate:modelValue']('no-existe@example.test')
    await ticks()
    assert.match(texto(vista.root), /No hay usuarios que coincidan/)
    campo(vista.root, 'Buscar por nombre o correo').props['onUpdate:modelValue']('')
    campo(vista.root, 'Rol', 'select').props['onUpdate:modelValue']('ejecutivo')
    await ticks()
    assert.match(texto(vista.root), /ejecutivo@example.test/)
    assert.doesNotMatch(texto(vista.root), /supervisor@example.test/)
    campo(vista.root, 'Estado', 'select').props['onUpdate:modelValue']('inactivo')
    await ticks()
    assert.match(texto(vista.root), /No hay usuarios que coincidan/)
    assert.match(texto(vista.root), /Administración real de Supabase/)
    assert.doesNotMatch(texto(vista.root), /Modo de demostración/)
  } finally { vista.unmount() }
})

test('permite crear desde formulario y refleja la acción en el historial sintético', async () => {
  const vista = montar(Component, { actor: admin, servicioInyectado: crearUsuariosAdminService({backend:backendUsuariosPrueba()}) })
  try {
    await ticks()
    boton(vista.root, 'Nuevo usuario').props.onClick()
    await ticks()
    campo(vista.root, 'Nombre').props['onUpdate:modelValue']('Jordan')
    campo(vista.root, 'Apellidos').props['onUpdate:modelValue']('Prueba')
    campo(vista.root, 'Correo electrónico').props['onUpdate:modelValue']('jordan@example.test')
    campo(vista.root, 'Teléfono').props['onUpdate:modelValue']('+52 55 1234 5678')
    campo(vista.root, 'Rol', 'select').props['onUpdate:modelValue']('supervisor')
    campo(vista.root, 'Estado', 'select').props['onUpdate:modelValue'](true)
    buscar(vista.root, node => node.tag === 'form')[0].props.onSubmit({ preventDefault() {} })
    await ticks()
    assert.match(texto(vista.root), /Cuenta y perfil creados en Supabase/)
    assert.equal(buscar(vista.root,n=>n.tag==='table').length,0)
    boton(vista.root,'Volver a usuarios').props.onClick()
    await ticks()
    assert.match(texto(vista.root), /jordan@example.test/)
    boton(vista.root, 'Historial de acciones').props.onClick()
    await ticks()
    assert.match(texto(vista.root), /Ejecutivo → Supervisor/)
    assert.match(texto(vista.root), /Inactivo → Activo/)
  } finally { vista.unmount() }
})

test('deniega actores no administradores aunque se monte la vista directamente', async () => {
  let listados = 0
  const vista = montar(Component, {
    actor: { id: 'supervisor', rol: 'supervisor', activo: true },
    servicioInyectado: { listar: async () => { listados++; return [] } },
  })
  try {
    await ticks()
    assert.match(texto(vista.root), /Acceso denegado/)
    assert.equal(listados, 0)
  } finally { vista.unmount() }
})

test('sin cliente Supabase la vista muestra error y nunca ofrece usuarios de demostracion',async()=>{
  const vista=montar(Component,{actor:admin})
  try{
    await ticks()
    assert.match(texto(vista.root),/Supabase no está configurado/)
    assert.doesNotMatch(texto(vista.root),/admin@example.test|ejecutivo@example.test|Modo de demostración/)
  }finally{vista.unmount()}
})

test('registro separado oculta listado y filtros y permite volver sin escribir',async()=>{
  let volver=0,listados=0
  const vista=montar(Component,{actor:admin,registroNuevo:true,volverListado:()=>volver++,servicioInyectado:{listar:async()=>{listados++;return []}}})
  try{
    await ticks()
    assert.match(texto(vista.root),/Registrar usuario/)
    assert.match(texto(vista.root),/Información personal/)
    assert.match(texto(vista.root),/Acceso y permisos/)
    assert.equal(buscar(vista.root,n=>n.tag==='table').length,0)
    assert.doesNotMatch(texto(vista.root),/Buscar por nombre o correo|Administración real de Supabase/)
    assert.equal(listados,0)
    boton(vista.root,'Volver a usuarios').props.onClick()
    assert.equal(volver,1)
  }finally{vista.unmount()}
})
test('Nuevo usuario solicita navegación al registro independiente',async()=>{
  let abrir=0
  const vista=montar(Component,{actor:admin,abrirRegistro:()=>abrir++,servicioInyectado:{listar:async()=>[]}})
  try{await ticks();boton(vista.root,'Nuevo usuario').props.onClick();await ticks();assert.equal(abrir,1);assert.equal(buscar(vista.root,n=>n.tag==='table').length,0)}finally{vista.unmount()}
})
test('error de invitación conserva formulario y no abandona el registro',async()=>{
  let volver=0,altas=0
  const vista=montar(Component,{actor:admin,registroNuevo:true,volverListado:()=>volver++,servicioInyectado:{crear:async()=>{altas++;throw Error('No se pudo enviar la invitación.')}}})
  try{
    await ticks();campo(vista.root,'Nombre').props['onUpdate:modelValue']('Nombre de prueba')
    await buscar(vista.root,n=>n.tag==='form')[0].props.onSubmit({preventDefault(){}})
    await ticks()
    assert.equal(altas,1);assert.equal(volver,0)
    assert.match(texto(vista.root),/No se pudo enviar la invitación/)
    assert.equal(campo(vista.root,'Nombre').value,'Nombre de prueba')
    assert.equal(buscar(vista.root,n=>n.tag==='table').length,0)
  }finally{vista.unmount()}
})

for(const accion of ['editar','estado','eliminar','historial','recargar'])test(`la vista ${accion} se puede abrir directamente sin mostrar el listado principal ni escribir`,async()=>{
  let escrituras=0
  const backend=backendUsuariosPrueba()
  const vista=montar(Component,{actor:admin,vistaAccion:accion,usuarioId:'ejecutivo-prueba',servicioInyectado:{...backend,crear:()=>escrituras++,editar:()=>escrituras++,cambiarEstado:()=>escrituras++,eliminarDefinitivamente:()=>escrituras++}})
  try{
    await ticks()
    assert.doesNotMatch(texto(vista.root),/Buscar por nombre o correo|Administración real de Supabase/)
    assert.ok(boton(vista.root,'Volver a usuarios'))
    assert.equal(escrituras,0)
    if(accion==='editar'){assert.match(texto(vista.root),/Editar usuario/);assert.ok(campo(vista.root,'Nombre'))}
    if(accion==='estado')assert.ok(boton(vista.root,'Confirmar desactivación'))
    if(accion==='eliminar')assert.ok(campo(vista.root,'Correo de confirmación'))
    if(accion==='historial')assert.match(texto(vista.root),/Historial administrativo/)
    if(accion==='recargar')assert.match(texto(vista.root),/Listado actualizado: 3 usuarios/)
  }finally{vista.unmount()}
})
test('cambio de estado requiere confirmación y muestra resultado separado sin repetir la escritura',async()=>{
  let escrituras=0
  const backend=backendUsuariosPrueba()
  const vista=montar(Component,{actor:admin,vistaAccion:'estado',usuarioId:'ejecutivo-prueba',servicioInyectado:{...backend,cambiarEstado:async()=>escrituras++}})
  try{
    await ticks();assert.equal(escrituras,0)
    await boton(vista.root,'Confirmar desactivación').props.onClick();await ticks()
    assert.equal(escrituras,1);assert.match(texto(vista.root),/Usuario desactivado/)
    assert.equal(buscar(vista.root,n=>n.tag==='table').length,0)
    assert.equal(boton(vista.root,'Confirmar desactivación'),undefined)
  }finally{vista.unmount()}
})
test('edición separada conserva protección de rol y estado propios',async()=>{
  const backend=backendUsuariosPrueba()
  const vista=montar(Component,{actor:admin,vistaAccion:'editar',usuarioId:admin.id,servicioInyectado:backend})
  try{await ticks();assert.equal(campo(vista.root,'Rol','select').props.disabled,true);assert.equal(campo(vista.root,'Estado','select').props.disabled,true)}finally{vista.unmount()}
})
test('usuario inexistente no genera un formulario o registro de demostración',async()=>{
  const vista=montar(Component,{actor:admin,vistaAccion:'editar',usuarioId:'inexistente',servicioInyectado:backendUsuariosPrueba()})
  try{await ticks();assert.match(texto(vista.root),/no existe o no está disponible/);assert.equal(buscar(vista.root,n=>n.tag==='form').length,0)}finally{vista.unmount()}
})
