<script setup lang="ts">
const { t } = useI18n()
const i18nHead = useLocaleHead({ addSeoAttributes: true })

useHead({
  titleTemplate: (title) => {
    const siteName = t('app.title')
    return title && title !== siteName ? `${title} - ${siteName}` : siteName
  },
  htmlAttrs: computed(() => i18nHead.value.htmlAttrs || {}),
  link: computed(() => i18nHead.value.link || []),
  meta: computed(() => i18nHead.value.meta || []),
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
