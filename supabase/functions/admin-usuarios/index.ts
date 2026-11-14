import { createClient } from 'npm:@supabase/supabase-js@2.112.4'
import postgres from 'npm:postgres@3.4.7'
import { crearAdminUsuariosHandler } from '../_shared/adminUsuarios.js'
import { crearAdminUsuariosExecutor } from '../_shared/adminUsuariosExecutor.js'
import { crearAdminUsuariosPostgres } from '../_shared/adminUsuariosPostgres.js'
import { crearAdminUsuariosHttp } from '../_shared/adminUsuariosHttp.js'
import { configurarOrigenesAdmin, revisarOrigenesAdmin } from '../_shared/adminUsuariosOrigins.js'
import { habilitarPasswordWritesAdmin } from '../_shared/adminUsuariosPasswordPolicy.js'

import { evaluarConfiguracionAdmin, crearDiagnosticoConfiguracionAdmin } from '../_shared/adminUsuariosConfig.js'

const env=(name:string)=>Deno.env.get(name)||''
const url=env('SUPABASE_URL'),anon=env('SUPABASE_ANON_KEY'),service=env('SUPABASE_SERVICE_ROLE_KEY')
const dbUrl=env('CRM_ADMIN_DATABASE_URL')
const projectRef=env('CRM_ADMIN_PROJECT_REF')
const opcionesWeb={allowedOrigins:env('CRM_ADMIN_ALLOWED_ORIGINS'),inviteRedirectLocal:env('CRM_ADMIN_INVITE_REDIRECT_LOCAL'),inviteRedirectProduction:env('CRM_ADMIN_INVITE_REDIRECT_PRODUCTION')}
const revisionWeb=revisarOrigenesAdmin(opcionesWeb)
let webConfig: ReturnType<typeof configurarOrigenesAdmin> | undefined
if(!revisionWeb.fallidas.length)webConfig=configurarOrigenesAdmin(opcionesWeb)
// Diagnóstico estático equivalente a las guardas previas; no prueba conexiones.
const revision=evaluarConfiguracionAdmin({url,dbUrl,projectRef,anon,service,fallasWeb:revisionWeb.fallidas})
function configuracionValida(){return revision.valida}
// Solo logs privados de Edge/Dashboard, nunca valores ni excepciones originales.
if(revision.fallidas.length)console.error(JSON.stringify({comprobaciones_fallidas:revision.fallidas}))
const configured=configuracionValida()
const enabled=configured&&env('CRM_ADMIN_USERS_ENABLED')==='true'
const writesEnabled=enabled&&env('CRM_ADMIN_USERS_STAGING_VALIDATED')==='true'&&env('CRM_ADMIN_DB_CONTRACT_VERIFIED')==='true'
const sql=configured?postgres(dbUrl,{prepare:false,max:1,ssl:'require',connect_timeout:10,idle_timeout:20}):null
const db=sql?crearAdminUsuariosPostgres({sql,deletionReviewed:env('CRM_ADMIN_DELETE_DEPENDENCIES_VERIFIED')==='true'}):null
const opts={auth:{persistSession:false,autoRefreshToken:false}}
const auth=configured?createClient(url,anon,opts):null
const admin=configured?createClient(url,service,opts):null
const ejecutar=crearAdminUsuariosExecutor({authAdmin:admin?.auth.admin,ejecutarDb:db?.ejecutarDb,eliminarConAuth:db?.eliminarConAuth})
const passwordWritesEnabled=habilitarPasswordWritesAdmin({
  projectRef,writesEnabled,passwordWritesValidated:env('CRM_ADMIN_PASSWORD_WRITES_VALIDATED')==='true',
  productionAuthorized:env('CRM_ADMIN_PASSWORD_PRODUCTION_AUTHORIZED')==='true',
})
const handler=crearAdminUsuariosHandler({enabled,writesEnabled,passwordWritesEnabled,
  authenticate:async(token:string)=>{if(!auth)return null;const {data,error}=await auth.auth.getUser(token);return error?null:data.user},
  cargarPerfil:db?.perfilPorId,contarAdminsActivos:db?.contarAdminsActivos,ejecutar})
// Independiente del pool PostgreSQL para diagnosticarlo incluso si falta su URL.
// Auth y RLS verifican el perfil real con el JWT del solicitante, sin usar Auth Admin.
let authDiagnostico: ReturnType<typeof createClient> | undefined
try{if(url&&anon)authDiagnostico=createClient(url,anon,opts)}catch{/*No exponer URL/clave ni excepciones.*/}
const diagnosticar=crearDiagnosticoConfiguracionAdmin({fallidas:revision.fallidas,autenticarAdmin:async(token:string)=>{
  if(!authDiagnostico)return 503
  const identity=await authDiagnostico.auth.getUser(token)
  if(identity.error||!identity.data.user)return 401
  const caller=createClient(url,anon,{...opts,global:{headers:{Authorization:`Bearer ${token}`}}})
  const {data,error}=await caller.from('perfiles').select('id,rol,activo').eq('id',identity.data.user.id).maybeSingle()
  if(error)return 503
  return data?.id===identity.data.user.id&&data?.rol==='administrador'&&data?.activo===true?200:403
}})
Deno.serve(crearAdminUsuariosHttp({handler,webConfig,configured,diagnosticar,diagnosticOrigins:revisionWeb.origins}))
