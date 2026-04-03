<script setup lang="ts">
const { t, locale, locales } = useI18n()
const i18nHead = useLocaleHead({ addSeoAttributes: true })
const localeCodes = computed(() =>
  (locales.value as Array<{ code: string }>).map(l => l.code),
)

useHead({
  titleTemplate: (title) => {
    const siteName = t('app.title')
    return title && title !== siteName ? `${title} - ${siteName}` : siteName
  },
  htmlAttrs: computed(() => i18nHead.value.htmlAttrs || {}),
  link: computed(() => i18nHead.value.link || []),
  meta: computed(() => i18nHead.value.meta || []),
  script: computed(() => [
    {
      type: 'application/ld+json',
      innerHTML: JSON.stringify({
        '@context': 'https://schema.org',
        '@type': 'WebApplication',
        'name': t('app.title'),
        'url': 'https://nikke.williamchong.cloud',
        'description': t('meta.description'),
        'applicationCategory': 'GameApplication',
        'operatingSystem': 'Web',
        'offers': {
          '@type': 'Offer',
          'price': '0',
          'priceCurrency': 'USD',
        },
        'inLanguage': localeCodes.value,
      }),
    },
    {
      type: 'application/ld+json',
      innerHTML: JSON.stringify({
        '@context': 'https://schema.org',
        '@type': 'WebSite',
        'name': t('app.title'),
        'url': 'https://nikke.williamchong.cloud',
        'inLanguage': locale.value,
      }),
    },
  ]),
})

useSeoMeta({
  description: () => t('meta.description'),
  keywords: () => t('meta.keywords'),
  ogTitle: () => t('meta.title'),
  ogDescription: () => t('meta.description'),
  ogType: 'website',
  ogSiteName: () => t('app.title'),
})
</script>

<template>
  <UApp>
    <LayoutAppHeader />
    <main class="mx-auto max-w-7xl px-4 py-6">
      <NuxtRouteAnnouncer />
      <NuxtPage />
    </main>
    <LayoutAppFooter />
  </UApp>
</template>
