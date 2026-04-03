// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },
  app: {
    baseURL: process.env.NUXT_APP_BASE_URL || '/',
    head: {
      link: [{ rel: 'icon', type: 'image/png', href: '/favicon.png' }],
    },
  },
  css: ['~/assets/css/main.css'],
  site: {
    url: 'https://nikke.williamchong.cloud',
    name: 'NIKKE Arena Planner',
  },
  modules: [
    '@nuxt/ui',
    '@nuxt/eslint',
    '@pinia/nuxt',
    '@nuxtjs/i18n',
    '@nuxtjs/sitemap',
  ],
  i18n: {
    locales: [
      { code: 'en', name: 'English', language: 'en', file: 'en.json' },
      { code: 'zh-TW', name: '繁體中文', language: 'zh-TW', file: 'zh-TW.json' },
      { code: 'zh-CN', name: '简体中文', language: 'zh-CN', file: 'zh-CN.json' },
    ],
    defaultLocale: 'en',
    langDir: 'locales',
    strategy: 'prefix_except_default',
    detectBrowserLanguage: {
      useCookie: false,
      redirectOn: 'root',
    },
    baseUrl: 'https://nikke.williamchong.cloud',
  },
})
