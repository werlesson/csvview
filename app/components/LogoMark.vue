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
  /* Glow sutil ao redor da marca (fiel ao "glowup" do mock 1a no badge do
     ícone) — drop-shadow segue o alfa do SVG em vez de um retângulo cheio,
     então o brilho contorna o desenho da logo, não a caixa da imagem. */
  filter: drop-shadow(0 3px 8px color-mix(in srgb, var(--accent) 45%, transparent))
    drop-shadow(0 8px 20px color-mix(in srgb, var(--accent) 30%, transparent));
}
</style>
