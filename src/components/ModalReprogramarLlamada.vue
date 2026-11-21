<script setup>
import { vDialogoModal } from '../compartido/directivas/dialogoModal.js'

import { reactive, watch } from 'vue'
import { construirFechaProgramada, formatearFecha } from '@/lib/crm'

const props = defineProps({
  guardando: Boolean,
  error: { type: String, default: '' },
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
    formulario.fecha = [fecha.getFullYear(), fecha.getMonth() + 1, fecha.getDate()]
      .map(valor => String(valor).padStart(2, '0')).join('-')
    formulario.hora = fecha.toTimeString().slice(0, 5)
    formulario.motivo = ''
  },
  { immediate: true },
)

function confirmar() {
  if (props.guardando || !formulario.fecha || !formulario.hora) return
  emit('confirmar', { fechaProgramada: construirFechaProgramada(formulario.fecha, formulario.hora) })
}
</script>

<template>
  <dialog
    v-if="abierto"
    v-dialogo-modal
    class="dialogo-llamada"
    aria-labelledby="titulo-reprogramar-llamada"
    @cancel.prevent="!guardando && $emit('cancelar')"
    @click.self="!guardando && $emit('cancelar')"
  >
    <section class="modal">
      <strong id="titulo-reprogramar-llamada">Reprogramar llamada</strong>
      <p v-if="error" role="alert">{{ error }}</p>
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
        <button :disabled="guardando" @click="$emit('cancelar')">Cancelar</button>
        <button
          class="primario"
          :disabled="guardando || !formulario.fecha || !formulario.hora"
          @click="confirmar"
        >
          Reprogramar
        </button>
      </div>
    </section>
  </dialog>
</template>

<style scoped>
.dialogo-llamada {
  width: min(calc(100% - 2rem), 440px);
  max-height: calc(100% - 2rem);
  margin: auto;
  padding: 0;
  border: 1px solid var(--color-borde);
  border-radius: var(--radio-panel);
  overflow: auto;
}

.dialogo-llamada::backdrop {
  background: rgba(7, 23, 47, 0.36);
}

.modal {
  padding: var(--espacio-pagina);
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
  min-height: var(--altura-control);
  padding: 5px 9px;
  font: inherit;
}

textarea { min-height: 5rem; resize: vertical; }

.modal-acciones {
  display: flex;
  gap: 0.7rem;
}

.modal-acciones button {
  flex: 1;
  min-height: var(--altura-control);
  border: 0;
  border-radius: 14px;
  font-weight: 700;
}

.primario {
  background: #1167e8;
  color: #fff;
}
</style>
