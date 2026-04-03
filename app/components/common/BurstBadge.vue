<script setup lang="ts">
import type { BurstType } from '~/types/character'

const props = defineProps<{ burst: BurstType }>()

const { t } = useI18n()
const { burstIcon } = useIcons()

const colorMap: Record<BurstType, string> = {
  I: 'info',
  II: 'warning',
  III: 'error',
  Λ: 'success',
}

const burstLabel = computed(() => t(`burst.${props.burst}`))
const burstIconSrc = computed(() => burstIcon(props.burst))
</script>

<template>
  <UBadge :color="(colorMap[props.burst] as any)" variant="subtle" size="xs" :title="burstLabel">
    <img v-if="burstIconSrc" :src="burstIconSrc" :alt="burstLabel" class="size-3.5">
    <span v-else>{{ props.burst === 'Λ' ? 'Λ' : `B${props.burst}` }}</span>
  </UBadge>
</template>
