<script setup>
import EstadoVacio from '../components/EstadoVacio.vue'

defineProps({
  titulo: {
    type: String,
    default: 'Módulo en preparación',
  },
  descripcion: {
    type: String,
    default: 'La estructura visual quedó reservada para futuras conexiones y permisos.',
  },
})
</script>

<template>
  <section class="vista-listado">
    <EstadoVacio :titulo="titulo" :descripcion="descripcion" />
  </section>
</template>
