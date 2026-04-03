<script setup lang="ts">
const { t } = useI18n()
const i18nHead = useLocaleHead({ addSeoAttributes: true })

useHead({
  title: () => t('meta.title'),
  htmlAttrs: computed(() => i18nHead.value.htmlAttrs || {}),
  link: computed(() => [
    { rel: 'icon', type: 'image/png', href: '/favicon.png' },
    ...(i18nHead.value.link || []),
  ]),
  meta: computed(() => [
    { name: 'description', content: t('meta.description') },
    { name: 'keywords', content: t('meta.keywords') },
    { property: 'og:title', content: t('meta.title') },
    { property: 'og:description', content: t('meta.description') },
    { property: 'og:type', content: 'website' },
    ...(i18nHead.value.meta || []),
  ]),
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
