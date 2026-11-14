import test from 'node:test'
import assert from 'node:assert/strict'
import {nextTick} from 'vue'
import {cargarComponente,montar,buscar,texto} from './helpers/vueHarness.js'
const Component=await cargarComponente('src/views/OportunidadesView.vue')
async function ticks(){await nextTick();await nextTick();await nextTick()}
function boton(root,t){return buscar(root,n=>n.tag==='button'&&texto(n).includes(t))[0]}
test('vista conecta tablero, edición, historial y gestión de etapas con datos de demostración',async()=>{
  const vista=montar(Component,{})
  try{
    await ticks()
    assert.match(texto(vista.root),/Modo de demostración/)
    boton(vista.root,'Cliente de demostración Alfa').props.onClick();await ticks()
    assert.match(texto(vista.root),/Editar oportunidad de demostración/)
    assert.match(texto(vista.root),/Historial de cambios/)
    const form=buscar(vista.root,n=>n.tag==='form')[0]
    const importe=buscar(form,n=>n.tag==='input'&&n.props.inputmode==='decimal')[0]
    importe.props['onUpdate:modelValue']('1234.50');await ticks()
    form.props.onSubmit({preventDefault(){}});await ticks()
    assert.match(texto(vista.root),/Oportunidad de demostración guardada/)
    assert.match(texto(vista.root),/1234.50/)
    boton(vista.root,'Gestionar etapas').props.onClick();await ticks()
    assert.match(texto(vista.root),/Agregar etapa/)
  }finally{vista.unmount()}
})

test('rechazo simulado de Supabase conserva formulario y no muestra confirmacion de guardado',async()=>{
  const {crearDatosDemostracion}=await import('../src/services/oportunidadesService.js')
  const datos=crearDatosDemostracion()
  const servicio={modo:'supabase',permiteGestionEtapas:false,persistencia:'Supabase staging',
    cargar:async()=>structuredClone(datos),obtenerHistorial:async()=>[],
    guardar:async()=>{throw Error('Supabase rechazó la operación: no tienes permisos para este recurso.')}}
  const vista=montar(Component,{servicioInyectado:servicio})
  try{
    await ticks()
    assert.equal(boton(vista.root,'Restablecer demostración'),undefined)
    assert.equal(boton(vista.root,'Gestionar etapas'),undefined)
    boton(vista.root,'Cliente de demostración Alfa').props.onClick();await ticks()
    const form=buscar(vista.root,n=>n.tag==='form')[0]
    form.props.onSubmit({preventDefault(){}});await ticks()
    assert.match(texto(vista.root),/no tienes permisos/)
    assert.equal(texto(vista.root).includes('confirmó el guardado'),false)
    assert.equal(buscar(vista.root,n=>n.tag==='form').length,1)
  }finally{vista.unmount()}
})
