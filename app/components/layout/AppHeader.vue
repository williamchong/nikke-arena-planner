<script setup lang="ts">
const { t } = useI18n()
const route = useRoute()
const localePath = useLocalePath()
const { trackEvent } = useAnalytics()
const colorMode = useColorMode()

watch(() => colorMode.preference, (_val, old) => { if (old) trackEvent('setting_theme') })

const mainNavItems = computed(() => [
  { label: t('nav.recommend'), to: localePath('/recommend/5v5'), icon: 'i-lucide-trophy', match: '/recommend', size: 'sm' as const },
  { label: t('nav.roster'), to: localePath('/roster'), icon: 'i-lucide-users', match: '/roster', size: 'sm' as const },
  { label: t('nav.calculator'), to: localePath('/calculator'), icon: 'i-lucide-calculator', match: '/calculator', size: 'xs' as const },
  { label: t('nav.about'), to: localePath('/about'), icon: 'i-lucide-info', match: '/about', size: 'xs' as const },
])

function isActive(item: { to: string, match: string }) {
  return route.path.endsWith(item.match) || route.path.includes(`${item.match}/`)
}
</script>

<template>
  <header class="border-b border-default">
    <div class="mx-auto flex h-14 max-w-7xl items-center gap-2 px-3 sm:gap-4 sm:px-4">
      <NuxtLink :to="localePath('/recommend/5v5')" class="flex shrink-0 items-center gap-2 text-sm font-bold sm:text-base">
        {{ t('app.title') }}
      </NuxtLink>

      <nav class="ml-auto flex items-center gap-0.5 sm:gap-1">
        <UButton
          v-for="item in mainNavItems"
          :key="item.to"
          :to="item.to"
          :icon="item.icon"
          :title="item.label"
          :variant="isActive(item) ? 'soft' : 'ghost'"
          color="neutral"
          :size="item.size"
        >
          <span class="hidden sm:inline">{{ item.label }}</span>
        </UButton>
      </nav>

      <div class="flex shrink-0 items-center gap-0.5 sm:gap-1">
        <CommonLocaleToggle />
        <UColorModeButton />
      </div>
    </div>
  </header>
</template>
