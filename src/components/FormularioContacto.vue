<script setup>
import { nextTick, reactive, ref, watch } from 'vue'
import { normalizarCorreo, normalizarTelefono } from '@/lib/crm'

const props = defineProps({
  contacto: { type: Object, default: null },
  guardando: Boolean,
  error: { type: String, default: '' },
  abierto: {
    type: Boolean,
    default: false,
  },
  usuarios: {
    type: Array,
    default: () => [],
  },
  prospectos: {
    type: Array,
    default: () => [],
  },
})

const emit = defineEmits(['cerrar', 'guardar', 'ver-contacto'])

const formulario = reactive({
  nombre: '',
  apellidos: '',
  empresa: '',
  cargo: '',
  telefono: '',
  whatsapp: '',
  correo: '',
  tipoMercado: 'nacional',
  pais: 'México',
  estado: '',
  ciudad: '',
  fabricanteInteres: '',
  modeloInteres: '',
  presupuesto: '',
  moneda: 'USD',
  prioridad: 'media',
  usuarioResponsableId: '',
  notas: '',
})

const usarTelefonoComoWhatsapp = ref(true)
const mostrarModalDuplicado = ref(false)
const duplicadoEncontrado = ref(null)
const errorFormulario = ref('')
let hidratando = false
function cerrar() { if (!props.guardando) emit('cerrar') }

watch(
  () => props.abierto,
  async (abierto) => {
    if (!abierto) return
    hidratando = true
    limpiar()
    const contacto = props.contacto
    if (contacto) {
      for (const campo of Object.keys(formulario)) {
        if (Object.hasOwn(contacto, campo)) formulario[campo] = contacto[campo] ?? ''
      }
      formulario.nombre = contacto.nombres || contacto.nombre || ''
      formulario.tipoMercado = contacto.mercado || 'nacional'
      formulario.usuarioResponsableId = contacto.responsableId || ''
      usarTelefonoComoWhatsapp.value = contacto.whatsapp === contacto.telefono
    }
    await nextTick()
    hidratando = false
  },
)

watch(
  () => usarTelefonoComoWhatsapp.value,
  (activo) => {
    if (hidratando) return
    if (activo) {
      formulario.whatsapp = formulario.telefono
    }
  },
)

watch(
  () => formulario.telefono,
  (telefono) => {
    if (hidratando) return
    if (usarTelefonoComoWhatsapp.value) {
      formulario.whatsapp = telefono
    }
  },
)

watch(
  () => formulario.tipoMercado,
  (mercadoActual) => {
    if (hidratando) return
    if (mercadoActual === 'nacional' && !formulario.pais.trim()) {
      formulario.pais = 'México'
    }
  },
)

function limpiar() {
  formulario.nombre = ''
  formulario.apellidos = ''
  formulario.empresa = ''
  formulario.cargo = ''
  formulario.telefono = ''
  formulario.whatsapp = ''
  formulario.correo = ''
  formulario.tipoMercado = 'nacional'
  formulario.pais = 'México'
  formulario.estado = ''
  formulario.ciudad = ''
  formulario.fabricanteInteres = ''
  formulario.modeloInteres = ''
  formulario.presupuesto = ''
  formulario.moneda = 'USD'
  formulario.prioridad = 'media'
  formulario.usuarioResponsableId = ''
  formulario.notas = ''
  usarTelefonoComoWhatsapp.value = true
  mostrarModalDuplicado.value = false
  duplicadoEncontrado.value = null
  errorFormulario.value = ''
}

function obtenerPayload() {
  return {
    nombre: formulario.nombre.trim(),
    apellidos: formulario.apellidos.trim(),
    empresa: formulario.empresa.trim(),
    cargo: formulario.cargo.trim(),
    telefono: formulario.telefono,
    whatsapp: usarTelefonoComoWhatsapp.value ? formulario.telefono : formulario.whatsapp,
    correo: formulario.correo.trim(),
    tipoMercado: formulario.tipoMercado,
    pais: formulario.pais,
    estado: formulario.estado,
    ciudad: formulario.ciudad,
    fabricanteInteres: formulario.fabricanteInteres.trim(),
    modeloInteres: formulario.modeloInteres.trim(),
    presupuesto: formulario.presupuesto,
    moneda: formulario.moneda,
    prioridad: formulario.prioridad,
    usuarioResponsableId: formulario.usuarioResponsableId,
    notas: formulario.notas.trim(),
  }
}

function validarFormulario() {
  const payload = obtenerPayload()

  if (!payload.nombre) {
    return 'El nombre es obligatorio.'
  }

  if (!normalizarTelefono(payload.telefono)) {
    return 'El teléfono es obligatorio.'
  }

  if (!payload.tipoMercado) {
    return 'Selecciona el mercado del contacto.'
  }

  if (!payload.pais) {
    return 'Selecciona un país.'
  }

  if (payload.correo && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(payload.correo)) return 'Escribe un correo válido.'

  if (payload.presupuesto !== '' && (!Number.isFinite(Number(payload.presupuesto)) || Number(payload.presupuesto) < 0)) {
    return 'Escribe un presupuesto válido, igual o mayor que cero.'
  }

  return ''
}

function buscarDuplicado() {
  const payload = obtenerPayload()
  const correo = normalizarCorreo(payload.correo)
  const telefono = normalizarTelefono(payload.telefono)
  const whatsapp = normalizarTelefono(payload.whatsapp)

  if (!correo && !telefono && !whatsapp) {
    return null
  }

  return (
    props.prospectos.find((prospecto) => {
      if (prospecto.id === props.contacto?.id) return false
      const correoExistente = normalizarCorreo(prospecto.correo)
      const telefonoExistente = normalizarTelefono(prospecto.telefono)
      const whatsappExistente = normalizarTelefono(prospecto.whatsapp)

      return (
        (correo && correoExistente && correo === correoExistente) ||
        (telefono && telefonoExistente && telefono === telefonoExistente) ||
        (whatsapp && whatsappExistente && whatsapp === whatsappExistente)
      )
    }) || null
  )
}

function guardar(forzar = false) {
  if (props.guardando) return
  errorFormulario.value = validarFormulario()

  if (errorFormulario.value) {
    return
  }

  const duplicado = buscarDuplicado()

  if (duplicado && !forzar) {
    duplicadoEncontrado.value = duplicado
    mostrarModalDuplicado.value = true
    return
  }

  mostrarModalDuplicado.value = false
  duplicadoEncontrado.value = null
  emit('guardar', obtenerPayload())
}
</script>

<template>
  <div v-if="abierto" class="overlay" @click.self="cerrar">
    <section class="modal-formulario" role="dialog" aria-modal="true" aria-labelledby="titulo-formulario-contacto">
      <header class="encabezado">
        <div>
          <p>{{ contacto ? 'Editar contacto' : 'Nuevo contacto' }}</p>
          <strong id="titulo-formulario-contacto">{{ contacto ? 'Actualizar contacto' : 'Registrar contacto' }}</strong>
        </div>
        <button type="button" aria-label="Cerrar formulario" @click="cerrar" :disabled="guardando">✕</button>
      </header>

      <p v-if="errorFormulario || error" class="feedback error" role="alert">{{ errorFormulario || error }}</p>

      <fieldset class="formulario" :disabled="guardando" style="border: 0; margin: 0; min-width: 0">
        <section class="bloque-formulario">
          <div class="bloque-titulo">
            <p>Información del contacto</p>
          </div>

          <div class="bloque-grid bloque-grid-contacto">
            <label>
              <span>Nombre *</span>
              <input v-model="formulario.nombre" type="text" />
            </label>

            <label>
              <span>Apellidos</span>
              <input v-model="formulario.apellidos" type="text" />
            </label>

            <label>
              <span>Empresa</span>
              <input v-model="formulario.empresa" type="text" />
            </label>

            <label>
              <span>Cargo</span>
              <input v-model="formulario.cargo" type="text" />
            </label>

            <label>
              <span>Teléfono *</span>
              <input v-model="formulario.telefono" type="tel" inputmode="tel" />
              <small class="check-ayuda">
                <input v-model="usarTelefonoComoWhatsapp" type="checkbox" />
                WhatsApp es el mismo número
              </small>
            </label>

            <label>
              <span>WhatsApp</span>
              <input
                v-model="formulario.whatsapp"
                type="tel"
                inputmode="tel"
                :disabled="usarTelefonoComoWhatsapp"
                :placeholder="
                  usarTelefonoComoWhatsapp
                    ? 'Se usará el mismo número del teléfono'
                    : 'Ingresa un WhatsApp diferente'
                "
              />
            </label>

            <label class="campo-correo">
              <span>Correo electrónico</span>
              <input v-model="formulario.correo" type="email" />
            </label>
          </div>
        </section>

        <section class="bloque-formulario">
          <div class="bloque-titulo">
            <p>Ubicación</p>
          </div>

          <div class="bloque-grid bloque-grid-ubicacion">
            <label>
              <span>Mercado *</span>
              <select v-model="formulario.tipoMercado">
                <option value="nacional">Nacional</option>
                <option value="internacional">Internacional</option>
              </select>
            </label>

            <label>
              <span>País</span>
              <input v-model="formulario.pais" type="text" autocomplete="country-name" />
            </label>

            <label>
              <span>Estado</span>
              <input v-model="formulario.estado" type="text" autocomplete="address-level1" />
            </label>

            <label>
              <span>Ciudad</span>
              <input v-model="formulario.ciudad" type="text" autocomplete="address-level2" />
            </label>
          </div>
        </section>

        <section class="bloque-formulario">
          <div class="bloque-titulo">
            <p>Interés comercial</p>
          </div>

          <div class="bloque-grid bloque-grid-interes">
            <label class="campo-interes campo-fabricante">
              <span>Fabricante de interés</span>
              <input v-model="formulario.fabricanteInteres" type="text" />
            </label>

            <label class="campo-interes">
              <span>Modelo de interés</span>
              <input v-model="formulario.modeloInteres" type="text" />
            </label>

            <label class="campo-presupuesto">
              <span>Presupuesto</span>
              <input v-model="formulario.presupuesto" type="number" min="0" step="1" />
            </label>

            <label class="campo-moneda">
              <span>Moneda</span>
              <select v-model="formulario.moneda">
                <option value="USD">USD</option>
                <option value="MXN">MXN</option>
              </select>
            </label>

            <label class="campo-prioridad">
              <span>Prioridad</span>
              <select v-model="formulario.prioridad">
                <option value="baja">Baja</option>
                <option value="media">Media</option>
                <option value="alta">Alta</option>
                <option value="urgente">Urgente</option>
              </select>
            </label>

            <label class="campo-responsable">
              <span>Responsable</span>
              <select v-model="formulario.usuarioResponsableId">
                <option value="">Selecciona un usuario</option>
                <option v-for="usuario in usuarios" :key="usuario.id" :value="usuario.id">
                  {{ usuario.nombreCompleto || usuario.nombre }}
                </option>
              </select>
            </label>
          </div>
        </section>

        <section class="bloque-formulario">
          <div class="bloque-titulo">
            <p>Notas</p>
          </div>

          <label class="campo-completo">
            <textarea v-model="formulario.notas" rows="3" />
          </label>
        </section>
      </fieldset>

      <footer class="acciones">
        <button type="button" class="ghost" @click="cerrar" :disabled="guardando">Cancelar</button>
        <button type="button" class="primario" :disabled="guardando" @click="guardar()">{{ guardando ? 'Guardando…' : (contacto ? 'Guardar contacto' : 'Registrar contacto') }}</button>
      </footer>
    </section>

    <div v-if="mostrarModalDuplicado && duplicadoEncontrado" class="modal-duplicado">
      <article class="dialogo-duplicado">
        <div>
          <p>Posible contacto duplicado</p>
          <strong>Ya existe un contacto registrado con el mismo correo, teléfono o WhatsApp.</strong>
        </div>

        <div class="detalle-duplicado">
          <div>
            <span>Nombre</span>
            <strong>{{ duplicadoEncontrado.nombre || 'Sin definir' }}</strong>
          </div>
          <div>
            <span>Empresa</span>
            <strong>{{ duplicadoEncontrado.empresa || 'Particular' }}</strong>
          </div>
          <div>
            <span>Teléfono</span>
            <strong>{{ duplicadoEncontrado.telefono || 'Sin definir' }}</strong>
          </div>
          <div>
            <span>Correo</span>
            <strong>{{ duplicadoEncontrado.correo || 'Sin definir' }}</strong>
          </div>
          <div>
            <span>Responsable</span>
            <strong>{{ duplicadoEncontrado.responsableNombre || 'Sin asignar' }}</strong>
          </div>
        </div>

        <div class="acciones acciones-modal">
          <button class="ghost" @click="mostrarModalDuplicado = false">Cancelar</button>
          <button class="ghost destacado" @click="$emit('ver-contacto', duplicadoEncontrado.id)">
            Ver contacto existente
          </button>
          <button class="primario" @click="guardar(true)" :disabled="guardando">Guardar de todos modos</button>
        </div>
      </article>
    </div>
  </div>
</template>

<style scoped>
.overlay {
  position: fixed;
  inset: 0;
  background: rgba(7, 23, 47, 0.56);
  z-index: 40;
  display: grid;
  place-items: center;
  padding: 1rem;
  box-sizing: border-box;
}

.modal-formulario {
  width: min(100%, 1280px);
  max-height: calc(100dvh - 2rem);
  background: #fff;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  border: 1px solid #dce6f3;
  border-radius: 16px;
  box-shadow: 0 24px 64px rgba(7, 23, 47, 0.28);
}

.encabezado {
  display: flex;
  justify-content: space-between;
  gap: 1rem;
  align-items: center;
  flex: 0 0 auto;
  padding: 0.75rem 1rem;
  border-bottom: 1px solid #e5ebf4;
  background: #fff;
}

.encabezado p,
.bloque-titulo p,
.formulario span,
.detalle-duplicado span {
  margin: 0;
  color: #62728e;
  font-weight: 700;
}

.encabezado p,
.bloque-titulo p {
  font-size: 0.78rem;
  letter-spacing: 0.01em;
}

.formulario label > span {
  font-size: 0.78rem;
}

.encabezado strong {
  color: #07172f;
  display: block;
  margin-top: 0.1rem;
  font-size: 1.05rem;
}

.encabezado button {
  border: 0;
  background: #eef4ff;
  color: #18365e;
  width: 2.25rem;
  height: 2.25rem;
  border-radius: 10px;
  cursor: pointer;
}

.feedback.error {
  flex: 0 0 auto;
  margin: 0.55rem 1rem 0;
  padding: 0.55rem 0.75rem;
  border-radius: 10px;
  background: #fff0f1;
  color: #b23d44;
}

.formulario {
  display: grid;
  align-content: start;
  flex: 1 1 auto;
  gap: 0;
  min-height: 0;
  overflow-y: auto;
  overflow-x: hidden;
  padding: 0.2rem 1rem 0.65rem;
  scrollbar-gutter: stable;
}

.bloque-formulario {
  border: 0;
  border-bottom: 1px solid #e4ebf7;
  border-radius: 0;
  padding: 0.7rem 0;
  display: grid;
  gap: 0.45rem;
}

.bloque-formulario:first-child { padding-top: 0.65rem; }
.bloque-formulario:last-child { border-bottom: 0; padding-bottom: 0; }

.bloque-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.55rem 0.7rem;
}

.formulario label {
  display: grid;
  gap: 0.22rem;
}

.campo-completo {
  grid-column: 1 / -1;
}

.formulario input,
.formulario select,
.formulario textarea {
  box-sizing: border-box;
  width: 100%;
  min-height: 2.4rem;
  border: 1px solid #dbe5f4;
  border-radius: 10px;
  padding: 0.42rem 0.65rem;
  color: #132f54;
  font: inherit;
}

.formulario textarea {
  min-height: 3.75rem;
  resize: vertical;
}

.check-ayuda {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  color: #5f718f;
  font-size: 0.76rem;
}

.check-ayuda input {
  min-height: auto;
}

.bloque-grid-contacto {
  grid-template-columns: repeat(4, minmax(0, 1fr));
}

.campo-correo { grid-column: span 2; }

.bloque-grid-ubicacion {
  grid-template-columns: repeat(4, minmax(0, 1fr));
}

.bloque-grid-interes {
  grid-template-columns: repeat(12, minmax(0, 1fr));
}

.campo-interes {
  grid-column: span 6;
}

.campo-presupuesto,
.campo-moneda,
.campo-prioridad {
  grid-column: span 3;
}

.campo-responsable {
  grid-column: span 3;
}

.acciones {
  flex: 0 0 auto;
  display: flex;
  justify-content: flex-end;
  gap: 0.7rem;
  padding: 0.7rem 1rem;
  border-top: 1px solid #e5ebf4;
  background: #fff;
  box-shadow: 0 -8px 18px rgba(25, 55, 91, 0.04);
}

.acciones button {
  flex: 0 1 auto;
  min-width: 8.75rem;
  min-height: 2.4rem;
  border: 0;
  border-radius: 10px;
  font-weight: 700;
  cursor: pointer;
}

.ghost {
  background: #f0f4fa;
  color: #49607f;
}

.ghost.destacado {
  background: #e8f0ff;
  color: #1b58b3;
}

.primario {
  background: #163e70;
  color: #fff;
}

.acciones-modal {
  flex-wrap: wrap;
}

/* El diálogo de duplicados conserva sus acciones ocupando el ancho disponible. */
.dialogo-duplicado .acciones button {
  flex: 1;
}

.campo-presupuesto {
  display: grid;
  gap: 0.3rem;
}

.modal-duplicado {
  position: fixed;
  inset: 0;
  display: grid;
  place-items: center;
  background: rgba(7, 23, 47, 0.3);
  z-index: 45;
  padding: 1rem;
}

.dialogo-duplicado {
  width: min(100%, 560px);
  background: #fff;
  border-radius: 24px;
  border: 1px solid #dfe7f5;
  box-shadow: 0 24px 60px rgba(12, 31, 61, 0.12);
  padding: 1.2rem;
  display: grid;
  gap: 1rem;
}

.dialogo-duplicado p {
  margin: 0 0 0.25rem;
  color: #6b7c98;
  font-weight: 700;
}

.dialogo-duplicado strong {
  color: #07172f;
}

.detalle-duplicado {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.8rem;
}

.detalle-duplicado div {
  border: 1px solid #e5ebf6;
  border-radius: 16px;
  padding: 0.8rem 0.9rem;
}

.detalle-duplicado strong {
  display: block;
  margin-top: 0.2rem;
}

@media (max-width: 820px) {
  .bloque-grid-contacto,
  .bloque-grid-ubicacion {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .campo-correo { grid-column: 1 / -1; }

  .bloque-grid-interes {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .campo-interes,
  .campo-presupuesto,
  .campo-moneda,
  .campo-prioridad,
  .campo-responsable {
    grid-column: span 1;
  }
}

@media (max-width: 600px) {
  .overlay { padding: 0; }

  .modal-formulario {
    width: 100%;
    max-height: 100dvh;
    height: 100dvh;
    border: 0;
    border-radius: 0;
  }

  .bloque-grid,
  .detalle-duplicado,
  .bloque-grid-contacto,
  .bloque-grid-interes {
    grid-template-columns: 1fr;
  }

  .campo-interes,
  .campo-correo,
  .campo-presupuesto,
  .campo-moneda,
  .campo-prioridad,
  .campo-responsable {
    grid-column: 1;
  }

  .encabezado,
  .acciones {
    padding-right: 1rem;
    padding-left: 1rem;
  }

  .formulario { padding-right: 1rem; padding-left: 1rem; }
  .bloque-formulario { padding-right: 0; padding-left: 0; }

  .acciones {
    justify-content: stretch;
  }

  .acciones button {
    flex: 1;
    min-width: 0;
  }
}
</style>
