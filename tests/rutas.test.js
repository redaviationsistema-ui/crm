import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
const acceso={status:'ok',perfil:{rol:'administrador'}}
globalThis.__authRutasTest={validarAccesoCrm:async()=>({...acceso}),cerrarSesion:async()=>{},iniciarAuthListener:()=>{}}
let codigo=fs.readFileSync('src/router/index.js','utf8')
codigo=codigo.replace("import { cerrarSesion, iniciarAuthListener, validarAccesoCrm } from '@/composables/useAuthSession'",'const {cerrarSesion,iniciarAuthListener,validarAccesoCrm}=globalThis.__authRutasTest')
codigo=codigo.replace(/import (CrmShellView|LoginView|EstablecerAccesoView) from [^\n]+/g,(_,nombre)=>`const ${nombre} = {render:()=>null}`)
codigo=codigo.replaceAll('createWebHistory','createMemoryHistory').replace('import.meta.env.BASE_URL',JSON.stringify('/crm/'))
codigo=codigo.replace("from 'vue-router'",`from ${JSON.stringify(import.meta.resolve('vue-router'))}`)
const {router}=await import(`data:text/javascript;base64,${Buffer.from(codigo).toString('base64')}`)
test('rutas existentes y oportunidades resuelven con sus guardas',async()=>{
  for(const ruta of ['/','/contactos','/llamadas','/seguimientos','/historial','/reportes','/equipo','/admin/usuarios','/admin/usuarios/nuevo','/admin/usuarios/editar/usuario','/admin/usuarios/estado/usuario','/admin/usuarios/eliminar/usuario','/admin/usuarios/historial','/admin/usuarios/diagnostico','/admin/usuarios/recargar','/configuracion','/oportunidades','/cotizaciones']){
    await router.push(ruta)
    assert.equal(router.currentRoute.value.path,ruta)
    assert.equal(router.currentRoute.value.meta.requiresAuth,true)
  }
  await router.push('/usuarios');assert.equal(router.currentRoute.value.path,'/usuarios')
  await router.push('/prospectos');assert.equal(router.currentRoute.value.path,'/contactos')
  acceso.perfil.rol='ejecutivo'
  await router.push('/usuarios');assert.equal(router.currentRoute.value.path,'/')
  await router.push('/admin/usuarios');assert.equal(router.currentRoute.value.path,'/')
  for(const ruta of ['/admin/usuarios/nuevo','/admin/usuarios/editar/usuario','/admin/usuarios/estado/usuario','/admin/usuarios/eliminar/usuario','/admin/usuarios/historial','/admin/usuarios/diagnostico','/admin/usuarios/recargar']){await router.push(ruta);assert.equal(router.currentRoute.value.path,'/')}
  await router.push('/reportes');assert.equal(router.currentRoute.value.path,'/')
  await router.push('/oportunidades');assert.equal(router.currentRoute.value.path,'/oportunidades')
  await router.push('/cotizaciones');assert.equal(router.currentRoute.value.path,'/cotizaciones')
  acceso.status='no-session'
  await router.push('/contactos');assert.equal(router.currentRoute.value.path,'/login')
})
