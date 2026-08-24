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

      <label class="busqueda">
        <span>Buscar</span>
        <input
          type="search"
          :value="filtros.busqueda"
          placeholder="Buscar cliente, empresa, telefono o motivo..."
          @input="actualizar('busqueda', $event.target.value)"
        />
      </label>
    </div>
  </section>
</template>

<style scoped>
.filtros {
  display: grid;
  gap: 1rem;
}

.tabs {
  display: flex;
  gap: 0.65rem;
  flex-wrap: wrap;
}

.tabs button,
.controles select,
.controles input {
  border: 1px solid #dbe5f4;
  background: #fff;
  border-radius: 14px;
}

.tabs button {
  padding: 0.85rem 1rem;
  font-weight: 700;
  color: #5d6d8c;
  cursor: pointer;
}

.tabs .activo {
  background: #1167e8;
  color: #fff;
  border-color: #1167e8;
}

.controles {
  display: grid;
  grid-template-columns: repeat(6, minmax(0, 1fr));
  gap: 0.85rem;
}

.controles label {
  display: grid;
  gap: 0.35rem;
}

.controles span {
  font-size: 0.82rem;
  color: #60708d;
  font-weight: 700;
}

.controles select,
.controles input {
  min-height: 3rem;
  padding: 0 0.9rem;
  color: #07172f;
}

.busqueda {
  grid-column: span 2;
}

@media (max-width: 1024px) {
  .controles {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .busqueda {
    grid-column: span 2;
  }
}

@media (max-width: 767px) {
  .controles {
    grid-template-columns: 1fr;
  }

  .busqueda {
    grid-column: auto;
  }
}
</style>
