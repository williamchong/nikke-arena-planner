<script setup lang="ts">
const { locale, locales } = useI18n()
const switchLocalePath = useSwitchLocalePath()
const { trackEvent } = useAnalytics()

watch(locale, (_val, old) => { if (old) trackEvent('setting_locale') })

const items = computed(() =>
  (locales.value as Array<{ code: string, name: string }>).map(l => ({
    label: l.name,
    value: l.code,
  })),
)

const currentLabel = computed(() =>
  items.value.find(i => i.value === locale.value)?.label ?? locale.value,
)
</script>

<template>
  <UDropdownMenu
    :items="items.map(i => ({ ...i, to: switchLocalePath(i.value as any) }))"
  >
    <UButton
      color="neutral"
      variant="ghost"
      icon="i-lucide-languages"
      :title="currentLabel"
    >
      <span class="hidden sm:inline">{{ currentLabel }}</span>
    </UButton>
  </UDropdownMenu>
</template>
