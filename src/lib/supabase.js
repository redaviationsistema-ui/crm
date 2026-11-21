import { createClient } from '@supabase/supabase-js'
import { crearFetchConBloqueoEscriturasStaging } from '@/lib/stagingWriteProtection'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabasePublicKey =
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY
const modoAplicacion = import.meta.env.MODE

const proyectosPorModo = {
  development: 'hhlicjgpwcesytziacvc',
  production: 'hhlicjgpwcesytziacvc',
  staging: 'cpwknzvrikuapsrsybka',
}

if (!supabaseUrl) {
  throw new Error('Falta VITE_SUPABASE_URL')
}

if (!supabasePublicKey) {
  throw new Error('Falta VITE_SUPABASE_PUBLISHABLE_KEY o VITE_SUPABASE_ANON_KEY')
}

if (supabasePublicKey.startsWith('sb_secret_')) {
  throw new Error('No se permiten claves privilegiadas de Supabase en Vue')
}

const proyectoEsperado = proyectosPorModo[modoAplicacion]
let proyectoConfigurado = ''

try {
  proyectoConfigurado = new URL(supabaseUrl).hostname.split('.')[0]
} catch {
  throw new Error('VITE_SUPABASE_URL no es una URL válida')
}

if (!proyectoEsperado || proyectoConfigurado !== proyectoEsperado) {
  throw new Error(`La URL de Supabase no corresponde al modo seleccionado (${modoAplicacion}).`)
}

export const supabase = createClient(supabaseUrl, supabasePublicKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
  global: {
    fetch: crearFetchConBloqueoEscriturasStaging(globalThis.fetch),
  },
})
