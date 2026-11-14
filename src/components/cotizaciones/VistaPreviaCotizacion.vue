<script setup>
import {computed} from 'vue'
import {calcularCotizacion} from '@/domain/cotizaciones'
const props=defineProps({cotizacion:{type:Object,required:true},guardada:Boolean,generando:Boolean,modoDemostracion:Boolean})
const emit=defineEmits(['descargar'])
const logo=`${import.meta.env?.BASE_URL || '/'}logoo.png`
const calculo=computed(()=>calcularCotizacion(props.cotizacion.conceptos))
</script>
<template>
  <article class="documento" aria-label="Vista previa de cotización">
    <header><img :src="logo" alt="Logotipo Sky Group" /><p class="empresa">Red Sky Group LLC</p><h2>Vista previa de cotización</h2><strong v-if="modoDemostracion">DEMOSTRACIÓN: COPIA LOCAL</strong><p>{{ guardada ? (modoDemostracion ? 'Cotización guardada localmente' : 'Cotización guardada') : 'Vista previa sin guardar' }}</p></header>
    <button v-if="guardada" type="button" :disabled="generando" @click="!generando && emit('descargar',cotizacion)">{{ generando ? 'Generando PDF…' : 'Descargar PDF de esta cotización' }}</button>
    <p v-else>Guarda la cotización para descargar su PDF con folio.</p>
    <h3>{{ cotizacion.titulo }}</h3><p>{{ cotizacion.folio || 'Sin folio asignado' }} · {{ cotizacion.estado }}</p>
    <dl><dt>Cliente</dt><dd>{{ cotizacion.clienteNombre }}</dd><dt>Empresa</dt><dd>{{ cotizacion.empresaNombre || 'Sin empresa' }}</dd><dt>Oportunidad</dt><dd>{{ cotizacion.oportunidadTitulo }}</dd><dt>Fecha</dt><dd>{{ cotizacion.fecha }}</dd><dt>Válida hasta</dt><dd>{{ cotizacion.validaHasta || 'No indicada' }}</dd><template v-if="cotizacion.descripcion"><dt>Descripción</dt><dd>{{ cotizacion.descripcion }}</dd></template></dl>
    <div class="tabla"><table><thead><tr><th>Concepto</th><th>Cantidad</th><th>Precio unitario</th><th>Importe</th></tr></thead><tbody>
      <tr v-for="(concepto,i) in calculo.conceptos" :key="i"><td>{{ concepto.descripcion }}</td><td>{{ concepto.cantidad }}</td><td>{{ concepto.precioUnitario }} {{ cotizacion.moneda }}</td><td>{{ concepto.importe }} {{ cotizacion.moneda }}</td></tr>
    </tbody></table></div>
    <p class="total">Subtotal: {{ calculo.subtotal }} {{ cotizacion.moneda }}</p><p class="total"><strong>Total: {{ calculo.total }} {{ cotizacion.moneda }}</strong></p>
    <p>No se han aplicado impuestos ni conversiones de moneda.</p><p v-if="cotizacion.notas" class="notas">{{ cotizacion.notas }}</p>
  </article>
</template>
<style scoped>
.documento{background:white;border:1px solid #c7d4e5;border-radius:16px;padding:1.5rem;color:#152e50}header{border-bottom:2px solid #193e70;margin-bottom:1rem}header img{width:120px;height:80px;object-fit:contain;float:right}header .empresa{font-weight:700;color:#193e70}button{padding:.7rem;border:1px solid #b2c8e6;border-radius:8px;cursor:pointer}button:disabled{opacity:.5;cursor:wait}header strong{color:#85600c}dl{display:grid;grid-template-columns:140px 1fr;gap:.5rem}dd{margin:0}table{width:100%;border-collapse:collapse}th,td{padding:.8rem;text-align:left;border-bottom:1px solid #dde5ef}.tabla{overflow:auto}.total{text-align:right}.notas{white-space:pre-wrap;overflow-wrap:anywhere}@media(max-width:600px){.documento{padding:1rem}dl{grid-template-columns:1fr}}
</style>
