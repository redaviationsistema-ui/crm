<script setup>
import { computed } from 'vue'
import { obtenerIniciales } from '../lib/crm'

const props = defineProps({
  abierto: {
    type: Boolean,
    default: false,
  },
  vistaActiva: {
    type: String,
    required: true,
  },
  usuario: {
    type: Object,
    required: true,
  },
  items: {
    type: Array,
    default: () => [],
  },
})

const emit = defineEmits(['cambiar-vista', 'cerrar', 'cerrar-sesion', 'ir-mi-perfil'])

const nombreUsuario = computed(
  () => props.usuario?.nombreCompleto || props.usuario?.nombre || props.usuario?.email || 'Usuario',
)
const avatar = computed(() => obtenerIniciales(nombreUsuario.value))

const areas = {
  contactos: 'Comercial',
  oportunidades: 'Comercial',
  cotizaciones: 'Comercial',
  llamadas: 'Actividad',
  seguimientos: 'Actividad',
  historial: 'Actividad',
  equipo: 'Gestión',
  reportes: 'Gestión',
  usuarios: 'Gestión',
  configuracion: 'Gestión',
}
const gruposMenu = computed(() => {
  const grupos = new Map()
  for (const item of props.items) {
    const area = areas[item.id] || ''
    if (!grupos.has(area)) grupos.set(area, [])
    grupos.get(area).push(item)
  }
  return grupos
})

function seleccionarVista(id) {
  emit('cambiar-vista', id)
  emit('cerrar')
}
</script>

<template>
  <aside class="crm-sidebar" :class="{ abierto }">
    <div class="marca">
      <strong>Sky Group LLC</strong>
      <small>CRM Aviación</small>
    </div>

    <nav class="menu" aria-label="Módulos del CRM">
      <div v-for="[area, opciones] in gruposMenu" :key="area" class="grupo-menu">
        <small v-if="area">{{ area }}</small>
        <button
          v-for="item in opciones"
          :key="item.id"
          class="menu-item"
          :class="{ activo: vistaActiva === item.id }"
          :aria-current="vistaActiva === item.id ? 'page' : undefined"
          @click="seleccionarVista(item.id)"
        >
          <span aria-hidden="true">{{ item.icono }}</span>
          {{ item.label }}
        </button>
      </div>
    </nav>

    <div class="perfil">
      <div class="avatar">{{ avatar }}</div>
      <div>
        <strong>{{ nombreUsuario }}</strong>
        <p>{{ usuario.rol || 'Sin rol asignado' }}</p>
      </div>
      <button class="perfil-accion" @click="emit('ir-mi-perfil')">Mi perfil</button>
      <button class="salir" @click="emit('cerrar-sesion')">Cerrar sesión</button>
    </div>
  </aside>
</template>

<style scoped>
.crm-sidebar {
  background: var(--color-marino);
  color: #f5f8ff;
  padding: 12px;
  display: flex;
  flex-direction: column;
  gap: 14px;
  min-height: 100%;
}

.marca {
  padding: 0.8rem;
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: var(--radio-panel);
  background: rgba(255, 255, 255, 0.03);
}

.marca-kicker,
.marca small,
.perfil p {
  color: #9fb3d6;
}

.marca strong {
  display: block;
  margin: 0.35rem 0;
  font-size: 1.15rem;
}

.menu {
  display: grid;
  gap: 9px;
}

.grupo-menu { display: grid; gap: 2px; }
.grupo-menu > small {
  padding: 2px 9px;
  color: #a8bbd7;
  font-size: var(--texto-secundario);
  font-weight: 600;
}


.menu-item {
  border: 0;
  border-radius: var(--radio-control);
  background: transparent;
  color: inherit;
  text-align: left;
  padding: 6px 9px;
  min-height: var(--altura-control);
  font-size: 0.95rem;
  display: flex;
  align-items: center;
  gap: 0.75rem;
  cursor: pointer;
}

.menu-item.activo,
.menu-item:hover {
  background: rgba(17, 103, 232, 0.18);
  color: #fff;
}

.perfil {
  margin-top: auto;
  padding: 1rem;
  border-radius: var(--radio-panel);
  background: rgba(255, 255, 255, 0.04);
  display: grid;
  grid-template-columns: auto 1fr;
  gap: 0.8rem;
  align-items: center;
}

.avatar {
  width: 2.8rem;
  height: 2.8rem;
  border-radius: 50%;
  background: var(--color-accion);
  color: #fff;
  display: grid;
  place-items: center;
  font-weight: 800;
}

.perfil-accion,
.salir {
  grid-column: 1 / -1;
  border: 0;
  border-radius: 14px;
  padding: 0.8rem 0.9rem;
  cursor: pointer;
}

.perfil-accion {
  margin-top: 0.2rem;
  background: transparent;
  color: #dce8ff;
  border: 1px solid rgba(255, 255, 255, 0.08);
}

.salir {
  background: rgba(255, 255, 255, 0.08);
  color: #fff;
}

@media (max-width: 767px) {
  .crm-sidebar {
    visibility: hidden;
    overflow-y: auto;
    position: fixed;
    inset: 0 auto 0 0;
    width: min(86vw, 320px);
    transform: translateX(-100%);
    transition: transform 0.25s ease;
    z-index: 30;
  }

  .crm-sidebar.abierto {
    visibility: visible;
    transform: translateX(0);
  }
}
</style>
