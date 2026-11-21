<script setup>
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import CrmHeader from '@/components/CrmHeader.vue'
import CrmSidebar from '@/components/CrmSidebar.vue'
import DetalleLlamadaDrawer from '@/components/DetalleLlamadaDrawer.vue'
import ModalCancelarLlamada from '@/components/ModalCancelarLlamada.vue'
import ModalReasignarLlamada from '@/components/ModalReasignarLlamada.vue'
import ModalReprogramarLlamada from '@/components/ModalReprogramarLlamada.vue'
import EstadoVacio from '@/components/EstadoVacio.vue'
import FormularioContacto from '@/components/FormularioContacto.vue'
import FormularioLlamada from '@/components/FormularioLlamada.vue'
import SkeletonCarga from '@/components/SkeletonCarga.vue'
import { cerrarSesion, useAuthSession } from '@/composables/useAuthSession'
import { useCrm } from '@/composables/useCrm'
import { esEjecutivoActivo } from '@/lib/crm'
import { obtenerMenuPorRol, ROLE_LABELS } from '@/lib/crmNavigation'
import { supabase } from '@/lib/supabase'
import { evaluarEscriturasPasswordAdmin } from '@/config/usuariosAdminPasswordWrites'
import ListaCotizaciones from '@/modulos/cotizaciones/vistas/ListaCotizaciones.vue'
import ListaOportunidades from '@/modulos/oportunidades/vistas/ListaOportunidades.vue'
import DashboardView from '@/views/DashboardView.vue'
import HistorialView from '@/views/HistorialView.vue'
import LlamadasView from '@/views/LlamadasView.vue'
import PlaceholderView from '@/views/PlaceholderView.vue'
import ProspectosView from '@/views/ProspectosView.vue'
import ReportesView from '@/views/ReportesView.vue'
import SeguimientosView from '@/views/SeguimientosView.vue'
import UsuariosAdminView from '@/views/UsuariosAdminView.vue'

const crm = useCrm()
const auth = useAuthSession()
const passwordWritesContext=computed(()=>{
  const userId=auth.state.user?.id
  const perfil=auth.state.perfil
  return {
    origin:globalThis.location?.origin,
    actor:perfil,
    sesionAutenticada:auth.isAuthenticated.value===true&&Boolean(userId)&&
      auth.state.session?.user?.id===userId&&perfil?.id===userId,
  }
})
const passwordWritesMode=computed(()=>evaluarEscriturasPasswordAdmin(import.meta.env,passwordWritesContext.value))
const route = useRoute()
const router = useRouter()
const esMovil = ref(false)

const vistaActual = computed(() => route.meta.section || 'panel')
const esVistaContactos = computed(() => vistaActual.value === 'contactos')
const vistaAutonoma = computed(() => ['oportunidades','cotizaciones','usuarios'].includes(vistaActual.value))
const usuarioActualId = computed(() => auth.state.perfil?.id || crm.estado.perfil?.id || '')
const usuariosVisibles = computed(() =>
  crm.estado.usuarios.filter((usuario) => usuario.id === usuarioActualId.value),
)
const usuariosAsignables = computed(() =>
  crm.estado.usuarios.filter((usuario) => usuario.rol !== 'administrador'),
)
const mostrarDetalleEscritorio = computed(() => Boolean(crm.estado.llamadaSeleccionada))
const rolActual = computed(() => auth.state.perfil?.rol || crm.estado.perfil?.rol || 'ejecutivo')
const responsablesLlamadas = computed(() => {
  if (crm.estado.cargandoResponsables || crm.estado.errorResponsables) return []
  const perfiles = rolActual.value === 'ejecutivo' ? usuariosVisibles.value : crm.estado.usuarios
  return perfiles.filter(esEjecutivoActivo)
})

watch(
  [crm.formularioAbierto, crm.modalReasignacion, () => crm.estado.llamadaSeleccionada?.id],
  ([formulario, reasignacion, llamadaId], [formularioAnterior, reasignacionAnterior, llamadaAnterior]) => {
    if ((formulario && !formularioAnterior && crm.modoFormularioLlamada.value !== 'editar') ||
      (reasignacion && !reasignacionAnterior) || (llamadaId && llamadaId !== llamadaAnterior)) {
      void crm.refrescarResponsablesLlamadas()
    }
  },
)
const menuActual = computed(() => obtenerMenuPorRol(rolActual.value))
const rutasPorVista = computed(() =>
  Object.fromEntries(menuActual.value.map((item) => [item.id, item.ruta])),
)
const proximaLlamada = computed(() =>
  crm.estado.resumenLlamadas
    .filter((llamada) => {
      if (!llamada?.fechaProgramada) {
        return false
      }

      return !['completada', 'cancelada'].includes(llamada.estado)
    })
    .sort((a, b) => new Date(a.fechaProgramada).getTime() - new Date(b.fechaProgramada).getTime())[0] ||
  null,
)
const usuarioSidebar = computed(() => ({
  ...(auth.state.perfil || crm.estado.perfil || crm.estado.usuario || { nombre: '', rol: '' }),
  rol: ROLE_LABELS[rolActual.value] || auth.state.perfil?.rol || crm.estado.perfil?.rol || '',
}))

function actualizarViewport() {
  esMovil.value = window.innerWidth <= 767
}

function cambiarVista(vista) {
  const destino = rutasPorVista.value[vista]

  if (!destino || destino === route.path) {
    return
  }

  router.push(destino)
}

async function salir() {
  await cerrarSesion()
  router.replace('/login')
}

function verContactoExistente(contactoId) {
  crm.formularioContactoAbierto.value = false
  crm.destacarContacto(contactoId)
  cambiarVista('contactos')
}

function irMiPerfil() {
  router.push('/configuracion')
}

watch(
  vistaActual,
  (vista) => {
    crm.vistaActiva.value = vista
    if (vista === 'panel') void crm.cargarLlamadasRecientes()
  },
  { immediate: true },
)

onMounted(async () => {
  actualizarViewport()
  window.addEventListener('resize', actualizarViewport)
  await crm.inicializarCrm()
})

onUnmounted(() => {
  window.removeEventListener('resize', actualizarViewport)
  crm.detenerRealtime()
})
</script>

<template>
  <div class="crm-shell" :class="{ 'con-detalle': mostrarDetalleEscritorio && !vistaAutonoma }">
    <div
      v-if="crm.sidebarAbierto.value"
      class="overlay-mobile"
      @click="crm.sidebarAbierto.value = false"
    />

    <CrmSidebar
      :abierto="crm.sidebarAbierto.value"
      :vista-activa="crm.vistaActiva.value"
      :usuario="usuarioSidebar"
      :items="menuActual"
      @cambiar-vista="cambiarVista"
      @cerrar="crm.sidebarAbierto.value = false"
      @ir-mi-perfil="irMiPerfil"
      @cerrar-sesion="salir"
    />

    <main class="crm-main">
      <CrmHeader
        v-if="!vistaAutonoma || esMovil"
        :titulo="vistaAutonoma ? 'CRM Aviación' : crm.tituloVista.value"
        :subtitulo="crm.vistaActiva.value === 'llamadas' ? `${crm.llamadasFiltradas.value.length} registros visibles` : ''"
        :accion-principal-label="vistaAutonoma ? '' : crm.vistaActiva.value === 'contactos'
          ? 'Nuevo contacto'
          : ['panel', 'llamadas'].includes(crm.vistaActiva.value) ? 'Programar llamada' : ''"
        @toggle-sidebar="crm.sidebarAbierto.value = !crm.sidebarAbierto.value"
        @accion-principal="
          crm.vistaActiva.value === 'contactos' ? crm.abrirFormularioContacto() : crm.programarLlamada()
        "
      />

      <div class="contenido">
        <SkeletonCarga v-if="!vistaAutonoma && (esVistaContactos ? crm.estado.cargandoContactos : crm.estado.cargando)" />

        <EstadoVacio
          v-else-if="!vistaAutonoma && (esVistaContactos ? crm.estado.errorContactos : crm.estado.error)"
          titulo="No fue posible cargar el CRM"
          :descripcion="esVistaContactos ? crm.estado.errorContactos : crm.estado.error"
        />

        <p v-else-if="crm.estado.errorOperacion && !vistaAutonoma" class="feedback-operacion">
          {{ crm.estado.errorOperacion }}
        </p>

        <p v-if="crm.estado.aviso && !vistaAutonoma" role="status">{{ crm.estado.aviso }}</p>
        <div v-if="crm.estado.reprogramacion && !vistaAutonoma">
          <p role="status">
            {{ {
              confirmada: 'La reprogramación se guardó.',
              observada: 'La llamada muestra la fecha solicitada.',
              incierta: 'No se pudo confirmar la reprogramación.',
            }[crm.estado.reprogramacion.estado] }}
            <span v-if="crm.estado.reprogramacion.errorLectura">No se pudo sincronizar toda la información.</span>
            <span v-if="crm.estado.reprogramacion.estado === 'incierta' && crm.estado.reprogramacion.fechaObservada">
              La fecha consultada aún difiere de la solicitada.
            </span>
          </p>
          <button
            v-if="crm.estado.reprogramacion.estado === 'incierta' || crm.estado.reprogramacion.errorLectura"
            type="button"
            class="boton-primario"
            :disabled="crm.estado.reprogramacion.consultando"
            @click="crm.consultarReprogramacion"
          >
            {{ crm.estado.reprogramacion.consultando ? 'Consultando…' : 'Consultar llamada' }}
          </button>
        </div>
        <ListaOportunidades v-if="vistaActual === 'oportunidades'" :obtener-cliente-supabase="() => supabase" />
        <ListaCotizaciones v-else-if="vistaActual === 'cotizaciones'" :obtener-cliente-supabase="() => supabase" />
        <UsuariosAdminView v-else-if="vistaActual === 'usuarios'" :actor="auth.state.perfil || crm.estado.perfil" :obtener-cliente-supabase="() => supabase" :password-writes-enabled="passwordWritesMode.habilitado" :password-writes-authenticated="passwordWritesContext.sesionAutenticada" :password-writes-block-reason="passwordWritesMode.motivo" :password-writes-requirements="passwordWritesMode.requisitosPendientes" :registro-nuevo="route.meta.registroUsuario === true" :abrir-registro="() => router.push('/admin/usuarios/nuevo')" :volver-listado="() => router.push('/admin/usuarios')" :vista-accion="route.meta.accionUsuario || 'listado'" :usuario-id="String(route.params.usuarioId || '')" :navegar-accion="(accion, id) => router.push('/admin/usuarios/' + accion + (id ? '/' + encodeURIComponent(id) : ''))" />
        <DashboardView
          v-else-if="!crm.estado.cargando && !crm.estado.error && crm.vistaActiva.value === 'panel'"
          :rol="rolActual"
          :nombre-usuario="auth.state.perfil?.nombre || crm.estado.perfil?.nombre || ''"
          :indicadores="crm.indicadores.value"
          :llamadas="crm.estado.llamadasRecientes"
          :error-llamadas="crm.estado.errorLlamadasRecientes || ''"
          :proxima-llamada="proximaLlamada"
          :usuario-actual-id="crm.estado.perfil?.id"
          @abrir-llamada="crm.programarLlamada"
          @abrir-reportes="cambiarVista('reportes')"
          @ver-detalle="crm.seleccionarLlamada"
          @iniciar="crm.iniciarLlamada"
          @cancelar="crm.solicitarCancelacion"
        />

        <LlamadasView
          v-else-if="!crm.estado.error && crm.vistaActiva.value === 'llamadas'"
          :rol="rolActual"
          :filtros="crm.filtros.value"
          :usuarios="rolActual === 'ejecutivo' ? usuariosVisibles : usuariosAsignables"
          :llamadas="crm.llamadasFiltradas.value"
          :usuario-actual-id="crm.estado.perfil?.id"
          @update:filtros="crm.actualizarFiltros"
          @ver-detalle="crm.seleccionarLlamada"
          @iniciar="crm.iniciarLlamada"
          @editar="crm.editarLlamada"
          @reasignar="crm.solicitarReasignacion"
          @reprogramar="crm.solicitarReprogramacion"
          @crear-seguimiento="crm.seleccionarLlamada"
          @cancelar="crm.solicitarCancelacion"
        />

        <ProspectosView
          v-else-if="!crm.estado.cargandoContactos && !crm.estado.errorContactos && crm.vistaActiva.value === 'contactos'"
          :rol="rolActual"
          :prospectos="crm.estado.prospectos"
          :llamadas="crm.estado.resumenLlamadas"
          :usuarios="crm.estado.usuarios"
          :cargando-historial="crm.estado.cargandoHistorialContactos"
          :error-historial="crm.estado.errorHistorialContactos || ''"
          :contacto-destacado="crm.contactoDestacado.value"
          @nuevo-contacto="crm.abrirFormularioContacto"
          @editar-contacto="crm.abrirFormularioContacto"
          @programar-llamada="crm.programarLlamada"
        />

        <SeguimientosView
          v-else-if="!crm.estado.error && crm.vistaActiva.value === 'seguimientos'"
          :rol="rolActual"
          :grupos="crm.seguimientoAgrupado.value"
          @ver-detalle="crm.seleccionarLlamada"
        />

        <HistorialView
          v-else-if="!crm.estado.error && crm.vistaActiva.value === 'historial'"
          :rol="rolActual"
          :llamadas="crm.estado.resumenLlamadas"
        />

        <ReportesView
          v-else-if="!crm.estado.error && crm.vistaActiva.value === 'reportes'"
          :reportes="crm.reportes.value"
          :llamadas="crm.estado.resumenLlamadas"
        />

        <PlaceholderView
          v-else-if="!esVistaContactos"
          :titulo="crm.tituloVista.value"
          :descripcion="crm.vistaActiva.value === 'equipo'
            ? 'La vista de productividad por responsable aún está en preparación.'
            : crm.descripcionVista.value"
        />
      </div>
    </main>

    <DetalleLlamadaDrawer
      v-if="!vistaAutonoma && (mostrarDetalleEscritorio || (esMovil && crm.estado.llamadaSeleccionada))"
      :llamada="crm.estado.llamadaSeleccionada"
      :abierto="esMovil ? crm.drawerAbierto.value : true"
      :eventos="crm.historialSeleccionado.value"
      :finalizacion="crm.estado.finalizaciones.get(crm.estado.llamadaSeleccionada?.id)"
      :guardando="crm.estado.guardando"
      @reintentar-lectura="crm.reintentarLecturaFinalizacion"
      :resultados="crm.estado.resultados"
      :usuarios="responsablesLlamadas"
      :error="crm.estado.errorOperacion || ''"
      :mostrar-vacio="!esMovil"
      @cerrar="crm.cerrarDetalleLlamada"
      @iniciar="crm.iniciarLlamada"
      @editar="crm.editarLlamada"
      @reprogramar="crm.solicitarReprogramacion"
      @reasignar="crm.solicitarReasignacion"
      @cancelar="crm.solicitarCancelacion"
      @guardar-resultado="crm.finalizarLlamada"
      @crear-seguimiento="crm.crearSeguimiento"
      @finalizar="crm.finalizarLlamada"
    />

    <FormularioLlamada
      :abierto="crm.formularioAbierto.value"
      :modo="crm.modoFormularioLlamada.value"
      :llamada="crm.llamadaEnEdicion.value"
      :prospecto-inicial-id="crm.prospectoPreseleccionadoId.value"
      :usuario-actual-id="usuarioActualId"
      :prospectos="crm.estado.prospectos"
      :usuarios="responsablesLlamadas"
      :motivos="crm.estado.motivos"
      :error="crm.estado.errorOperacion || (!crm.llamadaEnEdicion.value && crm.estado.errorResponsables) || ''"
      @cerrar="crm.formularioAbierto.value = false"
      @guardar="crm.crearLlamada"
      @guardar-y-crear-otra="crm.crearLlamada"
    />

    <FormularioContacto
      :contacto="crm.contactoEnEdicion.value"
      :guardando="crm.estado.guardando"
      :error="crm.estado.errorOperacion || ''"
      :abierto="crm.formularioContactoAbierto.value"
      :prospectos="crm.estado.prospectos"
      :usuarios="rolActual === 'ejecutivo' ? usuariosVisibles : usuariosAsignables"
      @cerrar="!crm.estado.guardando && (crm.formularioContactoAbierto.value = false)"
      @guardar="crm.crearContacto"
      @ver-contacto="verContactoExistente"
    />

    <ModalCancelarLlamada
      :abierto="crm.modalCancelacion.value"
      @cancelar="crm.modalCancelacion.value = false"
      @confirmar="crm.confirmarCancelacion"
    />

    <ModalReprogramarLlamada
      :abierto="crm.modalReprogramacion.value"
      :llamada="crm.llamadaPendienteReprogramacion.value"
      :guardando="crm.reprogramando.value"
      :error="crm.estado.errorOperacion || ''"
      @cancelar="crm.modalReprogramacion.value = false"
      @confirmar="crm.confirmarReprogramacion"
    />

    <ModalReasignarLlamada
      :abierto="crm.modalReasignacion.value"
      :llamada="crm.llamadaPendienteReasignacion.value"
      :usuarios="responsablesLlamadas"
      @cancelar="crm.modalReasignacion.value = false"
      @confirmar="crm.confirmarReasignacion"
      :error="crm.estado.errorOperacion || crm.estado.errorResponsables || ''"
    />

    <nav class="nav-movil">
      <button
        v-for="item in menuActual.slice(0, 5)"
        :key="item.id"
        @click="cambiarVista(item.id)"
      >
        {{ item.label }}
      </button>
    </nav>
  </div>
</template>

<style scoped>
.feedback-operacion {
  margin: 0 0 1rem;
  padding: 0.9rem 1rem;
  border-radius: 16px;
  background: #fff0f1;
  color: #b23d44;
}
</style>
