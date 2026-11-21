<script setup>
import { cerrarMenuConEscape } from '../compartido/utilidades/cerrarMenuConEscape.js'

import { computed } from 'vue'
import { resolverEstadoLlamada } from '@/lib/crm'

const props = defineProps({
  llamada: {
    type: Object,
    required: true,
  },
  rol: {
    type: String,
    default: 'ejecutivo',
  },
})

const emit = defineEmits([
  'ver-detalle',
  'editar',
  'reprogramar',
  'reasignar',
  'iniciar',
  'crear-seguimiento',
  'cancelar',
])

const estado = computed(() => resolverEstadoLlamada(props.llamada))

const acciones = computed(() => {
  if (estado.value === 'pendiente') {
    return [
      ['Ver detalle', 'ver-detalle'],
      ['Editar llamada', 'editar'],
      ['Iniciar llamada', 'iniciar'],
      ['Reprogramar', 'reprogramar'],
      ['Reasignar', 'reasignar'],
      ['Cancelar llamada', 'cancelar'],
    ]
  }

  if (estado.value === 'en seguimiento') {
    return [
      ['Ver detalle', 'ver-detalle'],
      ['Registrar resultado', 'ver-detalle'],
      ['Crear seguimiento', 'crear-seguimiento'],
      ['Reasignar', 'reasignar'],
      ['Cancelar llamada', 'cancelar'],
    ]
  }

  if (estado.value === 'completada') {
    return [
      ['Ver detalle', 'ver-detalle'],
      ['Ver historial', 'ver-detalle'],
      ['Programar seguimiento', 'crear-seguimiento'],
    ]
  }

  if (estado.value === 'cancelada') {
    return [['Ver detalle', 'ver-detalle']]
  }

  return [['Ver detalle', 'ver-detalle']]
})
</script>

<template>
  <details class="menu-acciones" @keydown.esc="cerrarMenuConEscape">
    <summary aria-label="Acciones de llamada">⋮</summary>
    <div class="menu-lista">
      <button
        v-for="[label, action] in acciones"
        :key="`${llamada.id}-${action}`"
        @click="emit(action, llamada)"
      >
        {{ label }}
      </button>
    </div>
  </details>
</template>

<style scoped>
.menu-acciones {
  position: relative;
}

.menu-acciones summary {
  list-style: none;
  cursor: pointer;
  font-weight: 800;
  color: #1167e8;
  font-size: 1.4rem;
  line-height: 1;
  display: grid;
  place-items: center;
  min-width: 28px;
  min-height: 28px;
  border-radius: var(--radio-control);
}

.menu-lista {
  min-width: 150px;
  padding: 0.5rem;
  border-radius: 16px;
  border: 1px solid #dbe5f4;
  background: #fff;
  box-shadow: 0 18px 34px rgba(7, 23, 47, 0.08);
  display: grid;
  gap: 0.2rem;
}

.menu-lista button {
  border: 0;
  background: transparent;
  text-align: left;
  padding: 5px 8px;
  border-radius: 12px;
  cursor: pointer;
}

.menu-lista button:hover {
  background: #f3f7ff;
}
</style>
