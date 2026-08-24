<script setup>
defineProps({
  modelValue: {
    type: String,
    default: null,
  },
  usuarios: {
    type: Array,
    default: () => [],
  },
  etiqueta: {
    type: String,
    default: 'Asignar a',
  },
})

defineEmits(['update:modelValue'])
</script>

<template>
  <label class="campo-select">
    <span>{{ etiqueta }}</span>
    <select :value="modelValue" @change="$emit('update:modelValue', $event.target.value)">
      <option value="">Selecciona un usuario</option>
      <option v-for="usuario in usuarios" :key="usuario.id" :value="usuario.id">
        {{ usuario.nombreCompleto || usuario.nombre }}
      </option>
    </select>
  </label>
</template>
