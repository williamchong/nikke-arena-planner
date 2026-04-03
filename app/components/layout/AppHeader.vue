<script setup lang="ts">
const { t } = useI18n()
const route = useRoute()

const navItems = computed(() => [
  { label: t('nav.roster'), to: '/', icon: 'i-lucide-users' },
  { label: t('nav.calculator'), to: '/calculator', icon: 'i-lucide-calculator' },
  { label: t('nav.recommend'), to: '/recommend/5v5', icon: 'i-lucide-trophy' },
])

function isActive(item: { to: string }) {
  if (item.to === '/') return route.path === '/'
  return route.path.startsWith(item.to.split('/').slice(0, 2).join('/'))
}
</script>

<template>
  <header class="border-b border-default">
    <div class="mx-auto flex h-14 max-w-7xl items-center gap-4 px-4">
      <NuxtLink to="/" class="flex items-center gap-2 font-bold">
        {{ t('app.title') }}
      </NuxtLink>

      <nav class="ml-auto flex items-center gap-1">
        <UButton
          v-for="item in navItems"
          :key="item.to"
          :to="item.to"
          :icon="item.icon"
          :label="item.label"
          :variant="isActive(item) ? 'soft' : 'ghost'"
          color="neutral"
          size="sm"
        />
      </nav>

      <div class="flex items-center gap-1">
        <CommonLocaleToggle />
        <UColorModeButton />
      </div>
    </div>
  </header>
</template>
