<script setup>
import EstadoVacio from '../components/EstadoVacio.vue'

defineProps({
  titulo: {
    type: String,
    default: 'Módulo en preparación',
  },
  descripcion: {
    type: String,
    default: 'Esta sección está en preparación.',
  },
})
</script>

<template>
  <section class="vista-listado">
    <EstadoVacio :titulo="titulo" :descripcion="descripcion" />
  </section>
</template>
