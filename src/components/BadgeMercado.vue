<script setup>
import { computed } from 'vue'
import { obtenerEtiquetaMercado, normalizarTexto } from '../lib/crm'

const props = defineProps({
  tipo: {
    type: String,
    required: true,
  },
})

const etiqueta = computed(() => obtenerEtiquetaMercado(props.tipo))
const clase = computed(() =>
  !props.tipo
    ? 'sin-mercado'
    : normalizarTexto(props.tipo) === 'internacional'
      ? 'es-internacional'
      : 'es-nacional',
)
</script>

<template>
  <span class="badge-mercado" :class="clase">{{ etiqueta }}</span>
</template>

<style scoped>
.badge-mercado {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  border-radius: 999px;
  padding: 0.45rem 0.8rem;
  font-size: 0.83rem;
  font-weight: 700;
}

.es-nacional {
  background: #e7f0ff;
  color: #0b4fbd;
}

.es-internacional {
  background: #eaf6f5;
  color: #0b6b6c;
}

.sin-mercado {
  background: #eff3f8;
  color: #60708d;
}
</style>
