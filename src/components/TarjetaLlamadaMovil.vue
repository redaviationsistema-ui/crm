<script setup>
import BadgeEstado from './BadgeEstado.vue'
import BadgeMercado from './BadgeMercado.vue'
import BadgePrioridad from './BadgePrioridad.vue'
import { formatearFecha, formatearHora } from '../lib/crm'

defineProps({
  llamada: {
    type: Object,
    required: true,
  },
})

defineEmits(['ver', 'iniciar'])
</script>

<template>
  <article class="tarjeta-llamada">
    <div class="tarjeta-top">
      <div>
        <strong>{{ llamada.cliente.nombre }}</strong>
        <p>{{ llamada.cliente.empresa }}</p>
      </div>
      <BadgePrioridad :prioridad="llamada.prioridad" />
    </div>

    <BadgeMercado :tipo="llamada.cliente.tipoMercado" />

    <div class="tarjeta-datos">
      <p>{{ llamada.motivo }}</p>
      <span>📞 {{ llamada.cliente.telefono }}</span>
      <span>📅 {{ formatearFecha(llamada.fechaProgramada) }} · {{ formatearHora(llamada.fechaProgramada) }}</span>
      <span>Creado por: {{ llamada.creadoPorNombre }}</span>
      <span>Asignado a: {{ llamada.asignadoANombre }}</span>
    </div>

    <div class="tarjeta-footer">
      <BadgeEstado :estado="llamada.estado" :fecha-programada="llamada.fechaProgramada" />
      <div class="acciones">
        <button @click="$emit('ver', llamada)">Ver detalle</button>
        <button class="primario" @click="$emit('iniciar', llamada)">Llamar</button>
      </div>
    </div>
  </article>
</template>

<style scoped>
.tarjeta-llamada {
  display: grid;
  gap: 1rem;
  padding: 1rem;
  border-radius: 22px;
  border: 1px solid #dfe7f5;
  background: #fff;
  box-shadow: 0 18px 34px rgba(7, 23, 47, 0.06);
}

.tarjeta-top,
.tarjeta-footer {
  display: flex;
  justify-content: space-between;
  gap: 1rem;
  align-items: flex-start;
}

.tarjeta-top strong {
  color: #07172f;
  font-size: 1rem;
}

.tarjeta-top p,
.tarjeta-datos p,
.tarjeta-datos span {
  margin: 0;
  color: #60708d;
}

.tarjeta-datos {
  display: grid;
  gap: 0.4rem;
}

.acciones {
  display: flex;
  gap: 0.6rem;
}

.acciones button {
  border: 1px solid #dbe5f4;
  background: #fff;
  border-radius: 12px;
  padding: 0.7rem 0.85rem;
}

.acciones .primario {
  background: #1167e8;
  color: #fff;
  border-color: #1167e8;
}

@media (max-width: 420px) {
  .tarjeta-top,
  .tarjeta-footer {
    flex-direction: column;
  }

  .acciones {
    width: 100%;
  }

  .acciones button {
    flex: 1;
  }
}
</style>
