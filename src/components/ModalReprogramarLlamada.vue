<script setup>
import { reactive, watch } from 'vue'
import { formatearFecha } from '@/lib/crm'

const props = defineProps({
  abierto: {
    type: Boolean,
    default: false,
  },
  llamada: {
    type: Object,
    default: null,
  },
})

const emit = defineEmits(['cancelar', 'confirmar'])

const formulario = reactive({
  fecha: '',
  hora: '',
  motivo: '',
})

watch(
  () => props.llamada,
  (llamada) => {
    if (!llamada?.fechaProgramada) {
      formulario.fecha = ''
      formulario.hora = ''
      formulario.motivo = ''
      return
    }

    const fecha = new Date(llamada.fechaProgramada)
    formulario.fecha = fecha.toISOString().slice(0, 10)
    formulario.hora = fecha.toTimeString().slice(0, 5)
    formulario.motivo = ''
  },
  { immediate: true },
)
</script>

<template>
  <div v-if="abierto" class="modal-overlay" @click.self="$emit('cancelar')">
    <section class="modal">
      <strong>Reprogramar llamada</strong>
      <p>Fecha actual: {{ formatearFecha(llamada?.fechaProgramada, { incluirHora: true }) }}</p>

      <label>
        <span>Nueva fecha *</span>
        <input v-model="formulario.fecha" type="date" />
      </label>

      <label>
        <span>Nueva hora *</span>
        <input v-model="formulario.hora" type="time" />
      </label>

      <label>
        <span>Motivo del cambio</span>
        <textarea v-model="formulario.motivo" rows="3" />
      </label>

      <div class="modal-acciones">
        <button @click="$emit('cancelar')">Cancelar</button>
        <button
          class="primario"
          @click="
            $emit('confirmar', {
              fechaProgramada: formulario.fecha && formulario.hora ? `${formulario.fecha}T${formulario.hora}:00` : '',
              motivo: formulario.motivo,
            })
          "
        >
          Reprogramar
        </button>
      </div>
    </section>
  </div>
</template>

<style scoped>
.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(7, 23, 47, 0.36);
  z-index: 55;
  display: grid;
  place-items: center;
  padding: 1rem;
}

.modal {
  width: min(100%, 440px);
  padding: 1.3rem;
  border-radius: 22px;
  background: #fff;
  display: grid;
  gap: 0.8rem;
}

label {
  display: grid;
  gap: 0.35rem;
}

span, p {
  margin: 0;
  color: #64748f;
}

input, textarea {
  border: 1px solid #dbe5f4;
  border-radius: 14px;
  min-height: 3rem;
  padding: 0.8rem 0.95rem;
  font: inherit;
}

textarea { min-height: 5rem; resize: vertical; }

.modal-acciones {
  display: flex;
  gap: 0.7rem;
}

.modal-acciones button {
  flex: 1;
  min-height: 3rem;
  border: 0;
  border-radius: 14px;
  font-weight: 700;
}

.primario {
  background: #1167e8;
  color: #fff;
}
</style>
