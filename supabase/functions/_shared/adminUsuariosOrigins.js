// Lista cerrada de entornos solicitados. Ningún valor se obtiene del cuerpo,
// Referer, Host o X-Forwarded-* de la solicitud.
export function revisarOrigenesAdmin({allowedOrigins,inviteRedirectLocal,inviteRedirectProduction}){
  const fallidas=[]
  let origins
  try{origins=JSON.parse(allowedOrigins)}catch{/*No registrar el valor ni el error de JSON.*/}
  const destinos={
    'http://localhost:5173':'http://localhost:5173/crm/establecer-acceso',
    'https://redskyg.com':'https://redskyg.com/crm/establecer-acceso',
  }
  const listaValida=Array.isArray(origins)&&origins.length>0&&new Set(origins).size===origins.length&&
    origins.every(origin=>typeof origin==='string'&&Object.hasOwn(destinos,origin))
  if(!listaValida)fallidas.push('LISTA_ORIGENES')
  if(inviteRedirectLocal!==destinos['http://localhost:5173'])fallidas.push('URL_INVITACION_LOCAL')
  if(inviteRedirectProduction!==destinos['https://redskyg.com'])fallidas.push('URL_INVITACION_PRODUCTION')
  return {fallidas,origins:listaValida?Object.freeze([...origins]):[],destinos}
}
export function configurarOrigenesAdmin(opciones){
  const revision=revisarOrigenesAdmin(opciones)
  if(revision.fallidas.length)throw Error('Configuración de orígenes o invitaciones inválida.')
  const {origins,destinos}=revision
  const redirects=Object.freeze(Object.fromEntries(origins.map(origin=>[origin,destinos[origin]])))
  return Object.freeze({origins,redirects})
}
