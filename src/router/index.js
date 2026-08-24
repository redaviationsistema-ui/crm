import { createRouter, createWebHistory } from 'vue-router'
import { cerrarSesion, iniciarAuthListener, validarAccesoCrm } from '@/composables/useAuthSession'
import CrmShellView from '@/views/CrmShellView.vue'
import LoginView from '@/views/LoginView.vue'

const crmRoutes = [
  { path: '/', component: CrmShellView, meta: { requiresAuth: true, section: 'panel' } },
  {
    path: '/llamadas',
    component: CrmShellView,
    meta: { requiresAuth: true, section: 'llamadas' },
  },
  {
    path: '/contactos',
    component: CrmShellView,
    meta: { requiresAuth: true, section: 'contactos' },
  },
  {
    path: '/prospectos',
    redirect: '/contactos',
  },
  {
    path: '/seguimientos',
    component: CrmShellView,
    meta: { requiresAuth: true, section: 'seguimientos' },
  },
  {
    path: '/historial',
    component: CrmShellView,
    meta: { requiresAuth: true, section: 'historial' },
  },
  {
    path: '/reportes',
    component: CrmShellView,
    meta: {
      requiresAuth: true,
      section: 'reportes',
      roles: ['administrador', 'supervisor'],
    },
  },
  {
    path: '/equipo',
    component: CrmShellView,
    meta: {
      requiresAuth: true,
      section: 'equipo',
      roles: ['administrador', 'supervisor'],
    },
  },
  {
    path: '/usuarios',
    component: CrmShellView,
    meta: {
      requiresAuth: true,
      section: 'usuarios',
      roles: ['administrador'],
    },
  },
  {
    path: '/configuracion',
    component: CrmShellView,
    meta: { requiresAuth: true, section: 'configuracion' },
  },
]

export const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/login',
      component: LoginView,
      meta: { publicOnly: true },
    },
    ...crmRoutes,
  ],
})

router.beforeEach(async (to) => {
  const acceso = await validarAccesoCrm()

  if (to.meta.requiresAuth) {
    if (acceso.status === 'ok') {
      if (to.meta.roles && !to.meta.roles.includes(acceso.perfil?.rol)) {
        return '/'
      }

      return true
    }

    if (acceso.status === 'no-profile' || acceso.status === 'inactive') {
      await cerrarSesion()
      return {
        path: '/login',
        query: {
          message:
            acceso.status === 'no-profile'
              ? 'Tu usuario existe, pero no tiene un perfil CRM configurado.'
              : 'Tu acceso al CRM está desactivado.',
        },
      }
    }

    return '/login'
  }

  if (to.meta.publicOnly && acceso.status === 'ok') {
    return '/'
  }

  return true
})

iniciarAuthListener(router)
