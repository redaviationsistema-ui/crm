<script setup>
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
  <div v-if="abierto" class="modal-overlay" @click.self="$emit('cancelar')">
    <section class="modal">
      <strong>Cancelar llamada</strong>
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
  width: min(100%, 420px);
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

textarea {
  border: 1px solid #dbe5f4;
  border-radius: 14px;
  min-height: 6rem;
  padding: 0.8rem 0.95rem;
  font: inherit;
  resize: vertical;
}

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

.peligro {
  background: #b12e3d;
  color: #fff;
}
</style>
