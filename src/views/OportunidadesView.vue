<script setup>
import { computed, onMounted, reactive, ref, toRaw } from 'vue'
import FormularioOportunidad from '@/components/oportunidades/FormularioOportunidad.vue'
import PipelineBoard from '@/components/oportunidades/PipelineBoard.vue'
import { crearServicioOportunidadesNavegador, filtrarOportunidades } from '@/services/oportunidadesService'
import { SERVICIOS } from '@/domain/oportunidades'
const props = defineProps({ servicioInyectado: { type: Object, default: null }, obtenerClienteSupabase: { type: Function, default: null } })
const servicio = props.servicioInyectado || crearServicioOportunidadesNavegador({obtenerCliente:props.obtenerClienteSupabase})
const esSupabase = servicio.modo === 'supabase'
let solicitudHistorial = 0
const datos = ref({ clientes: [], empresas: [], responsables: [], embudos: [], etapas: [], oportunidades: [] })
const error = ref(''), mensaje = ref(''), cargando = ref(true), guardando = ref(false)
const formulario = ref(null), seleccionadoId = ref(''), gestionEtapas = ref(false), confirmarReset = ref(false)
const etapa = reactive({ id: '', nombre: '', embudoId: 'demo-comercial', estado: 'abierta', orden: 0 })
const filtros = reactive({ embudoId: '', busqueda: '', responsableId: '', servicio: '', estado: '', etapaId: '', moneda: '', prioridad: '' })
const etapas = computed(() => [...datos.value.etapas].sort((a,b) => a.orden - b.orden || a.nombre.localeCompare(b.nombre)))
const embudosTablero = computed(() => {
  const catalogo = [...datos.value.embudos]
  for (const oportunidad of datos.value.oportunidades) {
    if (!catalogo.some(e => e.id === oportunidad.embudoId)) catalogo.push({id:oportunidad.embudoId,nombre:'Embudo no activo o no disponible',activo:false})
  }
  return catalogo
})
function etapasEmbudo(id) {
  const catalogo = etapas.value.filter(e => e.embudoId === id)
  for (const oportunidad of datos.value.oportunidades.filter(o => o.embudoId === id)) {
    if (!catalogo.some(e => e.id === oportunidad.etapaId)) catalogo.push({id:oportunidad.etapaId,embudoId:id,nombre:'Etapa no disponible',activo:false})
  }
  return catalogo
}
const estadosFiltro = computed(() => esSupabase ? [...new Set(datos.value.oportunidades.map(o => o.estado))] : ['abierta','ganada','perdida'])
const visibles = computed(() => filtrarOportunidades(datos.value, filtros))
const seleccionado = computed(() => datos.value.oportunidades.find(o => o.id === seleccionadoId.value))
function limpiarSesion(errorSesion) {
  if (!errorSesion.sesionInvalida) return
  datos.value = { clientes: [], empresas: [], responsables: [], embudos: [], etapas: [], oportunidades: [] }
  formulario.value = null; seleccionadoId.value = ''; solicitudHistorial++
}
async function cargar() {
  cargando.value = true
  try { datos.value = await servicio.cargar(); error.value = ''; return true }
  catch (e) { limpiarSesion(e); error.value = e.message; return false }
  finally { cargando.value = false }
}
onMounted(cargar)
function nueva() {
  error.value = ''; mensaje.value = ''
  const embudo = datos.value.embudos.find(e => e.id === filtros.embudoId) || datos.value.embudos[0]
  formulario.value = { titulo: '', descripcion: '', clienteId: '', empresaId: '', responsableId: '', servicio: embudo?.servicio || '', embudoId: embudo?.id || '',
    etapaId: etapas.value.find(e => e.embudoId === embudo?.id && (esSupabase ? e.activo !== false : e.estado === 'abierta'))?.id || '', estado: 'abierta', moneda: 'USD', prioridad: 'media',
    valorEstimado: '', proximoSeguimiento: new Date(Date.now()+86400000).toISOString(), motivoPerdida: '' }
}
async function editar(id) {
  const registro = datos.value.oportunidades.find(o => o.id === id)
  if (!registro) return
  error.value = ''; mensaje.value = ''; seleccionadoId.value = id
  formulario.value = structuredClone(toRaw(registro))
  await cargarHistorial(id)
}
async function cargarHistorial(id) {
  const solicitud = ++solicitudHistorial
  try {
    const historial = await servicio.obtenerHistorial(id)
    if (solicitud === solicitudHistorial && seleccionadoId.value === id) {
      const registro = datos.value.oportunidades.find(o => o.id === id)
      if (registro) registro.historial = historial
    }
  } catch(e) { if (solicitud === solicitudHistorial) { limpiarSesion(e); error.value = e.message } }
}
async function guardar(modelo) {
  if (guardando.value) return
  guardando.value = true; error.value = ''; mensaje.value = ''
  try {
    const registro = await servicio.guardar(modelo)
    seleccionadoId.value = registro.id; formulario.value = null
    const indice = datos.value.oportunidades.findIndex(o => o.id === registro.id)
    if (indice < 0) datos.value.oportunidades.push(registro)
    else datos.value.oportunidades.splice(indice,1,registro)
    mensaje.value = esSupabase ? 'Supabase confirmó el guardado.' : `Oportunidad de demostración guardada en ${servicio.persistencia}.`
    const recargada = await cargar()
    if (!recargada) mensaje.value += ' La recarga falló; no repitas el guardado.'
    if (recargada) await cargarHistorial(registro.id)
  } catch(e) { limpiarSesion(e); mensaje.value = ''; error.value = e.message; if(e.confirmacionPendiente) { formulario.value = null; if(e.registroId) seleccionadoId.value = e.registroId } }
  finally { guardando.value = false }
}
async function guardarEtapa() {
  if (guardando.value) return
  guardando.value = true; error.value = ''; mensaje.value = ''
  try {
    await servicio.guardarEtapa({ ...etapa }); await cargar()
    Object.assign(etapa, { id: '', nombre: '', embudoId: datos.value.embudos[0]?.id || '', estado: 'abierta', orden: etapas.value.length })
    mensaje.value = 'Etapa de demostración guardada.'
  } catch(e) { error.value = e.message }
  finally { guardando.value = false }
}
async function restablecer() {
  if (guardando.value) return
  guardando.value = true; error.value = ''
  try {
    datos.value = await servicio.restablecer(); formulario.value = null; seleccionadoId.value = ''; confirmarReset.value = false
    Object.keys(filtros).forEach(k => filtros[k] = '')
    Object.assign(etapa, { id: '', nombre: '', embudoId: 'demo-comercial', estado: 'abierta', orden: 0 })
    mensaje.value = 'Datos  restablecidos.'
  } catch(e) { error.value = e.message }
  finally { guardando.value = false; cargando.value = false }
}
function mostrarValor(valor) { return valor == null ? 'Sin valor' : typeof valor === 'object' ? JSON.stringify(valor) : String(valor) }
function fecha(valor) { return valor ? new Date(valor).toLocaleString('es-MX') : 'Sin fecha' }
function cliente(id) { return datos.value.clientes.find(c => c.id === id)?.nombre || 'Sin cliente' }
function responsable(id) { return datos.value.responsables.find(r => r.id === id)?.nombre || 'Sin responsable' }
</script>
<template>
  <section class="oportunidades">
    <div v-if="!esSupabase" class="aviso-demo" role="note"><strong>Modo de demostración: datos locales</strong><p>Clientes, empresas, responsables y oportunidades son de demostración. Los cambios se guardan en {{ servicio.persistencia }}; no se envían a Supabase.</p></div>
    <div v-else class="aviso-demo" role="note"><strong>Supabase · staging autenticado</strong><p>Los registros y etapas se consultan bajo RLS. Los guardados utilizan las RPC existentes.</p></div>
    <p v-if="servicio.backendBloqueado" role="status">{{ servicio.backendBloqueado }}</p>
    <header><div><h1>Oportunidades comerciales</h1><p>{{ visibles.length }} de {{ datos.oportunidades.length }} oportunidades{{ esSupabase ? '' : ' de demostración' }}</p></div>
      <button :disabled="cargando || guardando || !!formulario" @click="nueva">+ Nueva oportunidad</button>
      <button v-if="servicio.permiteGestionEtapas" :disabled="guardando" @click="gestionEtapas = !gestionEtapas">Gestionar etapas</button>
      <button v-if="!esSupabase" :disabled="guardando" @click="confirmarReset = !confirmarReset">Restablecer demostración</button>
      <button :disabled="cargando || guardando" @click="cargar">Recargar</button>
    </header>
    <div v-if="confirmarReset" class="panel" role="alert"><p>Se eliminarán únicamente los cambios de esta demostración local.</p><button :disabled="guardando" @click="restablecer">Confirmar restablecimiento</button><button @click="confirmarReset = false">Cancelar</button></div>
    <p v-if="error" role="alert" class="error">{{ error }}</p><p v-if="mensaje" role="status">{{ mensaje }}</p>
    <p v-if="cargando" role="status">Cargando oportunidades{{ esSupabase ? '' : ' de demostración' }}…</p>
    <FormularioOportunidad v-if="formulario" :key="formulario.id || 'nueva'" :inicial="formulario" :modo-supabase="esSupabase" :clientes="datos.clientes" :empresas="datos.empresas" :responsables="datos.responsables" :embudos="datos.embudos" :etapas="etapas" :guardando="guardando" :error="error" @guardar="guardar" @cancelar="formulario = null; error = ''" />
    <section v-if="gestionEtapas && servicio.permiteGestionEtapas" class="panel">
      <h2>Etapas de demostración</h2>
      <div class="etapas-lista"><button v-for="e in etapas" :key="e.id" :disabled="guardando" @click="Object.assign(etapa,e)">{{ e.orden }} · {{ e.nombre }} · {{ e.estado }}</button></div>
      <form @submit.prevent="guardarEtapa"><fieldset :disabled="guardando">
        <legend>{{ etapa.id ? 'Editar etapa' : 'Agregar etapa' }}</legend>
        <label>Nombre <input v-model="etapa.nombre" maxlength="80" required /></label>
        <label>Embudo <select v-model="etapa.embudoId"><option v-for="e in datos.embudos" :key="e.id" :value="e.id">{{ e.nombre }}</option></select></label>
        <label>Estado <select v-model="etapa.estado"><option>abierta</option><option>ganada</option><option>perdida</option></select></label>
        <label>Orden <input v-model="etapa.orden" type="number" min="0" step="1" required /></label>
        <button>Guardar etapa de demostración</button><button type="button" @click="etapa.id = ''; etapa.nombre = ''; etapa.estado = 'abierta'">Nueva etapa</button>
      </fieldset></form>
    </section>
    <div class="filtros">
      <label>Embudo <select v-model="filtros.embudoId" @change="filtros.etapaId = ''"><option value="">Todos los embudos</option><option v-for="e in datos.embudos" :key="e.id" :value="e.id">{{ e.nombre }}</option></select></label>
      <label>Buscar cliente o empresa <input v-model="filtros.busqueda" type="search" /></label>
      <label>Responsable <select v-model="filtros.responsableId"><option value="">Todos</option><option v-for="r in datos.responsables" :key="r.id" :value="r.id">{{ r.nombre }}</option></select></label>
      <label v-if="!esSupabase">Servicio <select v-model="filtros.servicio"><option value="">Todos</option><option v-for="s in SERVICIOS" :key="s">{{ s }}</option></select></label>
      <label>Estado <select v-model="filtros.estado"><option value="">Todos</option><option v-for="estado in estadosFiltro" :key="estado">{{ estado }}</option></select></label>
      <label>Etapa <select v-model="filtros.etapaId"><option value="">Todas</option><option v-for="e in etapas" :key="e.id" :value="e.id">{{ e.nombre }}</option></select></label>
      <label>Moneda <input v-model="filtros.moneda" maxlength="3" placeholder="USD" @input="filtros.moneda = filtros.moneda.toUpperCase()" /></label>
      <label>Prioridad <select v-model="filtros.prioridad"><option value="">Todas</option><option>alta</option><option>media</option><option>baja</option></select></label>
      <button @click="Object.keys(filtros).forEach(k => filtros[k] = '')">Limpiar filtros</button>
    </div>
    <section v-for="embudo in embudosTablero.filter(e => !filtros.embudoId || e.id === filtros.embudoId)" :key="embudo.id">
      <h2>{{ embudo.nombre }}</h2>
      <PipelineBoard :etapas="etapasEmbudo(embudo.id)" :oportunidades="visibles.filter(o => o.embudoId === embudo.id)" @abrir="editar" />
    </section>
    <section v-if="seleccionado" class="panel">
      <h2>{{ seleccionado.titulo || cliente(seleccionado.clienteId) }} · {{ seleccionado.embudoNombre || seleccionado.servicio }}</h2>
      <p>{{ responsable(seleccionado.responsableId) }} · {{ seleccionado.valorEstimado }} {{ seleccionado.moneda }} · {{ seleccionado.estado }}</p>
      <p v-if="seleccionado.descripcion">{{ seleccionado.descripcion }}</p>
      <p>Próximo seguimiento: {{ fecha(seleccionado.proximoSeguimiento) }}</p>
      <p v-if="seleccionado.motivoPerdida">Motivo de pérdida: {{ seleccionado.motivoPerdida }}</p>
      <button :disabled="guardando" @click="editar(seleccionado.id)">Editar o cambiar etapa</button>
      <h3>Historial de cambios</h3>
      <ol><li v-for="evento in [...seleccionado.historial].reverse()" :key="evento.id"><strong>{{ fecha(evento.fecha) }} · {{ evento.tipo }}</strong><p>{{ evento.actor }}</p>
        <ul><li v-for="(cambio,campo) in evento.cambios" :key="campo">{{ campo }}: {{ mostrarValor(cambio.antes) }} → {{ mostrarValor(cambio.despues) }}</li></ul>
      </li></ol>
    </section>
  </section>
</template>
<style scoped>
.oportunidades { display: grid; gap: 1.25rem; color: #122640; }
h1,h2,h3,p { margin: 0 0 .6rem; } header, .etapas-lista { display: flex; flex-wrap: wrap; align-items: center; gap: .7rem; } header > div { margin-right: auto; }
.aviso-demo { padding: 1rem; background: #fff3d6; border: 1px solid #e8c575; border-radius: 12px; }
.panel { padding: 1.2rem; border: 1px solid #d5e0ef; border-radius: 14px; background: white; }
.filtros, fieldset { display: grid; grid-template-columns: repeat(auto-fit,minmax(160px,1fr)); gap: .8rem; } fieldset { border: 0; padding: 1rem 0; min-width: 0; }
label { display: grid; gap: .4rem; } input,select { padding: .65rem; border: 1px solid #bccbe0; border-radius: 8px; width: 100%; box-sizing: border-box; }
button { padding: .7rem 1rem; border: 1px solid #b6c8e3; border-radius: 9px; color: #153f76; background: #f2f6fd; cursor: pointer; } button:disabled { opacity: .55; cursor: wait; }
.error { color: #a42121; } li { padding-bottom: .5rem; }
</style>
