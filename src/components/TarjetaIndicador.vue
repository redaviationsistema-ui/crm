<script setup>
defineProps({
  titulo: {
    type: String,
    required: true,
  },
  valor: {
    type: [String, Number],
    default: 0,
  },
  ayuda: {
    type: String,
    default: '',
  },
  tono: {
    type: String,
    default: 'base',
  },
})
</script>

<template>
  <article class="tarjeta-indicador" :class="`tono-${tono}`">
    <p>{{ titulo }}</p>
    <strong>{{ valor }}</strong>
    <span v-if="ayuda">{{ ayuda }}</span>
  </article>
</template>

<style scoped>
.tarjeta-indicador {
  min-height: 76px;
  padding: var(--espacio-panel);
  border-radius: var(--radio-panel);
  background: #fff;
  border: 1px solid #e4eaf2;
  box-shadow: var(--sombra-panel);
  display: grid;
  align-content: space-between;
  gap: 0.25rem;
}

.tarjeta-indicador p {
  margin: 0;
  color: #61708d;
  font-size: 0.82rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.03em;
}

.tarjeta-indicador strong {
  font-size: 1.55rem;
  color: #07172f;
  line-height: 1;
}

.tarjeta-indicador span {
  color: var(--color-secundario);
  font-size: 0.8rem;
}

.tono-primario {
  background: var(--color-accion);
  border-color: transparent;
}

.tono-primario p,
.tono-primario strong,
.tono-primario span {
  color: #fff;
}

.tono-alerta {
  background: var(--color-fondo-alerta);
  border-color: #f3d0d6;
}
</style>
