import test from 'node:test'
import assert from 'node:assert/strict'
import {nextTick} from 'vue'
import {cargarComponente,montar,buscar,texto} from './helpers/vueHarness.js'
const Component=await cargarComponente('src/views/CotizacionesView.vue')
async function ticks(){for(let i=0;i<6;i++)await nextTick()}
function boton(root,t){return buscar(root,n=>n.tag==='button'&&texto(n).includes(t))[0]}
function campo(root,t,tag='input'){const label=buscar(root,n=>n.tag==='label'&&texto(n).includes(t))[0];return buscar(label,n=>n.tag===tag)[0]}
async function llenar(root){
  campo(root,'Título').props['onUpdate:modelValue']('Oferta de demostración')
  campo(root,'Oportunidad de demostración','select').props['onUpdate:modelValue']('demo-oportunidad-1')
  campo(root,'Descripción').props['onUpdate:modelValue']('Inspección')
  campo(root,'Cantidad').props['onUpdate:modelValue']('3')
  campo(root,'Precio unitario').props['onUpdate:modelValue']('0.10')
  await ticks()
}
test('la demostración inyectada conecta formulario, oportunidad, vista previa y guardado local',async()=>{
  const {crearCotizacionesDemostracionService}=await import('../src/services/cotizacionesService.js')
  const vista=montar(Component,{servicioInyectado:crearCotizacionesDemostracionService()})
  try{
    await ticks();boton(vista.root,'Nueva cotización').props.onClick();await ticks();await llenar(vista.root)
    boton(vista.root,'Vista previa').props.onClick();await ticks()
    assert.match(texto(vista.root),/Vista previa sin guardar/)
    assert.match(texto(vista.root),/Empresa de demostración Alfa/)
    assert.match(texto(vista.root),/Total: 0.30 USD/)
    assert.equal(buscar(vista.root,n=>n.tag==='form').length,1)
    buscar(vista.root,n=>n.tag==='form')[0].props.onSubmit({preventDefault(){}});await ticks()
    assert.match(texto(vista.root),/Cotización de demostración guardada/)
    assert.match(texto(vista.root),/DEMO-COT-0001/)
    assert.equal(buscar(vista.root,n=>n.tag==='form').length,0)
  }finally{vista.unmount()}
})
test('error de guardado mantiene conceptos y no muestra confirmacion falsa',async()=>{
  const {crearCotizacionesDemostracionService}=await import('../src/services/cotizacionesService.js')
  const servicio=crearCotizacionesDemostracionService()
  servicio.guardar=async()=>{throw Error('Almacenamiento bloqueado')}
  const vista=montar(Component,{servicioInyectado:servicio})
  try{
    await ticks();boton(vista.root,'Nueva cotización').props.onClick();await ticks();await llenar(vista.root)
    buscar(vista.root,n=>n.tag==='form')[0].props.onSubmit({preventDefault(){}});await ticks()
    assert.match(texto(vista.root),/Almacenamiento bloqueado/)
    assert.equal(campo(vista.root,'Precio unitario').value,'0.10')
    assert.equal(texto(vista.root).includes('Cotización de demostración guardada'),false)
  }finally{vista.unmount()}
})
test('el módulo normal muestra el bloqueo y no ofrece crear ni restablecer datos de demostración',async()=>{
  const vista=montar(Component,{})
  try{
    await ticks()
    assert.match(texto(vista.root),/Persistencia real de cotizaciones bloqueada/)
    assert.match(texto(vista.root),/No se muestran datos de demostración/)
    assert.equal(buscar(vista.root,n=>n.tag==='form').length,0)
    assert.equal(buscar(vista.root,n=>n.tag==='button'&&texto(n).includes('Nueva cotización')).length,0)
    assert.equal(texto(vista.root).includes('DEMO-COT'),false)
  }finally{vista.unmount()}
})

test('resultado incierto mantiene el formulario y bloquea reenvíos',async()=>{
  let llamadas=0
  const oportunidadId='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
  const servicio={
    modo:'supabase',
    persistencia:'Supabase staging',
    concurrenciaDisponible:false,
    cargar:async()=>({cotizaciones:[],oportunidades:[{id:oportunidadId,titulo:'Oportunidad real',clienteId:'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',clienteNombre:'Prospecto real',moneda:'USD'}]}),
    guardar:async()=>{llamadas++;const error=Error('No se confirmó la lectura posterior');error.confirmacionPendiente=true;throw error},
    restablecer:async()=>{throw Error('No disponible')},
  }
  const vista=montar(Component,{servicioInyectado:servicio})
  try{
    await ticks();boton(vista.root,'Nueva cotización').props.onClick();await ticks()
    campo(vista.root,'Título').props['onUpdate:modelValue']('Propuesta real')
    campo(vista.root,'Oportunidad','select').props['onUpdate:modelValue'](oportunidadId)
    campo(vista.root,'Descripción','textarea').props['onUpdate:modelValue']('Descripción')
    const camposDescripcion=buscar(vista.root,n=>n.tag==='label'&&texto(n).includes('Descripción'))
    buscar(camposDescripcion.at(-1),n=>n.tag==='input')[0].props['onUpdate:modelValue']('Inspección')
    campo(vista.root,'Cantidad').props['onUpdate:modelValue']('1')
    campo(vista.root,'Precio unitario').props['onUpdate:modelValue']('10.00')
    await ticks()
    const form=buscar(vista.root,n=>n.tag==='form')[0]
    form.props.onSubmit({preventDefault(){}})
    await ticks()
    assert.equal(llamadas,1)
    assert.match(texto(vista.root),/No reenvíes esta cotización/)
    const guardar=boton(vista.root,'Guardar cotización')
    assert.equal(guardar.props.disabled,true)
    form.props.onSubmit({preventDefault(){}})
    await ticks()
    assert.equal(llamadas,1)
  }finally{vista.unmount()}
})
