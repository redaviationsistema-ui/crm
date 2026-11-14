// These switches control the UI only; admin-usuarios authorizes every write independently.
export const configuracionUsuariosAdminPassword=Object.freeze({
  origenes:Object.freeze({
    local:'http://localhost:5173',
    produccion:'https://redskyg.com',
  }),
  produccionProjectRefs:Object.freeze(['hhlicjgpwcesytziacvc']),
})

function clavePublica(key){
  if(typeof key!=='string'||!key)return false
  if(key.startsWith('sb_publishable_'))return true
  if(key.split('.').length!==3)return false
  try{
    const payload=JSON.parse(globalThis.atob(key.split('.')[1].replace(/-/g,'+').replace(/_/g,'/')))
    return payload.role==='anon'
  }catch{return false}
}

export function evaluarEscriturasPasswordAdmin(env={},contexto={},config=configuracionUsuariosAdminPassword){
  const requisitos=[]
  const {origin,sesionAutenticada=false,actor}=contexto
  if(!config.origenes||![config.origenes.local,config.origenes.produccion].includes(origin)){
    requisitos.push('Usar un origen explícitamente autorizado: http://localhost:5173 o https://redskyg.com.')
  }
  if(sesionAutenticada!==true)requisitos.push('Iniciar sesión con una sesión Supabase verificada.')
  if(actor?.rol!=='administrador'||actor?.activo!==true)requisitos.push('Se requiere un administrador activo.')

  let url
  try{url=new URL(env.VITE_SUPABASE_URL)}catch{requisitos.push('Configurar una URL válida en VITE_SUPABASE_URL.')}
  if(url&&(url.protocol!=='https:'||url.pathname!=='/'||url.username||url.password||url.search||url.hash)){
    requisitos.push('Usar una URL Supabase HTTPS válida sin credenciales, ruta, parámetros o fragmento.')
  }
  if(!clavePublica(env.VITE_SUPABASE_ANON_KEY))requisitos.push('Configurar una clave pública Supabase; no se permiten claves privilegiadas.')

  let projectRef=''
  if(url){
    projectRef=url.hostname.endsWith('.supabase.co')?url.hostname.slice(0,-'.supabase.co'.length):''
    if(!/^[a-z]{20}$/.test(projectRef))requisitos.push('VITE_SUPABASE_URL debe apuntar a un proyecto Supabase con referencia válida.')
  }

  if(origin===config.origenes?.local){
    if(env.VITE_CRM_ADMIN_PASSWORD_LOCAL_ENABLED!=='true')requisitos.push('Falta VITE_CRM_ADMIN_PASSWORD_LOCAL_ENABLED=true.')
    if(config.produccionProjectRefs.includes(projectRef)){
      if(env.DEV!==true||env.MODE!=='development'){
        requisitos.push('El proyecto productivo conectado localmente requiere Vite en modo development.')
      }
      if(env.VITE_CRM_ADMIN_PASSWORD_PRODUCTION_BACKEND_VALIDATED!=='true'){
        requisitos.push('El proyecto conectado es producción; falta VITE_CRM_ADMIN_PASSWORD_PRODUCTION_BACKEND_VALIDATED=true.')
      }
    }else{
      if(env.DEV!==true||env.MODE!=='staging'){
        requisitos.push('Un proyecto staging solo se autoriza desde desarrollo local en modo staging.')
      }
      const stagingRef=env.VITE_CRM_ADMIN_PASSWORD_STAGING_PROJECT_REF
      if(env.MODE!=='staging'||!env.DEV||!/^[a-z]{20}$/.test(stagingRef)||
        config.produccionProjectRefs.includes(stagingRef)||url?.origin!==`https://${stagingRef}.supabase.co`||
        env.VITE_CRM_ADMIN_PASSWORD_STAGING_VALIDATED!=='true'){
        requisitos.push('Para usar staging local, configurar su referencia y validar el backend independiente.')
      }
    }
  }

  if(origin===config.origenes?.produccion){
    if(env.DEV!==false||env.MODE!=='production')requisitos.push('El origen web requiere un build production.')
    if(env.VITE_CRM_ADMIN_PASSWORD_PRODUCTION_ENABLED!=='true')requisitos.push('Falta VITE_CRM_ADMIN_PASSWORD_PRODUCTION_ENABLED=true.')
    if(env.VITE_CRM_ADMIN_PASSWORD_PRODUCTION_BACKEND_VALIDATED!=='true')requisitos.push('Falta validar expresamente el backend productivo.')
    if(!config.produccionProjectRefs.includes(projectRef)||url?.origin!==`https://${projectRef}.supabase.co`){
      requisitos.push('La aplicación web debe usar el proyecto productivo aprobado.')
    }
  }

  return {
    habilitado:requisitos.length===0,
    motivo:requisitos[0]||'Entorno autorizado para mostrar el botón; el backend conserva la decisión final.',
    requisitosPendientes:requisitos,
  }
}
