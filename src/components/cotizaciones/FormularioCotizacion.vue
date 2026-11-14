<script setup>
import {computed,reactive,ref,watch} from 'vue'
import {calcularCotizacion,validarCotizacion,MONEDAS_COTIZACION,TRANSICIONES_COTIZACION} from '@/domain/cotizaciones'
const props=defineProps({inicial:{type:Object,required:true},oportunidades:{type:Array,default:()=>[]},guardando:Boolean,error:{type:String,default:''},modoDemostracion:Boolean,modoPersistido:Boolean,bloqueadoPorConfirmacion:Boolean})
const emit=defineEmits(['guardar','previsualizar','cancelar'])
const modelo=reactive({...props.inicial,conceptos:props.inicial.conceptos.map(c=>({...c}))})
const errores=ref({})
const totales=computed(()=>{try{return calcularCotizacion(modelo.conceptos)}catch{return null}})
const estados=computed(()=>props.modoPersistido?['borrador']:props.inicial.id?TRANSICIONES_COTIZACION[props.inicial.estado]:['borrador','preparada'])
const oportunidadSeleccionada=computed(()=>props.oportunidades.find(o=>o.id===modelo.oportunidadId))
watch(()=>modelo.oportunidadId,id=>{
  const o=props.oportunidades.find(o=>o.id===id)
  modelo.prospectoId=o?.clienteId || ''
  if(o&&MONEDAS_COTIZACION.includes(o.moneda))modelo.moneda=o.moneda
})
function enviar(evento){
  if(props.guardando)return
  errores.value=validarCotizacion(modelo)
  if(!Object.keys(errores.value).length)emit(evento,{...modelo,conceptos:modelo.conceptos.map(c=>({...c}))})
}
</script>
<template>
  <form @submit.prevent="enviar('guardar')" class="formulario-cotizacion">
    <fieldset :disabled="guardando"><legend>{{ inicial.id ? 'Editar cotización' : 'Nueva cotización' }}{{ modoDemostracion ? ' de demostración' : '' }}</legend>
      <p v-if="error" role="alert">{{ error }}</p><ul v-if="Object.keys(errores).length" role="alert"><li v-for="(mensaje,campo) in errores" :key="campo">{{ mensaje }}</li></ul>
      <div class="campos">
        <label>Título <input v-model="modelo.titulo" required maxlength="200" /></label>
        <label>Oportunidad{{ modoDemostracion ? ' de demostración' : '' }} <select v-model="modelo.oportunidadId" required><option value="">Seleccionar</option><option v-for="o in oportunidades" :key="o.id" :value="o.id">{{ o.titulo || o.id }} · {{ o.clienteNombre }}</option></select></label>
        <label v-if="modoPersistido">Prospecto relacionado <input :value="oportunidadSeleccionada?.clienteNombre || ''" disabled /></label>
        <label>Moneda <select v-model="modelo.moneda"><option v-for="m in MONEDAS_COTIZACION" :key="m">{{ m }}</option></select></label>
        <label>Estado <select v-model="modelo.estado" :disabled="modoPersistido"><option v-for="e in estados" :key="e">{{ e }}</option></select></label>
        <label v-if="!modoPersistido">Fecha <input v-model="modelo.fecha" type="date" required /></label>
        <div v-else class="campo-servidor"><span>Fecha de emisión</span><p>{{ inicial.id ? modelo.fecha : 'La asignará Supabase al guardar' }}</p></div>
        <label>Válida hasta <input v-model="modelo.validaHasta" type="date" :min="modelo.fecha" /></label>
      </div>
      <label v-if="modoPersistido">Descripción <textarea v-model="modelo.descripcion" maxlength="4000" /></label>
      <p>Todos los precios usan {{ modelo.moneda }}. Cambiar moneda no convierte los importes.</p>
      <section v-for="(concepto,i) in modelo.conceptos" :key="i" class="partida">
        <h3>Concepto {{ i+1 }}</h3>
        <label>Descripción <input v-model="concepto.descripcion" required maxlength="1000" /></label>
        <label>Cantidad <input v-model="concepto.cantidad" inputmode="decimal" required /></label>
        <label>Precio unitario <input v-model="concepto.precioUnitario" inputmode="decimal" required /></label>
        <p>Importe: {{ totales?.conceptos[i]?.importe || '—' }} {{ modelo.moneda }}</p>
        <button type="button" :disabled="modelo.conceptos.length===1" @click="modelo.conceptos.splice(i,1)">Quitar concepto</button>
      </section>
      <button type="button" :disabled="modelo.conceptos.length>=100" @click="modelo.conceptos.push({descripcion:'',cantidad:'1',precioUnitario:''})">Agregar concepto</button>
      <p>Subtotal: {{ totales?.subtotal || '—' }} {{ modelo.moneda }} · <strong>Total: {{ totales?.total || '—' }} {{ modelo.moneda }}</strong></p>
      <label v-if="!modoPersistido">Notas <textarea v-model="modelo.notas" maxlength="4000" /></label>
      <p v-if="modoPersistido" role="note">La RPC solo permite guardar borradores. El estado se asigna en el servidor; enviar o cerrar cotizaciones requiere una operación backend independiente.</p>
      <p v-if="bloqueadoPorConfirmacion" role="alert">No reenvíes esta cotización. Recarga la lista y verifica manualmente si Supabase la guardó; las escrituras seguirán bloqueadas en esta sesión.</p>
      <div class="acciones"><button type="button" @click="emit('cancelar')">Cancelar</button><button type="button" @click="enviar('previsualizar')">Vista previa</button><button type="submit" :disabled="bloqueadoPorConfirmacion">{{ guardando ? 'Guardando…' : `Guardar cotización${modoDemostracion ? ' de demostración' : ''}` }}</button></div>
    </fieldset>
  </form>
</template>
<style scoped>
.formulario-cotizacion{padding:1.2rem;border:1px solid #c7d6e9;border-radius:14px;background:white}fieldset{border:0;padding:0;min-width:0}legend{font-weight:700;margin-bottom:1rem}.campos{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:1rem}label,.campo-servidor{display:grid;gap:.4rem}.campo-servidor p{margin:0;padding:.65rem;border:1px solid #e0e7f0;border-radius:8px;background:#f7f9fc}input,select,textarea{padding:.65rem;border:1px solid #bacbe0;border-radius:8px;box-sizing:border-box;width:100%}.partida{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:.8rem;padding:1rem 0;border-bottom:1px solid #d9e3f1}.partida h3{grid-column:1/-1;margin:0}.acciones{display:flex;flex-wrap:wrap;gap:.7rem;margin-top:1rem}button{padding:.7rem;border:1px solid #acc1dd;border-radius:8px;cursor:pointer}[role=alert]{color:#a42121}
</style>
