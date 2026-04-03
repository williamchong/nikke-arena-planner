<script setup lang="ts">
import type { SpeedTier } from '~/types/character'

const props = defineProps<{ tier: SpeedTier }>()

const colorMap: Record<string, string> = {
  '1RL': 'success',
  '2RL': 'success',
  '3SG': 'success',
  '5SG': 'info',
  '3RL': 'info',
  '7SG': 'warning',
  '4RL': 'warning',
  '5RL': 'error',
}
</script>

<template>
  <UBadge :color="(colorMap[props.tier] as any) || 'neutral'" variant="solid" size="xs">
    {{ props.tier }}
  </UBadge>
</template>
