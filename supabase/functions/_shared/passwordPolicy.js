// Política compartida entre formulario y Edge. No devuelve valores sensibles.
export function validarPasswordAdministrativa(password,confirmacion){
  if(typeof password!=='string'||password.length<12||password.length>128)return 'La contraseña debe tener entre 12 y 128 caracteres.'
  if(!/^[!-~]+$/.test(password)||!/[A-Z]/.test(password)||!/[a-z]/.test(password)||!/[0-9]/.test(password)||!/[\W_]/.test(password))return 'Incluye mayúsculas, minúsculas, números y símbolos, sin espacios.'
  if(password!==confirmacion)return 'Las contraseñas no coinciden.'
  return ''
}
