<script setup lang="ts">
const { t } = useI18n()
const route = useRoute()
const localePath = useLocalePath()
const { trackEvent } = useAnalytics()
const colorMode = useColorMode()

watch(() => colorMode.preference, (_val, old) => { if (old) trackEvent('setting_theme') })

const mainNavItems = computed(() => [
  { label: t('nav.recommend'), to: localePath('/recommend/5v5'), icon: 'i-lucide-trophy', match: '/recommend' },
  { label: t('nav.roster'), to: localePath('/roster'), icon: 'i-lucide-users', match: '/roster' },
])

function isActive(item: { to: string, match: string }) {
  return route.path.endsWith(item.match) || route.path.includes(`${item.match}/`)
}
</script>

<template>
  <header class="border-b border-default">
    <div class="mx-auto flex h-14 max-w-7xl items-center gap-4 px-4">
      <NuxtLink :to="localePath('/recommend/5v5')" class="flex items-center gap-2 font-bold">
        {{ t('app.title') }}
      </NuxtLink>

      <nav class="ml-auto flex items-center gap-1">
        <UButton
          v-for="item in mainNavItems"
          :key="item.to"
          :to="item.to"
          :icon="item.icon"
          :label="item.label"
          :variant="isActive(item) ? 'soft' : 'ghost'"
          color="neutral"
          size="sm"
        />
        <UButton
          :to="localePath('/calculator')"
          icon="i-lucide-calculator"
          :label="t('nav.calculator')"
          :variant="route.path.endsWith('/calculator') ? 'soft' : 'ghost'"
          color="neutral"
          size="xs"
        />
        <UButton
          :to="localePath('/about')"
          icon="i-lucide-info"
          :label="t('nav.about')"
          :variant="route.path.endsWith('/about') ? 'soft' : 'ghost'"
          color="neutral"
          size="xs"
        />
      </nav>

      <div class="flex items-center gap-1">
        <CommonLocaleToggle />
        <UColorModeButton />
      </div>
    </div>
  </header>
</template>
