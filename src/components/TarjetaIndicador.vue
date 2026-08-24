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
    <span>{{ ayuda }}</span>
  </article>
</template>

<style scoped>
.tarjeta-indicador {
  min-height: 118px;
  padding: 1rem 1.05rem;
  border-radius: 16px;
  background: #fff;
  border: 1px solid #e4eaf2;
  box-shadow: 0 8px 24px rgba(15, 23, 42, 0.05);
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
  font-size: 2.1rem;
  color: #07172f;
  line-height: 1;
}

.tarjeta-indicador span {
  color: #7b869c;
  font-size: 0.8rem;
}

.tono-primario {
  background: linear-gradient(135deg, #0e5fd7, #2f87ff);
  border-color: transparent;
}

.tono-primario p,
.tono-primario strong,
.tono-primario span {
  color: #fff;
}

.tono-alerta {
  background: linear-gradient(135deg, #fff5f5, #ffffff);
  border-color: #f3d0d6;
}
</style>
