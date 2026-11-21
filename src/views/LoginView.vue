<script setup>
import { computed, reactive, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { iniciarSesionConPassword, useAuthSession } from '@/composables/useAuthSession'

const route = useRoute()
const router = useRouter()
const auth = useAuthSession()

const formulario = reactive({
  email: '',
  password: '',
})

const estado = reactive({
  cargando: false,
  error: '',
  errorCode: '',
  errorStatus: null,
})
const mostrarPassword = ref(false)

const mensajeRuta = computed(() => String(route.query.message || ''))

async function iniciarSesion() {
  estado.cargando = true
  estado.error = ''
  estado.errorCode = ''
  estado.errorStatus = null

  try {
    await iniciarSesionConPassword(formulario.email, formulario.password)
    router.replace('/')
  } catch (error) {
    estado.error = error?.message || 'Ocurrió un error al iniciar sesión.'
    estado.errorCode = error?.code || ''
    estado.errorStatus = Number.isInteger(error?.status) ? error.status : null
  } finally {
    estado.cargando = false
  }
}
</script>

<template>
  <main class="login-shell">
    <section class="login-hero">
      <p class="eyebrow">Sky Group LLC</p>
      <h1>Acceso a Sky Group</h1>
      <p>
        Gestiona llamadas, contactos y seguimientos con autenticación real de Supabase.
      </p>
    </section>

    <section class="login-card">
      <header>
        <p>Acceso seguro</p>
        <h2>Iniciar sesión</h2>
      </header>

      <p v-if="mensajeRuta" class="feedback warning">{{ mensajeRuta }}</p>
      <p v-else-if="estado.error" class="feedback error">
        <strong v-if="estado.errorStatus || estado.errorCode">
          {{ estado.errorStatus ? `HTTP ${estado.errorStatus}` : '' }}
          {{ estado.errorCode ? `(${estado.errorCode})` : '' }}:
        </strong>
        {{ estado.error }}
      </p>
      <p v-else-if="auth.state.checking" class="feedback neutral">Comprobando sesión...</p>

      <form class="login-form" @submit.prevent="iniciarSesion">
        <label>
          <span>Correo electrónico</span>
          <input v-model="formulario.email" type="email" autocomplete="email" required />
        </label>

        <label>
          <span>Contraseña</span>
          <div class="password-field">
            <input
              v-model="formulario.password"
              :type="mostrarPassword ? 'text' : 'password'"
              autocomplete="current-password"
              required
            />
            <button
              type="button"
              class="password-toggle"
              @click="mostrarPassword = !mostrarPassword"
            >
              {{ mostrarPassword ? 'Ocultar' : 'Ver' }}
            </button>
          </div>
        </label>

        <button type="submit" :disabled="estado.cargando">
          {{ estado.cargando ? 'Iniciando sesión...' : 'Iniciar sesión' }}
        </button>
      </form>
    </section>
  </main>
</template>

<style scoped>
.login-shell {
  min-height: 100vh;
  display: grid;
  grid-template-columns: minmax(0, 1.1fr) minmax(340px, 420px);
  background:
    radial-gradient(circle at top left, rgba(17, 103, 232, 0.18), transparent 30%),
    linear-gradient(180deg, #f7f9fd 0%, #eef3fb 100%);
}

.login-hero {
  padding: clamp(20px, 5vw, 52px);
  background:
    var(--color-marino);
  color: #fff;
  display: grid;
  align-content: center;
  gap: 1rem;
}

.eyebrow {
  margin: 0;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  font-size: 0.8rem;
  color: rgba(255, 255, 255, 0.72);
}

.login-hero h1,
.login-card h2 {
  margin: 0;
}

.login-hero h1 {
  font-size: clamp(1.6rem, 3vw, 2.6rem);
}

.login-hero p {
  margin: 0;
  max-width: 40rem;
  color: rgba(255, 255, 255, 0.84);
  line-height: 1.6;
}

.login-card {
  padding: clamp(16px, 3vw, 28px);
  display: grid;
  align-content: center;
  background: rgba(255, 255, 255, 0.88);
  backdrop-filter: blur(16px);
  border-left: 1px solid rgba(17, 103, 232, 0.08);
}

.login-card header {
  margin-bottom: 1rem;
}

.login-card header p {
  margin: 0 0 0.35rem;
  color: #637392;
  font-weight: 700;
}

.login-form {
  display: grid;
  gap: 1rem;
}

.login-form label {
  display: grid;
  gap: 0.45rem;
}

.login-form span {
  color: #5d6d8b;
  font-weight: 700;
}

.login-form input {
  min-height: var(--altura-control);
  border: 1px solid #d8e2f1;
  border-radius: var(--radio-control);
  padding: 0 1rem;
  background: #fff;
  width: 100%;
}

.password-field {
  position: relative;
  display: flex;
  align-items: center;
}

.password-field input {
  padding-right: 5.5rem;
}

.password-toggle {
  position: absolute;
  right: 0.8rem;
  border: 0;
  background: transparent;
  color: #1167e8;
  font-weight: 800;
  padding: 0.35rem 0.45rem;
}

.login-form button {
  min-height: var(--altura-control);
  border: 0;
  border-radius: var(--radio-control);
  background: #1167e8;
  color: #fff;
  font-weight: 800;
  box-shadow: 0 16px 34px rgba(17, 103, 232, 0.24);
}

.login-form button:disabled {
  opacity: 0.7;
  cursor: wait;
}

.feedback {
  margin: 0 0 1rem;
  padding: 0.9rem 1rem;
  border-radius: 14px;
  font-size: 0.94rem;
  line-height: 1.5;
  word-break: break-word;
}

.feedback.error {
  background: #fdeced;
  color: #a62a36;
}

.feedback.warning {
  background: #fff3df;
  color: #9a6217;
}

.feedback.neutral {
  background: #eef4ff;
  color: #2c57a8;
}

@media (max-width: 900px) {
  .login-shell {
    grid-template-columns: 1fr;
  }

  .login-hero {
    padding: 2.25rem 1.25rem;
  }

  .login-card {
    padding: 1.25rem;
    border-left: 0;
  }
}
</style>
