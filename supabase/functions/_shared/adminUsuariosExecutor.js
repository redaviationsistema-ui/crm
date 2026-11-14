const parcial=mensaje=>Object.assign(Error(mensaje),{status:409,requiereRevision:true})
function verificarPerfil(p,id,cambios){
  if(!p||p.id!==id||Object.keys(cambios).some(k=>p[k]!==cambios[k]))throw parcial('PostgreSQL no confirmó los datos enviados. Revisa el perfil antes de repetir.')
}
function verificarEstado(user,activo){
  if(typeof activo!=='boolean')return true
  const hasta=user.banned_until?Date.parse(user.banned_until):0
  return Number.isFinite(hasta)&&(activo?hasta<=Date.now():hasta>Date.now())
}
export function crearAdminUsuariosExecutor({authAdmin,ejecutarDb,eliminarConAuth}){
  return async (entrada,contexto={})=>{
    // El secreto nunca forma parte de comandos SQL, preflight, auditoría o perfiles.
    const {password,...c}=entrada
    if(password!==undefined&&!['cambiar_password','crear_con_password'].includes(c.operacion))throw Object.assign(Error('Contrato de contraseña no permitido.'),{status:400})
    if(['cambiar_password','crear_con_password'].includes(c.operacion)&&typeof password!=='string')throw Object.assign(Error('Falta una contraseña válida.'),{status:400})
    if(['listar','historial'].includes(c.operacion))return ejecutarDb(c)
    if(c.operacion==='crear'&&!contexto.redirectTo)throw Object.assign(Error('No hay URL de invitación autorizada para esta solicitud.'),{status:503})
    const contrato=await ejecutarDb({...c,operacion:'preflight'})
    if(contrato?.contrato!=='administrar-perfil-existente-v1')throw Object.assign(Error('No se verificó la función administrativa existente. No se modificó Auth.'),{status:503})
    if(c.operacion==='cambiar_password'){
      try{
        const r=await authAdmin.updateUserById(c.usuarioId,{password})
        if(r.error||r.data?.user?.id!==c.usuarioId)throw Error('No confirmado')
        return {usuarioId:c.usuarioId,contrasenaActualizada:true}
      }catch{throw parcial('No se confirmó la contraseña. Revisa Auth antes de repetir; esta operación no guarda datos del perfil.')}
    }
    if(['crear','crear_con_password'].includes(c.operacion)){
      let alta
      try{
        alta=c.operacion==='crear'
          ?await authAdmin.inviteUserByEmail(c.usuario.correo,{redirectTo:contexto.redirectTo,data:{nombre:c.usuario.nombre,apellidos:c.usuario.apellidos}})
          :await authAdmin.createUser({email:c.usuario.correo,password,email_confirm:true,ban_duration:'876000h',user_metadata:{nombre:c.usuario.nombre,apellidos:c.usuario.apellidos}})
      }catch{throw parcial('Auth no confirmó el alta. Revisa Dashboard antes de repetir.')}
      if(alta.error||!alta.data?.user?.id)throw parcial('Auth no confirmó el alta. Revisa Dashboard antes de repetir.')
      const id=alta.data.user.id
      try{
        const ban=await authAdmin.updateUserById(id,{ban_duration:'876000h'})
        if(ban.error)throw Error('Ban pendiente')
        const p=await ejecutarDb({...c,operacion:'crear',usuarioId:id})
        verificarPerfil(p,id,c.usuario)
        if(c.usuario.activo){const activar=await authAdmin.updateUserById(id,{ban_duration:'none'});if(activar.error)throw Error('Activación pendiente')}
        const a=await authAdmin.getUserById(id)
        if(a.error||a.data?.user?.id!==id||a.data.user.email?.toLowerCase()!==c.usuario.correo||!verificarEstado(a.data.user,c.usuario.activo))throw Error('Verificación Auth pendiente')
        return p
      }catch{
        await authAdmin.updateUserById(id,{ban_duration:'876000h'}).catch(()=>null)
        throw parcial('Alta incompleta. Revisa y reconcilia Auth y perfil en Dashboard; no repitas ni elimines automáticamente la cuenta.')
      }
    }
    if(c.operacion==='eliminar_definitivamente'){
      if(!eliminarConAuth)throw Object.assign(Error('Eliminación segura no configurada.'),{status:503})
      await ejecutarDb({...c,operacion:'preparar_eliminacion'})
      const ban=await authAdmin.updateUserById(c.usuarioId,{ban_duration:'876000h'})
      if(ban.error)throw parcial('Perfil desactivado; Auth no confirmó el bloqueo. Eliminación detenida.')
      let borradoIntentado=false
      try{await eliminarConAuth(c,async()=>{
        borradoIntentado=true
        const r=await authAdmin.deleteUser(c.usuarioId)
        if(r.error)throw parcial('Auth rechazó la eliminación. Se conserva la desactivación; revisa dependencias en Dashboard.')
      })}catch(e){
        if(!borradoIntentado||e.requiereRevision)throw e
        throw parcial('La eliminación requiere revisión en Auth y PostgreSQL; no se confirmó el resultado final.')
      }
      const auth=await authAdmin.getUserById(c.usuarioId)
      if(auth.data?.user||auth.error?.status!==404)throw parcial('Auth no confirmó la ausencia del usuario. Revisa Dashboard antes de repetir.')
      try{return await ejecutarDb({...c,operacion:'verificar_eliminacion'})}catch{throw parcial('Auth eliminó la cuenta pero falta confirmar PostgreSQL. Revisa Dashboard antes de repetir.')}
    }
    const p=await ejecutarDb(c)
    verificarPerfil(p,c.usuarioId,c.cambios||{})
    const cambios=c.cambios||{},authCambios={}
    if(cambios.correo!==undefined&&cambios.correo!==c.objetivo.correo)authCambios.email=cambios.correo
    if(cambios.activo!==undefined)authCambios.ban_duration=cambios.activo?'none':'876000h'
    if(Object.keys(authCambios).length){
      try{
      const r=await authAdmin.updateUserById(c.usuarioId,authCambios)
      if(r.error)throw parcial('Perfil actualizado; sincronización Auth pendiente. Revisa Dashboard antes de repetir.')
      const a=await authAdmin.getUserById(c.usuarioId)
      if(a.error||a.data?.user?.id!==c.usuarioId||!verificarEstado(a.data.user,cambios.activo)||(authCambios.email&&a.data.user.email?.toLowerCase()!==authCambios.email))throw parcial('No se pudo verificar la sincronización Auth. Revisión administrativa necesaria.')
      }catch(e){if(e.requiereRevision)throw e;throw parcial('Perfil actualizado; no se pudo confirmar Auth. Revisa Dashboard antes de repetir.')}
    }
    return p
  }
}
