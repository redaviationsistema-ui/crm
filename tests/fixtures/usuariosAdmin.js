// DOBLE EXCLUSIVO DE PRUEBAS. No importado por src/ ni por la Edge Function.
export function backendUsuariosPrueba(){
  let usuarios=[
    {id:'admin-prueba',nombre:'Alex',apellidos:'Admin',correo:'admin@example.test',telefono:'',rol:'administrador',activo:true},
    {id:'supervisor-prueba',nombre:'Sam',apellidos:'Supervisor',correo:'supervisor@example.test',telefono:'',rol:'supervisor',activo:true},
    {id:'ejecutivo-prueba',nombre:'Taylor',apellidos:'Ejecutivo',correo:'ejecutivo@example.test',telefono:'',rol:'ejecutivo',activo:true},
  ],auditoria=[]
  return {
    listar:async()=>structuredClone(usuarios),historial:async()=>structuredClone(auditoria),
    crear:async entrada=>{const u={...entrada,id:'nuevo-prueba'};usuarios.push(u);auditoria.push({id:'1',usuario_id:u.id,realizado_por:'admin-prueba',rol_anterior:'ejecutivo',rol_nuevo:u.rol,activo_anterior:false,activo_nuevo:u.activo,fecha_cambio:'2026-11-13T12:00:00Z',usuario_correo:u.correo});return u},
    editar:async(id,cambios)=>{const u=usuarios.find(u=>u.id===id);Object.assign(u,cambios);return structuredClone(u)},
    cambiarEstado:async(id,activo)=>{const u=usuarios.find(u=>u.id===id);u.activo=activo;return structuredClone(u)},
    eliminarDefinitivamente:async(id)=>{usuarios=usuarios.filter(u=>u.id!==id);return {id,eliminado:true}},
  }
}
