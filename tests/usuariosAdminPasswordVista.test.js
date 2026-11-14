import test from 'node:test'
import assert from 'node:assert/strict'
import {nextTick} from 'vue'
import {cargarComponente,montar,buscar,texto} from './helpers/vueHarness.js'
const Component=await cargarComponente('src/views/UsuariosAdminView.vue')
const actor={id:'admin',rol:'administrador',activo:true}
const usuario={id:'destino',nombre:'Prueba',apellidos:'Staging',correo:'prueba@example.test',telefono:'',rol:'ejecutivo',activo:true}
const campo=(root,label,tag='input')=>buscar(buscar(root,n=>n.tag==='label'&&texto(n).trim().startsWith(label))[0],n=>n.tag===tag)[0]
const boton=(root,label)=>buscar(root,n=>n.tag==='button'&&(texto(n).trim()===label||n.props['aria-label']===label))[0]
const botonGenerar=root=>buscar(root,n=>n.tag==='button'&&['Generar contraseña','Generar otra contraseña'].includes(texto(n).trim()))[0]
async function ticks(){for(let i=0;i<12;i++)await nextTick()}
const editar=servicio=>montar(Component,{actor,vistaAccion:'editar',usuarioId:usuario.id,passwordWritesEnabled:true,passwordWritesAuthenticated:true,servicioInyectado:{listar:async()=>[usuario],...servicio}})
const nuevo=servicio=>montar(Component,{actor,registroNuevo:true,servicioInyectado:{listar:async()=>[usuario],...servicio}})
const submit=v=>buscar(v.root,n=>n.tag==='form')[0].props.onSubmit({preventDefault(){}})
async function prepararPassword(v){campo(v.root,'Cambiar contraseña').props['onUpdate:modelValue'](true);await ticks();botonGenerar(v.root).props.onClick();await ticks()}
async function confirmar(v){campo(v.root,'Confirmo que deseo reemplazar').props['onUpdate:modelValue'](true);await ticks()}
test('registro requiere elegir creación directa; genera oculta y solo copia/muestra por acción expresa',async()=>{
  const anterior=Object.getOwnPropertyDescriptor(globalThis,'navigator');let copias=0
  Object.defineProperty(globalThis,'navigator',{configurable:true,value:{clipboard:{writeText:async()=>copias++}}})
  const v=nuevo({})
  try{
    await ticks();assert.equal(boton(v.root,'Generar contraseña').props.disabled,true)
    campo(v.root,'Método de registro','select').props['onUpdate:modelValue']('password');await ticks()
    boton(v.root,'Generar contraseña').props.onClick();await ticks()
    const p=campo(v.root,'Contraseña'),c=campo(v.root,'Confirmar contraseña')
    assert.ok(p.value.length>=16&&p.value.length<=20);assert.equal(p.value,c.value);assert.equal(p.props.type,'password');assert.equal(copias,0)
    boton(v.root,'Mostrar contraseña').props.onClick();await ticks();assert.equal(p.props.type,'text')
    await boton(v.root,'Copiar contraseña').props.onClick();assert.equal(copias,1)
    boton(v.root,'Generar otra contraseña').props.onClick();await ticks();assert.equal(p.props.type,'password');assert.equal(copias,1)
    boton(v.root,'Cancelar').props.onClick();await ticks();assert.equal(p.value,'');assert.equal(c.value,'')
  }finally{v.unmount();if(anterior)Object.defineProperty(globalThis,'navigator',anterior);else delete globalThis.navigator}
})
test('editar nunca infiere ni muestra contraseña actual y Guardar datos ignora campos de contraseña',async()=>{
  const perfiles=[],passwords=[]
  const v=editar({editar:async(...a)=>perfiles.push(a),cambiarPassword:async(...a)=>passwords.push(a)})
  try{
    await ticks();assert.match(texto(v.root),/Contraseña actual no visible/)
    assert.equal(campo(v.root,'Nueva contraseña').value,'');assert.equal(campo(v.root,'Confirmar nueva contraseña').value,'')
    await prepararPassword(v)
    await submit(v);await ticks()
    assert.equal(perfiles.length,1);assert.equal(perfiles[0].length,3);assert.deepEqual(perfiles[0][2],{nombre:usuario.nombre,apellidos:usuario.apellidos,correo:usuario.correo,telefono:'',rol:'ejecutivo',activo:true})
    assert.equal(passwords.length,0);assert.match(texto(v.root),/Datos del perfil guardados/)
    assert.notEqual(campo(v.root,'Nueva contraseña').value,'')
    assert.notEqual(campo(v.root,'Confirmar nueva contraseña').value,'')
  }finally{v.unmount()}
})
test('prepara contraseña aunque el guardado real esté bloqueado; perfil sigue independiente',async()=>{
  const anterior=Object.getOwnPropertyDescriptor(globalThis,'navigator');let copias=0,perfiles=0,passwords=0
  Object.defineProperty(globalThis,'navigator',{configurable:true,value:{clipboard:{writeText:async()=>copias++}}})
  const v=montar(Component,{actor,vistaAccion:'editar',usuarioId:usuario.id,passwordWritesEnabled:false,passwordWritesAuthenticated:true,
    passwordWritesRequirements:['Falta VITE_CRM_ADMIN_PASSWORD_PRODUCTION_ENABLED=true.'],
    servicioInyectado:{
    listar:async()=>[usuario],editar:async()=>perfiles++,cambiarPassword:async()=>passwords++,
  }})
  try{
    await ticks()
    campo(v.root,'Cambiar contraseña').props['onUpdate:modelValue'](true);await ticks()
    assert.equal(campo(v.root,'Nueva contraseña').props.disabled,false)
    assert.equal(boton(v.root,'Generar contraseña').props.disabled,false)
    boton(v.root,'Generar contraseña').props.onClick();await ticks()
    const p=campo(v.root,'Nueva contraseña')
    assert.ok(p.value.length>=12)
    boton(v.root,'Mostrar contraseña').props.onClick();await ticks();assert.equal(p.props.type,'text')
    await boton(v.root,'Copiar nueva contraseña').props.onClick()
    assert.equal(copias,1)
    assert.equal(boton(v.root,'Actualizar contraseña').props.disabled,true)
    assert.match(texto(v.root),/Requisitos pendientes para habilitar Actualizar contraseña/)
    assert.match(texto(v.root),/VITE_CRM_ADMIN_PASSWORD_PRODUCTION_ENABLED=true/)
    await boton(v.root,'Actualizar contraseña').props.onClick();assert.equal(passwords,0)
    await submit(v);await ticks()
    assert.equal(perfiles,1);assert.equal(passwords,0)
    assert.match(texto(v.root),/Datos del perfil guardados/)
  }finally{v.unmount();if(anterior)Object.defineProperty(globalThis,'navigator',anterior);else delete globalThis.navigator}
})
test('sesión no autenticada mantiene Actualizar contraseña bloqueado y no invoca el servicio',async()=>{
  let calls=0
  const v=montar(Component,{actor,vistaAccion:'editar',usuarioId:usuario.id,passwordWritesEnabled:true,passwordWritesAuthenticated:false,
    servicioInyectado:{listar:async()=>[usuario],cambiarPassword:async()=>calls++}})
  try{
    await ticks();await prepararPassword(v);await confirmar(v)
    assert.equal(boton(v.root,'Actualizar contraseña').props.disabled,true)
    await boton(v.root,'Actualizar contraseña').props.onClick()
    assert.equal(calls,0)
  }finally{v.unmount()}
})
test('Actualizar contraseña es independiente, exige confirmación y no transmite confirmacion ni guarda perfil',async()=>{
  let perfiles=0;const passwords=[]
  const v=editar({editar:async()=>perfiles++,cambiarPassword:async(...a)=>{passwords.push(a);return {usuarioId:usuario.id,contrasenaActualizada:true}}})
  try{
    await ticks();await prepararPassword(v)
    await boton(v.root,'Actualizar contraseña').props.onClick();await ticks()
    assert.equal(passwords.length,0);assert.match(texto(v.root),/Confirma el reemplazo/)
    await confirmar(v)
    const p=campo(v.root,'Nueva contraseña'),c=campo(v.root,'Confirmar nueva contraseña'),valor=p.value
    await boton(v.root,'Actualizar contraseña').props.onClick();await ticks()
    assert.deepEqual(passwords,[[actor,usuario.id,valor]]);assert.equal(perfiles,0)
    assert.match(texto(v.root),/Contraseña actualizada correctamente en Supabase Auth/)
    assert.equal(p.value,'');assert.equal(c.value,'')
    assert.equal(p.props.disabled,true)
    assert.equal(texto(v.root).includes(valor),false)
  }finally{v.unmount()}
})
test('respuesta rechazada muestra error y conserva los campos hasta una confirmación',async()=>{
  let calls=0
  const v=editar({cambiarPassword:async()=>{calls++;throw Object.assign(Error('Rechazada'),{status:400,tipoResultado:'rechazado'})}})
  try{
    await ticks();await prepararPassword(v);await confirmar(v)
    const p=campo(v.root,'Nueva contraseña'),c=campo(v.root,'Confirmar nueva contraseña'),valor=p.value
    await boton(v.root,'Actualizar contraseña').props.onClick();await ticks()
    assert.equal(calls,1)
    assert.equal(p.value,valor);assert.equal(c.value,valor)
    assert.match(texto(v.root),/Supabase Auth rechazó la contraseña/)
    assert.doesNotMatch(texto(v.root),/Contraseña actualizada correctamente/)
    assert.equal(boton(v.root,'Actualizar contraseña').props.disabled,false)
  }finally{v.unmount()}
})
test('perfil guardado y contraseña rechazada se informan por separado',async()=>{
  const v=editar({editar:async()=>({id:'destino'}),cambiarPassword:async()=>{throw Object.assign(Error('secreto-no-visible'),{status:503})}})
  try{
    await ticks();await submit(v);await ticks();await prepararPassword(v);await confirmar(v)
    await boton(v.root,'Actualizar contraseña').props.onClick();await ticks()
    assert.match(texto(v.root),/Datos del perfil guardados/);    assert.match(texto(v.root),/Operaciones de contraseña bloqueadas o no disponibles/)
    assert.doesNotMatch(texto(v.root),/Contraseña actualizada|secreto-no-visible/)
    assert.notEqual(campo(v.root,'Nueva contraseña').value,'')
    assert.notEqual(campo(v.root,'Confirmar nueva contraseña').value,'')
  }finally{v.unmount()}
})
test('alta elige una única operación sin usar ambas vías',async()=>{
  for(const directo of [false,true]){
    const invitaciones=[],directas=[]
    const v=nuevo({crear:async(...a)=>invitaciones.push(a),crearConPassword:async(...a)=>directas.push(a)})
    try{
      await ticks()
      if(directo){campo(v.root,'Método de registro','select').props['onUpdate:modelValue']('password');await ticks();boton(v.root,'Generar contraseña').props.onClick();await ticks()}
      await submit(v);await ticks()
      assert.equal(invitaciones.length,directo?0:1);assert.equal(directas.length,directo?1:0)
      if(directo){assert.equal(directas[0].length,3);assert.match(texto(v.root),/Correo confirmado administrativamente/)}
      else assert.equal(invitaciones[0].length,2)
    }finally{v.unmount()}
  }
})
test('regenerar invalida confirmación y un envío pendiente bloquea doble clic y guardado de datos',async()=>{
  let resolver,calls=0,perfiles=0
  const v=editar({cambiarPassword:()=>{calls++;return new Promise(r=>resolver=r)},editar:async()=>perfiles++})
  try{
    await ticks();await prepararPassword(v);await confirmar(v)
    boton(v.root,'Generar otra contraseña').props.onClick();await ticks()
    await boton(v.root,'Actualizar contraseña').props.onClick();assert.equal(calls,0)
    await confirmar(v);const button=boton(v.root,'Actualizar contraseña');const pending=button.props.onClick();await ticks()
    await button.props.onClick();await submit(v);assert.equal(calls,1);assert.equal(perfiles,0)
    resolver({usuarioId:usuario.id,contrasenaActualizada:true});await pending;await ticks()
    assert.equal(campo(v.root,'Nueva contraseña').value,'')
    assert.equal(campo(v.root,'Nueva contraseña').props.disabled,true)
  }finally{v.unmount()}
})
test('rechazos conservan los campos y el límite local impide un cuarto intento',async()=>{
  let calls=0
  const v=editar({cambiarPassword:async()=>{calls++;throw Object.assign(Error('Rechazada'),{status:400,tipoResultado:'rechazado'})}})
  try{
    await ticks()
    for(let i=0;i<4;i++){await prepararPassword(v);await confirmar(v);await boton(v.root,'Actualizar contraseña').props.onClick();await ticks()}
    assert.equal(calls,3);assert.match(texto(v.root),/Límite de intentos/)
    assert.notEqual(campo(v.root,'Nueva contraseña').value,'')
  }finally{v.unmount()}
})
test('resultado incierto conserva campos, bloquea el reenvío y exige revisión de Auth',async()=>{
  let calls=0
  const v=editar({cambiarPassword:async()=>{calls++;throw Object.assign(Error('no mostrar'),{tipoResultado:'incierto',requiereRevision:true})}})
  try{
    await ticks();await prepararPassword(v);await confirmar(v)
    const p=campo(v.root,'Nueva contraseña'),c=campo(v.root,'Confirmar nueva contraseña')
    const valor=p.value
    await boton(v.root,'Actualizar contraseña').props.onClick();await ticks()
    assert.equal(calls,1)
    assert.equal(p.value,valor)
    assert.equal(c.value,valor)
    assert.match(texto(v.root),/Resultado incierto: no se reenviará/)
    assert.equal(boton(v.root,'Actualizar contraseña').props.disabled,true)
    await boton(v.root,'Actualizar contraseña').props.onClick()
    assert.equal(calls,1)
  }finally{v.unmount()}
})
test('respuesta positiva para otro usuario nunca se muestra como éxito',async()=>{
  let calls=0
  const v=editar({cambiarPassword:async()=>{calls++;return {usuarioId:'otro',contrasenaActualizada:true}}})
  try{
    await ticks();await prepararPassword(v);await confirmar(v)
    const valor=campo(v.root,'Nueva contraseña').value
    await boton(v.root,'Actualizar contraseña').props.onClick();await ticks()
    assert.equal(calls,1)
    assert.equal(campo(v.root,'Nueva contraseña').value,valor)
    assert.match(texto(v.root),/Resultado incierto/)
    assert.doesNotMatch(texto(v.root),/Contraseña actualizada correctamente/)
    assert.equal(boton(v.root,'Actualizar contraseña').props.disabled,true)
  }finally{v.unmount()}
})
