// Lectura de diagnóstico separada del CRUD. Nunca devolver cuerpos/errores remotos.
const ETIQUETAS=new Set(['REFERENCIA_PROYECTO_FORMATO','URL_SUPABASE_FORMATO','URL_SUPABASE_PROYECTO','CLAVE_PUBLICA_DISPONIBLE','CLAVE_SERVIDOR_DISPONIBLE','POSTGRESQL_URL_FORMATO','POSTGRESQL_PROTOCOLO','POSTGRESQL_PROYECTO','POSTGRESQL_PASSWORD_PRESENTE','LISTA_ORIGENES','URL_INVITACION_LOCAL','URL_INVITACION_PRODUCTION'])
export function esDesarrolloLocalAdmin(desarrollo,origin){return desarrollo===true&&origin==='http://localhost:5173'}
export async function diagnosticarConexionUsuarios({obtenerCliente,fetchImpl=globalThis.fetch}){
  const resultado={http:null,comprobaciones_fallidas:[]}
  try{
    const cliente=await obtenerCliente()
    const url=new URL(cliente.supabaseUrl)
    if(url.protocol!=='https:'||url.pathname!=='/'||url.username||url.password||url.search||url.hash)return resultado
    const key=cliente.supabaseKey||''
    let publica=key.startsWith('sb_publishable_')
    try{if(key.split('.').length===3)publica=JSON.parse(globalThis.atob(key.split('.')[1].replace(/-/g,'+').replace(/_/g,'/'))).role==='anon'}catch{publica=false}
    if(!publica)return resultado
    const identidad=await cliente.auth.getUser()
    const sesion=await cliente.auth.getSession()
    const session=sesion.data?.session
    if(identidad.error||sesion.error||!identidad.data?.user||!session?.access_token||session.user?.id!==identidad.data.user.id)return resultado
    const response=await fetchImpl(`${url.origin}/functions/v1/admin-usuarios`,{
      method:'POST',headers:{Authorization:`Bearer ${session.access_token}`,apikey:key,'Content-Type':'application/json'},
      body:JSON.stringify({operacion:'diagnosticar_configuracion'}),signal:AbortSignal.timeout(15000),
    })
    resultado.http=response.status
    const body=await response.json().catch(()=>null)
    // No mostrar etiquetas en respuestas de autorización fallida o errores genéricos.
    if(response.status===200&&Array.isArray(body?.comprobaciones_fallidas)){
      resultado.comprobaciones_fallidas=body.comprobaciones_fallidas.filter(c=>typeof c==='string'&&ETIQUETAS.has(c))
    }
  }catch{/*No imprimir excepciones, JWT, claves, URLs ni cadenas de conexión.*/}
  return resultado
}
