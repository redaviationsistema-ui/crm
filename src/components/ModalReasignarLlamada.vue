<script setup>
import { computed, ref, watch } from 'vue'

const props = defineProps({
  abierto: {
    type: Boolean,
    default: false,
  },
  llamada: {
    type: Object,
    default: null,
  },
  usuarios: {
    type: Array,
    default: () => [],
  },
})

const emit = defineEmits(['cancelar', 'confirmar'])

const nuevoUsuarioId = ref('')

watch(
  () => props.llamada,
  (llamada) => {
    nuevoUsuarioId.value = llamada?.asignadoAId || ''
  },
  { immediate: true },
)

const responsableActual = computed(() => props.llamada?.asignadoANombre || 'Sin definir')
</script>

<template>
  <div v-if="abierto" class="modal-overlay" @click.self="$emit('cancelar')">
    <section class="modal">
      <strong>Reasignar llamada</strong>
      <p>Responsable actual: {{ responsableActual }}</p>

      <label>
        <span>Nuevo responsable</span>
        <select v-model="nuevoUsuarioId">
          <option value="">Seleccionar usuario</option>
          <option v-for="usuario in usuarios" :key="usuario.id" :value="usuario.id">
            {{ usuario.nombreCompleto || usuario.nombre }} — {{ usuario.rol }}
          </option>
        </select>
      </label>

      <div class="modal-acciones">
        <button @click="$emit('cancelar')">Cancelar</button>
        <button class="primario" @click="$emit('confirmar', nuevoUsuarioId)">Reasignar</button>
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

select {
  border: 1px solid #dbe5f4;
  border-radius: 14px;
  min-height: 3rem;
  padding: 0 0.95rem;
  font: inherit;
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

.primario {
  background: #1167e8;
  color: #fff;
}
</style>
