export const ROLES_USUARIO_ADMIN = Object.freeze(['administrador', 'supervisor', 'ejecutivo'])
export const CAMPOS_DEPENDENCIA_USUARIO = Object.freeze({
  prospectos: 'prospectos',
  llamadas: 'llamadas',
  oportunidades: 'oportunidades',
  auditorias: 'auditorías',
})

const correoValido = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function validarUsuarioAdmin(usuario) {
  const errores = {}
  if (!usuario?.nombre?.trim()) errores.nombre = 'Escribe el nombre.'
  if (!usuario?.apellidos?.trim()) errores.apellidos = 'Escribe los apellidos.'
  if (!correoValido.test(usuario?.correo?.trim() || '')) errores.correo = 'Escribe un correo electrónico válido.'
  if (typeof usuario?.telefono !== 'string' || usuario.telefono.length > 40) errores.telefono = 'El teléfono debe tener 40 caracteres o menos.'
  if (!ROLES_USUARIO_ADMIN.includes(usuario?.rol)) errores.rol = 'Selecciona un rol permitido.'
  if (typeof usuario?.activo !== 'boolean') errores.activo = 'Selecciona un estado válido.'
  return errores
}

export function contarAdministradoresActivos(usuarios) {
  return usuarios.filter(usuario => usuario.rol === 'administrador' && usuario.activo === true).length
}

export function validarCambioUsuarioAdmin({ actor, usuarios, actual, cambios }) {
  if (actor?.rol !== 'administrador' || actor?.activo !== true) {
    throw Error('Solo un administrador activo puede gestionar usuarios.')
  }
  if (!actual) throw Error('El usuario ya no existe. Actualiza la lista e inténtalo de nuevo.')
  const siguiente = { ...actual, ...cambios }
  const errores = validarUsuarioAdmin(siguiente)
  if (Object.keys(errores).length) throw Error(Object.values(errores).join(' '))
  if (actor.id === actual.id && cambios.rol !== undefined && cambios.rol !== actual.rol) {
    throw Error('No puedes cambiar tu propio rol desde esta pantalla.')
  }
  if (actor.id === actual.id && cambios.activo === false) {
    throw Error('No puedes desactivar tu propia cuenta.')
  }
  const dejaDeSerAdministradorActivo = actual.rol === 'administrador' && actual.activo &&
    (siguiente.rol !== 'administrador' || siguiente.activo !== true)
  if (dejaDeSerAdministradorActivo && contarAdministradoresActivos(usuarios) <= 1) {
    throw Error('No se puede desactivar ni degradar al último administrador activo.')
  }
  return siguiente
}

export function dependenciasUsuario(usuario) {
  return Object.entries(CAMPOS_DEPENDENCIA_USUARIO)
    .filter(([campo]) => Number(usuario?.dependencias?.[campo] || 0) > 0)
    .map(([campo, etiqueta]) => `${etiqueta}: ${usuario.dependencias[campo]}`)
}
