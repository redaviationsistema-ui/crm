// SQL parametrizado SOLO en Edge. No crea funciones, tablas, triggers ni políticas.
const CAMPOS=['id','nombre','apellidos','correo','telefono','avatar_url','rol','activo','fecha_creacion','fecha_actualizacion']
const PERSONAL=['nombre','apellidos','correo','telefono']
const fallo=(status,mensaje)=>Object.assign(Error(mensaje),{status})
export function parametrosAdministrarPerfil(c,actual){
  const cambios=c.usuario||c.cambios||{}
  return {p_actor_id:c.actorId,p_usuario_id:c.usuarioId,
    p_nuevo_rol:cambios.rol!==undefined&&cambios.rol!==actual.rol?cambios.rol:null,
    p_nuevo_activo:cambios.activo!==undefined&&cambios.activo!==actual.activo?cambios.activo:null}
}
export function crearAdminUsuariosPostgres({sql,deletionReviewed=false}){
  async function autorizar(tx,id){
    const [actor]=await tx`SELECT id,rol,activo FROM public.perfiles WHERE id=${id}::uuid FOR SHARE`
    if(actor?.rol!=='administrador'||actor?.activo!==true)throw fallo(403,'Se requiere un administrador activo.')
  }
  async function perfil(tx,id){const [row]=await tx`SELECT ${tx(CAMPOS)} FROM public.perfiles WHERE id=${id}::uuid`;return row||null}
  async function contrato(tx){
    const [f]=await tx`SELECT p.prorettype='void'::regtype AS retorna_void,p.prosecdef,
      p.proargnames[1:4]=ARRAY['p_actor_id','p_usuario_id','p_nuevo_rol','p_nuevo_activo'] AS parametros,
      coalesce(p.proconfig @> ARRAY['search_path=""'],false) AS ruta_segura,
      has_function_privilege(current_user,p.oid,'EXECUTE') AS permitido
      FROM pg_proc p WHERE p.oid=to_regprocedure('crm_internal.administrar_perfil(uuid,uuid,text,boolean)')`
    if(!f?.retorna_void||!f.prosecdef||!f.parametros||!f.ruta_segura||!f.permitido)throw fallo(503,'Revisar firma, SECURITY DEFINER, search_path y EXECUTE de administrar_perfil.')
  }
  async function cambiarAcceso(tx,c,actual){
    const p=parametrosAdministrarPerfil(c,actual)
    if(p.p_nuevo_rol===null&&p.p_nuevo_activo===null)return
    if(c.actorId===c.usuarioId)throw fallo(403,'No puedes modificar tu propio acceso.')
    // Retorno void: releer el perfil después, nunca interpretar el retorno como fila.
    await tx`SELECT crm_internal.administrar_perfil(
      p_actor_id => ${p.p_actor_id}::uuid,p_usuario_id => ${p.p_usuario_id}::uuid,
      p_nuevo_rol => ${p.p_nuevo_rol}::text,p_nuevo_activo => ${p.p_nuevo_activo}::boolean)`
  }
  async function dependencias(tx,id){
    if(!deletionReviewed)throw fallo(503,'Eliminación bloqueada: revisar FK, triggers, Storage y dependencias en Dashboard.')
    const fks=await tx`SELECT n.nspname AS esquema,t.relname AS tabla,c.confdeltype,c.condeferrable,
      c.conrelid='public.perfiles'::regclass AS es_perfil,c.confrelid='auth.users'::regclass AS a_auth,
      cardinality(c.conkey) AS columnas,a.attname AS columna,r.attname AS referencia
      FROM pg_constraint c JOIN pg_class t ON t.oid=c.conrelid JOIN pg_namespace n ON n.oid=t.relnamespace
      JOIN pg_attribute a ON a.attrelid=c.conrelid AND a.attnum=c.conkey[1]
      JOIN pg_attribute r ON r.attrelid=c.confrelid AND r.attnum=c.confkey[1]
      WHERE c.contype='f' AND c.confrelid IN ('public.perfiles'::regclass,'auth.users'::regclass) AND n.nspname<>'auth'`
    const cascada=f=>f.es_perfil&&f.a_auth&&f.columna==='id'&&f.referencia==='id'&&f.columnas===1&&f.confdeltype==='c'
    if(!fks.some(cascada))throw fallo(409,'Revisar FK perfiles.id a auth.users.id ON DELETE CASCADE.')
    for(const fk of fks){
      if(cascada(fk))continue
      // RESTRICT/NO ACTION protege también de referencias creadas después de esta lectura.
      if(fk.columnas!==1||fk.referencia!=='id'||fk.condeferrable||!['a','r'].includes(fk.confdeltype))throw fallo(409,'Hay FK con propagación de cambios o estructura no verificada. Eliminación bloqueada.')
      const [row]=await tx`SELECT EXISTS(SELECT 1 FROM ${tx(fk.esquema)}.${tx(fk.tabla)} WHERE ${tx(fk.columna)}=${id}::uuid) AS existe`
      if(row.existe)throw fallo(409,'El usuario tiene registros vinculados. Desactívalo para conservarlos.')
    }
  }
  async function ejecutarDb(c){
    try{return await sql.begin(async tx=>{
      await tx`SET LOCAL statement_timeout='15s'`
      await tx`SET LOCAL lock_timeout='5s'`
      await autorizar(tx,c.actorId)
      if(c.operacion==='listar')return tx`SELECT ${tx(CAMPOS)} FROM public.perfiles ORDER BY nombre,id`
      if(c.operacion==='historial'){
        // Esquema confirmado desde Dashboard: no snapshots JSON ni nombres supuestos.
        return tx`SELECT a.id,a.usuario_id,a.realizado_por,a.rol_anterior,a.rol_nuevo,
          a.activo_anterior,a.activo_nuevo,a.fecha_cambio,
          actor.nombre AS actor_nombre,actor.apellidos AS actor_apellidos,
          objetivo.correo AS usuario_correo
          FROM public.auditoria_usuarios a
          LEFT JOIN public.perfiles actor ON actor.id=a.realizado_por
          LEFT JOIN public.perfiles objetivo ON objetivo.id=a.usuario_id
          ORDER BY a.fecha_cambio DESC,a.id DESC LIMIT 200`
      }
      await contrato(tx)
      if(c.operacion==='preflight'){
        if(c.usuario){const [r]=await tx`SELECT EXISTS(SELECT 1 FROM auth.users WHERE lower(email)=lower(${c.usuario.correo})) AS existe`
          if(r.existe)throw fallo(409,'El correo ya tiene una cuenta Auth. No se creará otra cuenta.')}
        return {contrato:'administrar-perfil-existente-v1'}
      }
      if(c.operacion==='crear'){
        const [auth]=await tx`SELECT id,email FROM auth.users WHERE id=${c.usuarioId}::uuid`
        if(!auth||auth.email?.toLowerCase()!==c.usuario.correo)throw fallo(409,'Auth no confirmó la cuenta invitada.')
        await tx`INSERT INTO public.perfiles (id,nombre,apellidos,correo,telefono,rol,activo)
          VALUES (${c.usuarioId}::uuid,${c.usuario.nombre},${c.usuario.apellidos},${c.usuario.correo},${c.usuario.telefono},'ejecutivo',false)
          ON CONFLICT(id) DO NOTHING`
      }
      const actual=await perfil(tx,c.usuarioId)
      if(c.operacion==='verificar_eliminacion'){
        const [auth]=await tx`SELECT id FROM auth.users WHERE id=${c.usuarioId}::uuid`
        if(actual||auth)throw fallo(409,'Eliminación no confirmada en PostgreSQL.')
        return {id:c.usuarioId,eliminado:true}
      }
      if(!actual)throw fallo(404,'El perfil solicitado no existe.')
      if(c.operacion==='preparar_eliminacion'){
        if(c.usuarioId===c.actorId)throw fallo(403,'No puedes eliminar tu propia cuenta.')
        if(actual.correo!==c.confirmacion)throw fallo(409,'El correo cambió; recarga el listado.')
        await dependencias(tx,c.usuarioId)
        if(actual.activo!==false)throw fallo(409,'Desactiva primero al usuario. Su historial y referencias se conservarán.')
        return {id:c.usuarioId,preparado:true}
      }
      if(!['crear','editar','cambiar_estado'].includes(c.operacion))throw fallo(400,'Operación no permitida.')
      const cambios=c.usuario||c.cambios||{}
      const personal=Object.fromEntries(PERSONAL.filter(k=>Object.hasOwn(cambios,k)).map(k=>[k,cambios[k]]))
      if(Object.keys(personal).length)await tx`UPDATE public.perfiles SET ${tx(personal,...Object.keys(personal))},fecha_actualizacion=now() WHERE id=${c.usuarioId}::uuid`
      await cambiarAcceso(tx,c,actual)
      return perfil(tx,c.usuarioId)
    })}catch(e){
      if(e.status)throw e
      const conflicto=['23503','23505','23514','P0001','40001','40P01','55P03'].includes(e.code)
      throw fallo(e.code==='42501'?403:conflicto?409:503,conflicto?'La base de datos rechazó el cambio por reglas administrativas, dependencias o concurrencia. Recarga el listado.':'PostgreSQL rechazó la operación. Revisa permisos y contrato en Dashboard.')
    }
  }
  return {ejecutarDb,eliminarConAuth:async(c,borrar)=>sql.begin(async tx=>{
    await tx`SET LOCAL statement_timeout='15s'`
    await tx`SET LOCAL lock_timeout='5s'`
    await autorizar(tx,c.actorId)
    const actual=await perfil(tx,c.usuarioId)
    if(c.actorId===c.usuarioId||!actual||actual.activo!==false||actual.correo!==c.confirmacion)throw fallo(409,'Recarga el perfil y confirma que permanece inactivo antes de eliminar.')
    await dependencias(tx,c.usuarioId)
    // El actor permanece activo bajo FOR SHARE hasta terminar Auth. No se bloquea
    // el perfil objetivo, pues Auth necesita borrarlo mediante su FK CASCADE.
    return borrar()
  }),perfilPorId:id=>perfil(sql,id),contarAdminsActivos:async()=>{
    const [r]=await sql`SELECT count(*)::integer AS total FROM public.perfiles WHERE rol='administrador' AND activo=true`;return r.total}}
}
