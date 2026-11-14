import test from 'node:test'
import assert from 'node:assert/strict'
import {configuracionUsuariosAdminPassword,evaluarEscriturasPasswordAdmin} from '../src/config/usuariosAdminPasswordWrites.js'

const ref='hhlicjgpwcesytziacvc'
const admin={id:'admin',rol:'administrador',activo:true}
const sesion={origin:'http://localhost:5173',sesionAutenticada:true,actor:admin}
const local={DEV:true,MODE:'development',VITE_SUPABASE_URL:`https://${ref}.supabase.co`,
  VITE_SUPABASE_ANON_KEY:'sb_publishable_test',VITE_CRM_ADMIN_PASSWORD_LOCAL_ENABLED:'true',
  VITE_CRM_ADMIN_PASSWORD_PRODUCTION_BACKEND_VALIDATED:'true'}
const production={DEV:false,MODE:'production',VITE_SUPABASE_URL:`https://${ref}.supabase.co`,
  VITE_SUPABASE_ANON_KEY:'sb_publishable_test',VITE_CRM_ADMIN_PASSWORD_PRODUCTION_ENABLED:'true',
  VITE_CRM_ADMIN_PASSWORD_PRODUCTION_BACKEND_VALIDATED:'true'}
const stagingRef='abcdefghijklmnopqrst'
const staging={...local,MODE:'staging',VITE_SUPABASE_URL:`https://${stagingRef}.supabase.co`,
  VITE_CRM_ADMIN_PASSWORD_STAGING_PROJECT_REF:stagingRef,VITE_CRM_ADMIN_PASSWORD_STAGING_VALIDATED:'true'}

test('flag ausente/apagado, origen no permitido, sesión ausente o actor no admin bloquean',()=>{
  assert.equal(configuracionUsuariosAdminPassword.origenes.local,'http://localhost:5173')
  assert.equal(configuracionUsuariosAdminPassword.origenes.produccion,'https://redskyg.com')
  assert.equal(evaluarEscriturasPasswordAdmin(local,sesion).habilitado,true)
  for(const [env,contexto] of [
    [{...local,VITE_CRM_ADMIN_PASSWORD_LOCAL_ENABLED:'false'},sesion],
    [local,{...sesion,origin:'http://127.0.0.1:5173'}],
    [local,{...sesion,sesionAutenticada:false}],
    [local,{...sesion,actor:{...admin,rol:'supervisor'}}],
    [local,{...sesion,actor:{...admin,activo:false}}],
  ])assert.equal(evaluarEscriturasPasswordAdmin(env,contexto).habilitado,false)
})
test('local permite el proyecto productivo solo con opt-in local, sesión y validación',()=>{
  assert.equal(evaluarEscriturasPasswordAdmin(local,sesion).habilitado,true)
  for(const candidate of [
    {...local,MODE:'staging'},
    {...local,DEV:false},
    {...local,VITE_CRM_ADMIN_PASSWORD_PRODUCTION_BACKEND_VALIDATED:'false'},
    {...local,VITE_CRM_ADMIN_PASSWORD_LOCAL_ENABLED:'false'},
    {...local,VITE_SUPABASE_URL:'https://hhlicjgpwcesytziacvc.supabase.co.evil.example'},
    {...local,VITE_SUPABASE_ANON_KEY:'sb_secret_not-public'},
  ])assert.equal(evaluarEscriturasPasswordAdmin(candidate,sesion).habilitado,false)
})
test('flag general VITE_CRM_ADMIN_PASSWORD_WRITES_ENABLED no autoriza localhost',()=>{
  const {VITE_CRM_ADMIN_PASSWORD_LOCAL_ENABLED,...sinOptIn}=local
  assert.equal(evaluarEscriturasPasswordAdmin({
    ...sinOptIn,VITE_CRM_ADMIN_PASSWORD_WRITES_ENABLED:'true',
  },sesion).habilitado,false)
})
test('staging local es independiente y exige referencia, modo y validación propios',()=>{
  assert.equal(evaluarEscriturasPasswordAdmin(staging,sesion).habilitado,true)
  for(const candidate of [
    {...staging,MODE:'development'},
    {...staging,VITE_CRM_ADMIN_PASSWORD_STAGING_VALIDATED:'false'},
    {...staging,VITE_CRM_ADMIN_PASSWORD_STAGING_PROJECT_REF:ref},
    {...staging,VITE_SUPABASE_URL:`https://${ref}.supabase.co`},
  ])assert.equal(evaluarEscriturasPasswordAdmin(candidate,sesion).habilitado,false)
})
test('producción exige origen productivo, build production y opt-in separado',()=>{
  const contexto={...sesion,origin:'https://redskyg.com'}
  assert.equal(evaluarEscriturasPasswordAdmin(production,contexto).habilitado,true)
  for(const candidate of [
    {...production,VITE_CRM_ADMIN_PASSWORD_PRODUCTION_ENABLED:'false'},
    {...production,VITE_CRM_ADMIN_PASSWORD_PRODUCTION_BACKEND_VALIDATED:'false'},
    {...production,MODE:'staging'},
    {...production,DEV:true},
  ])assert.equal(evaluarEscriturasPasswordAdmin(candidate,contexto).habilitado,false)
  assert.equal(evaluarEscriturasPasswordAdmin(production,sesion).habilitado,false)
})
