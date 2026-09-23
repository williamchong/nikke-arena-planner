<script setup lang="ts">
const { t, locale, locales } = useI18n()
const i18nHead = useLocaleHead()
const { url: siteUrl } = useSiteConfig()
const localeCodes = computed(() =>
  (locales.value as Array<{ code: string }>).map(l => l.code),
)

useHead({
  // unhead v3 types reject a computed htmlAttrs object; per-field getters are required
  htmlAttrs: {
    lang: () => i18nHead.value.htmlAttrs.lang,
    dir: () => i18nHead.value.htmlAttrs.dir,
  },
  link: computed(() => i18nHead.value.link),
  meta: computed(() => [
    { name: 'keywords', content: t('meta.keywords') },
    ...i18nHead.value.meta,
  ]),
  titleTemplate: (title) => {
    const siteName = t('app.title')
    return title && title !== siteName ? `${title} - ${siteName}` : siteName
  },
  script: computed(() => [
    {
      type: 'application/ld+json',
      innerHTML: JSON.stringify({
        '@context': 'https://schema.org',
        '@type': 'WebApplication',
        'name': t('app.title'),
        'url': siteUrl,
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
        'url': siteUrl,
        'inLanguage': locale.value,
      }),
    },
  ]),
})

useSeoMeta({
  description: () => t('meta.description'),
  ogTitle: () => t('meta.title'),
  ogDescription: () => t('meta.description'),
  ogType: 'website',
  ogSiteName: () => t('app.title'),
  ogImage: `${siteUrl}/images/og-image.png`,
  ogImageWidth: 1200,
  ogImageHeight: 630,
})
</script>

<template>
  <UApp>
    <LayoutAppHeader />
    <main class="mx-auto max-w-7xl px-3 py-4 sm:px-4 sm:py-6">
      <NuxtRouteAnnouncer />
      <NuxtPage />
    </main>
    <LayoutAppFooter />
  </UApp>
</template>
