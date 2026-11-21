<script setup>
import { vDialogoModal } from '../compartido/directivas/dialogoModal.js'

import { ref, watch } from 'vue'

const props = defineProps({
  abierto: {
    type: Boolean,
    default: false,
  },
})

const emit = defineEmits(['cancelar', 'confirmar'])

const motivo = ref('')

watch(
  () => props.abierto,
  (abierto) => {
    if (abierto) {
      motivo.value = ''
    }
  },
)
</script>

<template>
  <dialog
    v-if="abierto"
    v-dialogo-modal
    class="dialogo-llamada"
    aria-labelledby="titulo-cancelar-llamada"
    @cancel.prevent="$emit('cancelar')"
    @click.self="$emit('cancelar')"
  >
    <section class="modal">
      <strong id="titulo-cancelar-llamada">Cancelar llamada</strong>
      <p>¿Seguro que deseas cancelar esta llamada?</p>

      <label>
        <span>Motivo de cancelación *</span>
        <textarea v-model="motivo" rows="4" />
      </label>

      <div class="modal-acciones">
        <button @click="$emit('cancelar')">Volver</button>
        <button class="peligro" @click="$emit('confirmar', motivo)">Cancelar llamada</button>
      </div>
    </section>
  </dialog>
</template>

<style scoped>
.dialogo-llamada {
  width: min(calc(100% - 2rem), 420px);
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

textarea {
  border: 1px solid #dbe5f4;
  border-radius: 14px;
  min-height: 6rem;
  padding: 5px 9px;
  font: inherit;
  resize: vertical;
}

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

.peligro {
  background: #b12e3d;
  color: #fff;
}
</style>
