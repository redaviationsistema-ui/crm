<script setup>
defineProps({
  titulo: {
    type: String,
    required: true,
  },
  subtitulo: {
    type: String,
    default: '',
  },
  mercado: {
    type: String,
    default: 'Todos',
  },
  accionPrincipalLabel: {
    type: String,
    default: '+ Programar llamada',
  },
  accionSecundariaLabel: {
    type: String,
    default: '',
  },
})

defineEmits(['toggle-sidebar', 'accion-principal', 'accion-secundaria'])
</script>

<template>
  <header class="crm-header">
    <div class="header-principal">
      <button class="hamburguesa" @click="$emit('toggle-sidebar')">☰</button>
      <div>
        <p>{{ titulo }}</p>
        <small>{{ subtitulo }}</small>
      </div>
    </div>

    <div class="header-acciones">
      <span class="mercado">{{ mercado }}</span>
      <button
        v-if="accionSecundariaLabel"
        class="boton-secundario"
        @click="$emit('accion-secundaria')"
      >
        {{ accionSecundariaLabel }}
      </button>
      <button class="boton-primario" @click="$emit('accion-principal')">
        {{ accionPrincipalLabel }}
      </button>
    </div>
  </header>
</template>

<style scoped>
.crm-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  padding: 1.4rem 1.5rem;
  border-bottom: 1px solid #dfe7f5;
  background: rgba(255, 255, 255, 0.9);
  backdrop-filter: blur(16px);
  position: sticky;
  top: 0;
  z-index: 15;
}

.header-principal {
  display: flex;
  align-items: center;
  gap: 0.9rem;
}

.header-principal p {
  margin: 0;
  color: #07172f;
  font-weight: 800;
  font-size: 1.25rem;
}

.header-principal small {
  color: #6e7d97;
}

.header-acciones {
  display: flex;
  align-items: center;
  gap: 0.9rem;
}

.hamburguesa {
  display: none;
  border: 1px solid #dbe5f4;
  background: #fff;
  border-radius: 14px;
  width: 2.8rem;
  height: 2.8rem;
  cursor: pointer;
}

.mercado {
  padding: 0.7rem 0.95rem;
  border-radius: 999px;
  background: #eef4ff;
  color: #335fa8;
  font-weight: 700;
}

.boton-primario {
  border: 0;
  border-radius: 16px;
  background: #1167e8;
  color: #fff;
  padding: 0.9rem 1.15rem;
  font-weight: 700;
  cursor: pointer;
  box-shadow: 0 14px 28px rgba(17, 103, 232, 0.24);
}

.boton-secundario {
  border: 1px solid #d6e1f2;
  border-radius: 16px;
  background: #ffffff;
  color: #2859a3;
  padding: 0.9rem 1.15rem;
  font-weight: 700;
  cursor: pointer;
}

@media (max-width: 767px) {
  .crm-header {
    flex-direction: column;
    align-items: stretch;
  }

  .hamburguesa {
    display: inline-grid;
    place-items: center;
  }

  .header-acciones {
    justify-content: space-between;
    flex-wrap: wrap;
  }

  .boton-primario,
  .boton-secundario {
    flex: 1;
  }
}
</style>
