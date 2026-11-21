<script setup>
import { computed, ref } from 'vue'
import BadgeEstado from '../components/BadgeEstado.vue'
import { formatearFecha, resolverEstadoLlamada } from '../lib/crm'
import TarjetaIndicador from '../components/TarjetaIndicador.vue'

const props = defineProps({
  llamadas: { type: Array, default: () => [] },
  reportes: {
    type: Array,
    default: () => [],
  },
})
const estado = ref('')
const distribucion = computed(() => {
  const conteos = new Map()
  for (const llamada of props.llamadas) {
    const clave = resolverEstadoLlamada(llamada)
    conteos.set(clave, (conteos.get(clave) || 0) + 1)
  }
  return conteos
})
const detalle = computed(() => estado.value
  ? props.llamadas.filter(llamada => resolverEstadoLlamada(llamada) === estado.value)
  : props.llamadas)
</script>

<template>
  <section class="vista-listado">
    <p class="alcance-indicadores">
      Fuente: resumen de hasta 200 llamadas visibles y consulta de llamadas vencidas. Los indicadores pueden ser parciales.
    </p>
    <div class="grid-indicadores">
      <TarjetaIndicador
        v-for="item in reportes"
        :key="item.titulo"
        :titulo="item.titulo"
        :valor="item.valor"
        :ayuda="item.ayuda"
        :tono="item.tono"
      />
    </div>
    <section v-if="llamadas.length" class="bloque detalle-reportes" aria-labelledby="titulo-detalle">
      <div class="titulo-seccion">
        <div>
          <h2 id="titulo-detalle">Detalle de actividad</h2>
          <p>{{ detalle.length }} de {{ llamadas.length }} llamadas del resumen</p>
        </div>
        <label class="campo-select">
          Estado
          <select v-model="estado">
            <option value="">Todos</option>
            <option v-for="[clave, total] in distribucion" :key="clave" :value="clave">
              {{ clave === 'vencida' ? 'Atrasada' : clave }} ({{ total }})
            </option>
          </select>
        </label>
      </div>
      <div class="tabla-prospectos tabla-reportes" tabindex="0" role="region" aria-label="Detalle de actividad">
        <table>
          <thead><tr><th>Cliente</th><th>Responsable</th><th>Fecha programada</th><th>Estado</th></tr></thead>
          <tbody>
            <tr v-for="llamada in detalle" :key="llamada.id">
              <td>{{ llamada.cliente.nombre }}</td>
              <td>{{ llamada.asignadoANombre || 'Sin responsable' }}</td>
              <td>{{ formatearFecha(llamada.fechaProgramada, { incluirHora: true }) }}</td>
              <td><BadgeEstado :estado="llamada.estado" :fecha-programada="llamada.fechaProgramada" /></td>
            </tr>
            <tr v-if="!detalle.length"><td colspan="4">Sin llamadas para este estado.</td></tr>
          </tbody>
        </table>
      </div>
    </section>
  </section>
</template>

<style scoped>
.alcance-indicadores {
  margin: 0;
  padding: 8px 12px;
  color: var(--color-secundario);
  background: var(--color-seleccion);
  border-radius: var(--radio-control);
  font-size: var(--texto-secundario);
}
.detalle-reportes { display: grid; gap: var(--espacio-panel); min-width: 0; }
.tabla-reportes { padding: 0; }
.tabla-reportes table { min-width: 500px; }
.campo-select { display: flex; align-items: center; gap: var(--espacio-corto); }
</style>
