import test from 'node:test'
import assert from 'node:assert/strict'
import { reactive, nextTick } from 'vue'
import { cargarComponente, montar, buscar, texto } from './helpers/vueHarness.js'
const Component=await cargarComponente('src/components/FormularioContacto.vue')
const contacto={id:'c-1',nombre:'Ana Pérez',nombres:'Ana',apellidos:'Pérez',empresa:'Ejemplo',telefono:'+1 202 555 0100',whatsapp:'',
  correo:'ana@example.invalid',mercado:'internacional',pais:'Estados Unidos',estado:'Texas',ciudad:'Austin',fabricanteInteres:'Cessna',
  modeloInteres:'CJ3',presupuesto:1500,moneda:'USD',prioridad:'alta',responsableId:'u-1',notas:'Nota existente'}
async function ticks(){await nextTick();await nextTick()}
function boton(root,contenido){return buscar(root,n=>n.tag==='button'&&texto(n).includes(contenido))[0]}
test('precarga edicion conservando nombre, ubicacion, modelo y responsable; no se detecta a si mismo como duplicado',async()=>{
  const enviados=[];const props=reactive({abierto:false,contacto,prospectos:[contacto],usuarios:[],onGuardar:p=>enviados.push(p)})
  const vista=montar(Component,props)
  try{
    props.abierto=true;await ticks()
    boton(vista.root,'Guardar contacto').props.onClick();await ticks()
    assert.equal(enviados.length,1)
    assert.equal(enviados[0].nombre,'Ana');assert.equal(enviados[0].apellidos,'Pérez')
    assert.equal(enviados[0].estado,'Texas');assert.equal(enviados[0].ciudad,'Austin')
    assert.equal(enviados[0].modeloInteres,'CJ3');assert.equal(enviados[0].usuarioResponsableId,'u-1')
  }finally{vista.unmount()}
})
test('error de guardado conserva datos y bloquea guardar/cerrar mientras espera',async()=>{
  let enviados=0,cierres=0
  const props=reactive({abierto:false,contacto,prospectos:[contacto],usuarios:[],guardando:false,error:'',onGuardar:()=>enviados++,onCerrar:()=>cierres++})
  const vista=montar(Component,props)
  try{
    props.abierto=true;await ticks()
    const nombre=buscar(vista.root,n=>n.tag==='input'&&n.props['onUpdate:modelValue'])[0]
    nombre.props['onUpdate:modelValue']('Ana editada')
    props.guardando=true;await ticks()
    boton(vista.root,'Guardando').props.onClick();boton(vista.root,'Cancelar').props.onClick()
    assert.equal(enviados,0);assert.equal(cierres,0)
    props.guardando=false;props.error='No tienes permisos para realizar esta acción.';await ticks()
    assert.ok(texto(vista.root).includes(props.error))
    assert.equal(nombre.props['onUpdate:modelValue'] instanceof Function,true)
    const entrada=buscar(vista.root,n=>n.tag==='input')[0]
    assert.equal(entrada.value,'Ana editada')
  }finally{vista.unmount()}
})
