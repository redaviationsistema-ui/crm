<script setup>
import EncabezadoPagina from '../compartido/componentes/EncabezadoPagina.vue'

defineProps({
  titulo: { type: String, required: true },
  subtitulo: { type: String, default: '' },
  accionPrincipalLabel: { type: String, default: '' },
})

defineEmits(['toggle-sidebar', 'accion-principal'])
</script>

<template>
  <EncabezadoPagina class="crm-header" :titulo="titulo" :descripcion="subtitulo">
    <template #navegacion>
      <button type="button" class="hamburguesa" aria-label="Abrir navegación" @click="$emit('toggle-sidebar')">☰</button>
    </template>
    <template v-if="accionPrincipalLabel" #acciones>
      <button type="button" class="boton-primario" @click="$emit('accion-principal')">
        {{ accionPrincipalLabel }}
      </button>
    </template>
  </EncabezadoPagina>
</template>

<style scoped>
.crm-header {
  padding: 7px var(--espacio-pagina);
  border-bottom: 1px solid var(--color-borde);
  background: var(--color-superficie);
  position: sticky;
  top: 0;
  z-index: 15;
}

.hamburguesa { display: none; }

@media (max-width: 767px) {
  .hamburguesa {
    display: grid;
    place-items: center;
    min-width: var(--altura-control);
    min-height: var(--altura-control);
    border: 1px solid var(--color-borde);
    background: var(--color-superficie);
    border-radius: var(--radio-control);
  }
}
</style>
