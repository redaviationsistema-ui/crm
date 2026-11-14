<script setup>
import TarjetaIndicador from '../components/TarjetaIndicador.vue'

defineProps({
  reportes: {
    type: Array,
    default: () => [],
  },
})
</script>

<template>
  <section class="vista-listado">
    <p class="alcance-indicadores">
      Los indicadores corresponden a los registros cargados y pueden ser parciales.
    </p>
    <div class="grid-indicadores">
      <TarjetaIndicador
        v-for="item in reportes"
        :key="item.titulo"
        :titulo="item.titulo"
        :valor="item.valor"
        :ayuda="item.ayuda"
        :tono="item.tono"
      />
    </div>
  </section>
</template>
