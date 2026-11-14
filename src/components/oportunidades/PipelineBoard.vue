<script setup>
defineProps({ etapas: { type: Array, default: () => [] }, oportunidades: { type: Array, default: () => [] } })
const emit = defineEmits(['abrir'])
</script>
<template>
  <section class="pipeline" aria-label="Pipeline comercial">
    <section v-for="etapa in etapas" :key="etapa.id" :aria-label="etapa.nombre">
      <h3>{{ etapa.nombre }}{{ etapa.activo === false ? ' (inactiva)' : '' }}</h3>
      <p v-if="!oportunidades.some(o => o.etapaId === etapa.id && (!etapa.embudoId || o.embudoId === etapa.embudoId))">Sin oportunidades con estos filtros.</p>
      <button v-for="o in oportunidades.filter(o => o.etapaId === etapa.id && (!etapa.embudoId || o.embudoId === etapa.embudoId))" :key="o.id" type="button" @click="emit('abrir', o.id)">
        {{ o.clienteNombre }} · {{ o.titulo }} · {{ o.embudoNombre || o.servicio }} · {{ o.valorEstimado }} {{ o.moneda }} · {{ o.estado }}
      </button>
    </section>
  </section>
</template>

<style scoped>
.pipeline { display: grid; grid-auto-flow: column; grid-auto-columns: minmax(240px,1fr); gap: 1rem; overflow-x: auto; padding-bottom: 1rem; }
.pipeline > section { background: #edf3fb; border-radius: 14px; padding: 1rem; min-height: 180px; }
button { display: block; width: 100%; padding: 1rem; margin-bottom: .7rem; text-align: left; background: white; border: 1px solid #d4dfed; border-radius: 10px; cursor: pointer; }
p { color: #52647f; }
</style>
