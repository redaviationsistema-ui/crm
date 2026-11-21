<script setup>
const props = defineProps({
  rol: {
    type: String,
    default: 'ejecutivo',
  },
  filtros: {
    type: Object,
    required: true,
  },
  responsables: {
    type: Array,
    default: () => [],
  },
})

const emit = defineEmits(['update:filtros'])

function actualizar(campo, valor) {
  emit('update:filtros', { ...props.filtros, [campo]: valor })
}
</script>

<template>
  <section class="filtros">
    <div class="tabs">
      <button
        v-for="tab in rol === 'ejecutivo' ? ['asignadas', 'en-seguimiento', 'completadas', 'vencida'] : ['todas', 'asignadas', 'creadas']"
        :key="tab"
        :class="{ activo: filtros.tab === tab }"
        :aria-pressed="filtros.tab === tab"
        @click="actualizar('tab', tab)"
      >
        {{
          {
            asignadas: 'Mis pendientes',
            'en-seguimiento': 'En proceso',
            completadas: 'Completadas',
            vencida: 'Atrasadas',
            creadas: 'Llamadas que asigné',
            todas: 'Todas',
          }[tab]
        }}
      </button>
    </div>

    <div class="controles">
      <label class="busqueda">
        <span>Buscar</span>
        <input
          type="search"
          :value="filtros.busqueda"
          placeholder="Cliente, empresa, teléfono o motivo"
          @input="actualizar('busqueda', $event.target.value)"
        />
      </label>
      <label>
        <span>Mercado</span>
        <select :value="filtros.mercado" @change="actualizar('mercado', $event.target.value)">
          <option value="todos">Todos los mercados</option>
          <option value="nacional">🇲🇽 Nacional</option>
          <option value="internacional">🌎 Internacional</option>
        </select>
      </label>

      <label v-if="rol !== 'ejecutivo'">
        <span>Estado</span>
        <select :value="filtros.estado" @change="actualizar('estado', $event.target.value)">
          <option value="todos">Todos</option>
          <option value="pendiente">Pendiente</option>
          <option value="en seguimiento">En seguimiento</option>
          <option value="completada">Completada</option>
          <option value="cancelada">Cancelada</option>
          <option value="vencida">Atrasada</option>
        </select>
      </label>

      <label>
        <span>Prioridad</span>
        <select :value="filtros.prioridad" @change="actualizar('prioridad', $event.target.value)">
          <option value="todas">Todas</option>
          <option value="baja">Baja</option>
          <option value="media">Media</option>
          <option value="alta">Alta</option>
          <option value="urgente">Urgente</option>
        </select>
      </label>

      <label v-if="rol !== 'ejecutivo'">
        <span>Responsable</span>
        <select
          :value="filtros.responsableId"
          @change="actualizar('responsableId', $event.target.value)"
        >
          <option value="">Todos</option>
          <option v-for="responsable in responsables" :key="responsable.id" :value="responsable.id">
            {{ responsable.nombre }}
          </option>
        </select>
      </label>

      <label>
        <span>Fecha</span>
        <input
          type="date"
          :value="filtros.fecha"
          @input="actualizar('fecha', $event.target.value)"
        />
      </label>

    </div>
  </section>
</template>

<style scoped>
.filtros {
  display: grid;
  gap: var(--espacio-corto);
  padding: var(--espacio-panel);
  background: var(--color-superficie);
  border: 1px solid var(--color-borde);
  border-radius: var(--radio-panel);
}

.tabs, .controles { display: flex; flex-wrap: wrap; gap: var(--espacio-corto); }
.controles label { display: grid; gap: 4px; flex: 1 1 104px; min-width: 0; }
.controles .busqueda { flex: 2 1 190px; }
.controles span { color: var(--color-secundario); font-size: var(--texto-secundario); font-weight: 600; }
.tabs button, .controles :is(input, select) {
  min-height: var(--altura-control);
  padding: 0 8px;
  border: 1px solid var(--color-borde);
  border-radius: var(--radio-control);
  background: var(--color-superficie);
  color: var(--color-tinta);
}
.controles :is(input, select) { width: 100%; min-width: 0; }
.tabs .activo { background: var(--color-seleccion); color: var(--color-accion); border-color: var(--color-accion); }
@media (max-width: 767px) {
  .controles .busqueda { flex-basis: 100%; }
}
</style>
