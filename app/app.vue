<script setup lang="ts">
const { t } = useI18n()
const route = useRoute()
const canonicalPath = computed(() => route.path)

useHead({
  title: () => t('meta.title'),
  link: [
    { rel: 'icon', type: 'image/png', href: '/favicon.png' },
    { rel: 'canonical', href: canonicalPath },
  ],
  meta: [
    { name: 'description', content: () => t('meta.description') },
    { name: 'keywords', content: () => t('meta.keywords') },
    { property: 'og:title', content: () => t('meta.title') },
    { property: 'og:description', content: () => t('meta.description') },
    { property: 'og:type', content: 'website' },
  ],
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
