<script setup>
import { computed, ref } from 'vue'
import BadgeEstado from '../components/BadgeEstado.vue'
import BadgePrioridad from '../components/BadgePrioridad.vue'
import EstadoVacio from '../components/EstadoVacio.vue'
import { formatearFecha } from '../lib/crm'

const props = defineProps({
  rol: { type: String, default: 'ejecutivo' },
  grupos: { type: Object, required: true },
})

defineEmits(['ver-detalle'])

const categorias = {
  hoy: 'Hoy',
  proximas: 'Próximos',
  atrasadas: 'Atrasados',
  completadas: 'Completados',
}
const seleccion = ref('')
const activa = computed(() => seleccion.value || Object.keys(categorias).find(clave => props.grupos[clave]?.length) || 'hoy')
const actividades = computed(() => props.grupos[activa.value] ?? [])
</script>

<template>
  <section class="vista-listado">
    <div class="categorias" role="group" aria-label="Categorías de seguimiento">
      <button
        v-for="(etiqueta, clave) in categorias"
        :key="clave"
        type="button"
        :aria-pressed="activa === clave"
        @click="seleccion = clave"
      >
        {{ etiqueta }}
        <strong>{{ grupos[clave]?.length ?? 0 }}</strong>
      </button>
    </div>

    <div v-if="actividades.length" class="actividades">
      <div class="actividad cabecera" aria-hidden="true">
        <span>Cliente / actividad</span><span>Responsable</span><span>Prioridad</span><span>Programación</span><span>Estado</span><span></span>
      </div>
      <ul>
        <li v-for="llamada in actividades" :key="llamada.id" class="actividad">
          <div><strong>{{ llamada.cliente.nombre }}</strong><small>{{ llamada.motivo }}</small></div>
          <span>{{ llamada.asignadoANombre }}</span>
          <BadgePrioridad :prioridad="llamada.prioridad" />
          <span>{{ formatearFecha(llamada.fechaProgramada, { incluirHora: true }) }}</span>
          <BadgeEstado :estado="llamada.estado" :fecha-programada="llamada.fechaProgramada" />
          <button type="button" @click="$emit('ver-detalle', llamada)">Ver detalle</button>
        </li>
      </ul>
    </div>

    <EstadoVacio v-else titulo="Sin seguimientos" :descripcion="`No hay registros en «${categorias[activa]}».`" />
  </section>
</template>

<style scoped>
.categorias { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: var(--espacio-corto); }
.categorias button, .actividad button {
  min-height: var(--altura-control);
  padding: 6px 10px;
  background: var(--color-superficie);
  color: var(--color-tinta);
  border: 1px solid var(--color-borde);
  border-radius: var(--radio-control);
}
.categorias button { display: flex; flex-wrap: wrap; justify-content: space-between; align-items: center; gap: 4px; }
.categorias [aria-pressed='true'] { background: var(--color-seleccion); color: var(--color-accion); border-color: var(--color-accion); }
.actividades { border: 1px solid var(--color-borde); border-radius: var(--radio-panel); background: var(--color-superficie); }
.actividades ul { list-style: none; margin: 0; padding: 0; }
.actividad { display: grid; align-items: center; grid-template-columns: 2fr 1fr .75fr 1fr .8fr auto; gap: var(--espacio-corto); padding: 6px 12px; }
.actividad > * { min-width: 0; overflow-wrap: anywhere; }
.actividad + .actividad { border-top: 1px solid var(--color-borde); }
.actividad small { display: block; color: var(--color-secundario); }
.cabecera { background: var(--color-fondo); color: var(--color-secundario); font-size: var(--texto-secundario); font-weight: 700; }
@media (max-width: 1024px) {
  .actividad { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .actividad > div { grid-column: 1 / -1; }
  .cabecera { display: none; }
}
@media (max-width: 767px) {
  .categorias { grid-template-columns: repeat(2, minmax(0, 1fr)); }
}
</style>
