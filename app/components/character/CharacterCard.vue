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
const { getAvatarUrl } = useAvatars()

const displayName = computed(() => localize(props.character.name))
const avatarUrl = computed(() => getAvatarUrl(props.character.avatarImg))
</script>

<template>
  <button
    class="flex flex-col items-center gap-1 rounded-lg border p-2 text-center transition-all"
    :class="owned
      ? 'border-primary bg-primary/10 ring-1 ring-primary/30'
      : 'border-default opacity-50 hover:opacity-75'"
    @click="emit('toggle', character.id)"
  >
    <img
      v-if="avatarUrl"
      :src="avatarUrl"
      :alt="displayName"
      class="size-12 rounded-full object-cover"
      loading="lazy"
    >
    <div class="flex items-center gap-1">
      <CommonBurstBadge :burst="character.burst" />
    </div>
    <span class="line-clamp-2 text-xs font-medium leading-tight">
      {{ displayName }}
    </span>
  </button>
</template>
