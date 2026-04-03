<script setup lang="ts">
import type { Character } from '~/types/character'

defineProps<{
  character?: Character | null
  position: number
  removable?: boolean
}>()

const emit = defineEmits<{
  remove: []
  click: []
}>()

const { localize } = useLocalizedField()
const { getAvatarUrl } = useAvatars()
</script>

<template>
  <div
    class="relative flex min-h-20 w-20 flex-col items-center justify-center gap-1 rounded-lg border p-2 text-center"
    :class="character ? 'border-primary/30 bg-primary/5' : 'border-dashed border-default cursor-pointer hover:bg-elevated'"
    @click="!character && emit('click')"
  >
    <span class="text-[10px] font-bold text-muted">P{{ position }}</span>

    <template v-if="character">
      <img
        v-if="getAvatarUrl(character.avatarImg)"
        :src="getAvatarUrl(character.avatarImg)!"
        :alt="localize(character.name)"
        class="size-10 rounded-full object-cover"
        loading="lazy"
      >
      <CommonBurstBadge :burst="character.burst" />
      <span class="line-clamp-2 text-[10px] font-medium leading-tight">
        {{ localize(character.name) }}
      </span>
      <button
        v-if="removable"
        class="absolute -right-1 -top-1 rounded-full bg-error/80 p-0.5 text-white hover:bg-error"
        @click.stop="emit('remove')"
      >
        <UIcon name="i-lucide-x" class="size-3" />
      </button>
    </template>

    <template v-else>
      <UIcon name="i-lucide-plus" class="size-5 text-muted" />
      <span class="text-[10px] text-muted">Add</span>
    </template>
  </div>
</template>
