// Empaquetado de fuentes locales: no conecta a Supabase ni despliega.
import {readFile,writeFile,mkdir} from 'node:fs/promises'
const root=new URL('../',import.meta.url)
const modules=[
 ['passwordPolicy.js',['validarPasswordAdministrativa']],
 ['adminUsuariosConfig.js',['evaluarConfiguracionAdmin','crearDiagnosticoConfiguracionAdmin']],
 ['adminUsuariosOrigins.js',['configurarOrigenesAdmin','revisarOrigenesAdmin']],
 ['adminUsuariosHttp.js',['crearAdminUsuariosHttp']],
 ['adminUsuarios.js',['crearAdminUsuariosHandler','crearLimitePassword']],
 ['adminUsuariosExecutor.js',['crearAdminUsuariosExecutor']],
 ['adminUsuariosPostgres.js',['parametrosAdministrarPerfil','crearAdminUsuariosPostgres']],
]
let output='// @ts-nocheck\n// JavaScript generado desde módulos .js; comprobar fuentes con deno check y tests Node.\n// GENERADO. Copiar COMPLETO al editor de admin-usuarios en Supabase Dashboard.\n// Fuentes: supabase/functions. Regenerar: node scripts/prepararAdminUsuariosDashboard.mjs\n'
for(const [file,names] of modules){
 let source=await readFile(new URL(`supabase/functions/_shared/${file}`,root),'utf8')
 source=source.replace(/^import \{validarPasswordAdministrativa\} from '\.\/passwordPolicy\.js'\n/m,'')
 if(/^import /m.test(source))throw Error('Actualizar empaquetador para resolver imports compartidos.')
 output+=`\nconst {${names.join(',')}}=(()=>{\n${source.replace(/^export /gm,'')}\nreturn {${names.join(',')}}\n})();\n`
}
const index=await readFile(new URL('supabase/functions/admin-usuarios/index.ts',root),'utf8')
output+='\n'+index.replace(/^import .* from '\.\.\/_shared\/[^']+'\n/gm,'')
await mkdir(new URL('docs/dashboard/',root),{recursive:true})
await writeFile(new URL('docs/dashboard/admin-usuarios.ts',root),output)
console.log('Preparado docs/dashboard/admin-usuarios.ts; sin conexión ni despliegue.')
