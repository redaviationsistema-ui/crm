import { computed, reactive } from 'vue'
import { supabase } from '@/lib/supabase'

const state = reactive({
  session: null,
  user: null,
  perfil: null,
  checking: true,
  initialized: false,
  listenerStarted: false,
})

let authSubscription = null

function limpiarEstado() {
  state.session = null
  state.user = null
  state.perfil = null
}

async function obtenerPerfil(userId) {
  const { data, error } = await supabase
    .from('perfiles')
    .select(`
      id,
      nombre,
      apellidos,
      correo,
      telefono,
      avatar_url,
      rol,
      activo
    `)
    .eq('id', userId)
    .single()

  if (error) {
    if (error.code === 'PGRST116') {
      return null
    }

    throw error
  }

  return data
}

function mensajePorEstado(estado) {
  if (estado === 'no-profile') {
    return 'Tu usuario existe, pero no tiene un perfil CRM configurado.'
  }

  if (estado === 'inactive') {
    return 'Tu acceso al CRM está desactivado.'
  }

  return ''
}

function normalizarErrorAuth(error) {
  const mensaje = error?.message?.trim()
  const normalizado = new Error(mensaje || 'Ocurrió un error al iniciar sesión.')
  if (error?.code) normalizado.code = error.code
  if (Number.isInteger(error?.status)) normalizado.status = error.status
  return normalizado
}

export async function validarAccesoCrm() {
  state.checking = true

  try {
    const {
      data: { session },
      error,
    } = await supabase.auth.getSession()

    if (error) {
      throw error
    }

    if (!session) {
      limpiarEstado()
      return { status: 'no-session' }
    }

    state.session = session
    state.user = session.user

    const perfil = await obtenerPerfil(session.user.id)

    if (!perfil) {
      limpiarEstado()
      return { status: 'no-profile' }
    }

    if (perfil.activo !== true) {
      limpiarEstado()
      return { status: 'inactive' }
    }

    state.perfil = perfil
    return { status: 'ok', session, user: session.user, perfil }
  } finally {
    state.checking = false
    state.initialized = true
  }
}

export async function iniciarSesionConPassword(email, password) {
  const { error } = await supabase.auth.signInWithPassword({
    email,
    password,
  })

  if (error) {
    throw normalizarErrorAuth(error)
  }

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser()

  if (userError) {
    throw userError
  }

  if (!user) {
    throw new Error('No fue posible recuperar el usuario autenticado.')
  }

  const perfil = await obtenerPerfil(user.id)

  if (!perfil) {
    await supabase.auth.signOut()
    throw new Error('Tu usuario existe, pero no tiene un perfil CRM configurado.')
  }

  if (perfil.activo !== true) {
    await supabase.auth.signOut()
    throw new Error('Tu acceso al CRM está desactivado.')
  }

  const {
    data: { session },
  } = await supabase.auth.getSession()

  state.session = session
  state.user = user
  state.perfil = perfil
}

export async function cerrarSesion() {
  await supabase.auth.signOut()
  limpiarEstado()
  state.checking = false
  state.initialized = true
}

export function iniciarAuthListener(router) {
  if (state.listenerStarted) {
    return
  }

  const { data } = supabase.auth.onAuthStateChange(async (event, session) => {
    state.session = session
    state.user = session?.user || null

    if (event === 'SIGNED_OUT') {
      limpiarEstado()
      state.checking = false
      state.initialized = true

      if (router.currentRoute.value.meta.requiresAuth) {
        router.replace('/login')
      }

      return
    }

    if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
      const acceso = await validarAccesoCrm()

      if (acceso.status === 'ok') {
        if (router.currentRoute.value.path === '/login') {
          router.replace('/')
        }

        return
      }

      if (acceso.status === 'no-profile' || acceso.status === 'inactive') {
        await supabase.auth.signOut()
        router.replace({
          path: '/login',
          query: {
            message: mensajePorEstado(acceso.status),
          },
        })
      }
    }
  })

  authSubscription = data.subscription
  state.listenerStarted = true
}

export function detenerAuthListener() {
  if (!authSubscription) {
    return
  }

  authSubscription.unsubscribe()
  authSubscription = null
  state.listenerStarted = false
}

export function useAuthSession() {
  return {
    state,
    isAuthenticated: computed(() => Boolean(state.session && state.user && state.perfil)),
  }
}
