<script setup>
defineProps({
  titulo: {
    type: String,
    default: 'Sin información',
  },
  descripcion: {
    type: String,
    default: 'No hay elementos disponibles en este momento.',
  },
})
</script>

<template>
  <article class="estado-vacio">
    <strong>{{ titulo }}</strong>
    <p>{{ descripcion }}</p>
  </article>
</template>

<style scoped>
.estado-vacio {
  padding: 2rem;
  border: 1px dashed #c9d8ef;
  border-radius: 24px;
  background: #fbfcff;
  text-align: center;
}

.estado-vacio strong {
  color: #07172f;
  font-size: 1.05rem;
}

.estado-vacio p {
  margin: 0.5rem 0 0;
  color: #6b7c97;
}
</style>
