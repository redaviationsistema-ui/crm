<script setup>
import { computed, reactive, ref, watch } from 'vue'
import { duracionLlamadaValida, esEjecutivoActivo } from '../lib/crm'
import SelectorUsuario from './SelectorUsuario.vue'

const props = defineProps({
  finalizacionBloqueada: Boolean,
  llamada: {
    type: Object,
    default: null,
  },
  resultados: {
    type: Array,
    default: () => [],
  },
  usuarios: {
    type: Array,
    default: () => [],
  },
  error: {
    type: String,
    default: '',
  },
})

const emit = defineEmits(['guardar-resultado', 'crear-seguimiento', 'finalizar'])

const formulario = reactive({
  contesto: 'si',
  resultadoId: '',
  duracion: '',
  notas: '',
  requiereOtraLlamada: 'no',
  fechaProxima: '',
  horaProxima: '',
  asignadoAId: '',
  prioridad: 'media',
  motivoId: '',
  motivoPersonalizado: '',
})
const responsablesElegibles = computed(() => props.usuarios.filter(esEjecutivoActivo))
const errorLocal = ref('')

const resultadosFiltrados = computed(() =>
  props.resultados.filter((item) =>
    typeof item.contesto === 'boolean' ? item.contesto === (formulario.contesto === 'si') : true,
  ),
)

watch(
  () => props.llamada,
  (llamada) => {
    errorLocal.value = ''
    formulario.resultadoId = llamada?.resultadoId || ''
    formulario.duracion = llamada?.duracionSegundos != null
      ? Math.round(Number(llamada.duracionSegundos) / 60)
      : ''
    formulario.notas = llamada?.notasResultado || llamada?.notas || ''
    formulario.requiereOtraLlamada = 'no'
    formulario.fechaProxima = ''
    formulario.horaProxima = ''
    formulario.asignadoAId = llamada?.asignadoAId || ''
    formulario.prioridad = llamada?.prioridad || 'media'
    formulario.motivoId = llamada?.motivoId || ''
    formulario.motivoPersonalizado = llamada?.motivoPersonalizado || ''
  },
  { immediate: true },
)

function construirPayload() {
  return {
    llamadaId: props.llamada?.id || null,
    contesto: formulario.contesto === 'si',
    resultadoId: formulario.resultadoId || null,
    duracion: formulario.duracion === '' ? null : Number(formulario.duracion),
    notas: formulario.notas,
    requiereOtraLlamada: formulario.requiereOtraLlamada === 'si',
    fechaProxima: formulario.fechaProxima,
    horaProxima: formulario.horaProxima,
    asignadoAId: formulario.asignadoAId || props.llamada?.asignadoAId || null,
    prioridad: formulario.prioridad,
    motivoId: formulario.motivoId || null,
    motivoPersonalizado: formulario.motivoPersonalizado || null,
    descripcion: formulario.notas || null,
  }
}

function validarSeguimiento() {
  if (formulario.requiereOtraLlamada !== 'si') {
    return ''
  }

  if (!formulario.fechaProxima) {
    return 'Selecciona la fecha y hora de la llamada.'
  }

  if (!formulario.horaProxima) {
    return 'Selecciona la fecha y hora de la llamada.'
  }

  if (!responsablesElegibles.value.some(usuario => usuario.id === formulario.asignadoAId)) {
    return 'Selecciona un ejecutivo activo.'
  }

  return ''
}

function guardarSeguimiento() {
  const mensaje = validarSeguimiento()

  if (mensaje) {
    errorLocal.value = mensaje
    return
  }

  errorLocal.value = ''
  emit('crear-seguimiento', construirPayload())
}

function guardarResultado(evento = 'guardar-resultado') {
  if (props.finalizacionBloqueada) return
  const payload = construirPayload()
  if (!duracionLlamadaValida(payload.duracion)) {
    errorLocal.value = 'Indica una duración en minutos enteros no negativos.'
    return
  }
  errorLocal.value = ''
  emit(evento, payload)
}
</script>

<template>
  <form class="formulario-resultado" @submit.prevent="guardarResultado()">
    <p v-if="errorLocal || error" class="feedback error" role="alert">{{ errorLocal || error }}</p>

    <div class="campo-grupo">
      <span>¿Contestó?</span>
      <div class="opciones-linea">
        <label><input v-model="formulario.contesto" type="radio" value="si" /> Sí</label>
        <label><input v-model="formulario.contesto" type="radio" value="no" /> No</label>
      </div>
    </div>

    <label>
      <span>Resultado</span>
      <select v-model="formulario.resultadoId">
        <option value="">Selecciona un resultado</option>
        <option v-for="resultado in resultadosFiltrados" :key="resultado.id" :value="resultado.id">
          {{ resultado.nombre }}
        </option>
      </select>
    </label>

    <div class="form-grid">
      <label>
        <span>Duración</span>
        <input v-model="formulario.duracion" type="number" min="0" step="1" placeholder="Minutos" aria-describedby="alcance-duracion-llamada" />
        <small id="alcance-duracion-llamada">La duración indicada es de referencia. El servicio de finalización no guarda cambios manuales de duración.</small>
      </label>

      <label>
        <span>¿Requiere otra llamada?</span>
        <select v-model="formulario.requiereOtraLlamada">
          <option value="no">No</option>
          <option value="si">Sí</option>
        </select>
      </label>
    </div>

    <label>
      <span>Notas</span>
      <textarea
        v-model="formulario.notas"
        rows="4"
        placeholder="Anota contexto, objeciones y próximos pasos."
      />
    </label>

    <div v-if="formulario.requiereOtraLlamada === 'si'" class="seguimiento">
      <h4>Próxima llamada</h4>
      <div class="form-grid">
        <label>
          <span>Fecha próxima llamada</span>
          <input v-model="formulario.fechaProxima" type="date" />
        </label>

        <label>
          <span>Hora</span>
          <input v-model="formulario.horaProxima" type="time" />
        </label>

        <SelectorUsuario v-model="formulario.asignadoAId" :usuarios="responsablesElegibles" etiqueta="Asignado a" />

        <label>
          <span>Prioridad</span>
          <select v-model="formulario.prioridad">
            <option value="baja">Baja</option>
            <option value="media">Media</option>
            <option value="alta">Alta</option>
            <option value="urgente">Urgente</option>
          </select>
        </label>
      </div>

      <label>
        <span>Motivo personalizado</span>
        <input
          v-model="formulario.motivoPersonalizado"
          type="text"
          placeholder="Motivo de la siguiente llamada"
        />
      </label>
    </div>

    <div class="acciones-sticky">
      <button type="button" class="secundario" @click="guardarSeguimiento">
        Guardar seguimiento
      </button>
      <button type="button" class="ghost" :disabled="finalizacionBloqueada" @click="guardarResultado('finalizar')">Finalizar</button>
    </div>
  </form>
</template>

<style scoped>
.formulario-resultado,
.form-grid,
.seguimiento {
  display: grid;
  gap: 0.8rem;
}

.campo-grupo,
label {
  display: grid;
  gap: 0.45rem;
}

.campo-grupo span,
label span,
.seguimiento h4 {
  color: #5f708d;
  font-weight: 700;
  font-size: 0.82rem;
}

.opciones-linea {
  display: flex;
  gap: 1rem;
}

input,
select,
textarea,
:deep(select) {
  border: 1px solid #e4eaf2;
  border-radius: 14px;
  min-height: 2.8rem;
  padding: 0.75rem 0.9rem;
  font: inherit;
}

textarea {
  min-height: 6.5rem;
  resize: vertical;
}

.feedback.error {
  margin: 0;
  padding: 0.85rem 0.95rem;
  border-radius: 16px;
  background: #fff0f1;
  color: #b23d44;
}

.form-grid {
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.seguimiento {
  padding: 1rem;
  border-radius: 16px;
  background: #f7faff;
  border: 1px solid #e4eaf2;
}

.acciones-sticky {
  display: flex;
  gap: 0.7rem;
  padding-top: 0.35rem;
}

.acciones-sticky button {
  min-height: 2.9rem;
  border-radius: 14px;
  border: 0;
  font-weight: 700;
  cursor: pointer;
  padding: 0.85rem 1rem;
}

.secundario {
  background: #1167e8;
  color: #fff;
}

.ghost {
  background: #eef4ff;
  color: #1f4e9d;
}

@media (min-width: 768px) {
  .acciones-sticky {
    grid-template-columns: 1fr 1fr;
    display: grid;
  }
}

@media (max-width: 767px) {
  .form-grid {
    grid-template-columns: 1fr;
  }
}
</style>
