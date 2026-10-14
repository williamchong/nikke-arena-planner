<script setup lang="ts">
const { t } = useI18n()

useSeoMeta({
  title: () => t('roster.title'),
  description: () => t('roster.metaDescription'),
  ogDescription: () => t('roster.metaDescription'),
})
</script>

<template>
  <CharacterGrid />
</template>
