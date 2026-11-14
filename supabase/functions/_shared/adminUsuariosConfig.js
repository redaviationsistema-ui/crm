// Solo etiquetas fijas. Nunca devolver entradas, excepciones ni valores secretos.
export function evaluarConfiguracionAdmin({url,dbUrl,projectRef,anon,service,fallasWeb=/** @type {readonly string[]} */ ([])}){
  const fallidas=[...fallasWeb]
  const refValida=/^[a-z]{20}$/.test(projectRef)
  if(!refValida)fallidas.push('REFERENCIA_PROYECTO_FORMATO')
  let api,db
  try{api=new URL(url)}catch{fallidas.push('URL_SUPABASE_FORMATO')}
  if(api&&refValida&&(api.origin!==`https://${projectRef}.supabase.co`||api.pathname!=='/'))fallidas.push('URL_SUPABASE_PROYECTO')
  if(!anon)fallidas.push('CLAVE_PUBLICA_DISPONIBLE')
  if(!service)fallidas.push('CLAVE_SERVIDOR_DISPONIBLE')
  try{db=new URL(dbUrl)}catch{fallidas.push('POSTGRESQL_URL_FORMATO')}
  if(db){
    if(!['postgres:','postgresql:'].includes(db.protocol))fallidas.push('POSTGRESQL_PROTOCOLO')
    if(refValida){
      let matches=false
      try{matches=db.hostname===`db.${projectRef}.supabase.co`||(db.hostname.endsWith('.pooler.supabase.com')&&decodeURIComponent(db.username).endsWith(`.${projectRef}`))}catch{/*Etiqueta fija, sin excepción original.*/}
      if(!matches)fallidas.push('POSTGRESQL_PROYECTO')
    }
    if(!db.password)fallidas.push('POSTGRESQL_PASSWORD_PRESENTE')
  }
  return Object.freeze({valida:fallidas.length===0,fallidas:Object.freeze(fallidas)})
}
export function crearDiagnosticoConfiguracionAdmin({fallidas,autenticarAdmin}){
  return async request=>{
    const generic=(status)=>Response.json({error:status===401?'Autenticación requerida o sesión no válida.':status===403?'Se requiere un administrador activo.':'No fue posible verificar la autorización del diagnóstico.'},{status})
    if(request.method!=='POST')return new Response(null,{status:405})
    const token=(request.headers.get('Authorization')||'').match(/^Bearer\s+(\S+)$/i)?.[1]
    if(!token)return generic(401)
    try{
      const status=await autenticarAdmin(token)
      if(status!==200)return generic([401,403].includes(status)?status:503)
      const body=await request.json()
      if(!body||body.operacion!=='diagnosticar_configuracion'||Object.keys(body).some(k=>k!=='operacion'))return Response.json({error:'Solicitud de diagnóstico no válida.'},{status:400})
      return Response.json({comprobaciones_fallidas:fallidas})
    }catch{return generic(503)}
  }
}
