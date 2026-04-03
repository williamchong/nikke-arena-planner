<script setup lang="ts">
const { locale, locales } = useI18n()

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
    :items="items.map(i => ({ ...i, onSelect: () => { locale = i.value as 'en' | 'zh-TW' | 'zh-CN' } }))"
  >
    <UButton
      color="neutral"
      variant="ghost"
      icon="i-lucide-languages"
      :label="currentLabel"
    />
  </UDropdownMenu>
</template>
