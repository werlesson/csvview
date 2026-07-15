import tailwindcss from '@tailwindcss/vite'

// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },

  // CSV View é 100% client-side: SPA estática, sem servidor.
  // `ssr: false` + preset estático do Nitro fazem `nuxt generate`
  // produzir um SPA servível por qualquer CDN/host estático, e garantem
  // que APIs de navegador (File, IndexedDB, Web Worker) rodem sem SSR.
  ssr: false,
  nitro: {
    preset: 'static',
  },

  app: {
    head: {
      // Título padrão (tela de Upload). O prefixo de marca nas demais telas
      // é montado no próprio `useHead` da página (ex.: Viewer), já que um
      // `titleTemplate` aplicaria o prefixo até neste título default.
      title: 'CSV View',
    },
  },

  css: [
    // Fontes auto-hospedadas (bundles locais, sem CDN externo).
    '@fontsource-variable/geist',
    '@fontsource-variable/geist-mono',
    '~/assets/css/main.css',
  ],

  vite: {
    plugins: [tailwindcss()],
  },
})
