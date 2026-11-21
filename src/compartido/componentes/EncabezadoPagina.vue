<script setup>
defineProps({
  titulo: { type: String, required: true },
  descripcion: { type: String, default: '' },
})
</script>

<template>
  <header class="encabezado-pagina">
    <div class="encabezado-titulo">
      <slot name="navegacion" />
      <div>
        <h1>{{ titulo }}</h1>
        <p v-if="descripcion">{{ descripcion }}</p>
      </div>
    </div>
    <div v-if="$slots.acciones" class="encabezado-acciones">
      <slot name="acciones" />
    </div>
  </header>
</template>

<style scoped>
.encabezado-pagina,
.encabezado-titulo,
.encabezado-acciones {
  display: flex;
  align-items: center;
  gap: var(--espacio-corto);
  min-width: 0;
}

.encabezado-pagina {
  min-height: var(--altura-barra);
  justify-content: space-between;
  flex-wrap: wrap;
}

.encabezado-acciones { flex-wrap: wrap; }
h1, p { margin: 0; }
p { color: var(--color-secundario); font-size: var(--texto-secundario); }
</style>
