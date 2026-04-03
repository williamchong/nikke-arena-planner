<script setup lang="ts">
const { t, locale, locales } = useI18n()
const i18nHead = useLocaleHead()
const localeCodes = computed(() =>
  (locales.value as Array<{ code: string }>).map(l => l.code),
)

useHead({
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
  <Html :lang="i18nHead.htmlAttrs?.lang" :dir="i18nHead.htmlAttrs?.dir">
    <Head>
      <Link rel="icon" type="image/png" href="/favicon.png" />
      <template v-for="link in i18nHead.link" :key="link.key">
        <Link :id="link.key" :rel="link.rel" :href="link.href" :hreflang="link.hreflang" />
      </template>
      <template v-for="meta in i18nHead.meta" :key="meta.key">
        <Meta :id="meta.key" :property="meta.property" :content="meta.content" />
      </template>
    </Head>
    <Body>
      <UApp>
        <LayoutAppHeader />
        <main class="mx-auto max-w-7xl px-4 py-6">
          <NuxtRouteAnnouncer />
          <NuxtPage />
        </main>
        <LayoutAppFooter />
      </UApp>
    </Body>
  </Html>
</template>
