<script setup>
import { formatearFecha } from '../lib/crm'

defineProps({
  eventos: {
    type: Array,
    default: () => [],
  },
})
</script>

<template>
  <section class="historial">
    <article v-for="evento in eventos" :key="evento.id" class="evento">
      <span>{{ formatearFecha(evento.fecha, { incluirHora: true }) }}</span>
      <strong>{{ evento.titulo }}</strong>
      <p>{{ evento.descripcion }}</p>
      <small v-if="evento.usuarioNombre">{{ evento.usuarioNombre }}</small>
    </article>
  </section>
</template>

<style scoped>
.historial {
  display: grid;
  gap: 0.75rem;
  position: relative;
}

.evento {
  position: relative;
  padding: 0 0 0.9rem 1.4rem;
  border-radius: 0;
  background: transparent;
  border: 0;
  border-bottom: 1px solid #edf2f8;
}

.evento::before {
  content: '';
  position: absolute;
  left: 0.2rem;
  top: 0.45rem;
  width: 0.5rem;
  height: 0.5rem;
  border-radius: 50%;
  background: #1167e8;
  box-shadow: 0 0 0 4px #eef4ff;
}

.evento::after {
  content: '';
  position: absolute;
  left: 0.42rem;
  top: 1.05rem;
  bottom: -0.9rem;
  width: 1px;
  background: #dbe5f4;
}

.evento span,
.evento p {
  color: #6c7c97;
  margin: 0;
  font-size: 0.86rem;
}

.evento strong {
  display: block;
  color: #07172f;
  margin: 0.15rem 0 0.2rem;
  font-size: 0.96rem;
}

.evento small {
  color: #8090aa;
  font-size: 0.8rem;
}

.evento:last-child {
  padding-bottom: 0;
  border-bottom: 0;
}

.evento:last-child::after {
  display: none;
}
</style>
