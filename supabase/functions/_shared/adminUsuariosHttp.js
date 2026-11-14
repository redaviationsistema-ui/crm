export function crearAdminUsuariosHttp({handler,webConfig,configured,diagnosticar,diagnosticOrigins=/** @type {readonly string[]} */ ([])}){
  return async request=>{
    const origin=request.headers.get('Origin')
    const baseHeaders={'Vary':'Origin','Cache-Control':'no-store'}
    const allowedOrigins=webConfig?.origins||diagnosticOrigins
    const generic='Configuración administrativa incompleta o inconsistente. Revisa los secretos del mismo proyecto.'
    if(!allowedOrigins.length)return Response.json({error:generic},{status:503,headers:baseHeaders})
    // Origin es una condición adicional de acceso, no una identidad autenticada.
    // Tampoco se selecciona producción por defecto cuando el encabezado falta.
    if(!origin||!allowedOrigins.includes(origin))return new Response('Origen no permitido.',{status:403,headers:baseHeaders})
    const headers={...baseHeaders,'Access-Control-Allow-Origin':origin,'Access-Control-Allow-Headers':'authorization, apikey, content-type, x-client-info','Access-Control-Allow-Methods':'POST, OPTIONS'}
    if(request.method==='OPTIONS')return new Response(null,{status:204,headers})
    if(request.method==='POST'&&diagnosticar){
      const body=await request.clone().json().catch(()=>null)
      if(body?.operacion==='diagnosticar_configuracion'){
        const response=await diagnosticar(request)
        const diagnosticHeaders=new Headers(response.headers)
        for(const [k,v] of Object.entries(headers))diagnosticHeaders.set(k,v)
        return new Response(response.body,{status:response.status,headers:diagnosticHeaders})
      }
    }
    if(!configured||!webConfig)return Response.json({error:generic},{status:503,headers})
    let response
    try{
      // Contexto interno por petición: no mutar un executor global compartido.
      response=await handler(request,Object.freeze({redirectTo:webConfig.redirects[origin]}))
    }catch{return Response.json({error:'No se pudo completar la operación administrativa.'},{status:500,headers})}
    const resultHeaders=new Headers(response.headers)
    for(const [k,v] of Object.entries(headers))resultHeaders.set(k,v)
    return new Response(response.body,{status:response.status,headers:resultHeaders})
  }
}
