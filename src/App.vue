<script setup>
import { RouterView } from 'vue-router'
import { useAuthSession } from '@/composables/useAuthSession'

const auth = useAuthSession()
</script>

<template>
  <div v-if="auth.state.checking && !auth.state.initialized" class="auth-loading">
    <div class="auth-loading-card">
      <strong>Comprobando sesión</strong>
      <p>Cargando acceso seguro al CRM...</p>
    </div>
  </div>
  <RouterView v-else />
</template>

<style scoped>
.auth-loading {
  min-height: 100vh;
  display: grid;
  place-items: center;
  padding: 1.5rem;
  background:
    radial-gradient(circle at top left, rgba(17, 103, 232, 0.12), transparent 28%),
    linear-gradient(180deg, #f9fbff 0%, #f6f8fc 100%);
}

.auth-loading-card {
  padding: 1.5rem 1.75rem;
  border-radius: 24px;
  background: rgba(255, 255, 255, 0.92);
  border: 1px solid #dfe7f5;
  box-shadow: 0 18px 38px rgba(7, 23, 47, 0.08);
  text-align: center;
}

.auth-loading-card strong {
  display: block;
  color: #07172f;
  font-size: 1.05rem;
}

.auth-loading-card p {
  margin: 0.45rem 0 0;
  color: #667793;
}
</style>
