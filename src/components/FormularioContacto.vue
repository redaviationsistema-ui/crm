<script setup>
import { computed, reactive, ref, watch } from 'vue'
import { normalizarCorreo, normalizarTelefono, normalizarTexto } from '@/lib/crm'

const OTRO_VALOR = '__otro__'

const props = defineProps({
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
  fabricanteInteresPersonalizado: '',
  modeloInteres: '',
  modeloInteresPersonalizado: '',
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

const paisesDisponibles = computed(() => {
  const unicos = new Set(['México'])

  props.prospectos.forEach((prospecto) => {
    if (prospecto.pais) {
      unicos.add(prospecto.pais)
    }
  })

  return [...unicos].sort((a, b) => a.localeCompare(b, 'es'))
})

const estadosDisponibles = computed(() => {
  const unicos = new Set()

  props.prospectos.forEach((prospecto) => {
    if (
      prospecto.pais &&
      prospecto.estado &&
      normalizarTexto(prospecto.pais) === normalizarTexto(formulario.pais)
    ) {
      unicos.add(prospecto.estado)
    }
  })

  return [...unicos].sort((a, b) => a.localeCompare(b, 'es'))
})

const ciudadesDisponibles = computed(() => {
  const unicos = new Set()

  props.prospectos.forEach((prospecto) => {
    if (
      prospecto.pais &&
      prospecto.estado &&
      prospecto.ciudad &&
      normalizarTexto(prospecto.pais) === normalizarTexto(formulario.pais) &&
      normalizarTexto(prospecto.estado) === normalizarTexto(formulario.estado)
    ) {
      unicos.add(prospecto.ciudad)
    }
  })

  return [...unicos].sort((a, b) => a.localeCompare(b, 'es'))
})

const fabricantesDisponibles = computed(() => {
  const unicos = new Set()

  props.prospectos.forEach((prospecto) => {
    if (prospecto.fabricanteInteres) {
      unicos.add(prospecto.fabricanteInteres)
    }
  })

  return [...unicos].sort((a, b) => a.localeCompare(b, 'es'))
})

const fabricanteSeleccionado = computed(() =>
  formulario.fabricanteInteres === OTRO_VALOR
    ? formulario.fabricanteInteresPersonalizado
    : formulario.fabricanteInteres,
)

const modelosDisponibles = computed(() => {
  const unicos = new Set()
  const fabricante = fabricanteSeleccionado.value

  props.prospectos.forEach((prospecto) => {
    if (
      prospecto.fabricanteInteres &&
      prospecto.modeloInteres &&
      normalizarTexto(prospecto.fabricanteInteres) === normalizarTexto(fabricante)
    ) {
      unicos.add(prospecto.modeloInteres)
    }
  })

  return [...unicos].sort((a, b) => a.localeCompare(b, 'es'))
})

const usarModeloManual = computed(
  () => !modelosDisponibles.value.length || formulario.modeloInteres === OTRO_VALOR,
)

watch(
  () => props.abierto,
  (abierto) => {
    if (abierto) {
      limpiar()
    }
  },
)

watch(
  () => usarTelefonoComoWhatsapp.value,
  (activo) => {
    if (activo) {
      formulario.whatsapp = formulario.telefono
    }
  },
)

watch(
  () => formulario.telefono,
  (telefono) => {
    if (usarTelefonoComoWhatsapp.value) {
      formulario.whatsapp = telefono
    }
  },
)

watch(
  () => formulario.tipoMercado,
  (mercadoActual) => {
    if (mercadoActual === 'nacional') {
      formulario.pais = 'México'
    }

    formulario.estado = ''
    formulario.ciudad = ''
  },
)

watch(
  () => formulario.pais,
  (nuevoPais, paisAnterior) => {
    if (nuevoPais !== paisAnterior) {
      formulario.estado = ''
      formulario.ciudad = ''
    }
  },
)

watch(
  () => formulario.estado,
  (nuevoEstado, estadoAnterior) => {
    if (nuevoEstado !== estadoAnterior) {
      formulario.ciudad = ''
    }
  },
)

watch(
  () => formulario.fabricanteInteres,
  (fabricanteActual, fabricanteAnterior) => {
    if (fabricanteActual !== fabricanteAnterior) {
      formulario.modeloInteres = ''
      formulario.modeloInteresPersonalizado = ''
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
  formulario.fabricanteInteresPersonalizado = ''
  formulario.modeloInteres = ''
  formulario.modeloInteresPersonalizado = ''
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
  const fabricanteFinal =
    formulario.fabricanteInteres === OTRO_VALOR
      ? formulario.fabricanteInteresPersonalizado.trim()
      : formulario.fabricanteInteres

  const modeloFinal =
    usarModeloManual.value || formulario.modeloInteres === OTRO_VALOR
      ? formulario.modeloInteresPersonalizado.trim()
      : formulario.modeloInteres

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
    fabricanteInteres: fabricanteFinal,
    modeloInteres: modeloFinal,
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

  if (estadosDisponibles.value.length && !payload.estado) {
    return 'Selecciona un estado válido.'
  }

  if (ciudadesDisponibles.value.length && !payload.ciudad) {
    return 'Selecciona una ciudad válida.'
  }

  if (fabricanteSeleccionado.value && !obtenerPayload().fabricanteInteres) {
    return 'Indica un fabricante válido.'
  }

  if (usarModeloManual.value && formulario.modeloInteres === OTRO_VALOR && !payload.modeloInteres) {
    return 'Escribe el modelo de interés.'
  }

  if (payload.presupuesto !== '' && Number(payload.presupuesto) < 0) {
    return 'El presupuesto no puede ser negativo.'
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
  <div v-if="abierto" class="overlay" @click.self="$emit('cerrar')">
    <section class="drawer-formulario">
      <div class="encabezado">
        <div>
          <p>Nuevo contacto</p>
          <strong>Registrar contacto</strong>
        </div>
        <button @click="$emit('cerrar')">✕</button>
      </div>

      <p v-if="errorFormulario" class="feedback error">{{ errorFormulario }}</p>

      <div class="formulario">
        <section class="bloque-formulario">
          <div class="bloque-titulo">
            <p>Datos del contacto</p>
          </div>

          <div class="bloque-grid">
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

            <label class="campo-completo">
              <span>Correo</span>
              <input v-model="formulario.correo" type="email" />
            </label>
          </div>
        </section>

        <section class="bloque-formulario">
          <div class="bloque-titulo">
            <p>Ubicación</p>
          </div>

          <div class="bloque-grid">
            <label>
              <span>Mercado *</span>
              <select v-model="formulario.tipoMercado">
                <option value="nacional">Nacional</option>
                <option value="internacional">Internacional</option>
              </select>
            </label>

            <label>
              <span>País</span>
              <select v-model="formulario.pais">
                <option value="">Selecciona un país</option>
                <option v-for="paisDisponible in paisesDisponibles" :key="paisDisponible" :value="paisDisponible">
                  {{ paisDisponible }}
                </option>
              </select>
            </label>

            <label>
              <span>Estado</span>
              <select v-model="formulario.estado" :disabled="!formulario.pais || !estadosDisponibles.length">
                <option value="">
                  {{ estadosDisponibles.length ? 'Selecciona un estado' : 'Sin estados disponibles' }}
                </option>
                <option v-for="estadoDisponible in estadosDisponibles" :key="estadoDisponible" :value="estadoDisponible">
                  {{ estadoDisponible }}
                </option>
              </select>
            </label>

            <label>
              <span>Ciudad</span>
              <select
                v-model="formulario.ciudad"
                :disabled="!formulario.estado || !ciudadesDisponibles.length"
              >
                <option value="">
                  {{ ciudadesDisponibles.length ? 'Selecciona una ciudad' : 'Sin ciudades disponibles' }}
                </option>
                <option v-for="ciudadDisponible in ciudadesDisponibles" :key="ciudadDisponible" :value="ciudadDisponible">
                  {{ ciudadDisponible }}
                </option>
              </select>
            </label>
          </div>
        </section>

        <section class="bloque-formulario">
          <div class="bloque-titulo">
            <p>Interés</p>
          </div>

          <div class="bloque-grid">
            <label>
              <span>Fabricante de interés</span>
              <select v-model="formulario.fabricanteInteres">
                <option value="">Selecciona un fabricante</option>
                <option v-for="fabricante in fabricantesDisponibles" :key="fabricante" :value="fabricante">
                  {{ fabricante }}
                </option>
                <option :value="OTRO_VALOR">Fabricante personalizado</option>
              </select>
            </label>

            <label v-if="formulario.fabricanteInteres === OTRO_VALOR">
              <span>Fabricante personalizado</span>
              <input
                v-model="formulario.fabricanteInteresPersonalizado"
                type="text"
                placeholder="Escribe el fabricante"
              />
            </label>

            <label v-else>
              <span>Modelo de interés</span>
              <select v-if="!usarModeloManual" v-model="formulario.modeloInteres">
                <option value="">Selecciona un modelo</option>
                <option v-for="modelo in modelosDisponibles" :key="modelo" :value="modelo">
                  {{ modelo }}
                </option>
                <option :value="OTRO_VALOR">Otro / Escribir modelo</option>
              </select>
              <input
                v-else
                v-model="formulario.modeloInteresPersonalizado"
                type="text"
                placeholder="Escribe el modelo de interés"
              />
            </label>

            <label v-if="!usarModeloManual && formulario.modeloInteres === OTRO_VALOR">
              <span>Modelo personalizado</span>
              <input v-model="formulario.modeloInteresPersonalizado" type="text" />
            </label>

            <label>
              <span>Presupuesto</span>
              <div class="campo-presupuesto">
                <input v-model="formulario.presupuesto" type="number" min="0" step="1" />
                <select v-model="formulario.moneda">
                  <option value="USD">USD</option>
                  <option value="MXN">MXN</option>
                </select>
              </div>
            </label>

            <label>
              <span>Prioridad</span>
              <select v-model="formulario.prioridad">
                <option value="baja">Baja</option>
                <option value="media">Media</option>
                <option value="alta">Alta</option>
                <option value="urgente">Urgente</option>
              </select>
            </label>

            <label>
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
            <textarea v-model="formulario.notas" rows="4" />
          </label>
        </section>
      </div>

      <div class="acciones">
        <button class="ghost" @click="$emit('cerrar')">Cancelar</button>
        <button class="primario" @click="guardar()">Guardar contacto</button>
      </div>
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
          <button class="primario" @click="guardar(true)">Guardar de todos modos</button>
        </div>
      </article>
    </div>
  </div>
</template>

<style scoped>
.overlay {
  position: fixed;
  inset: 0;
  background: rgba(7, 23, 47, 0.4);
  z-index: 40;
  display: flex;
  justify-content: flex-end;
}

.drawer-formulario {
  width: min(100%, 720px);
  min-height: 100%;
  background: #fff;
  padding: 1.3rem;
  display: grid;
  gap: 1rem;
  overflow: auto;
}

.encabezado {
  display: flex;
  justify-content: space-between;
  gap: 1rem;
}

.encabezado p,
.bloque-titulo p,
.formulario span,
.detalle-duplicado span {
  margin: 0;
  color: #62728e;
  font-weight: 700;
}

.encabezado strong {
  color: #07172f;
  font-size: 1.2rem;
}

.encabezado button {
  border: 0;
  background: #eef4ff;
  width: 2.4rem;
  height: 2.4rem;
  border-radius: 50%;
  cursor: pointer;
}

.feedback.error {
  margin: 0;
  padding: 0.9rem 1rem;
  border-radius: 16px;
  background: #fff0f1;
  color: #b23d44;
}

.formulario {
  display: grid;
  gap: 1rem;
}

.bloque-formulario {
  border: 1px solid #e4ebf7;
  border-radius: 22px;
  padding: 1rem;
  display: grid;
  gap: 0.9rem;
}

.bloque-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.9rem;
}

.formulario label {
  display: grid;
  gap: 0.45rem;
}

.campo-completo {
  grid-column: 1 / -1;
}

.formulario input,
.formulario select,
.formulario textarea {
  min-height: 3rem;
  border: 1px solid #dbe5f4;
  border-radius: 14px;
  padding: 0.8rem 0.95rem;
  font: inherit;
}

.formulario textarea {
  min-height: 6rem;
  resize: vertical;
}

.check-ayuda {
  display: inline-flex;
  align-items: center;
  gap: 0.45rem;
  color: #5f718f;
  font-size: 0.92rem;
}

.check-ayuda input {
  min-height: auto;
}

.campo-presupuesto {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 110px;
  gap: 0.7rem;
}

.acciones {
  display: flex;
  gap: 0.7rem;
}

.acciones button {
  flex: 1;
  min-height: 3rem;
  border: 0;
  border-radius: 14px;
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
  background: #1167e8;
  color: #fff;
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

.acciones-modal {
  flex-wrap: wrap;
}

@media (max-width: 767px) {
  .drawer-formulario {
    width: 100%;
  }

  .bloque-grid,
  .detalle-duplicado,
  .campo-presupuesto {
    grid-template-columns: 1fr;
  }

  .acciones {
    flex-direction: column;
  }
}
</style>
