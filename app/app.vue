<script setup lang="ts">
// Inicializa o tema (data-theme na raiz, dark por padrão) o quanto antes.
useTheme()
</script>

<template>
  <div>
    <NuxtRouteAnnouncer />
    <NuxtLayout>
      <NuxtPage />
    </NuxtLayout>
  </div>
</template>
