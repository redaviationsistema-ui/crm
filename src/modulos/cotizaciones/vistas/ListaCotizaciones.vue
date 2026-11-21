<script setup>
import EncabezadoPagina from '../../../compartido/componentes/EncabezadoPagina.vue'
import {computed,onMounted,reactive,ref,toRaw} from 'vue'
import FormularioCotizacion from '../componentes/FormularioCotizacion.vue'
import VistaPreviaCotizacion from '../componentes/VistaPreviaCotizacion.vue'
import {crearCotizacionesNavegador} from '../servicios/servicioCotizaciones.js'
import {crearDescargadorPdf} from '../utilidades/cotizacionPdf.js'
import {ESTADOS_COTIZACION} from '../dominio/cotizaciones.js'
const props=defineProps({servicioInyectado:{type:Object,default:null},descargadorInyectado:{type:Object,default:null},obtenerClienteSupabase:{type:Function,default:null}})
const servicio=props.servicioInyectado || crearCotizacionesNavegador({obtenerCliente:props.obtenerClienteSupabase})
const modoDemostracion=servicio.modo==='demostracion'
const modoPersistido=servicio.modo==='supabase'
const permiteOperar=modoDemostracion || servicio.modo==='supabase'
const descargador=props.descargadorInyectado || crearDescargadorPdf({modoDemostracion})
const generandoPdf=ref(false)
const datos=ref({cotizaciones:[],oportunidades:[]}),formulario=ref(null),previa=ref(null),previaGuardada=ref(false)
const guardando=ref(false),cargando=ref(true),error=ref(''),mensaje=ref(''),confirmarReset=ref(false)
const confirmacionPendiente=ref(false)
const filtros=reactive({busqueda:'',estado:'',moneda:''})
const estadosVisibles=computed(()=>modoPersistido?['borrador','enviada','aceptada','rechazada','vencida','cancelada']:ESTADOS_COTIZACION)
const visibles=computed(()=>datos.value.cotizaciones.filter(c=>(!filtros.estado||c.estado===filtros.estado)&&(!filtros.moneda||c.moneda===filtros.moneda)&&[c.folio,c.titulo,c.clienteNombre,c.oportunidadTitulo].join(' ').toLocaleLowerCase('es').includes(filtros.busqueda.trim().toLocaleLowerCase('es'))))
async function cargar(){if(!permiteOperar)return false;cargando.value=true;try{datos.value=await servicio.cargar();error.value='';return true}catch(e){error.value=e.message;return false}finally{cargando.value=false}}
onMounted(()=>{if(permiteOperar)cargar();else cargando.value=false})
function nueva(){
  error.value='';mensaje.value='';previa.value=null
  const fecha=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Mexico_City',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date())
  formulario.value={titulo:'',descripcion:'',prospectoId:'',oportunidadId:'',moneda:'USD',estado:'borrador',fecha,validaHasta:'',notas:'',conceptos:[{descripcion:'',cantidad:'1',precioUnitario:''}]}
}
function editar(cotizacion){if(guardando.value)return;error.value='';mensaje.value='';previa.value=null;formulario.value=structuredClone(toRaw(cotizacion))}
function previsualizar(modelo,guardada=false){
  const oportunidad=datos.value.oportunidades.find(o=>o.id===modelo.oportunidadId)
  previa.value={...modelo,clienteNombre:guardada?modelo.clienteNombre:oportunidad?.clienteNombre || '',empresaNombre:guardada?modelo.empresaNombre:oportunidad?.empresaNombre || '',oportunidadTitulo:guardada?modelo.oportunidadTitulo:oportunidad?.titulo || '',conceptos:modelo.conceptos.map(c=>({...c}))}
  previaGuardada.value=guardada
}
async function guardar(modelo){
  if(guardando.value||confirmacionPendiente.value)return
  guardando.value=true;error.value='';mensaje.value=''
  try{
    const registro=await servicio.guardar(modelo)
    datos.value.cotizaciones=[registro,...datos.value.cotizaciones.filter(c=>c.id!==registro.id)]
    formulario.value=null;previsualizar(registro,true)
    mensaje.value=modoPersistido?'Cotización guardada correctamente.':`Cotización de demostración guardada en ${servicio.persistencia}.`
    if(!await cargar())mensaje.value+=' No se pudo recargar la lista; no repitas el guardado.'
  }catch(e){error.value=e.message;if(e.confirmacionPendiente)confirmacionPendiente.value=true}finally{guardando.value=false}
}
async function descargarPdf(cotizacion){
  if(generandoPdf.value)return
  generandoPdf.value=true;error.value='';mensaje.value=''
  try{
    const resultado=await descargador.ejecutar(structuredClone(toRaw(cotizacion)))
    if(resultado.estado==='descargado')mensaje.value='Descarga del PDF iniciada.'
  }catch(e){error.value=e.message || 'No se pudo descargar el PDF. Inténtalo de nuevo.'}
  finally{generandoPdf.value=false}
}
async function restablecer(){
  if(guardando.value)return
  guardando.value=true;error.value='';mensaje.value=''
  try{await servicio.restablecer();formulario.value=null;previa.value=null;confirmarReset.value=false;await cargar();mensaje.value='Cotizaciones de demostración restablecidas.'}catch(e){error.value=e.message}finally{guardando.value=false}
}
</script>
<template>
  <section class="cotizaciones">
    <EncabezadoPagina titulo="Cotizaciones comerciales" :descripcion="visibles.length + (modoDemostracion ? ' cotizaciones de demostración' : ' cotizaciones')">
      <template v-if="permiteOperar || modoDemostracion" #acciones>
        <button v-if="permiteOperar" :disabled="cargando||guardando||!!formulario||!datos.oportunidades.length" class="accion-principal" @click="nueva">+ Nueva cotización</button>
        <button v-if="modoDemostracion" :disabled="guardando" @click="confirmarReset=!confirmarReset">Restablecer cotizaciones de demostración</button>
        <button v-if="permiteOperar" :disabled="guardando||cargando" @click="cargar">Recargar</button>
      </template>
    </EncabezadoPagina>
    <div v-if="modoDemostracion" class="aviso" role="note"><strong>Cotizaciones de demostración: copia local</strong><p>Solo se asocian a oportunidades de demostración. Se guardan en {{ servicio.persistencia }}; no se envían a Supabase ni a clientes.</p></div>
    <div v-else-if="servicio.modo==='supabase'" class="aviso" role="status"><strong>Cotizaciones persistidas en Supabase</strong><p>Las escrituras dependen de la autorización del backend y las políticas RLS.</p></div>
    <div v-else class="aviso" role="status"><strong>Persistencia real de cotizaciones bloqueada</strong><p>{{ servicio.backendBloqueado }}</p><p>No se muestran datos de demostración ni se realizan llamadas de escritura.</p></div>
    <p v-if="error" role="alert">{{ error }}</p><p v-if="mensaje" role="status">{{ mensaje }}</p><p v-if="cargando">Cargando cotizaciones…</p>
    <div v-if="confirmarReset&&modoDemostracion" class="aviso"><p>Se borrarán solo las cotizaciones de demostración de esta sesión; las oportunidades se conservarán.</p><button :disabled="guardando" @click="restablecer">Confirmar restablecimiento</button><button @click="confirmarReset=false">Cancelar</button></div>
    <FormularioCotizacion v-if="formulario" :key="formulario.id||'nueva'" :inicial="formulario" :oportunidades="datos.oportunidades" :guardando="guardando" :error="error" :modo-demostracion="modoDemostracion" :modo-persistido="modoPersistido" :bloqueado-por-confirmacion="confirmacionPendiente" @guardar="guardar" @previsualizar="previsualizar" @cancelar="formulario=null;error=''" />
    <div v-if="permiteOperar" class="filtros"><label>Buscar folio, título o cliente <input v-model="filtros.busqueda" type="search" /></label><label>Estado <select v-model="filtros.estado"><option value="">Todos</option><option v-for="e in estadosVisibles" :key="e">{{ e }}</option></select></label><label>Moneda <select v-model="filtros.moneda"><option value="">Todas</option><option>USD</option><option>MXN</option><option>EUR</option></select></label></div>
    <p v-if="permiteOperar&&!cargando&&!visibles.length">No hay cotizaciones con estos filtros. {{ modoDemostracion ? 'Crea una propuesta de demostración para comenzar.' : 'Crea una cotización vinculada a una oportunidad real.' }}</p>
    <div v-if="visibles.length" class="tabla" role="region" tabindex="0" aria-label="Tabla de cotizaciones"><table><thead><tr><th>Folio</th><th>Cotización</th><th>Cliente / oportunidad</th><th>Estado</th><th>Total</th><th>Acciones</th></tr></thead><tbody><tr v-for="c in visibles" :key="c.id"><td>{{ c.folio }}</td><td>{{ c.titulo }}</td><td>{{ c.clienteNombre }} / {{ c.oportunidadTitulo }}</td><td>{{ c.estado }}</td><td>{{ c.total }} {{ c.moneda }}</td><td><button :disabled="guardando" @click="previsualizar(c,true)">Ver propuesta</button><button :disabled="guardando||generandoPdf" @click="descargarPdf(c)">{{ generandoPdf ? 'Generando PDF…' : 'Descargar PDF' }}</button><button v-if="modoDemostracion ? ['borrador','preparada'].includes(c.estado) : c.estado==='borrador'" :disabled="guardando||!!formulario" @click="editar(c)">Editar</button></td></tr></tbody></table></div>
    <VistaPreviaCotizacion v-if="previa" :cotizacion="previa" :guardada="previaGuardada" :generando="generandoPdf" :modo-demostracion="modoDemostracion" @descargar="descargarPdf" />
  </section>
</template>
<style scoped>
.cotizaciones{display:grid;gap:var(--espacio-panel);color:#152d4d}.aviso{padding:var(--espacio-panel);background:var(--color-fondo-alerta);border:1px solid #e5c574;border-radius:12px}h1,p{margin:.3rem 0}.filtros{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:1rem}label{display:grid;gap:.4rem}input,select{min-height:var(--altura-control);padding:4px 8px;border:1px solid #b4c8e0;border-radius:8px}button{min-height:var(--altura-control);padding:4px 8px;margin:.2rem;border:1px solid #b2c8e6;background:#f2f6fc;border-radius:8px;cursor:pointer}button:disabled{opacity:.5;cursor:wait}.tabla{overflow:auto}table{width:100%;border-collapse:collapse;background:white}th,td{text-align:left;height:var(--altura-fila);padding:5px 8px;border-bottom:1px solid #d9e3ef}[role=alert]{color:#a42121}
.accion-principal { background: var(--color-accion); color: white; border-color: var(--color-accion); }
</style>
