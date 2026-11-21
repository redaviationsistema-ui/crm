<script setup>
import AccionesLlamadaMenu from './AccionesLlamadaMenu.vue'
import BadgeEstado from './BadgeEstado.vue'
import BadgeMercado from './BadgeMercado.vue'
import BadgePrioridad from './BadgePrioridad.vue'
import EstadoVacio from './EstadoVacio.vue'
import SkeletonCarga from './SkeletonCarga.vue'
import TarjetaLlamadaMovil from './TarjetaLlamadaMovil.vue'
import { formatearFecha } from '../lib/crm'

defineProps({
  rol: {
    type: String,
    default: 'ejecutivo',
  },
  llamadas: {
    type: Array,
    default: () => [],
  },
  cargando: {
    type: Boolean,
    default: false,
  },
  usuarioActualId: {
    type: String,
    default: null,
  },
})

defineEmits([
  'ver-detalle',
  'iniciar',
  'editar',
  'reasignar',
  'reprogramar',
  'crear-seguimiento',
  'cancelar',
])
</script>

<template>
  <section class="tabla-llamadas">
    <SkeletonCarga v-if="cargando" />

    <EstadoVacio
      v-else-if="!llamadas.length"
      titulo="Sin llamadas por mostrar"
      descripcion="Ajusta filtros o registra una nueva llamada para comenzar."
    />

    <template v-else>
      <div class="version-movil">
        <TarjetaLlamadaMovil
          v-for="llamada in llamadas"
          :key="llamada.id"
          :llamada="llamada"
          @ver="$emit('ver-detalle', $event)"
          @iniciar="$emit('iniciar', $event)"
        />
      </div>

      <div class="version-desktop" tabindex="0" role="region" aria-label="Tabla de llamadas">
        <table>
          <thead>
            <tr>
              <th>Prioridad</th>
              <th>Cliente</th>
              <th>Mercado</th>
              <th>Teléfono</th>
              <th>Motivo</th>
              <th v-if="rol !== 'ejecutivo'">Creado por</th>
              <th v-if="rol !== 'ejecutivo'">Asignado a</th>
              <th>Fecha para llamar</th>
              <th>Estado</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="llamada in llamadas" :key="llamada.id">
              <td><BadgePrioridad :prioridad="llamada.prioridad" /></td>
              <td>
                <strong class="texto-celda" :title="llamada.cliente.nombre">{{ llamada.cliente.nombre }}</strong>
                <span class="texto-celda" :title="llamada.cliente.empresa">{{ llamada.cliente.empresa }}</span>
              </td>
              <td><BadgeMercado :tipo="llamada.cliente.tipoMercado" /></td>
              <td>{{ llamada.cliente.telefono }}</td>
              <td><span class="texto-celda" :title="llamada.motivo">{{ llamada.motivo }}</span></td>
              <td v-if="rol !== 'ejecutivo'">{{ llamada.creadoPorNombre }}</td>
              <td v-if="rol !== 'ejecutivo'">{{ llamada.asignadoANombre }}</td>
              <td>{{ formatearFecha(llamada.fechaProgramada, { incluirHora: true }) }}</td>
              <td>
                <BadgeEstado :estado="llamada.estado" :fecha-programada="llamada.fechaProgramada" />
              </td>
              <td>
                <div class="acciones-tabla">
                  <button
                    v-if="llamada.estado === 'pendiente'"
                    class="accion-rapida"
                    @click="$emit('iniciar', llamada)"
                  >
                    📞 Llamar
                  </button>
                  <AccionesLlamadaMenu
                    :llamada="llamada"
                    :rol="rol"
                    @ver-detalle="$emit('ver-detalle', $event)"
                    @editar="$emit('editar', $event)"
                    @reprogramar="$emit('reprogramar', $event)"
                    @reasignar="$emit('reasignar', $event)"
                    @iniciar="$emit('iniciar', $event)"
                    @crear-seguimiento="$emit('crear-seguimiento', $event)"
                    @cancelar="$emit('cancelar', $event)"
                  />
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </template>
  </section>
</template>

<style scoped>
.version-movil {
  display: none;
}

.version-desktop {
  overflow: auto;
  border: 1px solid #dfe7f5;
  border-radius: var(--radio-panel);
  background: #fff;
}

table {
  width: 100%;
  border-collapse: collapse;
  min-width: 850px;
}

th,
td {
  height: var(--altura-fila);
  padding: 4px 8px;
  text-align: left;
  border-bottom: 1px solid #edf2fb;
  vertical-align: middle;
}

th {
  color: var(--color-secundario);
  background: #f7f9fc;
  font-size: 0.82rem;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

td strong,
td span {
  display: block;
}

td strong {
  color: #07172f;
}

td span {
  color: #71819c;
}

.texto-celda {
  max-inline-size: 18ch;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.acciones-tabla {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 0.4rem;
}

.accion-rapida {
  border: 1px solid #dbe5f4;
  background: #eef4ff;
  color: #1167e8;
  border-radius: 12px;
  padding: 4px 7px;
  font-weight: 700;
}

@media (max-width: 767px) {
  .version-desktop {
    display: none;
  }

  .version-movil {
    display: grid;
    gap: 1rem;
  }
}
</style>
