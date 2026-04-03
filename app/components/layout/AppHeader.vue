<script setup lang="ts">
const { t } = useI18n()
const route = useRoute()

const mainNavItems = computed(() => [
  { label: t('nav.recommend'), to: '/recommend/5v5', icon: 'i-lucide-trophy' },
  { label: t('nav.roster'), to: '/roster', icon: 'i-lucide-users' },
])

function isActive(item: { to: string }) {
  if (item.to === '/roster') return route.path === '/roster'
  return route.path.startsWith('/recommend')
}
</script>

<template>
  <header class="border-b border-default">
    <div class="mx-auto flex h-14 max-w-7xl items-center gap-4 px-4">
      <NuxtLink to="/recommend/5v5" class="flex items-center gap-2 font-bold">
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
          :to="'/calculator'"
          icon="i-lucide-calculator"
          :label="t('nav.calculator')"
          :variant="route.path === '/calculator' ? 'soft' : 'ghost'"
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
