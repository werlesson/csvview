<script setup lang="ts">
// Página de Upload — placeholder até a Fase 6 (dropzone, recentes, fluxo de
// abertura). Nesta fase entrega apenas o esqueleto da rota `/`.
</script>

<template>
  <section class="upload-placeholder">
    <h1 class="upload-placeholder__title">
      Solte um CSV e comece a explorar.
    </h1>
    <p class="upload-placeholder__hint">
      A tela de upload chega na Fase 6.
    </p>
  </section>
</template>

<style scoped>
.upload-placeholder {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  padding: 64px 0;
  text-align: center;
}

.upload-placeholder__title {
  font-size: 34px;
  font-weight: 600;
  color: var(--text);
}

.upload-placeholder__hint {
  font-size: 15px;
  color: var(--text-2);
}
</style>
