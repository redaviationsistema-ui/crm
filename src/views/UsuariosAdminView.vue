<script setup>
import { cerrarMenuConEscape } from '../compartido/utilidades/cerrarMenuConEscape.js'

import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import { generarPasswordSegura, validarPasswordAdministrativa } from '@/domain/passwordUsuario'
import { ROLES_USUARIO_ADMIN } from '@/domain/usuariosAdmin'
import { crearUsuariosAdminNavegador } from '@/services/usuariosAdminService'
import { diagnosticarConexionUsuarios, esDesarrolloLocalAdmin } from '@/services/usuariosAdminDiagnostico'

const props = defineProps({
  obtenerClienteSupabase: { type: Function, default: null },
  servicioInyectado: { type: Object, default: null },
  passwordWritesEnabled: { type: Boolean, default: false },
  passwordWritesAuthenticated: { type: Boolean, default: false },
  passwordWritesBlockReason: { type: String, default: 'Escrituras de contraseña apagadas por configuración.' },
  passwordWritesRequirements: { type: Array, default: () => [] },
  actor: { type: Object, default: null },
  vistaAccion: { type: String, default: 'listado' },
  usuarioId: { type: String, default: '' },
  navegarAccion: { type: Function, default: null },
  registroNuevo: { type: Boolean, default: false },
  abrirRegistro: { type: Function, default: null },
  volverListado: { type: Function, default: null },
})
const servicio = props.servicioInyectado || crearUsuariosAdminNavegador({obtenerCliente:props.obtenerClienteSupabase})
const actor = computed(() => props.actor)
const usuarios = ref([])
const auditoria = ref([])
const cargando = ref(false)
const guardando = ref(false)
const error = ref('')
const mensaje = ref('')
const busqueda = ref('')
const filtroRol = ref('')
const filtroEstado = ref('')
const formularioAbierto = ref(false)
const usuarioEnEdicion = ref(null)
const confirmacionEliminar = ref(null)
const textoConfirmacion = ref('')
const mostrarAuditoria = ref(false)
const pantalla = ref('listado')
const objetivoEstado = ref(null)
const completada = ref(false)
const cargandoAccion = ref(false)
let vistaActualId = 0
const tituloAccion = computed(() => ({estado:!objetivoEstado.value?'Cambiar estado del usuario':objetivoEstado.value.activo?'Desactivar usuario':'Activar usuario',eliminar:'Eliminar usuario',historial:'Historial de acciones',diagnostico:'Diagnosticar conexión',recargar:'Actualizar usuarios'}[pantalla.value] || 'Administración de usuarios'))
const diagnosticando = ref(false)
const diagnostico = ref(null)
let diagnosticoActual = 0
let cargaActual = 0
const formulario = reactive({ nombre: '', apellidos: '', correo: '', telefono: '', rol: 'ejecutivo', activo: true })
const modoAlta=ref('invitacion')
const actualizandoPassword=ref(false),errorPassword=ref(''),resultadoPassword=ref('')
const passwordWriteBlocked=ref(false)
const passwordWriteUncertain=ref(false)
let intentosPassword=[]
const passwordDeshabilitada=computed(()=>guardando.value||actualizandoPassword.value||!autorizado.value||(pantalla.value==='editar'?!seguridad.cambiar:modoAlta.value!=='password'))
const passwordOperationBlocked=computed(()=>!props.passwordWritesEnabled||!props.passwordWritesAuthenticated||!autorizado.value||passwordWriteBlocked.value||passwordWriteUncertain.value)
const passwordBlockReason=computed(()=>passwordWriteUncertain.value
  ?'Resultado incierto: revisa Auth antes de iniciar otro intento.'
  :passwordWriteBlocked.value
    ?'Operaciones de contraseña bloqueadas o no disponibles.'
    :props.passwordWritesBlockReason)
const passwordBlockRequirements=computed(()=>passwordWriteBlocked.value||passwordWriteUncertain.value
  ?[passwordBlockReason.value]
  :props.passwordWritesRequirements)
const passwordInput=ref(null),confirmacionInput=ref(null)
const seguridad=reactive({password:'',confirmacion:'',cambiar:false,visible:false,copiada:false,reemplazar:false})
function limpiarCamposPassword(mantenerCambio=false){Object.assign(seguridad,{password:'',confirmacion:'',cambiar:mantenerCambio&&pantalla.value==='editar',visible:false,copiada:false,reemplazar:false});if(passwordInput.value)passwordInput.value.value='';if(confirmacionInput.value)confirmacionInput.value.value=''}
function limpiarSeguridad(){limpiarCamposPassword()}
function salirPagina(){vistaActualId++;limpiarSeguridad()}
onMounted(()=>globalThis.addEventListener?.('pagehide',salirPagina))
onBeforeUnmount(()=>{vistaActualId++;limpiarSeguridad();globalThis.removeEventListener?.('pagehide',salirPagina)})
watch(()=>seguridad.cambiar,activo=>{
  errorPassword.value=''
  if(activo)resultadoPassword.value=''
  if(!activo&&pantalla.value==='editar'){
    seguridad.password='';seguridad.confirmacion='';seguridad.visible=false;seguridad.copiada=false;seguridad.reemplazar=false
    passwordWriteUncertain.value=false
  }
})
watch(()=>[seguridad.password,seguridad.confirmacion],()=>{seguridad.copiada=false;seguridad.reemplazar=false})
watch(modoAlta,()=>limpiarSeguridad())
watch(formulario,()=>{if(pantalla.value==='editar'){if(completada.value)mensaje.value='';completada.value=false}})
function generarPassword(){
  error.value='';errorPassword.value='';resultadoPassword.value=''
  try{const nueva=generarPasswordSegura();seguridad.password=nueva;seguridad.confirmacion=nueva;seguridad.visible=false;seguridad.copiada=false}
  catch{error.value='No se pudo generar una contraseña de forma segura.'}
}
async function copiarPassword(){
  if(!seguridad.password)return
  let valor=seguridad.password
  const vista=vistaActualId
  try{await globalThis.navigator.clipboard.writeText(valor);if(vista===vistaActualId&&seguridad.password===valor)seguridad.copiada=true}
  catch{if(vista===vistaActualId)error.value='No se pudo copiar la contraseña. Comprueba los permisos del portapapeles.'}
  finally{valor=undefined}
}

const roles = ROLES_USUARIO_ADMIN
const usuarioFiltrado = computed(() => {
  const termino = busqueda.value.trim().toLocaleLowerCase('es')
  return usuarios.value.filter(usuario => {
    const texto = `${usuario.nombre} ${usuario.apellidos} ${usuario.correo}`.toLocaleLowerCase('es')
    return (!termino || texto.includes(termino)) && (!filtroRol.value || usuario.rol === filtroRol.value) &&
      (filtroEstado.value === '' || usuario.activo === (filtroEstado.value === 'activo'))
  })
})
const autorizado = computed(() => actor.value?.rol === 'administrador' && actor.value?.activo === true)

const puedeDiagnosticar = computed(() => autorizado.value && esDesarrolloLocalAdmin(import.meta.env?.DEV, globalThis.location?.origin))

async function ejecutarDiagnostico() {
  if(!puedeDiagnosticar.value||diagnosticando.value)return
  const solicitud=++diagnosticoActual,actorId=actor.value.id
  diagnosticando.value=true
  diagnostico.value=null
  try{
    const resultado=await diagnosticarConexionUsuarios({obtenerCliente:props.obtenerClienteSupabase})
    if(solicitud===diagnosticoActual&&puedeDiagnosticar.value&&actor.value?.id===actorId)diagnostico.value=resultado
  }finally{if(solicitud===diagnosticoActual)diagnosticando.value=false}
}

async function mostrarAccion(accion,id){
  if(!autorizado.value||guardando.value)return
  if(accion==='diagnostico'&&diagnosticando.value)return
  if(props.navegarAccion)return props.navegarAccion(accion,id)
  return iniciarPantalla(accion,id)
}
async function iniciarPantalla(accion,id){
  const vista=++vistaActualId
  limpiarSeguridad()
  passwordWriteUncertain.value=false
  errorPassword.value='';resultadoPassword.value=''
  modoAlta.value='invitacion'
  diagnosticoActual++;diagnostico.value=null;diagnosticando.value=false
  pantalla.value=accion;error.value='';mensaje.value='';completada.value=false
  formularioAbierto.value=false;usuarioEnEdicion.value=null;confirmacionEliminar.value=null;objetivoEstado.value=null;auditoria.value=[];mostrarAuditoria.value=false
  textoConfirmacion.value=''
  cargandoAccion.value=false
  if(accion==='listado'){await cargar();return}
  if(!autorizado.value){error.value='Acceso denegado: se requiere un administrador activo.';return}
  if(accion==='nuevo'){prepararRegistro();return}
  if(accion==='diagnostico'){if(puedeDiagnosticar.value)await ejecutarDiagnostico();else error.value='Diagnóstico disponible solo en desarrollo local para administradores activos.';return}
  cargandoAccion.value=true
  try{
    if(accion==='historial'){await cargarAuditoria();return}
    if(accion==='recargar'){if(await cargar())mensaje.value=`Listado actualizado: ${usuarios.value.length} usuarios.`;return}
    if(!['editar','estado','eliminar'].includes(accion)){error.value='Acción no disponible.';return}
    if(!usuarios.value.some(u=>u.id===id)&&!await cargar())return
    if(vista!==vistaActualId)return
    const usuario=usuarios.value.find(u=>u.id===id)
    if(!usuario){error.value='El usuario solicitado no existe o no está disponible.';return}
    if(accion==='editar'){prepararEdicion(usuario)}
    if(accion==='estado')objetivoEstado.value=usuario
    if(accion==='eliminar')confirmacionEliminar.value=usuario
  }finally{if(vista===vistaActualId)cargandoAccion.value=false}
}
watch(() => [props.vistaAccion,props.usuarioId,props.registroNuevo],()=>iniciarPantalla(props.registroNuevo?'nuevo':props.vistaAccion,props.usuarioId),{immediate:true})
watch(() => [props.actor?.id,props.actor?.rol,props.actor?.activo], () => {usuarios.value=[];iniciarPantalla(props.registroNuevo?'nuevo':props.vistaAccion,props.usuarioId)})
function diagnosticarConexion(){return mostrarAccion('diagnostico')}
function consultarAuditoria(){return mostrarAccion('historial')}
function editarUsuario(usuario){return mostrarAccion('editar',usuario.id)}
function pedirEstado(usuario){return mostrarAccion('estado',usuario.id)}
function pedirEliminacion(usuario){return mostrarAccion('eliminar',usuario.id)}

async function cargar() {
  const carga = ++cargaActual,vista=vistaActualId
  error.value = ''
  if (!autorizado.value) {
    usuarios.value=[];auditoria.value=[];cargando.value=false
    error.value = 'Acceso denegado: se requiere una sesión de administrador activo.'
    return
  }
  cargando.value = true
  const actorId=actor.value.id
  try { const resultado=await servicio.listar(actor.value);if(carga!==cargaActual||vista!==vistaActualId||actor.value?.id!==actorId||!autorizado.value)return false;usuarios.value=resultado;return true }
  catch (e) { if(carga===cargaActual&&vista===vistaActualId){usuarios.value=[];error.value = e.message || 'No se pudo cargar la lista de usuarios.'}return false }
  finally { if(carga===cargaActual)cargando.value = false }
}

function limpiarFormulario() {
  formulario.nombre = ''
  formulario.apellidos = ''
  formulario.correo = ''
  formulario.telefono = ''
  formulario.rol = 'ejecutivo'
  formulario.activo = true
}

function prepararRegistro() {
  limpiarSeguridad()
  pantalla.value='nuevo'
  error.value = ''
  mensaje.value = ''
  usuarioEnEdicion.value = null
  limpiarFormulario()
  formularioAbierto.value = true
}

function nuevoUsuario(){
  if(!autorizado.value||guardando.value)return
  if(props.navegarAccion)return mostrarAccion('nuevo')
  prepararRegistro()
  if(props.abrirRegistro&&!props.registroNuevo)props.abrirRegistro()
}
function volverUsuarios(){
  if(guardando.value||actualizandoPassword.value)return
  limpiarSeguridad()
  if(props.volverListado)props.volverListado()
  else iniciarPantalla('listado')
}

function prepararEdicion(usuario) {
  limpiarSeguridad()
  errorPassword.value='';resultadoPassword.value=''
  // No inferir contraseña de identidades email, metadatos, fechas o datos del perfil.
  errorPassword.value='';resultadoPassword.value=''
  modoAlta.value='invitacion'
  error.value = ''
  mensaje.value = ''
  usuarioEnEdicion.value = usuario
  Object.assign(formulario, {
    nombre: usuario.nombre,
    apellidos: usuario.apellidos,
    correo: usuario.correo,
    telefono: usuario.telefono || '',
    rol: usuario.rol,
    activo: usuario.activo,
  })
  formularioAbierto.value = true
}

function reservarIntentoPassword(){
  const ahora=Date.now();intentosPassword=intentosPassword.filter(t=>ahora-t<60000)
  if(intentosPassword.length>=3)return false
  intentosPassword.push(ahora);return true
}
async function actualizarPassword(){
  if(guardando.value||actualizandoPassword.value||!autorizado.value||!props.passwordWritesAuthenticated||passwordOperationBlocked.value||pantalla.value!=='editar'||!usuarioEnEdicion.value)return
  errorPassword.value='';resultadoPassword.value=''
  let password=seguridad.password
  const fallo=validarPasswordAdministrativa(password,seguridad.confirmacion)
  if(fallo){errorPassword.value=fallo;return}
  if(!seguridad.cambiar||!seguridad.reemplazar){errorPassword.value='Confirma el reemplazo de la contraseña antes de actualizar.';return}
  if(!reservarIntentoPassword()){errorPassword.value='Límite de intentos alcanzado. Espera un minuto.';return}
  const vista=vistaActualId,actorId=actor.value.id,usuarioId=usuarioEnEdicion.value.id
  const vigente=()=>vista===vistaActualId&&actor.value?.id===actorId&&autorizado.value
  let confirmada=false
  actualizandoPassword.value=true
  try{
    const resultado=await servicio.cambiarPassword(actor.value,usuarioId,password)
    if(resultado?.usuarioId!==usuarioId||resultado?.contrasenaActualizada!==true){
      throw Object.assign(Error('El backend no confirmó el resultado.'),{tipoResultado:'incierto',requiereRevision:true})
    }
    if(vigente()){
      confirmada=true
      resultadoPassword.value='Contraseña actualizada correctamente en Supabase Auth'
    }
  }catch(e){
    if(vigente()){
      if(e.requiereRevision===true||e.tipoResultado==='incierto'){
        passwordWriteUncertain.value=true
        errorPassword.value='Resultado incierto: no se reenviará la contraseña preparada. Revisa Auth antes de iniciar otro intento.'
      }else if(e.status===503||e.tipoResultado==='bloqueado'){
        passwordWriteBlocked.value=true
        errorPassword.value=`${passwordBlockReason.value} Los datos del perfil no cambian por esta acción.`
      }else if(e.status===429){
        errorPassword.value='Límite de intentos alcanzado. Espera antes de repetir. Los datos del perfil no cambian por esta acción.'
      }else if(e.tipoResultado==='rechazado'){
        errorPassword.value=e.status===400
          ?'Supabase Auth rechazó la contraseña. Verifica los requisitos y la coincidencia.'
          :e.status===401
            ?'La sesión no es válida o expiró. Inicia sesión nuevamente.'
            :e.status===404
              ?'El usuario de destino no está disponible.'
              :'El servidor rechazó la operación. Verifica los permisos y el usuario destino.'
      }else{
        passwordWriteUncertain.value=true
        errorPassword.value='No se confirmó el cambio de contraseña. Revisa Auth antes de iniciar otro intento.'
      }
    }
  }
  finally{password=undefined;if(confirmada&&vigente())limpiarCamposPassword();actualizandoPassword.value=false}
}
async function guardarUsuario(){
  if(guardando.value||actualizandoPassword.value||!autorizado.value||completada.value)return
  let password
  if(pantalla.value==='nuevo'&&modoAlta.value==='password'){
    const fallo=validarPasswordAdministrativa(seguridad.password,seguridad.confirmacion)
    if(fallo){error.value=fallo;return}
    if(!reservarIntentoPassword()){error.value='Límite de intentos alcanzado. Espera un minuto.';limpiarSeguridad();return}
    password=seguridad.password
  }
  const vista=vistaActualId,actorId=actor.value.id
  const vigente=()=>vista===vistaActualId&&actor.value?.id===actorId&&autorizado.value
  guardando.value=true;error.value='';mensaje.value=''
  try{
    const datos={...formulario}
    if(usuarioEnEdicion.value){
      await servicio.editar(actor.value,usuarioEnEdicion.value.id,datos)
      if(!vigente())return
      mensaje.value='Datos del perfil guardados. La contraseña no se modificó con esta acción.'
    }else if(modoAlta.value==='password'){
      await servicio.crearConPassword(actor.value,datos,password)
      if(!vigente())return
      mensaje.value='Cuenta y perfil creados. Correo confirmado administrativamente; sin invitación ni cambio obligatorio al primer acceso.'
    }else{
      await servicio.crear(actor.value,datos)
      if(!vigente())return
      mensaje.value='Cuenta y perfil creados en Supabase. Revisa el correo de invitación.'
    }
    if(!usuarioEnEdicion.value)limpiarSeguridad()
    completada.value=true
    if(!await cargar()&&vigente())mensaje.value+=' No se pudo recargar el listado; no repitas la operación.'
  }catch(e){if(vigente())error.value=e.message||'No se pudo confirmar el guardado.'}
  finally{password=undefined;if(vigente()&&!usuarioEnEdicion.value)limpiarSeguridad();guardando.value=false}
}

async function cambiarEstado(usuario) {
  if (guardando.value || !autorizado.value || completada.value) return
  const vista=vistaActualId,actorId=actor.value.id
  const vigente=()=>vista===vistaActualId&&actor.value?.id===actorId&&autorizado.value
  guardando.value = true
  error.value = ''
  mensaje.value = ''
  try {
    await servicio.cambiarEstado(actor.value, usuario.id, !usuario.activo)
    if(!vigente())return
    completada.value=true
    mensaje.value = `Usuario ${usuario.activo ? 'desactivado' : 'activado'}.`
    if (!await cargar() && vigente()) mensaje.value += ' No se pudo recargar el listado; no repitas la operación.'
  } catch (e) { if(vigente())error.value = e.message || 'No se pudo cambiar el estado.' }
  finally { guardando.value = false }
}

async function eliminarDefinitivamente() {
  if (!confirmacionEliminar.value || guardando.value || !autorizado.value || completada.value) return
  const vista=vistaActualId,actorId=actor.value.id
  const vigente=()=>vista===vistaActualId&&actor.value?.id===actorId&&autorizado.value
  guardando.value = true
  error.value = ''
  mensaje.value = ''
  try {
    await servicio.eliminarDefinitivamente(actor.value, confirmacionEliminar.value.id, textoConfirmacion.value)
    if(!vigente())return
    mensaje.value = 'Cuenta eliminada de Supabase Auth y perfil eliminado.'
    completada.value=true
    textoConfirmacion.value = ''
    if (!await cargar() && vigente()) mensaje.value += ' No se pudo recargar el listado; no repitas la operación.'
  } catch (e) { if(vigente())error.value = e.message || 'No se pudo eliminar el usuario.' }
  finally { guardando.value = false }
}

async function cargarAuditoria() {
  if (!autorizado.value) return
  error.value = ''
  const actorId=actor.value.id,carga=cargaActual,vista=vistaActualId
  try {
    const eventos=await servicio.historial(actor.value)
    if(actor.value?.id!==actorId||!autorizado.value||carga!==cargaActual||vista!==vistaActualId)return
    auditoria.value=eventos
    mostrarAuditoria.value=true
  } catch (e) { if(actor.value?.id===actorId&&carga===cargaActual&&vista===vistaActualId){auditoria.value=[];mostrarAuditoria.value=false;error.value = e.message || 'No se pudo consultar el historial.'} }
}

function etiquetaRol(rol) {
  return { administrador: 'Administrador', supervisor: 'Supervisor', ejecutivo: 'Ejecutivo' }[rol] || rol
}
function fechaCorta(fecha) {
  if (!fecha) return 'Sin fecha'
  const valor = new Date(fecha)
  return Number.isNaN(valor.getTime()) ? fecha : new Intl.DateTimeFormat('es-MX', { dateStyle: 'medium' }).format(valor)
}
</script>

<template>
  <section v-if="pantalla === 'nuevo' || pantalla === 'editar'" class="registro-usuario" aria-labelledby="titulo-registro">
    <button type="button" class="volver-registro" :disabled="guardando || actualizandoPassword" @click="volverUsuarios"><span aria-hidden="true">←</span> Volver a usuarios</button>
    <header class="registro-encabezado formulario-encabezado">
      <div><span class="registro-etiqueta">ADMINISTRACIÓN DE USUARIOS</span>
        <h1 id="titulo-registro">{{ pantalla === 'editar' ? 'Editar usuario' : 'Registrar usuario' }}</h1>
        <p>{{ pantalla === 'editar' ? 'Actualiza la información y el acceso de este usuario.' : 'Configura un nuevo acceso para tu equipo.' }}</p>
      </div>
      <span class="indicador-usuario" :class="formulario.activo ? 'usuario-activo' : 'usuario-inactivo'"><span aria-hidden="true"></span>{{ formulario.activo ? 'Activo' : 'Inactivo' }}</span>
    </header>
    <p v-if="cargandoAccion" role="status">Cargando perfil…</p>
    <p v-if="completada" class="mensaje tarjeta-resultado" role="status">{{ mensaje }}</p>
    <p v-if="error && !formularioAbierto" class="error" role="alert">{{ error }}</p>
    <div v-if="formularioAbierto && (!completada || pantalla === 'editar')" class="registro-distribucion">
      <form class="registro-tarjeta" :aria-busy="guardando" @submit.prevent="guardarUsuario">
        <p v-if="error" class="registro-error" role="alert">{{ error }}</p>
        <fieldset :disabled="guardando || actualizandoPassword || !autorizado">
          <legend><span class="numero-seccion" aria-hidden="true"><svg viewBox="0 0 24 24"><circle cx="12" cy="8" r="3.5"/><path d="M5 21v-2a7 7 0 0 1 14 0v2"/></svg></span>01. Información personal</legend>
          <p class="descripcion-seccion">{{ pantalla === 'editar' ? 'Los cambios se guardarán en el perfil del usuario.' : 'La invitación se enviará al correo que registres.' }}</p>
          <div class="registro-campos">
            <label>Nombre <span>*</span><input v-model="formulario.nombre" required maxlength="100" autocomplete="given-name" placeholder="Nombre del usuario" /></label>
            <label>Apellidos <span>*</span><input v-model="formulario.apellidos" required maxlength="100" autocomplete="family-name" placeholder="Apellidos del usuario" /></label>
            <label>Correo electrónico <span>*</span><input v-model="formulario.correo" required type="email" maxlength="254" autocomplete="email" placeholder="nombre@empresa.com" /></label>
            <label>Teléfono <span class="opcional">Opcional</span><input v-model="formulario.telefono" maxlength="40" type="tel" autocomplete="tel" placeholder="Número de contacto" /></label>
          </div>
        </fieldset>
        <fieldset :disabled="guardando || actualizandoPassword || !autorizado" class="permisos-registro">
          <legend><span class="numero-seccion" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="m12 3 8 3v6c0 5-8 9-8 9s-8-4-8-9V6Z"/><path d="m8.5 12 2.5 2.5 4.5-5"/></svg></span>02. Acceso y permisos</legend>
          <div class="registro-campos">
            <label>Rol<select v-model="formulario.rol" :disabled="usuarioEnEdicion?.id === actor?.id"><option v-for="rol in roles" :key="rol" :value="rol">{{ etiquetaRol(rol) }}</option></select></label>
            <label>Estado<select v-model="formulario.activo" :disabled="usuarioEnEdicion?.id === actor?.id"><option :value="true">Activo</option><option :value="false">Inactivo</option></select></label>
          </div>
          <p class="detalle-rol">{{ {administrador:'Administra usuarios, permisos y la operación del CRM.',supervisor:'Supervisa el trabajo y seguimiento comercial del equipo.',ejecutivo:'Gestiona contactos y el seguimiento de su actividad comercial.'}[formulario.rol] }}</p>
        </fieldset>
        <fieldset :disabled="guardando || actualizandoPassword || !autorizado" class="permisos-registro seguridad-password">
          <legend><span class="numero-seccion" aria-hidden="true"><svg viewBox="0 0 24 24"><rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3m-4 5v2"/></svg></span>03. Seguridad y contraseña</legend>
          <p class="descripcion-seccion">{{ pantalla === 'editar' ? 'Guardar datos solo actualiza el perfil. Usa Actualizar contraseña para cambiar la credencial.' : 'Selecciona una sola vía: invitación por correo o creación directa con contraseña.' }}</p>
          <label v-if="pantalla === 'nuevo'" class="modo-alta">Método de registro<select v-model="modoAlta" :disabled="guardando"><option value="invitacion">Invitación por correo</option><option value="password">Crear cuenta con contraseña</option></select></label>
          <p v-if="pantalla === 'nuevo' && modoAlta === 'password'" class="confirmar-password">Se creará con el correo confirmado administrativamente. No se enviará invitación ni se exigirá cambiar la contraseña al primer acceso.</p>
          <div v-if="pantalla === 'editar'" class="seguridad-resumen">
            <p class="estado-password" role="status">Contraseña actual no visible</p>
            <label class="solicitar-password"><input v-model="seguridad.cambiar" type="checkbox" /> Cambiar contraseña</label>
          </div>
          <div class="registro-campos">
            <label>{{ pantalla === 'editar' ? 'Nueva contraseña' : 'Contraseña' }}
              <span class="password-integrada">
                <input id="usuario-password" ref="passwordInput" v-model="seguridad.password" :type="seguridad.visible ? 'text' : 'password'" autocomplete="new-password" :minlength="pantalla === 'nuevo' && modoAlta === 'password' ? 12 : undefined" maxlength="128" :disabled="passwordDeshabilitada" :required="pantalla === 'nuevo' && modoAlta === 'password'" spellcheck="false" autocapitalize="off" />
                <button type="button" class="icono-password" :disabled="!seguridad.password || guardando" :aria-label="seguridad.visible ? 'Ocultar contraseña' : 'Mostrar contraseña'" :title="seguridad.visible ? 'Ocultar contraseña' : 'Mostrar contraseña'" :aria-pressed="seguridad.visible" aria-controls="usuario-password usuario-password-confirmacion" @click="seguridad.visible = !seguridad.visible"><svg aria-hidden="true" viewBox="0 0 24 24"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/><path v-if="seguridad.visible" d="m3 3 18 18"/></svg></button>
                <button type="button" class="icono-password" :disabled="!seguridad.password || guardando" :aria-label="pantalla === 'editar' ? 'Copiar nueva contraseña' : 'Copiar contraseña'" :title="pantalla === 'editar' ? 'Copiar nueva contraseña' : 'Copiar contraseña'" @click="copiarPassword"><svg aria-hidden="true" viewBox="0 0 24 24"><rect x="8" y="8" width="12" height="13" rx="2"/><path d="M15 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h3"/></svg></button>
              </span>
            </label>
            <label>{{ pantalla === 'editar' ? 'Confirmar nueva contraseña' : 'Confirmar contraseña' }}<input id="usuario-password-confirmacion" ref="confirmacionInput" v-model="seguridad.confirmacion" :type="seguridad.visible ? 'text' : 'password'" autocomplete="new-password" :minlength="pantalla === 'nuevo' && modoAlta === 'password' ? 12 : undefined" maxlength="128" :disabled="passwordDeshabilitada" :required="pantalla === 'nuevo' && modoAlta === 'password'" spellcheck="false" autocapitalize="off" /></label>
          </div>
          <div class="controles-password"><button type="button" :disabled="passwordDeshabilitada" @click="generarPassword"><svg aria-hidden="true" viewBox="0 0 24 24"><path d="m4 20 11-11 4 4L8 24M14 2v4m-2-2h4M5 5v4M3 7h4m12-3v4m-2-2h4" transform="translate(0 -2)"/></svg>{{ seguridad.password ? 'Generar otra contraseña' : 'Generar contraseña' }}</button><span v-if="seguridad.copiada" role="status">Contraseña copiada</span><span class="requisitos-password">12–128 caracteres · Mayúsculas, minúsculas, números y símbolos · Sin espacios</span></div>
          <div v-if="pantalla === 'editar' && seguridad.cambiar && (seguridad.password || seguridad.confirmacion)" class="confirmar-password">
            <strong>Reemplazar la contraseña actual</strong>
            <p>La nueva contraseña sustituirá a la anterior. No es posible recuperar ni mostrar la contraseña existente.</p>
            <label class="solicitar-password"><input v-model="seguridad.reemplazar" type="checkbox" /> Confirmo que deseo reemplazar la contraseña de este usuario</label>
          </div>
          <div v-if="pantalla === 'editar' && passwordOperationBlocked" class="confirmar-password" role="status">
            <p>{{ passwordWriteBlocked || passwordWriteUncertain ? passwordBlockReason : 'Requisitos pendientes para habilitar Actualizar contraseña:' }}</p>
            <ul v-if="passwordBlockRequirements.length"><li v-for="requisito in passwordBlockRequirements" :key="requisito">{{ requisito }}</li></ul>
            <p>Puedes generar, mostrar y copiar una contraseña; no se enviará al backend.</p>
          </div>
          <div v-if="pantalla === 'editar'" class="controles-password"><button type="button" class="principal" :disabled="passwordDeshabilitada || passwordOperationBlocked || !seguridad.password || !seguridad.reemplazar" @click="actualizarPassword">{{ actualizandoPassword ? 'Actualizando…' : 'Actualizar contraseña' }}</button></div>
          <p v-if="errorPassword" role="alert" class="error">{{ errorPassword }}</p><p v-if="resultadoPassword" role="status" class="mensaje">{{ resultadoPassword }}</p>
          <p class="privacidad-password">La contraseña no se envía por correo.</p>
        </fieldset>
        <footer class="registro-pie"><span>* Campos obligatorios</span><div><button type="button" :disabled="guardando || actualizandoPassword" @click="volverUsuarios">Cancelar</button><button type="submit" class="crear-invitacion" :disabled="guardando || actualizandoPassword || !autorizado">{{ guardando ? 'Guardando…' : pantalla === 'editar' ? 'Guardar datos' : 'Crear usuario' }}</button></div></footer>
      </form>
    </div>
  </section>
  <section v-else-if="pantalla !== 'listado'" class="usuarios-admin accion-usuario">
    <button type="button" class="volver-registro" :disabled="guardando || actualizandoPassword" @click="volverUsuarios">← Volver a usuarios</button>
    <header class="registro-encabezado"><span class="registro-etiqueta">ADMINISTRACIÓN DE USUARIOS</span><h1>{{ tituloAccion }}</h1></header>
    <p v-if="error" class="error" role="alert">{{ error }}</p>
    <p v-if="mensaje" class="mensaje tarjeta-resultado" role="status">{{ mensaje }}</p>
    <p v-if="cargandoAccion" role="status">Consultando información…</p>
    <div v-if="pantalla === 'diagnostico' && puedeDiagnosticar" class="tarjeta-accion">
      <button type="button" :disabled="diagnosticando" @click="ejecutarDiagnostico">Ejecutar diagnóstico</button>
      <div v-if="diagnostico" role="status"><p>HTTP: {{ diagnostico.http ?? 'sin respuesta' }}</p><pre>{{ JSON.stringify(diagnostico.comprobaciones_fallidas) }}</pre></div>
    </div>
    <div v-if="pantalla === 'estado' && objetivoEstado && !completada" class="tarjeta-accion">
      <h2>{{ objetivoEstado.nombre }} {{ objetivoEstado.apellidos }}</h2><p>{{ objetivoEstado.correo }}</p>
      <p>{{ objetivoEstado.activo ? 'Su acceso al CRM quedará bloqueado. Sus datos e historial se conservarán.' : 'El usuario recuperará el acceso de acuerdo con su rol asignado.' }}</p>
      <div class="acciones-formulario"><button :disabled="guardando || actualizandoPassword" @click="volverUsuarios">Cancelar</button><button class="principal" :disabled="guardando || objetivoEstado.id === actor?.id" @click="cambiarEstado(objetivoEstado)">{{ guardando ? 'Guardando…' : objetivoEstado.activo ? 'Confirmar desactivación' : 'Confirmar activación' }}</button></div>
    </div>
    <div v-if="pantalla === 'eliminar' && confirmacionEliminar && !completada" class="tarjeta-accion">
      <h2>{{ confirmacionEliminar.nombre }} {{ confirmacionEliminar.apellidos }}</h2>
      <p>Esta acción es definitiva. La cuenta debe estar inactiva y el servidor comprobará sus dependencias para conservar los registros comerciales.</p>
      <p>Escribe <strong>{{ confirmacionEliminar.correo }}</strong> para confirmar.</p>
      <label>Correo de confirmación<input v-model="textoConfirmacion" type="email" autocomplete="off" :disabled="guardando" /></label>
      <div class="acciones-formulario"><button :disabled="guardando || actualizandoPassword" @click="volverUsuarios">Cancelar</button><button class="peligro" :disabled="guardando || confirmacionEliminar.activo || confirmacionEliminar.id === actor?.id || textoConfirmacion !== confirmacionEliminar.correo" @click="eliminarDefinitivamente">{{ guardando ? 'Eliminando…' : 'Confirmar eliminación' }}</button></div>
    </div>
    <section v-if="pantalla === 'historial' && !cargandoAccion && !error" class="historial" aria-labelledby="titulo-historial">
      <h2 id="titulo-historial">Historial administrativo</h2>
      <p>Últimos 200 registros de auditoría.</p>
      <p v-if="!auditoria.length">No hay eventos disponibles en la auditoría.</p>
      <div class="tabla" v-else><table><thead><tr><th>Fecha</th><th>Administrador</th><th>Usuario</th><th>Rol anterior / nuevo</th><th>Estado anterior / nuevo</th></tr></thead><tbody><tr v-for="evento in auditoria" :key="evento.id"><td>{{ fechaCorta(evento.fecha_cambio) }}</td><td>{{ [evento.actor_nombre, evento.actor_apellidos].filter(Boolean).join(' ') || evento.realizado_por }}</td><td>{{ evento.usuario_correo || evento.usuario_id }}</td><td>{{ etiquetaRol(evento.rol_anterior) }} → {{ etiquetaRol(evento.rol_nuevo) }}</td><td>{{ evento.activo_anterior ? 'Activo' : 'Inactivo' }} → {{ evento.activo_nuevo ? 'Activo' : 'Inactivo' }}</td></tr></tbody></table></div>
    </section>
  </section>
  <section v-else class="usuarios-admin" aria-labelledby="titulo-usuarios">

    <header class="encabezado">
      <div><h1 id="titulo-usuarios">Administración de usuarios</h1><p>{{ usuarioFiltrado.length }} de {{ usuarios.length }} usuarios · Administración real de Supabase</p></div>
      <div class="acciones-encabezado">
        <details class="herramientas-usuarios" @keydown.esc="cerrarMenuConEscape">
          <summary>Herramientas</summary>
          <div class="opciones-usuarios">
            <button v-if="puedeDiagnosticar" type="button" :disabled="diagnosticando" :aria-busy="diagnosticando" @click="diagnosticarConexion">Diagnosticar conexión</button>
            <button type="button" :disabled="guardando||cargando||!autorizado" @click="consultarAuditoria">Historial de acciones</button>
            <button type="button" @click="mostrarAccion('recargar')" :disabled="cargando||guardando">Recargar</button>
          </div>
        </details>
        <button type="button" class="principal" :disabled="!autorizado || guardando" @click="nuevoUsuario">+ Nuevo usuario</button>
      </div>
    </header>

    <p v-if="error" class="error" role="alert">{{ error }}</p>
    <p v-if="mensaje" class="mensaje" role="status">{{ mensaje }}</p>
    <p v-if="cargando" role="status">Consultando usuarios reales…</p>

    <div class="filtros">
      <label>Buscar por nombre o correo<input v-model="busqueda" type="search" placeholder="Nombre o correo" /></label>
      <label>Rol<select v-model="filtroRol"><option value="">Todos</option><option v-for="rol in roles" :key="rol" :value="rol">{{ etiquetaRol(rol) }}</option></select></label>
      <label>Estado<select v-model="filtroEstado"><option value="">Todos</option><option value="activo">Activos</option><option value="inactivo">Inactivos</option></select></label>
    </div>

    <div class="tabla" tabindex="0" role="region" aria-label="Tabla de usuarios"><table>
      <thead><tr><th>Usuario</th><th>Correo / teléfono</th><th>Rol</th><th>Estado</th><th>Creado</th><th>Acciones</th></tr></thead>
      <tbody>
        <tr v-for="usuario in usuarioFiltrado" :key="usuario.id">
          <td><strong>{{ usuario.nombre }} {{ usuario.apellidos }}</strong></td>
          <td>{{ usuario.correo }}<small>{{ usuario.telefono || 'Sin teléfono' }}</small></td>
          <td>{{ etiquetaRol(usuario.rol) }}</td>
          <td><span class="estado" :class="usuario.activo ? 'activo' : 'inactivo'">{{ usuario.activo ? 'Activo' : 'Inactivo' }}</span></td>
          <td>{{ fechaCorta(usuario.fecha_creacion) }}</td>
          <td class="acciones-fila">
            <button type="button" :disabled="guardando" @click="editarUsuario(usuario)">Editar</button>
            <button type="button" :disabled="guardando || usuario.id === actor?.id" @click="pedirEstado(usuario)">{{ usuario.activo ? 'Desactivar' : 'Activar' }}</button>
            <button type="button" class="peligro" :disabled="guardando || usuario.id === actor?.id || usuario.activo" title="Primero desactiva al usuario; las dependencias pueden impedir su eliminación" @click="pedirEliminacion(usuario)">Eliminar…</button>
          </td>
        </tr>
        <tr v-if="!cargando && !error && !usuarioFiltrado.length"><td colspan="6" class="vacio">{{ usuarios.length ? 'No hay usuarios que coincidan con los filtros.' : 'No hay usuarios registrados en public.perfiles.' }}</td></tr>
      </tbody>
    </table></div>



  </section>
</template>

<style scoped>
.modo-alta{clear:both;display:grid;gap:6px;margin-bottom:12px;font-size:12px;color:#61748d}.modo-alta select{height:42px;border:1px solid #dce3ec;border-radius:7px}

.accion-usuario{max-width:1120px;margin:auto}.tarjeta-accion,.tarjeta-resultado{padding:var(--espacio-pagina);background:white;border:1px solid #e2e8f0;border-radius:16px}.tarjeta-accion{max-width:760px;line-height:1.7}.tarjeta-accion label{max-width:460px}.tarjeta-accion h2{margin-top:0}.tarjeta-accion pre{white-space:pre-wrap;overflow-wrap:anywhere}.accion-usuario .historial{border:0;padding:0}

.volver-registro{display:inline-flex;align-items:center;gap:10px;border:0;background:transparent;padding:8px 0;color:#64748b;font-size:14px}.volver-registro span{font-size:20px}.registro-encabezado{margin:30px 0}.registro-etiqueta{font-size:11px;font-weight:700;letter-spacing:.13em;color:#74869c}.registro-encabezado h1{margin:12px 0 10px;font-size:clamp(26px,3vw,36px);letter-spacing:-.035em;line-height:1.2}.registro-encabezado>p{margin:0;color:#64748b;line-height:1.6}
.registro-usuario{width:100%;max-width:1100px;margin:0 auto;padding:0 0 20px;color:#17304e}
.registro-usuario .volver-registro{font-size:12px;padding:4px 0;min-height:30px}
.registro-usuario .formulario-encabezado{display:flex;align-items:center;justify-content:space-between;gap:16px;margin:10px 0 16px}
.formulario-encabezado h1{font-size:26px;margin:5px 0 4px;letter-spacing:-.03em}.formulario-encabezado p{font-size:13px;line-height:1.5;color:#748397;margin:0}.formulario-encabezado .registro-etiqueta{font-size:10px;letter-spacing:.1em}
.indicador-usuario{display:inline-flex;align-items:center;gap:7px;padding:5px 11px;border-radius:20px;font-size:11px;font-weight:600;white-space:nowrap;border:1px solid transparent}.indicador-usuario>span{width:6px;height:6px;background:currentColor;border-radius:50%}.usuario-activo{background:#edf7f0;border-color:#d8eadd;color:#32734c}.usuario-inactivo{background:#fff7e9;border-color:#f2e2c4;color:#946a32}
.registro-distribucion{display:block}.registro-tarjeta{width:100%;box-sizing:border-box;background:#fff;border:1px solid #dfe6ee;border-radius:12px;box-shadow:0 4px 20px #17304e04;overflow:hidden}
.registro-tarjeta fieldset{border:0;padding:12px 22px 14px;margin:0;min-width:0;box-sizing:border-box;display:flow-root}.registro-tarjeta .permisos-registro{border-top:1px solid #edf1f5}
.registro-tarjeta legend{float:left;display:flex;align-items:center;gap:8px;width:100%;padding:0;margin:0 0 8px;font-size:13px;font-weight:700;color:#2a415e}
.numero-seccion{display:grid;place-items:center;width:24px;height:24px;border-radius:7px;background:#f1f5fa;color:#758aa3;flex-shrink:0}.numero-seccion svg{width:15px;height:15px;fill:none;stroke:currentColor;stroke-width:1.6;stroke-linecap:round;stroke-linejoin:round}
.descripcion-seccion{clear:both;margin:0 0 8px;color:#8591a1;font-size:11px;line-height:1.5}.registro-campos{clear:both;display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px 22px}
.registro-campos label{display:block;font-size:12px;font-weight:500;color:#43566f;min-width:0}.registro-campos label>span:not(.password-integrada){color:#8c99aa}.registro-campos .opcional{float:right;font-size:10px;font-weight:400}
.registro-campos input,.registro-campos select{display:block;width:100%;min-width:0;box-sizing:border-box;margin-top:6px;height:var(--altura-control);min-height:var(--altura-control);padding:10px 12px;border:1px solid #dce3ec;border-radius:7px;background:#fff;color:#203b5b;font-size:13px;line-height:1.4;transition:border-color .15s,box-shadow .15s}.registro-campos input::placeholder{color:#a6b0bd}.registro-campos input:focus,.registro-campos select:focus{outline:none;border-color:#7896b8;box-shadow:0 0 0 3px #ecf2f9}.registro-campos input:disabled,.registro-campos select:disabled{background:#f5f7fa;color:#9aa6b4}
.detalle-rol{clear:both;margin:8px 0 0;color:#8591a1;font-size:11px;line-height:1.5}
.seguridad-resumen{clear:both;display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px;margin-bottom:12px}.estado-password{margin:0;font-size:11px;color:#8591a1}.solicitar-password{display:flex;align-items:center;gap:8px;font-size:12px;color:#61748d}.solicitar-password input{width:14px;height:14px;min-height:0;margin:0;accent-color:#173f70}
.password-integrada{display:flex;align-items:center;position:relative;gap:0;min-width:0;margin-top:6px;border:1px solid #dce3ec;border-radius:7px;background:#fff;overflow:hidden}.password-integrada:focus-within{border-color:#7896b8;box-shadow:0 0 0 3px #ecf2f9}.registro-campos .password-integrada input{flex:1;width:0;margin:0;border:0;border-radius:0;box-shadow:none;height:var(--altura-control);min-height:var(--altura-control)}.password-integrada .icono-password{display:grid;place-items:center;flex:0 0 32px;width:32px;height:32px;padding:7px;border:0;background:transparent;color:#7c8da3;border-radius:5px;margin-right:3px}.icono-password svg,.controles-password svg{width:16px;height:16px;fill:none;stroke:currentColor;stroke-width:1.6;stroke-linecap:round;stroke-linejoin:round}.password-integrada .icono-password:hover:not(:disabled){background:#f0f4f9;color:#173f70}.icono-password:focus-visible{outline:2px solid #7896b8;outline-offset:-2px}
.controles-password{display:flex;align-items:center;flex-wrap:wrap;gap:10px;margin-top:10px;font-size:11px;color:#52725e}.controles-password button{display:inline-flex;align-items:center;gap:6px;padding:6px 10px;border:1px solid #dce4ee;border-radius:6px;background:#f8fafd;color:#476181;font-size:11px;min-height:31px}.requisitos-password{color:#8a96a5;font-size:10px}.privacidad-password{font-size:10px;line-height:1.5;color:#99a4b2;margin:7px 0 0}
.confirmar-password{padding:10px 12px;margin:12px 0 0;border:1px solid #eee0be;border-radius:7px;background:#fffaf1;font-size:11px;line-height:1.5;color:#80704a}.confirmar-password p{margin:4px 0 8px}.confirmar-password .solicitar-password{font-size:11px}
.registro-pie{display:flex;justify-content:space-between;align-items:center;gap:12px;padding:12px 22px;border-top:1px solid #edf1f5;background:#fafbfd}.registro-pie>span{font-size:10px;color:#97a2b1}.registro-pie>div{display:flex;gap:9px}.registro-pie button{font-size:12px;min-height:var(--altura-control);padding:9px 18px;border-radius:7px;border:1px solid #dce3ec}.registro-pie .crear-invitacion{background:#173f70;border-color:#173f70;color:#fff;min-width:120px}.registro-pie .crear-invitacion:hover:not(:disabled){background:#12355f}
.registro-error{margin:14px 24px 0;padding:9px 12px;background:#fff6f6;border:1px solid #f0d8d8;border-radius:7px;color:#9a3b3b;font-size:12px;line-height:1.5}
@media(max-width:600px){.registro-usuario .formulario-encabezado{gap:10px}.formulario-encabezado h1{font-size:22px}.formulario-encabezado p{font-size:12px}.registro-tarjeta fieldset{padding:15px 16px}.registro-campos{grid-template-columns:1fr;gap:12px}.registro-pie{padding:12px 16px;flex-wrap:wrap}.registro-pie>div{margin-left:auto}.registro-pie>span{width:100%}.registro-error{margin:12px 16px 0}.requisitos-password{flex-basis:100%}.seguridad-resumen{align-items:flex-start;flex-direction:column}}

.usuarios-admin{display:grid;gap:var(--espacio-panel);color:var(--color-tinta)}.aviso-conexion{padding:.9rem 1rem;border:1px solid #d6b75d;background:#fff8df;border-radius:8px}.aviso-conexion p{margin:.35rem 0 0}.encabezado{display:flex;align-items:center;gap:1rem;flex-wrap:wrap}.encabezado>div:first-child{margin-right:auto}.encabezado h1,.encabezado p,.formulario h2,.confirmacion h2,.historial h2{margin:.2rem 0}.acciones-encabezado,.acciones-formulario{display:flex;gap:.5rem;flex-wrap:wrap}button{min-height:var(--altura-control);padding:4px 9px;border:1px solid #b9c9dc;border-radius:6px;background:#fff;color:#17304e;cursor:pointer}button:disabled{opacity:.55;cursor:not-allowed}.principal{background:#173f70;color:#fff;border-color:#173f70}.peligro{color:#9e2f2f}.formulario,.confirmacion,.historial{padding:1rem 0;border-top:1px solid #cbd6e2;border-bottom:1px solid #cbd6e2}.campos,.filtros{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:.8rem;margin:0}label{display:grid;gap:.35rem;font-size:.92rem}input,select{width:100%;min-width:0;box-sizing:border-box;min-height:var(--altura-control);padding:4px 8px;border:1px solid #b7c6d8;border-radius:5px;background:#fff;color:#17304e}.acciones-formulario{justify-content:flex-end;margin-top:1rem}.ayuda,small{display:block;color:#63758a}.tabla{overflow:auto;background:#fff}table{width:100%;border-collapse:collapse;min-width:780px}th,td{text-align:left;height:var(--altura-fila);padding:5px 8px;border-bottom:1px solid #dce3eb;vertical-align:top}th{font-size:.85rem;color:#4f6277;background:#f4f7fa}td small{margin-top:.25rem;overflow-wrap:anywhere}.acciones-fila{white-space:nowrap}.acciones-fila button{margin:0 .2rem .2rem 0}.estado{display:inline-block;padding:.2rem .45rem;border-radius:4px;font-size:.85rem}.estado.activo{color:#17643e;background:#e6f4eb}.estado.inactivo{color:#7b4b10;background:#fbf0dc}.vacio{text-align:center;color:#63758a}.error{color:#9e2f2f}.mensaje{color:#17643e}.confirmacion{border-color:#b95050}.confirmacion label{max-width:420px}@media(max-width:600px){.acciones-encabezado{width:100%}.acciones-encabezado button{flex:1}.filtros{grid-template-columns:1fr}}

.herramientas-usuarios { position: relative; }
.herramientas-usuarios summary {
  display: list-item;
  min-height: var(--altura-control);
  padding: 7px 10px;
  border: 1px solid var(--color-borde);
  border-radius: var(--radio-control);
  background: var(--color-superficie);
  cursor: pointer;
}
.opciones-usuarios {
  position: absolute;
  inset: calc(100% + 4px) auto auto 0;
  z-index: 2;
  display: grid;
  gap: 4px;
  width: max-content;
  max-width: 72vw;
  padding: 6px;
  background: var(--color-superficie);
  border: 1px solid var(--color-borde);
  border-radius: var(--radio-panel);
  box-shadow: var(--sombra-panel);
}
.opciones-usuarios button { text-align: left; }
</style>
