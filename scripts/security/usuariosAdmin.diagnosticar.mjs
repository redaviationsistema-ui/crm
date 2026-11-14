// Petición explícita de SOLO diagnóstico. No carga .env, no ejecuta CRUD ni imprime JWT.
const etiquetas=new Set(['REFERENCIA_PROYECTO_FORMATO','URL_SUPABASE_FORMATO','URL_SUPABASE_PROYECTO','CLAVE_PUBLICA_DISPONIBLE','CLAVE_SERVIDOR_DISPONIBLE','POSTGRESQL_URL_FORMATO','POSTGRESQL_PROTOCOLO','POSTGRESQL_PROYECTO','POSTGRESQL_PASSWORD_PRESENTE','LISTA_ORIGENES','URL_INVITACION_LOCAL','URL_INVITACION_PRODUCTION'])
try{
  const e=process.env,api=new URL(e.VITE_SUPABASE_URL||'')
  if(api.protocol!=='https:'||!/^([a-z]{20})\.supabase\.co$/.test(api.hostname)||api.pathname!=='/'||api.username||api.password||api.search||api.hash||api.port)throw Error()
  if(!e.VITE_SUPABASE_ANON_KEY||!e.CRM_ADMIN_JWT||!['http://localhost:5173','https://redskyg.com'].includes(e.CRM_ADMIN_TEST_ORIGIN))throw Error()
  const key=e.VITE_SUPABASE_ANON_KEY
  let publica=key.startsWith('sb_publishable_')
  try{if(key.split('.').length===3)publica=JSON.parse(Buffer.from(key.split('.')[1],'base64url')).role==='anon'}catch{publica=false}
  if(!publica)throw Error()
  const r=await fetch(`${api.origin}/functions/v1/admin-usuarios`,{method:'POST',headers:{Origin:e.CRM_ADMIN_TEST_ORIGIN,apikey:e.VITE_SUPABASE_ANON_KEY,Authorization:`Bearer ${e.CRM_ADMIN_JWT}`,'Content-Type':'application/json'},body:JSON.stringify({operacion:'diagnosticar_configuracion'}),signal:AbortSignal.timeout(15000)})
  if(!r.ok){console.error(`Diagnóstico no autorizado o no disponible (HTTP ${r.status}). Revisa los logs privados del Dashboard.`);process.exitCode=1}
  else{
    const body=await r.json()
    if(!Array.isArray(body?.comprobaciones_fallidas)||body.comprobaciones_fallidas.some(nombre=>!etiquetas.has(nombre)))throw Error()
    // No imprimir la respuesta remota completa, ni siquiera en caso de error.
    console.log(JSON.stringify({comprobaciones_fallidas:body.comprobaciones_fallidas}))
  }
}catch{
  console.error('No se pudo obtener un diagnóstico seguro. Revisa las variables requeridas y los logs privados del Dashboard.')
  process.exitCode=1
}
