<script setup>
import { computed, reactive, ref, watch } from 'vue'
import { SERVICIOS, validarOportunidad } from '../../domain/oportunidades.js'
const props = defineProps({
  modoSupabase: Boolean,
  inicial: { type: Object, default: null }, error: { type: String, default: '' },
  clientes: { type: Array, default: () => [] }, empresas: { type: Array, default: () => [] },
  responsables: { type: Array, default: () => [] }, etapas: { type: Array, default: () => [] },
  embudos: { type: Array, default: () => [] }, guardando: Boolean,
})
const emit = defineEmits(['guardar', 'cancelar'])
const modelo = reactive({ titulo: '', descripcion: '', clienteId: '', empresaId: '', servicio: '', responsableId: '', embudoId: '',
  etapaId: '', valorEstimado: '', moneda: 'USD', prioridad: 'media', proximoSeguimiento: '',
  estado: 'abierta', motivoPerdida: '' })
const fechaLocal = computed({
  get() {
    if (!modelo.proximoSeguimiento) return ''
    const fecha = new Date(modelo.proximoSeguimiento)
    if (!Number.isFinite(fecha.getTime())) return ''
    const dos = n => String(n).padStart(2, '0')
    return `${fecha.getFullYear()}-${dos(fecha.getMonth()+1)}-${dos(fecha.getDate())}T${dos(fecha.getHours())}:${dos(fecha.getMinutes())}`
  },
  set(valor) {
    const fecha = new Date(valor)
    modelo.proximoSeguimiento = valor && Number.isFinite(fecha.getTime()) ? fecha.toISOString() : ''
  },
})
const errores = ref({})
watch(() => props.inicial, valor => {
  if (valor) Object.assign(modelo, valor)
}, { immediate: true })
watch(() => modelo.embudoId, id => {
  const embudo = props.embudos.find(e => e.id === id)
  if (embudo?.servicio) modelo.servicio = embudo.servicio
})
watch(() => modelo.clienteId, id => {
  const cliente = props.clientes.find(c => c.id === id)
  modelo.empresaId = cliente?.empresaId || ''
})
function seleccionarEtapa() {
  if (!props.modoSupabase) modelo.estado = props.etapas.find(e => e.id === modelo.etapaId)?.estado || 'abierta'
}
function guardar() {
  if (props.guardando) return
  errores.value = validarOportunidad(modelo, props.etapas, {modoSupabase:props.modoSupabase})
  if (props.modoSupabase && !modelo.titulo?.trim()) errores.value.titulo = 'El título es obligatorio.'
  if (!Object.keys(errores.value).length) emit('guardar', { ...modelo })
}
</script>
<template>
  <form @submit.prevent="guardar">
    <fieldset :disabled="guardando">
      <legend>{{ inicial?.id ? 'Editar oportunidad' : 'Nueva oportunidad' }}{{ modoSupabase ? '' : ' de demostración' }}</legend>
      <p v-if="error" role="alert">{{ error }}</p>
      <label>Título <input v-model="modelo.titulo" :required="modoSupabase" maxlength="200" /></label>
      <label>{{ modoSupabase ? 'Descripción o motivo de cierre' : 'Descripción' }} <textarea v-model="modelo.descripcion" /></label>
      <label>Cliente <select v-model="modelo.clienteId" :disabled="modoSupabase && !!inicial?.id"><option value="">Seleccionar</option><option v-for="c in clientes" :key="c.id" :value="c.id">{{ c.nombre }}</option></select></label>
      <label>Empresa <select v-model="modelo.empresaId" :disabled="modoSupabase"><option value="">Sin empresa</option><option v-for="e in empresas" :key="e.id" :value="e.id">{{ e.nombre }}</option></select></label>
      <label v-if="!modoSupabase">Servicio <select v-model="modelo.servicio" :disabled="modoSupabase || !!embudos.find(e => e.id === modelo.embudoId)?.servicio"><option value="">Seleccionar</option><option v-for="s in SERVICIOS" :key="s">{{ s }}</option></select></label>
      <label>Responsable <select v-model="modelo.responsableId"><option value="">Seleccionar</option><option v-for="r in responsables" :key="r.id" :value="r.id">{{ r.nombre }}</option></select></label>
      <label>Embudo <select v-model="modelo.embudoId" :disabled="modoSupabase && !!inicial?.id" @change="modelo.etapaId = ''; modelo.estado = 'abierta'"><option value="">Seleccionar</option><option v-for="e in embudos" :key="e.id" :value="e.id">{{ e.nombre }}</option></select></label>
      <label>Etapa <select v-model="modelo.etapaId" @change="seleccionarEtapa"><option value="">Seleccionar</option><option v-for="e in etapas.filter(e => e.embudoId === modelo.embudoId && (e.activo !== false || e.id === modelo.etapaId))" :key="e.id" :value="e.id">{{ e.nombre }}</option></select></label>
      <label>Valor estimado <input v-model="modelo.valorEstimado" inputmode="decimal" /></label>
      <label>Moneda <input v-model="modelo.moneda" maxlength="3" /></label>
      <label>Prioridad <select v-model="modelo.prioridad"><option>alta</option><option>media</option><option>baja</option></select></label>
      <label>Próximo seguimiento (hora local) <input v-model="fechaLocal" type="datetime-local" /></label>
      <label v-if="modelo.estado === 'perdida' && !modoSupabase">Motivo de pérdida <textarea v-model="modelo.motivoPerdida" /></label>
      <ul v-if="Object.keys(errores).length" role="alert"><li v-for="(error, campo) in errores" :key="campo">{{ campo }}: {{ error }}</li></ul>
      <button type="button" @click="emit('cancelar')">Cancelar</button><button type="submit">Guardar</button>
    </fieldset>
  </form>
</template>

<style scoped>
form { padding: 1.25rem; background: white; border-radius: 16px; border: 1px solid #dbe5f4; }
fieldset { border: 0; padding: 0; display: grid; grid-template-columns: repeat(2,minmax(0,1fr)); gap: 1rem; min-width: 0; }
legend { font-weight: 700; padding-bottom: 1rem; } label { display: grid; gap: .4rem; }
input, select, textarea { padding: .65rem; border: 1px solid #bac9df; border-radius: 8px; width: 100%; box-sizing: border-box; }
button { padding: .7rem; border-radius: 8px; cursor: pointer; } [role=alert], ul { grid-column: 1/-1; color: #a42121; }
@media(max-width: 700px) { fieldset { grid-template-columns: 1fr; } }
</style>
