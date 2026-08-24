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

function seleccionarVista(id) {
  emit('cambiar-vista', id)
  emit('cerrar')
}
</script>

<template>
  <aside class="crm-sidebar" :class="{ abierto }">
    <div class="marca">
      <strong>Centro comercial</strong>
      <small>Llamadas y seguimiento</small>
    </div>

    <nav class="menu">
      <button
        v-for="item in items"
        :key="item.id"
        class="menu-item"
        :class="{ activo: vistaActiva === item.id }"
        @click="seleccionarVista(item.id)"
      >
        <span>{{ item.icono }}</span>
        {{ item.label }}
      </button>
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
  background: #07172f;
  color: #f5f8ff;
  padding: 1.5rem 1.1rem;
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
  min-height: 100%;
}

.marca {
  padding: 0.8rem;
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 20px;
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
  gap: 0.4rem;
}

.menu-item {
  border: 0;
  border-radius: 16px;
  background: transparent;
  color: inherit;
  text-align: left;
  padding: 0.95rem 1rem;
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
  border-radius: 20px;
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
  background: linear-gradient(135deg, #3a88ff, #7cb4ff);
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
    position: fixed;
    inset: 0 auto 0 0;
    width: min(86vw, 320px);
    transform: translateX(-100%);
    transition: transform 0.25s ease;
    z-index: 30;
  }

  .crm-sidebar.abierto {
    transform: translateX(0);
  }
}
</style>
