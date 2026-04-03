<script setup lang="ts">
import type { BurstType } from '~/types/character'

const props = defineProps<{ burst: BurstType }>()

const colorMap: Record<BurstType, string> = {
  I: 'info',
  II: 'warning',
  III: 'error',
  Λ: 'success',
}
</script>

<template>
  <UBadge :color="(colorMap[props.burst] as any)" variant="subtle" size="xs">
    {{ props.burst === 'Λ' ? 'Λ' : `B${props.burst}` }}
  </UBadge>
</template>
