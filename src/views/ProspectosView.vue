<script setup>
import { computed, ref, watch } from 'vue'
import BadgeMercado from '../components/BadgeMercado.vue'
import { formatearFecha, normalizarTexto, resolverEstadoLlamada } from '../lib/crm'

const props = defineProps({
  rol: {
    type: String,
    default: 'ejecutivo',
  },
  prospectos: {
    type: Array,
    default: () => [],
  },
  llamadas: {
    type: Array,
    default: () => [],
  },
  usuarios: {
    type: Array,
    default: () => [],
  },
  contactoDestacado: {
    type: Object,
    default: () => ({ id: '', nonce: 0 }),
  },
})

const emit = defineEmits(['nuevo-contacto', 'programar-llamada'])

const busqueda = ref('')
const mercado = ref('todos')
const responsableId = ref('')
const prioridad = ref('todas')
const pais = ref('')
const detalleAbierto = ref(false)
const prospectoActivoId = ref('')
const tabDetalle = ref('resumen')
const menuAbiertoId = ref('')

const mapaUsuarios = computed(() =>
  new Map(
    props.usuarios.map((usuario) => [
      usuario.id,
      usuario.nombreCompleto || usuario.nombre || 'Sin nombre',
    ]),
  ),
)

const prospectosEnriquecidos = computed(() =>
  props.prospectos.map((prospecto) => {
    const llamadasRelacionadas = props.llamadas
      .filter((llamada) => llamada.prospectoId === prospecto.id)
      .sort(
        (a, b) =>
          new Date(b.fechaFin || b.fechaInicio || b.fechaProgramada || 0).getTime() -
          new Date(a.fechaFin || a.fechaInicio || a.fechaProgramada || 0).getTime(),
      )

    const proximaLlamada =
      llamadasRelacionadas
        .filter((llamada) => {
          const fecha = llamada.fechaProgramada ? new Date(llamada.fechaProgramada).getTime() : 0
          return (
            resolverEstadoLlamada(llamada) === 'pendiente' &&
            fecha >= Date.now()
          )
        })
        .sort(
          (a, b) => new Date(a.fechaProgramada).getTime() - new Date(b.fechaProgramada).getTime(),
        )[0] || null

    const ultimaLlamada =
      llamadasRelacionadas
        .filter((llamada) => llamada.fechaFin || llamada.fechaInicio || llamada.fechaProgramada)
        .sort(
          (a, b) =>
            new Date(b.fechaFin || b.fechaInicio || b.fechaProgramada).getTime() -
            new Date(a.fechaFin || a.fechaInicio || a.fechaProgramada).getTime(),
        )[0] || null

    return {
      ...prospecto,
      empresaVisible: prospecto.empresa || 'Particular',
      responsableVisible:
        mapaUsuarios.value.get(prospecto.responsableId) ||
        prospecto.responsableNombre ||
        'Sin asignar',
      paisVisible: prospecto.pais || 'Sin definir',
      prioridadVisible: prospecto.prioridad || 'media',
      aeronaveVisible: [prospecto.fabricanteInteres, prospecto.modeloInteres].filter(Boolean),
      llamadasRelacionadas,
      ultimaLlamadaCalculada: ultimaLlamada,
      proximaLlamadaCalculada: proximaLlamada,
      tieneSeguimientoPendiente: Boolean(proximaLlamada),
    }
  }),
)

const prospectosFiltrados = computed(() => {
  const termino = normalizarTexto(busqueda.value)

  return prospectosEnriquecidos.value.filter((prospecto) => {
    if (mercado.value !== 'todos' && normalizarTexto(prospecto.mercado) !== mercado.value) {
      return false
    }

    if (responsableId.value && prospecto.responsableId !== responsableId.value) {
      return false
    }

    if (prioridad.value !== 'todas' && normalizarTexto(prospecto.prioridadVisible) !== prioridad.value) {
      return false
    }

    if (pais.value && !normalizarTexto(prospecto.paisVisible).includes(normalizarTexto(pais.value))) {
      return false
    }

    if (!termino) {
      return true
    }

    const contenido = [
      prospecto.nombre,
      prospecto.empresaVisible,
      prospecto.telefono,
      prospecto.fabricanteInteres,
      prospecto.modeloInteres,
    ]
      .join(' ')
      .toLowerCase()

    return contenido.includes(termino)
  })
})

const indicadores = computed(() => [
  {
    label: 'Total contactos',
    valor: prospectosEnriquecidos.value.length,
  },
  {
    label: 'Nacionales',
    valor: prospectosEnriquecidos.value.filter(
      (prospecto) => normalizarTexto(prospecto.mercado) === 'nacional',
    ).length,
  },
  {
    label: 'Internacionales',
    valor: prospectosEnriquecidos.value.filter(
      (prospecto) => normalizarTexto(prospecto.mercado) === 'internacional',
    ).length,
  },
  {
    label: 'Con seguimiento',
    valor: prospectosEnriquecidos.value.filter((prospecto) => prospecto.tieneSeguimientoPendiente)
      .length,
  },
])

const prospectoActivo = computed(
  () => prospectosEnriquecidos.value.find((prospecto) => prospecto.id === prospectoActivoId.value) || null,
)

const historialProspecto = computed(() =>
  [...(prospectoActivo.value?.llamadasRelacionadas || [])].sort(
    (a, b) =>
      new Date(b.fechaFin || b.fechaInicio || b.fechaProgramada || 0).getTime() -
      new Date(a.fechaFin || a.fechaInicio || a.fechaProgramada || 0).getTime(),
  ),
)

function abrirDetalle(prospecto, tab = 'resumen') {
  prospectoActivoId.value = prospecto.id
  tabDetalle.value = tab
  detalleAbierto.value = true
  menuAbiertoId.value = ''
}

function cerrarDetalle() {
  detalleAbierto.value = false
}

function alternarMenu(prospectoId) {
  menuAbiertoId.value = menuAbiertoId.value === prospectoId ? '' : prospectoId
}

function programarDesdeContacto(prospecto) {
  menuAbiertoId.value = ''
  emit('programar-llamada', prospecto)
}

function clasePrioridad(prioridadActual) {
  return `prioridad prioridad-${normalizarTexto(prioridadActual || 'media')}`
}

function textoAeronave(prospecto) {
  if (!prospecto.aeronaveVisible.length) {
    return ['Sin definir']
  }

  return prospecto.aeronaveVisible
}

watch(
  () => props.contactoDestacado?.nonce,
  () => {
    if (!props.contactoDestacado?.id) {
      return
    }

    const prospecto = prospectosEnriquecidos.value.find(
      (item) => item.id === props.contactoDestacado.id,
    )

    if (prospecto) {
      abrirDetalle(prospecto)
    }
  },
)
</script>

<template>
  <section class="vista-contactos">
    <div class="indicadores-contacto">
      <article v-for="item in indicadores" :key="item.label" class="indicador-contacto">
        <span>{{ item.label }}</span>
        <strong>{{ item.valor }}</strong>
      </article>
    </div>

    <section class="panel-filtros">
      <label class="campo-buscar">
        <span>Buscar</span>
        <input
          v-model="busqueda"
          type="text"
          placeholder="Buscar por nombre, empresa, teléfono o aeronave..."
        />
      </label>

      <label>
        <span>Mercado</span>
        <select v-model="mercado">
          <option value="todos">Todos los mercados</option>
          <option value="nacional">Nacional</option>
          <option value="internacional">Internacional</option>
        </select>
      </label>

      <label v-if="rol !== 'ejecutivo'">
        <span>Responsable</span>
        <select v-model="responsableId">
          <option value="">Todos los responsables</option>
          <option v-for="usuario in usuarios" :key="usuario.id" :value="usuario.id">
            {{ usuario.nombreCompleto || usuario.nombre }}
          </option>
        </select>
      </label>

      <label>
        <span>Prioridad</span>
        <select v-model="prioridad">
          <option value="todas">Todas las prioridades</option>
          <option value="baja">Baja</option>
          <option value="media">Media</option>
          <option value="alta">Alta</option>
          <option value="urgente">Urgente</option>
        </select>
      </label>

      <label>
        <span>País</span>
        <input v-model="pais" type="text" placeholder="Filtrar por país" />
      </label>
    </section>

    <section class="tabla-contactos">
      <table class="solo-escritorio">
        <thead>
          <tr>
            <th>Contacto</th>
            <th>Empresa</th>
            <th>Mercado</th>
            <th>País</th>
            <th>Aeronave de interés</th>
            <th>Prioridad</th>
            <th>Responsable</th>
            <th>Última llamada</th>
            <th>Próxima llamada</th>
            <th>Acciones</th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="prospecto in prospectosFiltrados"
            :key="prospecto.id"
            class="fila-contacto"
            @click="abrirDetalle(prospecto)"
          >
            <td>
              <div class="contacto-principal">
                <strong>{{ prospecto.nombre }}</strong>
                <span>{{ prospecto.telefono || 'Sin teléfono' }}</span>
              </div>
            </td>
            <td>{{ prospecto.empresaVisible }}</td>
            <td><BadgeMercado :tipo="prospecto.mercado" /></td>
            <td>{{ prospecto.paisVisible }}</td>
            <td>
              <div class="texto-en-bloque">
                <span
                  v-for="linea in textoAeronave(prospecto)"
                  :key="`${prospecto.id}-${linea}`"
                >
                  {{ linea }}
                </span>
              </div>
            </td>
            <td>
              <span :class="clasePrioridad(prospecto.prioridadVisible)">
                {{ prospecto.prioridadVisible }}
              </span>
            </td>
            <td>{{ prospecto.responsableVisible }}</td>
            <td>
              {{
                prospecto.ultimaLlamadaCalculada
                  ? formatearFecha(
                      prospecto.ultimaLlamadaCalculada.fechaFin ||
                        prospecto.ultimaLlamadaCalculada.fechaInicio ||
                        prospecto.ultimaLlamadaCalculada.fechaProgramada,
                      { incluirHora: true },
                    )
                  : 'Sin llamadas'
              }}
            </td>
            <td>
              {{
                prospecto.proximaLlamadaCalculada
                  ? formatearFecha(prospecto.proximaLlamadaCalculada.fechaProgramada, {
                      incluirHora: true,
                    })
                  : 'Sin seguimiento'
              }}
            </td>
            <td>
              <div class="acciones-contacto" @click.stop>
                <button class="boton-programar" @click="programarDesdeContacto(prospecto)">
                  📞 Programar
                </button>
                <div class="menu-acciones">
                  <button class="boton-menu" @click="alternarMenu(prospecto.id)">⋮</button>
                  <div v-if="menuAbiertoId === prospecto.id" class="dropdown-acciones">
                    <button @click="abrirDetalle(prospecto)">Ver contacto</button>
                    <button @click="programarDesdeContacto(prospecto)">Programar llamada</button>
                    <button @click="abrirDetalle(prospecto, 'llamadas')">Ver llamadas</button>
                    <button @click="abrirDetalle(prospecto, 'historial')">Ver historial</button>
                  </div>
                </div>
              </div>
            </td>
          </tr>
        </tbody>
      </table>

      <div class="solo-movil tarjetas-contacto">
        <article
          v-for="prospecto in prospectosFiltrados"
          :key="prospecto.id"
          class="tarjeta-contacto"
          @click="abrirDetalle(prospecto)"
        >
          <div class="tarjeta-header">
            <div>
              <strong>{{ prospecto.nombre }}</strong>
              <span>{{ prospecto.empresaVisible }}</span>
            </div>
            <BadgeMercado :tipo="prospecto.mercado" />
          </div>

          <div class="tarjeta-datos">
            <span>{{ prospecto.telefono || 'Sin teléfono' }}</span>
            <span>{{ prospecto.paisVisible }}</span>
            <span>{{ prospecto.responsableVisible }}</span>
          </div>

          <div class="tarjeta-acciones" @click.stop>
            <button class="boton-programar" @click="programarDesdeContacto(prospecto)">
              📞 Programar
            </button>
            <button class="boton-menu" @click="abrirDetalle(prospecto)">Ver contacto</button>
          </div>
        </article>
      </div>
    </section>

    <div v-if="detalleAbierto && prospectoActivo" class="overlay-detalle" @click.self="cerrarDetalle">
      <aside class="panel-detalle">
        <div class="detalle-header">
          <div>
            <p>Detalle del contacto</p>
            <strong>{{ prospectoActivo.nombre }}</strong>
            <span>{{ prospectoActivo.empresaVisible }}</span>
          </div>
          <button @click="cerrarDetalle">✕</button>
        </div>

        <div class="detalle-tags">
          <BadgeMercado :tipo="prospectoActivo.mercado" />
          <span :class="clasePrioridad(prospectoActivo.prioridadVisible)">
            {{ prospectoActivo.prioridadVisible }}
          </span>
        </div>

        <div class="tabs-detalle">
          <button :class="{ activa: tabDetalle === 'resumen' }" @click="tabDetalle = 'resumen'">
            Resumen
          </button>
          <button :class="{ activa: tabDetalle === 'llamadas' }" @click="tabDetalle = 'llamadas'">
            Llamadas
          </button>
          <button
            :class="{ activa: tabDetalle === 'historial' }"
            @click="tabDetalle = 'historial'"
          >
            Historial
          </button>
        </div>

        <div v-if="tabDetalle === 'resumen'" class="detalle-contenido">
          <section class="bloque-detalle">
            <h4>Información de contacto</h4>
            <div class="detalle-grid">
              <div>
                <span>Teléfono</span>
                <strong>{{ prospectoActivo.telefono || 'Sin definir' }}</strong>
              </div>
              <div>
                <span>WhatsApp</span>
                <strong>{{ prospectoActivo.whatsapp || 'Sin definir' }}</strong>
              </div>
              <div>
                <span>Correo</span>
                <strong>{{ prospectoActivo.correo || 'Sin definir' }}</strong>
              </div>
              <div>
                <span>País</span>
                <strong>{{ prospectoActivo.paisVisible }}</strong>
              </div>
            </div>
          </section>

          <section class="bloque-detalle">
            <h4>Interés comercial</h4>
            <div class="detalle-grid">
              <div>
                <span>Fabricante</span>
                <strong>{{ prospectoActivo.fabricanteInteres || 'Sin definir' }}</strong>
              </div>
              <div>
                <span>Modelo</span>
                <strong>{{ prospectoActivo.modeloInteres || 'Sin definir' }}</strong>
              </div>
              <div>
                <span>Presupuesto</span>
                <strong>
                  {{
                    prospectoActivo.presupuesto
                      ? `${Number(prospectoActivo.presupuesto).toLocaleString('es-MX')} ${prospectoActivo.moneda}`
                      : 'Sin definir'
                  }}
                </strong>
              </div>
              <div>
                <span>Responsable</span>
                <strong>{{ prospectoActivo.responsableVisible }}</strong>
              </div>
            </div>
          </section>
        </div>

        <div v-else-if="tabDetalle === 'llamadas'" class="detalle-contenido">
          <article
            v-for="llamada in prospectoActivo.llamadasRelacionadas"
            :key="llamada.id"
            class="evento-llamada"
          >
            <div>
              <strong>{{ llamada.motivoPersonalizado || llamada.motivo || 'Llamada registrada' }}</strong>
              <span>{{ llamada.asignadoANombre || 'Sin responsable' }}</span>
            </div>
            <div class="evento-meta">
              <span>{{ llamada.estado }}</span>
              <span>{{ formatearFecha(llamada.fechaProgramada, { incluirHora: true }) }}</span>
            </div>
          </article>

          <p v-if="!prospectoActivo.llamadasRelacionadas.length" class="sin-registros">
            Este contacto todavía no tiene llamadas registradas.
          </p>
        </div>

        <div v-else class="detalle-contenido">
          <article v-for="llamada in historialProspecto" :key="llamada.id" class="evento-llamada">
            <div>
              <strong>{{ llamada.resultado || llamada.estado }}</strong>
              <span>{{ llamada.notasResultado || llamada.descripcion || 'Sin observaciones' }}</span>
            </div>
            <div class="evento-meta">
              <span>{{ llamada.asignadoANombre || 'Sin responsable' }}</span>
              <span>
                {{
                  formatearFecha(llamada.fechaFin || llamada.fechaInicio || llamada.fechaProgramada, {
                    incluirHora: true,
                  })
                }}
              </span>
            </div>
          </article>

          <p v-if="!historialProspecto.length" class="sin-registros">
            No hay historial disponible para este contacto.
          </p>
        </div>
      </aside>
    </div>
  </section>
</template>

<style scoped>
.vista-contactos {
  display: grid;
  gap: 1rem;
}

.indicadores-contacto {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 0.85rem;
}

.indicador-contacto,
.panel-filtros,
.tabla-contactos,
.tarjeta-contacto,
.panel-detalle {
  background: rgba(255, 255, 255, 0.9);
  border: 1px solid #dfe7f5;
  border-radius: 24px;
  box-shadow: 0 24px 60px rgba(12, 31, 61, 0.08);
}

.indicador-contacto {
  padding: 1rem 1.1rem;
  display: grid;
  gap: 0.35rem;
}

.indicador-contacto span {
  color: #6a7a95;
  font-size: 0.9rem;
  font-weight: 700;
}

.indicador-contacto strong {
  color: #07172f;
  font-size: 1.7rem;
}

.panel-filtros {
  padding: 1rem;
  display: grid;
  grid-template-columns: minmax(220px, 2fr) repeat(4, minmax(0, 1fr));
  gap: 0.85rem;
}

.panel-filtros label {
  display: grid;
  gap: 0.45rem;
}

.panel-filtros span {
  color: #62728e;
  font-weight: 700;
}

.panel-filtros input,
.panel-filtros select {
  min-height: 3rem;
  border: 1px solid #dbe5f4;
  border-radius: 14px;
  padding: 0.8rem 0.95rem;
  font: inherit;
  background: #fff;
}

.tabla-contactos {
  overflow: hidden;
}

table {
  width: 100%;
  border-collapse: collapse;
}

th,
td {
  padding: 1rem;
  text-align: left;
  border-bottom: 1px solid #e7edf7;
  vertical-align: top;
}

th {
  color: #60708d;
  font-size: 0.83rem;
  text-transform: uppercase;
  letter-spacing: 0.06em;
}

.fila-contacto {
  cursor: pointer;
}

.fila-contacto:hover {
  background: #f8fbff;
}

.contacto-principal,
.texto-en-bloque {
  display: grid;
  gap: 0.2rem;
}

.contacto-principal strong,
.evento-llamada strong {
  color: #07172f;
}

.contacto-principal span,
.texto-en-bloque span,
.evento-llamada span {
  color: #6f7f9a;
}

.prioridad {
  display: inline-flex;
  padding: 0.35rem 0.7rem;
  border-radius: 999px;
  font-size: 0.82rem;
  font-weight: 700;
  text-transform: capitalize;
}

.prioridad-baja {
  background: #eff5ff;
  color: #315ea5;
}

.prioridad-media {
  background: #eef4ff;
  color: #2a5ab0;
}

.prioridad-alta {
  background: #ffeceb;
  color: #c1514d;
}

.prioridad-urgente {
  background: #ffe2de;
  color: #aa2d26;
}

.acciones-contacto {
  display: flex;
  align-items: center;
  gap: 0.55rem;
  position: relative;
}

.boton-programar,
.boton-menu,
.tabs-detalle button,
.dropdown-acciones button,
.detalle-header button {
  border: 0;
  cursor: pointer;
  font: inherit;
}

.boton-programar {
  min-height: 2.5rem;
  border-radius: 12px;
  padding: 0 0.9rem;
  background: #e9f2ff;
  color: #1656bf;
  font-weight: 700;
}

.boton-menu {
  width: 2.5rem;
  height: 2.5rem;
  border-radius: 12px;
  background: #f1f5fb;
  color: #2e4b78;
  font-size: 1.3rem;
}

.menu-acciones {
  position: relative;
}

.dropdown-acciones {
  position: absolute;
  right: 0;
  top: calc(100% + 0.4rem);
  min-width: 13rem;
  background: #fff;
  border: 1px solid #dbe5f4;
  border-radius: 16px;
  box-shadow: 0 20px 40px rgba(8, 28, 61, 0.18);
  padding: 0.4rem;
  display: grid;
  z-index: 8;
}

.dropdown-acciones button {
  background: transparent;
  text-align: left;
  color: #243957;
  border-radius: 12px;
  padding: 0.7rem 0.8rem;
}

.dropdown-acciones button:hover {
  background: #f3f7ff;
}

.solo-movil {
  display: none;
}

.tarjetas-contacto {
  padding: 1rem;
  gap: 0.85rem;
}

.tarjeta-contacto {
  padding: 1rem;
  display: grid;
  gap: 0.8rem;
}

.tarjeta-header,
.tarjeta-acciones {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
}

.tarjeta-header div,
.tarjeta-datos {
  display: grid;
  gap: 0.25rem;
}

.tarjeta-header span,
.tarjeta-datos span {
  color: #6d7c96;
}

.overlay-detalle {
  position: fixed;
  inset: 0;
  background: rgba(8, 23, 47, 0.42);
  display: flex;
  justify-content: flex-end;
  z-index: 30;
}

.panel-detalle {
  width: min(100%, 480px);
  min-height: 100%;
  padding: 1.25rem;
  overflow: auto;
  display: grid;
  gap: 1rem;
}

.detalle-header {
  display: flex;
  justify-content: space-between;
  gap: 1rem;
}

.detalle-header p,
.bloque-detalle h4 {
  margin: 0;
  color: #60708d;
}

.detalle-header strong {
  display: block;
  color: #07172f;
  font-size: 1.45rem;
}

.detalle-header span {
  color: #6d7c96;
}

.detalle-header button {
  width: 2.4rem;
  height: 2.4rem;
  border-radius: 999px;
  background: #edf3fc;
}

.detalle-tags,
.tabs-detalle {
  display: flex;
  gap: 0.6rem;
  flex-wrap: wrap;
}

.tabs-detalle button {
  border-radius: 999px;
  padding: 0.65rem 0.95rem;
  background: #eef3fb;
  color: #5c6f8f;
  font-weight: 700;
}

.tabs-detalle button.activa {
  background: #1167e8;
  color: #fff;
}

.detalle-contenido {
  display: grid;
  gap: 1rem;
}

.bloque-detalle {
  border: 1px solid #e1eaf7;
  border-radius: 20px;
  padding: 1rem;
  display: grid;
  gap: 0.85rem;
}

.detalle-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.9rem;
}

.detalle-grid span {
  display: block;
  margin-bottom: 0.25rem;
  color: #6f8099;
}

.detalle-grid strong {
  color: #07172f;
}

.evento-llamada {
  border: 1px solid #e1eaf6;
  border-radius: 18px;
  padding: 0.95rem 1rem;
  display: grid;
  gap: 0.5rem;
}

.evento-meta {
  display: flex;
  justify-content: space-between;
  gap: 0.75rem;
  flex-wrap: wrap;
}

.sin-registros {
  margin: 0;
  color: #667895;
}

@media (max-width: 1199px) {
  .panel-filtros {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 959px) {
  .indicadores-contacto {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .solo-escritorio {
    display: none;
  }

  .solo-movil {
    display: grid;
  }
}

@media (max-width: 767px) {
  .panel-filtros,
  .detalle-grid,
  .indicadores-contacto {
    grid-template-columns: 1fr;
  }

  .panel-detalle {
    width: 100%;
    border-radius: 0;
  }
}
</style>
