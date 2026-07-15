<script setup lang="ts">
/**
 * Marca (logo) do csvview, apresentacional pura.
 *
 * Reutilizada entre a landing e o Viewer (`app/layouts/default.vue`).
 * Sem estado/composable: só referencia o asset estático `public/logo.svg`
 * (servido sem processamento do Vite, RNF-04).
 */
</script>

<template>
  <img
    class="logo-mark"
    src="/logo.svg"
    alt="csvview.app"
    width="2064"
    height="512"
  >
</template>

<style scoped>
.logo-mark {
  display: block;
  width: auto;
  height: 24px;
}
</style>
