<script setup>
import { computed } from 'vue'
import { resolverEstadoLlamada } from '../lib/crm'

const props = defineProps({
  estado: {
    type: String,
    required: true,
  },
  fechaProgramada: {
    type: String,
    default: null,
  },
})

const mapa = {
  pendiente: 'Pendiente',
  'en seguimiento': 'En seguimiento',
  completada: 'Completada',
  cancelada: 'Cancelada',
  vencida: 'Vencida',
}

const estadoResuelto = computed(() =>
  resolverEstadoLlamada({ estado: props.estado, fechaProgramada: props.fechaProgramada }),
)
const etiqueta = computed(() => mapa[estadoResuelto.value] || 'Pendiente')
const claseEstado = computed(() => `estado-${estadoResuelto.value.replace(/\s+/g, '-')}`)
</script>

<template>
  <span class="badge-estado" :class="claseEstado">{{ etiqueta }}</span>
</template>

<style scoped>
.badge-estado {
  display: inline-flex;
  align-items: center;
  border-radius: 999px;
  padding: 0.45rem 0.8rem;
  font-size: 0.8rem;
  font-weight: 700;
}

.estado-pendiente {
  background: #eef3ff;
  color: #2557c6;
}

.estado-en-seguimiento {
  background: #fff1da;
  color: #94620b;
}

.estado-completada {
  background: #e7f6ed;
  color: #1f7a4b;
}

.estado-cancelada {
  background: #f5f0f0;
  color: #7c5f66;
}

.estado-vencida {
  background: #fde9ea;
  color: #ae2631;
}
</style>
