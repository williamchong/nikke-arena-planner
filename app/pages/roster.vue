<script setup lang="ts">
const { t } = useI18n()

useSeoMeta({
  title: () => t('roster.title'),
})
</script>

<template>
  <CharacterGrid />
</template>
