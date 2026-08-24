<script setup>
import { ref, watch } from 'vue'
import BadgeEstado from './BadgeEstado.vue'
import BadgeMercado from './BadgeMercado.vue'
import BadgePrioridad from './BadgePrioridad.vue'
import FormularioResultado from './FormularioResultado.vue'
import HistorialLlamada from './HistorialLlamada.vue'
import { formatearFecha } from '../lib/crm'

const props = defineProps({
  llamada: {
    type: Object,
    default: null,
  },
  abierto: {
    type: Boolean,
    default: false,
  },
  eventos: {
    type: Array,
    default: () => [],
  },
  resultados: {
    type: Array,
    default: () => [],
  },
  usuarios: {
    type: Array,
    default: () => [],
  },
  mostrarVacio: {
    type: Boolean,
    default: true,
  },
  error: {
    type: String,
    default: '',
  },
})

const emit = defineEmits([
  'cerrar',
  'iniciar',
  'editar',
  'reprogramar',
  'reasignar',
  'cancelar',
  'guardar-resultado',
  'crear-seguimiento',
  'finalizar',
])

const tabDetalle = ref('resumen')

watch(
  () => props.llamada?.id,
  () => {
    tabDetalle.value = 'resumen'
  },
)

function iniciarYEnfocarSeguimiento() {
  if (!props.llamada) return
  emit('iniciar', props.llamada)
  tabDetalle.value = 'seguimiento'
}
</script>

<template>
  <aside class="detalle-drawer" :class="{ abierto }">
    <template v-if="llamada">
      <div class="detalle-sticky">
        <div class="drawer-head">
          <div>
            <p>Detalle de llamada</p>
            <strong>{{ llamada.cliente.nombre }}</strong>
            <small>{{ llamada.cliente.empresa }}</small>
          </div>
          <button class="cerrar" @click="$emit('cerrar')">✕</button>
        </div>

        <div class="resumen-topline">
          <BadgeMercado :tipo="llamada.cliente.tipoMercado" />
          <BadgePrioridad :prioridad="llamada.prioridad" />
        </div>

        <div class="tabs-detalle">
          <button :class="{ activa: tabDetalle === 'resumen' }" @click="tabDetalle = 'resumen'">
            Resumen
          </button>
          <button
            :class="{ activa: tabDetalle === 'seguimiento' }"
            @click="tabDetalle = 'seguimiento'"
          >
            Seguimiento
          </button>
          <button
            :class="{ activa: tabDetalle === 'historial' }"
            @click="tabDetalle = 'historial'"
          >
            Historial
          </button>
        </div>
      </div>

      <div v-if="tabDetalle === 'resumen'" class="detalle-seccion">
        <div class="resumen-lista">
          <div class="resumen-item">
            <span>Teléfono</span>
            <strong>{{ llamada.cliente.telefono || 'Sin definir' }}</strong>
          </div>
          <div class="resumen-item">
            <span>País</span>
            <strong>{{ llamada.cliente.pais || 'Sin definir' }}</strong>
          </div>
          <div class="resumen-item">
            <span>Motivo</span>
            <strong>{{ llamada.motivo || 'Sin definir' }}</strong>
          </div>
          <div class="resumen-item">
            <span>Fecha para llamar</span>
            <strong>{{ formatearFecha(llamada.fechaProgramada, { incluirHora: true }) }}</strong>
          </div>
          <div class="resumen-item">
            <span>Creado por</span>
            <strong>{{ llamada.creadoPorNombre || 'Sin definir' }}</strong>
          </div>
          <div class="resumen-item">
            <span>Asignado a</span>
            <strong>{{ llamada.asignadoANombre || 'Sin definir' }}</strong>
          </div>
          <div class="resumen-item">
            <span>Estado</span>
            <div><BadgeEstado :estado="llamada.estado" :fecha-programada="llamada.fechaProgramada" /></div>
          </div>
        </div>

        <div class="acciones-principales">
          <button v-if="llamada.estado === 'pendiente'" class="accion-llamada" @click="iniciarYEnfocarSeguimiento">
            📞 Iniciar llamada
          </button>

          <div class="acciones-secundarias">
            <button class="accion-secundaria" @click="$emit('reprogramar', llamada)">Reprogramar</button>
            <button class="accion-secundaria" @click="$emit('reasignar', llamada)">Reasignar</button>
          </div>

          <button class="link-peligro" @click="$emit('cancelar', llamada)">Cancelar llamada</button>
        </div>
      </div>

      <div v-if="tabDetalle === 'seguimiento'" class="detalle-seccion">
        <FormularioResultado
          :llamada="llamada"
          :resultados="resultados"
          :usuarios="usuarios"
          :error="error"
          @guardar-resultado="$emit('guardar-resultado', $event)"
          @crear-seguimiento="$emit('crear-seguimiento', $event)"
          @finalizar="$emit('finalizar', $event)"
        />
      </div>

      <div v-if="tabDetalle === 'historial'" class="detalle-seccion">
        <div class="historial-wrap">
          <h3>Historial</h3>
          <HistorialLlamada :eventos="eventos" />
        </div>
      </div>
    </template>
  </aside>
</template>

<style scoped>
.detalle-drawer {
  background: #fff;
  border-left: 1px solid #e4eaf2;
  padding: 0;
  display: grid;
  align-content: start;
  overflow-y: auto;
  min-width: 0;
  height: 100vh;
}

.detalle-sticky {
  position: sticky;
  top: 0;
  z-index: 4;
  background: rgba(255, 255, 255, 0.98);
  padding: 1rem 1rem 0.9rem;
  border-bottom: 1px solid #edf2f8;
}

.drawer-head {
  display: flex;
  justify-content: space-between;
  gap: 1rem;
  align-items: flex-start;
}

.drawer-head p,
.drawer-head small {
  margin: 0;
  color: #6b7c97;
}

.drawer-head strong {
  display: block;
  color: #07172f;
  font-size: 1.12rem;
  margin: 0.15rem 0 0.2rem;
}

.cerrar {
  border: 0;
  background: #eef4ff;
  min-height: 2.5rem;
  min-width: 2.5rem;
  border-radius: 999px;
  cursor: pointer;
  color: #16386f;
  font-weight: 700;
}

.resumen-topline {
  display: flex;
  gap: 0.5rem;
  align-items: center;
  margin-top: 0.8rem;
  flex-wrap: wrap;
}

.tabs-detalle {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 0.5rem;
  margin-top: 1rem;
}

.tabs-detalle button {
  min-height: 2.7rem;
  border-radius: 12px;
  border: 1px solid #e4eaf2;
  background: #fff;
  color: #60708d;
  font-weight: 700;
}

.tabs-detalle .activa {
  background: #eef4ff;
  color: #1f4e9d;
  border-color: #d6e4ff;
}

.detalle-seccion {
  padding: 1rem;
}

.resumen-lista {
  display: grid;
  gap: 0.9rem;
}

.resumen-item {
  display: grid;
  gap: 0.3rem;
  padding-bottom: 0.9rem;
  border-bottom: 1px solid #edf2f8;
}

.resumen-item span {
  color: #60708d;
  font-size: 0.78rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.03em;
}

.resumen-item strong {
  color: #07172f;
  font-size: 0.95rem;
}

.accion-llamada {
  min-height: 3rem;
  border: 0;
  border-radius: 14px;
  background: #1167e8;
  color: #fff;
  font-weight: 800;
}

.acciones-principales {
  display: grid;
  gap: 0.9rem;
  margin-top: 1.25rem;
}

.acciones-secundarias {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.75rem;
}

.accion-secundaria {
  min-height: 2.8rem;
  border: 1px solid #e4eaf2;
  border-radius: 14px;
  background: #fff;
  color: #16386f;
  font-weight: 700;
}

.link-peligro {
  border: 0;
  background: transparent;
  color: #a62a36;
  font-weight: 700;
  text-align: left;
  padding: 0;
}

.historial-wrap h3 {
  margin: 0 0 1rem;
  color: #07172f;
  font-size: 1rem;
}

@media (max-width: 1199px) {
  .detalle-drawer {
    position: fixed;
    inset: 0 0 0 auto;
    width: min(100%, 420px);
    transform: translateX(100%);
    transition: transform 0.28s ease;
    z-index: 25;
    box-shadow: -12px 0 32px rgba(15, 23, 42, 0.12);
  }

  .detalle-drawer.abierto {
    transform: translateX(0);
  }
}

@media (max-width: 767px) {
  .detalle-drawer {
    width: 100%;
    max-width: 100%;
    border-left: 0;
  }

  .detalle-sticky {
    padding: 1rem 1rem 0.85rem;
  }

  .cerrar {
    background: transparent;
    color: #1167e8;
    min-width: auto;
  }

  .cerrar::before {
    content: '← Detalle de llamada';
  }

  .cerrar {
    font-size: 0;
  }

  .cerrar::before {
    font-size: 0.95rem;
    font-weight: 700;
  }

  .acciones-secundarias {
    grid-template-columns: 1fr;
  }
}
</style>
