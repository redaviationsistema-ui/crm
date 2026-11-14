<script setup>
import { computed } from 'vue'
import BadgeEstado from '@/components/BadgeEstado.vue'
import BadgeMercado from '@/components/BadgeMercado.vue'
import BadgePrioridad from '@/components/BadgePrioridad.vue'
import EstadoVacio from '@/components/EstadoVacio.vue'
import TarjetaIndicador from '@/components/TarjetaIndicador.vue'
import { formatearFecha, formatearHora } from '@/lib/crm'

const props = defineProps({
  rol: {
    type: String,
    default: 'ejecutivo',
  },
  nombreUsuario: {
    type: String,
    default: '',
  },
  indicadores: {
    type: Array,
    default: () => [],
  },
  llamadas: {
    type: Array,
    default: () => [],
  },
  proximaLlamada: {
    type: Object,
    default: null,
  },
})

defineEmits(['abrir-llamada', 'abrir-reportes', 'ver-detalle', 'iniciar'])

const indicadoresPrincipales = computed(() => props.indicadores.slice(0, 4))
const resumenMercados = computed(() => ({
  nacional: props.indicadores[5]?.valor || 0,
  internacional: props.indicadores[6]?.valor || 0,
  completadas: props.indicadores[4]?.valor || 0,
}))
const llamadasResumen = computed(() => props.llamadas.slice(0, 4))
</script>

<template>
  <section class="panel dashboard-shell">
   


    <div class="dashboard-grid">
      <div class="dashboard-columna-principal">
        <article v-if="proximaLlamada" class="bloque proxima-card">
          <div class="proxima-top">
            <div>
              <p class="kicker-local">Próxima llamada</p>
              <strong>{{ proximaLlamada.cliente.nombre }}</strong>
              <p class="proxima-empresa">{{ proximaLlamada.cliente.empresa }}</p>
            </div>
            <span class="proxima-fecha">
              {{ formatearFecha(proximaLlamada.fechaProgramada) }} ·
              {{ formatearHora(proximaLlamada.fechaProgramada) }}
            </span>
          </div>

          <div class="proxima-meta">
            <span class="meta-linea">
              <BadgeMercado :tipo="proximaLlamada.cliente.tipoMercado" />
              <BadgePrioridad :prioridad="proximaLlamada.prioridad" />
            </span>
            <p>{{ proximaLlamada.motivo }}</p>
          </div>

          <div class="proxima-acciones">
            <button class="ghost-card" @click="$emit('ver-detalle', proximaLlamada)">Ver contacto</button>
            <button class="boton-primario" @click="$emit('iniciar', proximaLlamada)">📞 Iniciar llamada</button>
          </div>
        </article>

        <div class="seccion-dashboard">
          <div class="seccion-head">
            <div>
              <p>Indicadores</p>
              <strong>Resumen de jornada</strong>
            </div>
          </div>

          <div class="grid-indicadores indicadores-compactos">
            <TarjetaIndicador
              v-for="item in indicadoresPrincipales"
              :key="item.titulo"
              :titulo="item.titulo"
              :valor="item.valor"
              :ayuda="item.ayuda"
              :tono="item.tono"
            />
          </div>
        </div>

        <article class="bloque bloque-llamadas-resumen">
          <div class="bloque-head">
            <div>
              <p>Mis llamadas</p>
              <strong>Llamadas asignadas pendientes de atención.</strong>
            </div>
          </div>

          <div v-if="llamadasResumen.length" class="tabla-resumen">
            <table>
              <thead>
                <tr>
                  <th>Prioridad</th>
                  <th>Cliente</th>
                  <th>Mercado</th>
                  <th>Fecha</th>
                  <th>Estado</th>
                  <th>Acción</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="llamada in llamadasResumen" :key="llamada.id">
                  <td><BadgePrioridad :prioridad="llamada.prioridad" /></td>
                  <td>
                    <strong>{{ llamada.cliente.nombre }}</strong>
                    <span>{{ llamada.cliente.empresa }}</span>
                  </td>
                  <td><BadgeMercado :tipo="llamada.cliente.tipoMercado" /></td>
                  <td>{{ formatearFecha(llamada.fechaProgramada, { incluirHora: true }) }}</td>
                  <td>
                    <BadgeEstado :estado="llamada.estado" :fecha-programada="llamada.fechaProgramada" />
                  </td>
                  <td class="acciones-inline">
                    <button class="ghost-link" @click="$emit('ver-detalle', llamada)">Ver</button>
                    <button class="ghost-link primario-link" @click="$emit('iniciar', llamada)">Llamar</button>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <EstadoVacio
            v-else
            class="estado-resumen"
            titulo="No tienes llamadas pendientes."
            descripcion=""
          />
        </article>
      </div>

      <div class="dashboard-columna-lateral">
        <article class="bloque bloque-mercados">
          <div class="bloque-head">
            <div>
              <p>Mercados</p>
              <strong>Distribución actual</strong>
            </div>
          </div>
          <div class="mercado-lista">
            <div class="mercado-item">
              <span>🇲🇽 Nacional</span>
              <strong>{{ resumenMercados.nacional }}</strong>
            </div>
            <div class="mercado-item">
              <span>🌎 Internacional</span>
              <strong>{{ resumenMercados.internacional }}</strong>
            </div>
            <div class="mercado-item destacado">
              <span>Completadas</span>
              <strong>{{ resumenMercados.completadas }}</strong>
            </div>
          </div>
        </article>
      </div>
    </div>
  </section>
</template>

<style scoped>
.dashboard-shell {
  gap: 1.25rem;
}

.hero-panel-compacto {
  padding: 1.4rem 1.5rem;
  border-radius: 18px;
}

.hero-panel-compacto h1 {
  font-size: clamp(1.6rem, 2vw, 2rem);
}

.dashboard-grid {
  display: grid;
  grid-template-columns: minmax(0, 2fr) minmax(280px, 1fr);
  gap: 1.25rem;
}

.dashboard-columna-principal,
.dashboard-columna-lateral,
.seccion-dashboard {
  display: grid;
  gap: 1.25rem;
}

.proxima-card {
  display: grid;
  gap: 1rem;
}

.proxima-top {
  display: flex;
  justify-content: space-between;
  gap: 1rem;
  align-items: flex-start;
}

.kicker-local {
  margin: 0 0 0.35rem;
  font-size: 0.78rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: #60708d;
}

.proxima-card strong {
  color: #07172f;
  font-size: 1.35rem;
}

.proxima-empresa,
.proxima-meta p {
  margin: 0;
  color: #61708d;
}

.proxima-fecha {
  color: #335fa8;
  font-weight: 700;
  font-size: 0.86rem;
  text-align: right;
}

.proxima-meta {
  display: grid;
  gap: 0.65rem;
}

.meta-linea {
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
  align-items: center;
}

.proxima-acciones {
  display: flex;
  gap: 0.75rem;
}

.ghost-card {
  min-height: 2.9rem;
  border-radius: 14px;
  border: 1px solid #dbe5f4;
  background: #fff;
  color: #1f4e9d;
  font-weight: 700;
  padding: 0.8rem 1rem;
}

.seccion-head p {
  margin: 0 0 0.2rem;
  color: #61708d;
}

.seccion-head strong {
  color: #07172f;
  font-size: 1.05rem;
}

.indicadores-compactos {
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 1rem;
}

.bloque-llamadas-resumen {
  padding: 1.1rem 1.15rem;
}

.tabla-resumen {
  overflow: auto;
}

.tabla-resumen table {
  width: 100%;
  min-width: 760px;
  border-collapse: collapse;
}

.tabla-resumen th,
.tabla-resumen td {
  padding: 0.9rem 0.5rem;
  text-align: left;
  border-bottom: 1px solid #edf2fb;
  vertical-align: middle;
}

.tabla-resumen th {
  color: #60708d;
  font-size: 0.78rem;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.tabla-resumen td strong,
.tabla-resumen td span {
  display: block;
}

.tabla-resumen td span {
  color: #71819c;
}

.acciones-inline {
  white-space: nowrap;
}

.ghost-link {
  border: 0;
  background: transparent;
  color: #44618e;
  font-weight: 700;
  padding: 0;
  margin-right: 0.75rem;
}

.primario-link {
  color: #1167e8;
}

.estado-resumen :deep(.estado-vacio) {
  padding: 1rem;
  border-radius: 14px;
  text-align: left;
  background: #f8fbff;
}

.mercado-lista {
  display: grid;
  gap: 0.8rem;
}

.mercado-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 1rem;
  padding: 0.9rem 1rem;
  border-radius: 14px;
  background: #f8fbff;
  border: 1px solid #e4eaf2;
}

.mercado-item span {
  color: #435674;
  font-weight: 700;
}

.mercado-item strong {
  color: #07172f;
  font-size: 1.8rem;
}

.destacado {
  background: linear-gradient(180deg, #fefefe, #f4f7fb);
}

@media (max-width: 1199px) {
  .dashboard-grid {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 767px) {
  .hero-panel-compacto {
    padding: 1.15rem;
  }

  .proxima-top,
  .proxima-acciones {
    flex-direction: column;
  }

  .indicadores-compactos {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
</style>
