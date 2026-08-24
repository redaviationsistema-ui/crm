<script setup>
import FiltrosLlamadas from '../components/FiltrosLlamadas.vue'
import TablaLlamadas from '../components/TablaLlamadas.vue'

defineProps({
  rol: {
    type: String,
    default: 'ejecutivo',
  },
  filtros: {
    type: Object,
    required: true,
  },
  usuarios: {
    type: Array,
    default: () => [],
  },
  llamadas: {
    type: Array,
    default: () => [],
  },
  usuarioActualId: {
    type: String,
    default: null,
  },
})

defineEmits([
  'update:filtros',
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
  <section class="vista-listado">
    <FiltrosLlamadas
      :rol="rol"
      :filtros="filtros"
      :responsables="usuarios"
      @update:filtros="$emit('update:filtros', $event)"
    />

    <TablaLlamadas
      :rol="rol"
      :llamadas="llamadas"
      :usuario-actual-id="usuarioActualId"
      @ver-detalle="$emit('ver-detalle', $event)"
      @iniciar="$emit('iniciar', $event)"
      @editar="$emit('editar', $event)"
      @reasignar="$emit('reasignar', $event)"
      @reprogramar="$emit('reprogramar', $event)"
      @crear-seguimiento="$emit('crear-seguimiento', $event)"
      @cancelar="$emit('cancelar', $event)"
    />
  </section>
</template>
