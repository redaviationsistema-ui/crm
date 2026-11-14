export {validarPasswordAdministrativa} from '../../supabase/functions/_shared/passwordPolicy.js'
export function generarPasswordSegura(cryptoApi=globalThis.crypto){
  if(!cryptoApi?.getRandomValues)throw Error('No está disponible la generación segura de contraseñas.')
  const grupos=['ABCDEFGHJKLMNPQRSTUVWXYZ','abcdefghijkmnopqrstuvwxyz','23456789','!@#$%&*+-=?']
  const entero=max=>{
    const limite=0x100000000-(0x100000000%max),valor=new Uint32Array(1)
    do{cryptoApi.getRandomValues(valor)}while(valor[0]>=limite)
    return valor[0]%max
  }
  const longitud=16+entero(5),todos=grupos.join('')
  const caracteres=grupos.map(grupo=>grupo[entero(grupo.length)])
  while(caracteres.length<longitud)caracteres.push(todos[entero(todos.length)])
  for(let i=caracteres.length-1;i>0;i--){const j=entero(i+1);[caracteres[i],caracteres[j]]=[caracteres[j],caracteres[i]]}
  return caracteres.join('')
}
