<template>
  <div class="skeleton">
    <div v-for="indice in 4" :key="indice" class="bloque" />
  </div>
</template>

<style scoped>
.skeleton {
  display: grid;
  gap: 0.9rem;
}

.bloque {
  min-height: 5rem;
  border-radius: 18px;
  background: linear-gradient(90deg, #edf2fb, #f7f9fd, #edf2fb);
  background-size: 200% 100%;
  animation: pulse 1.3s infinite linear;
}

@keyframes pulse {
  0% {
    background-position: 200% 0;
  }

  100% {
    background-position: -200% 0;
  }
}
</style>
