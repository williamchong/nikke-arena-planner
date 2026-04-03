<script setup lang="ts">
import type { Character } from '~/types/character'

const props = defineProps<{
  character: Character
  owned: boolean
}>()

const emit = defineEmits<{
  toggle: [id: string]
}>()

const { localize } = useLocalizedField()

const displayName = computed(() => localize(props.character.name))

const roleIcon = computed(() => {
  switch (props.character.role) {
    case 'attacker': return 'i-lucide-swords'
    case 'supporter': return 'i-lucide-heart-handshake'
    case 'defender': return 'i-lucide-shield'
  }
})
</script>

<template>
  <button
    class="flex flex-col items-center gap-1 rounded-lg border p-2 text-center transition-all"
    :class="owned
      ? 'border-primary bg-primary/10 ring-1 ring-primary/30'
      : 'border-default opacity-50 hover:opacity-75'"
    @click="emit('toggle', character.id)"
  >
    <div class="flex items-center gap-1">
      <UIcon :name="roleIcon" class="size-3.5 text-muted" />
      <CommonBurstBadge :burst="character.burst" />
    </div>
    <span class="line-clamp-2 text-xs font-medium leading-tight">
      {{ displayName }}
    </span>
    <span class="text-[10px] text-muted uppercase">
      {{ character.weapon }}
    </span>
  </button>
</template>
