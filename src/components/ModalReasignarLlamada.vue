<script setup>
import { vDialogoModal } from '../compartido/directivas/dialogoModal.js'

import { esEjecutivoActivo } from '../lib/crm.js'
import { computed, ref, watch } from 'vue'

const props = defineProps({
  error: { type: String, default: '' },
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

watch(() => props.abierto, () => { nuevoUsuarioId.value = '' })
const responsablesElegibles = computed(() => props.usuarios.filter(esEjecutivoActivo))
const puedeReasignar = computed(() => responsablesElegibles.value.some(usuario => usuario.id === nuevoUsuarioId.value))
const responsableActual = computed(() => props.llamada?.asignadoANombre || 'Sin definir')
</script>

<template>
  <dialog
    v-if="abierto"
    v-dialogo-modal
    class="dialogo-llamada"
    aria-labelledby="titulo-reasignar-llamada"
    @cancel.prevent="$emit('cancelar')"
    @click.self="$emit('cancelar')"
  >
    <section class="modal">
      <strong id="titulo-reasignar-llamada">Reasignar llamada</strong>
      <p v-if="error" role="alert">{{ error }}</p>
      <p>Responsable actual: {{ responsableActual }}</p>

      <label>
        <span>Nuevo responsable</span>
        <select v-model="nuevoUsuarioId">
          <option value="">Seleccionar usuario</option>
          <option v-for="usuario in responsablesElegibles" :key="usuario.id" :value="usuario.id">
            {{ usuario.nombreCompleto || usuario.nombre }} — {{ usuario.rol }}
          </option>
        </select>
      </label>

      <div class="modal-acciones">
        <button @click="$emit('cancelar')">Cancelar</button>
        <button class="primario" :disabled="!puedeReasignar" @click="puedeReasignar && $emit('confirmar', nuevoUsuarioId)">Reasignar</button>
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

select {
  border: 1px solid #dbe5f4;
  border-radius: 14px;
  min-height: var(--altura-control);
  padding: 0 0.95rem;
  font: inherit;
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

.primario {
  background: #1167e8;
  color: #fff;
}
</style>
