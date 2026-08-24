<script setup>
import BadgePrioridad from '../components/BadgePrioridad.vue'
import EstadoVacio from '../components/EstadoVacio.vue'
import { formatearFecha } from '../lib/crm'

defineProps({
  rol: {
    type: String,
    default: 'ejecutivo',
  },
  grupos: {
    type: Object,
    required: true,
  },
})

defineEmits(['ver-detalle'])
</script>

<template>
  <section class="vista-listado">
    <div class="seguimientos-grid">
      <article v-for="(items, clave) in grupos" :key="clave" class="bloque">
        <div class="bloque-head">
          <div>
            <p>{{ { hoy: 'Hoy', proximas: 'Próximas', atrasadas: 'Atrasadas', completadas: 'Completadas' }[clave] || clave }}</p>
            <strong>{{ items.length }} registros</strong>
          </div>
        </div>

        <div v-if="items.length" class="seguimiento-lista">
          <button
            v-for="llamada in items"
            :key="llamada.id"
            class="seguimiento-item"
            @click="$emit('ver-detalle', llamada)"
          >
            <span>{{ formatearFecha(llamada.fechaProgramada, { incluirHora: true }) }}</span>
            <strong>{{ llamada.cliente.nombre }}</strong>
            <p>{{ llamada.motivo }}</p>
            <div class="seguimiento-meta">
              <BadgePrioridad :prioridad="llamada.prioridad" />
              <span>{{ llamada.asignadoANombre }}</span>
            </div>
          </button>
        </div>

        <EstadoVacio
          v-else
          class="estado-vacio-compacto"
          titulo="Sin seguimientos"
          :descripcion="`No hay elementos en ${clave}.`"
        />
      </article>
    </div>
  </section>
</template>

<style scoped>
@media (max-width: 767px) {
  .bloque {
    padding: 1rem;
  }

  :deep(.estado-vacio-compacto) {
    padding: 1rem 0.85rem;
    border-radius: 18px;
    min-height: auto;
    height: auto;
  }

  :deep(.estado-vacio-compacto strong) {
    font-size: 0.95rem;
  }

  :deep(.estado-vacio-compacto p) {
    margin-top: 0.3rem;
    font-size: 0.84rem;
  }
}
</style>
