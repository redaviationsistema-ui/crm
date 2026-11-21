<script setup>
import { computed, reactive, ref, watch } from 'vue'
import { esEjecutivoActivo, obtenerEtiquetaMercado } from '@/lib/crm'
import SelectorProspecto from './SelectorProspecto.vue'
import SelectorUsuario from './SelectorUsuario.vue'

const props = defineProps({
  abierto: {
    type: Boolean,
    default: false,
  },
  modo: {
    type: String,
    default: 'crear',
  },
  llamada: {
    type: Object,
    default: null,
  },
  prospectoInicialId: {
    type: String,
    default: '',
  },
  usuarioActualId: {
    type: String,
    default: '',
  },
  prospectos: {
    type: Array,
    default: () => [],
  },
  usuarios: {
    type: Array,
    default: () => [],
  },
  motivos: {
    type: Array,
    default: () => [],
  },
  error: {
    type: String,
    default: '',
  },
})

const emit = defineEmits(['cerrar', 'guardar', 'guardar-y-crear-otra'])

const formulario = reactive({
  prospectoId: '',
  motivoId: '',
  motivoPersonalizado: '',
  descripcion: '',
  asignadoAId: '',
  prioridad: 'media',
  fecha: '',
  hora: '',
})

const prospectoActivo = computed(() =>
  props.prospectos.find((prospecto) => prospecto.id === formulario.prospectoId) || null,
)
const esEdicion = computed(() => props.modo === 'editar')
const responsablesElegibles = computed(() => props.usuarios.filter(esEjecutivoActivo))
const responsableHistorico = computed(() => props.llamada?.asignadoANombre || props.llamada?.asignadoAId || 'Sin asignar')

function esResponsableElegible(id) {
  return responsablesElegibles.value.some(usuario => usuario.id === id)
}

function responsableInicial() {
  return [props.usuarioActualId, prospectoActivo.value?.responsableId].find(esResponsableElegible) || ''
}

const mostrarMotivoPersonalizado = computed(() => {
  const motivo = props.motivos.find((item) => item.id === formulario.motivoId)
  return motivo?.nombre?.trim().toLowerCase() === 'otro'
})
const errorLocal = ref('')
const mercadoSeleccionado = computed(() =>
  prospectoActivo.value?.mercado
    ? obtenerEtiquetaMercado(prospectoActivo.value.mercado)
    : 'Selecciona un contacto para cargar el mercado automáticamente',
)

watch(
  [responsablesElegibles, () => formulario.prospectoId, () => props.usuarioActualId],
  () => {
    if (esEdicion.value || !props.abierto) return
    if (!formulario.asignadoAId) formulario.asignadoAId = responsableInicial()
  },
)

watch(
  () => props.abierto,
  (abierto) => {
    if (abierto) {
      errorLocal.value = ''
      if (esEdicion.value && props.llamada) {
        const fecha = props.llamada.fechaProgramada ? new Date(props.llamada.fechaProgramada) : null
        formulario.prospectoId = props.llamada.prospectoId || ''
        formulario.motivoId = props.llamada.motivoId || ''
        formulario.motivoPersonalizado = props.llamada.motivoPersonalizado || ''
        formulario.descripcion = props.llamada.descripcion || ''
        formulario.asignadoAId = props.llamada.asignadoAId || ''
        formulario.prioridad = props.llamada.prioridad || 'media'
        formulario.fecha = fecha ? fecha.toISOString().slice(0, 10) : ''
        formulario.hora = fecha ? fecha.toTimeString().slice(0, 5) : ''
      } else {
        formulario.prospectoId = props.prospectoInicialId || ''
        formulario.motivoId = ''
        formulario.motivoPersonalizado = ''
        formulario.descripcion = ''
        formulario.asignadoAId = responsableInicial()
        formulario.prioridad = 'media'
        formulario.fecha = ''
        formulario.hora = ''
      }
    }
  },
  { immediate: true },
)

watch(
  () => props.prospectoInicialId,
  (prospectoInicialId) => {
    if (!esEdicion.value && props.abierto) {
      formulario.prospectoId = prospectoInicialId || ''
    }
  },
)

function payload() {
  return {
    prospectoId: formulario.prospectoId,
    motivoId: formulario.motivoId || null,
    motivoPersonalizado: formulario.motivoPersonalizado || null,
    descripcion: formulario.descripcion,
    asignadoAId: formulario.asignadoAId,
    prioridad: formulario.prioridad,
    fecha: formulario.fecha,
    hora: formulario.hora,
    mercado: prospectoActivo.value?.mercado || null,
  }
}

function limpiar() {
  errorLocal.value = ''
  formulario.prospectoId = ''
  formulario.motivoId = ''
  formulario.motivoPersonalizado = ''
  formulario.descripcion = ''
  formulario.asignadoAId = responsableInicial()
  formulario.prioridad = 'media'
  formulario.fecha = ''
  formulario.hora = ''
}

function guardarYCrearOtra() {
  const mensaje = validarFormulario()

  if (mensaje) {
    errorLocal.value = mensaje
    return
  }

  emit('guardar-y-crear-otra', payload())
  limpiar()
}

function validarFormulario() {
  if (!formulario.prospectoId) {
    return 'Selecciona un contacto.'
  }

  if (!formulario.motivoId) {
    return 'Selecciona un motivo.'
  }

  if (!esEdicion.value && !esResponsableElegible(formulario.asignadoAId)) {
    return 'Selecciona un ejecutivo activo.'
  }

  if (!formulario.fecha) {
    return 'Selecciona la fecha de la llamada.'
  }

  if (!formulario.hora) {
    return 'Selecciona la hora de la llamada.'
  }

  return ''
}

function guardar() {
  const mensaje = validarFormulario()

  if (mensaje) {
    errorLocal.value = mensaje
    return
  }

  errorLocal.value = ''
  emit('guardar', payload())
}
</script>

<template>
  <div v-if="abierto" class="overlay" @click.self="$emit('cerrar')">
    <section class="drawer-formulario">
      <div class="encabezado">
        <div>
          <p>{{ esEdicion ? 'Actualizar llamada' : 'Nueva llamada' }}</p>
          <strong>{{ esEdicion ? 'Editar llamada' : 'Programar llamada' }}</strong>
        </div>
        <button @click="$emit('cerrar')">✕</button>
      </div>

      <p v-if="errorLocal || error" class="feedback error">{{ errorLocal || error }}</p>

      <div class="formulario">
        <SelectorProspecto
          v-model="formulario.prospectoId"
          :prospectos="prospectos"
          class="campo-contacto"
        />

        <label class="campo-mercado">
          <span>Mercado</span>
          <input :value="mercadoSeleccionado" type="text" disabled />
        </label>

        <label>
          <span>Motivo *</span>
          <select v-model="formulario.motivoId">
            <option value="">Selecciona un motivo</option>
            <option v-for="motivo in motivos" :key="motivo.id" :value="motivo.id">
              {{ motivo.nombre }}
            </option>
          </select>
        </label>

        <label v-if="mostrarMotivoPersonalizado">
          <span>Especificar motivo</span>
          <input
            v-model="formulario.motivoPersonalizado"
            type="text"
            placeholder="Describe el motivo"
          />
        </label>

        <label class="campo-completo">
          <span>Descripción</span>
          <textarea
            v-model="formulario.descripcion"
            rows="4"
            placeholder="Contexto comercial, aeronave de interés y notas previas."
          />
        </label>

        <label v-if="esEdicion">
          <span>Asignado a</span>
          <input :value="responsableHistorico" readonly />
        </label>
        <SelectorUsuario v-else v-model="formulario.asignadoAId" :usuarios="responsablesElegibles" etiqueta="Asignado a" />

        <label>
          <span>Prioridad</span>
          <select v-model="formulario.prioridad">
            <option value="baja">Baja</option>
            <option value="media">Media</option>
            <option value="alta">Alta</option>
            <option value="urgente">Urgente</option>
          </select>
        </label>

        <label>
          <span>Fecha para llamar *</span>
          <input v-model="formulario.fecha" type="date" />
        </label>

        <label>
          <span>Hora *</span>
          <input v-model="formulario.hora" type="time" />
        </label>
      </div>

      <div class="acciones">
        <button class="ghost" @click="$emit('cerrar')">Cancelar</button>
        <button class="primario" @click="guardar">
          {{ esEdicion ? 'Guardar cambios' : 'Programar llamada' }}
        </button>
        <button v-if="!esEdicion" class="secundario" @click="guardarYCrearOtra">
          Programar y crear otra
        </button>
      </div>
    </section>
  </div>
</template>

<style scoped>
.overlay {
  position: fixed;
  inset: 0;
  background: rgba(7, 23, 47, 0.4);
  z-index: 40;
  display: flex;
  justify-content: flex-end;
}

.drawer-formulario {
  width: min(100%, 560px);
  min-height: 100%;
  background: #fff;
  padding: var(--espacio-pagina);
  display: grid;
  gap: 1rem;
  overflow: auto;
}

.encabezado {
  display: flex;
  justify-content: space-between;
  gap: 1rem;
}

.encabezado p,
.formulario span {
  margin: 0;
  color: #62728e;
  font-weight: 700;
}

.encabezado strong {
  color: #07172f;
  font-size: 1.2rem;
}

.encabezado button {
  border: 0;
  background: #eef4ff;
  width: 2.4rem;
  height: 2.4rem;
  border-radius: 50%;
  cursor: pointer;
}

.formulario {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.9rem;
  align-items: start;
}

.formulario label,
:deep(.campo-select) {
  display: grid;
  gap: 0.45rem;
  min-width: 0;
}

.campo-completo {
  grid-column: 1 / -1;
}

.campo-contacto,
.campo-mercado {
  min-width: 0;
}

.formulario input,
.formulario select,
.formulario textarea,
:deep(select) {
  width: 100%;
  min-height: var(--altura-control);
  border: 1px solid #dbe5f4;
  border-radius: 14px;
  padding: 5px 9px;
  font: inherit;
}

.formulario textarea {
  min-height: 6rem;
  resize: vertical;
}

.acciones {
  display: flex;
  gap: 0.7rem;
}

.feedback.error {
  margin: 0;
  padding: 0.9rem 1rem;
  border-radius: 16px;
  background: #fff0f1;
  color: #b23d44;
}

.acciones button {
  flex: 1;
  min-height: var(--altura-control);
  border: 0;
  border-radius: 14px;
  font-weight: 700;
  cursor: pointer;
}

.ghost {
  background: #f0f4fa;
  color: #49607f;
}

.primario {
  background: #1167e8;
  color: #fff;
}

.secundario {
  background: #dfeafa;
  color: #1f4e9d;
}

@media (max-width: 767px) {
  .drawer-formulario {
    width: 100%;
  }

  .formulario {
    grid-template-columns: 1fr;
  }

  .acciones {
    flex-direction: column;
  }
}
</style>
