<script setup>
import { computed } from 'vue'
import { normalizarTexto } from '../lib/crm'

const props = defineProps({
  prioridad: {
    type: String,
    required: true,
  },
})

const prioridad = computed(() => normalizarTexto(props.prioridad) || 'media')
const etiqueta = computed(
  () =>
    ({
      baja: 'Baja',
      media: 'Media',
      alta: 'Alta',
      urgente: 'Urgente',
    })[prioridad.value] || 'Media',
)
</script>

<template>
  <span class="badge-prioridad" :class="`prioridad-${prioridad}`">{{ etiqueta }}</span>
</template>

<style scoped>
.badge-prioridad {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 999px;
  padding: 0.45rem 0.75rem;
  font-size: 0.8rem;
  font-weight: 700;
}

.prioridad-baja {
  background: #eaf6ee;
  color: #2f7b52;
}

.prioridad-media {
  background: #fff2df;
  color: #9e6212;
}

.prioridad-alta {
  background: #fdebec;
  color: #b03845;
}

.prioridad-urgente {
  background: #f8dade;
  color: #8e1325;
}
</style>
