<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { supabase } from '@/lib/supabase'
const router=useRouter()
const password=ref(''),confirmacion=ref(''),error=ref(''),guardando=ref(false)
async function guardar(){
  if(guardando.value)return
  error.value=''
  if(password.value.length<12||password.value!==confirmacion.value){error.value='Usa al menos 12 caracteres y confirma la misma contraseña.';return}
  guardando.value=true
  try{
    const identity=await supabase.auth.getUser()
    if(identity.error||!identity.data.user)throw Error('El enlace no es válido o ya expiró. Solicita una nueva invitación al administrador.')
    const result=await supabase.auth.updateUser({password:password.value})
    if(result.error)throw result.error
    password.value='';confirmacion.value=''
    await router.replace('/')
  }catch(e){error.value=e.message||'No se pudo establecer el acceso.'}
  finally{guardando.value=false}
}
</script>
<template>
  <main class="acceso"><form @submit.prevent="guardar">
    <h1>Establecer acceso al CRM</h1>
    <p>Define tu contraseña para la cuenta que recibió la invitación.</p>
    <p v-if="error" role="alert">{{ error }}</p>
    <label>Contraseña<input v-model="password" type="password" autocomplete="new-password" minlength="12" required :disabled="guardando" /></label>
    <label>Confirmar contraseña<input v-model="confirmacion" type="password" autocomplete="new-password" minlength="12" required :disabled="guardando" /></label>
    <button type="submit" :disabled="guardando">{{ guardando?'Guardando…':'Guardar contraseña' }}</button>
  </form></main>
</template>
<style scoped>
.acceso{min-height:100vh;display:grid;place-items:center;background:#f4f7fa;color:#17304e;padding:1rem}.acceso form{background:white;padding:2rem;border:1px solid #cbd6e2;border-radius:8px;max-width:460px;width:100%;box-sizing:border-box}.acceso label{display:grid;gap:.4rem;margin:1rem 0}.acceso input,.acceso button{padding:.7rem;border:1px solid #b7c6d8;border-radius:5px}.acceso button{background:#173f70;color:white;cursor:pointer}.acceso [role=alert]{color:#9e2f2f}
</style>
