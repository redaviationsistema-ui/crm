<script setup>
import BadgeMercado from '../components/BadgeMercado.vue'
import { formatearDuracion, formatearFecha } from '../lib/crm'

defineProps({
  rol: {
    type: String,
    default: 'ejecutivo',
  },
  llamadas: {
    type: Array,
    default: () => [],
  },
})
</script>

<template>
  <section class="vista-listado">
    <div class="tabla-prospectos" tabindex="0" role="region" aria-label="Historial de llamadas">
      <table>
        <thead>
          <tr>
            <th>Fecha</th>
            <th>Contacto</th>
            <th>Mercado</th>
            <th v-if="rol !== 'ejecutivo'">Responsable</th>
            <th>Resultado</th>
            <th>Duración</th>
            <th>Notas</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="llamada in llamadas" :key="llamada.id">
            <td>{{ formatearFecha(llamada.fechaProgramada, { incluirHora: true }) }}</td>
            <td>{{ llamada.cliente.nombre }}</td>
            <td><BadgeMercado :tipo="llamada.cliente.tipoMercado" /></td>
            <td v-if="rol !== 'ejecutivo'">{{ llamada.asignadoANombre }}</td>
            <td>{{ llamada.resultado || 'Pendiente' }}</td>
            <td>{{ formatearDuracion(llamada.duracion) }}</td>
            <td>{{ llamada.notas || 'Sin notas' }}</td>
          </tr>
        </tbody>
      </table>
    </div>
  </section>
</template>
