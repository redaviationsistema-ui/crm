<script setup>
defineProps({
  abierto: {
    type: Boolean,
    default: false,
  },
  titulo: {
    type: String,
    default: 'Confirmar acción',
  },
  descripcion: {
    type: String,
    default: '¿Deseas continuar?',
  },
})

defineEmits(['cancelar', 'confirmar'])
</script>

<template>
  <div v-if="abierto" class="modal-overlay" @click.self="$emit('cancelar')">
    <section class="modal">
      <strong>{{ titulo }}</strong>
      <p>{{ descripcion }}</p>
      <div class="modal-acciones">
        <button @click="$emit('cancelar')">Volver</button>
        <button class="peligro" @click="$emit('confirmar')">Confirmar</button>
      </div>
    </section>
  </div>
</template>

<style scoped>
.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(7, 23, 47, 0.36);
  z-index: 50;
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

.modal strong {
  color: #07172f;
  font-size: 1.08rem;
}

.modal p {
  margin: 0;
  color: #64748f;
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
