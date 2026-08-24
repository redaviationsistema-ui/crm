<script setup>
defineProps({
  modelValue: {
    type: String,
    default: null,
  },
  prospectos: {
    type: Array,
    default: () => [],
  },
})

defineEmits(['update:modelValue'])
</script>

<template>
  <label class="campo-select">
    <span>Contacto</span>
    <select :value="modelValue" @change="$emit('update:modelValue', $event.target.value)">
      <option value="">Selecciona un contacto</option>
      <option v-for="prospecto in prospectos" :key="prospecto.id" :value="prospecto.id">
        {{ prospecto.nombre }} · {{ prospecto.empresa }}
      </option>
    </select>
  </label>
</template>

<style scoped>
.campo-select {
  min-width: 0;
}

.campo-select select {
  width: 100%;
}
</style>
