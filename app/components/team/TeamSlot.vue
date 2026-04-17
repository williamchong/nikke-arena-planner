<script setup lang="ts">
import type { Character } from '~/types/character'

defineProps<{
  character?: Character | null
  position: number
  removable?: boolean
  lockable?: boolean
  locked?: boolean
  banable?: boolean
}>()

const emit = defineEmits<{
  remove: []
  click: []
  toggleLock: []
  ban: []
}>()

const { t } = useI18n()
</script>

<template>
  <div
    class="relative flex min-h-20 w-16 flex-col items-center justify-center gap-1 rounded-lg border p-1.5 text-center sm:w-20 sm:p-2"
    :class="[
      character
        ? locked
          ? 'border-warning/50 bg-warning/10'
          : 'border-primary/30 bg-primary/5'
        : 'border-dashed border-default cursor-pointer hover:bg-elevated',
    ]"
    @click="!character && emit('click')"
  >
    <span class="text-[10px] font-bold text-muted">P{{ position }}</span>

    <template v-if="character">
      <CharacterAvatar :character="character" size="sm" />
      <button
        v-if="lockable"
        class="absolute -left-1 -top-1 rounded-full p-0.5"
        :class="locked ? 'bg-warning text-white' : 'bg-elevated text-muted hover:text-default'"
        :title="locked ? t('calculator.unlock') : t('calculator.lock')"
        @click.stop="emit('toggleLock')"
      >
        <UIcon :name="locked ? 'i-lucide-lock' : 'i-lucide-unlock'" class="size-3" />
      </button>
      <button
        v-if="removable && !locked"
        class="absolute -right-1 -top-1 rounded-full bg-error/80 p-0.5 text-white hover:bg-error"
        @click.stop="emit('remove')"
      >
        <UIcon name="i-lucide-x" class="size-3" />
      </button>
      <button
        v-if="banable"
        class="absolute right-0.5 top-0.5 rounded text-muted/60 hover:bg-elevated hover:text-default"
        :title="t('recommend.banCharacter')"
        @click.stop="emit('ban')"
      >
        <UIcon name="i-lucide-x" class="size-3.5" />
      </button>
    </template>

    <template v-else>
      <UIcon name="i-lucide-plus" class="size-5 text-muted" />
      <span class="text-[10px] text-muted">Add</span>
    </template>
  </div>
</template>
