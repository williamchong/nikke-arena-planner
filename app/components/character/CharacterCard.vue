<script setup lang="ts">
import type { Character } from '~/types/character'

defineProps<{
  character: Character
  owned: boolean
}>()

const emit = defineEmits<{
  toggle: [id: string]
}>()
</script>

<template>
  <button
    class="flex flex-col items-center gap-1 rounded-lg border p-2 text-center transition-all"
    :class="owned
      ? 'border-primary bg-primary/10 ring-1 ring-primary/30'
      : 'border-default opacity-50 hover:opacity-75'"
    @click="emit('toggle', character.id)"
  >
    <CharacterAvatar :character="character" />
  </button>
</template>
