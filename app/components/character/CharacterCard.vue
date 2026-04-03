<script setup lang="ts">
import type { Character } from '~/types/character'

const props = defineProps<{
  character: Character
  owned: boolean
}>()

const emit = defineEmits<{
  toggle: [id: string]
}>()

const { t } = useI18n()
const { localize } = useLocalizedField()
const { getAvatarUrl } = useAvatars()
const { elementIcon, weaponIcon } = useIcons()

const displayName = computed(() => localize(props.character.name))
const avatarUrl = computed(() => getAvatarUrl(props.character.avatarImg))
const elementIconSrc = computed(() => elementIcon(props.character.element))
const weaponIconSrc = computed(() => weaponIcon(props.character.weapon))

const elementColor: Record<string, string> = {
  fire: 'ring-red-400/60',
  water: 'ring-blue-400/60',
  wind: 'ring-green-400/60',
  electric: 'ring-violet-400/60',
  iron: 'ring-yellow-400/60',
}
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
      :title="displayName"
      class="size-12 rounded-full object-cover ring-2"
      :class="elementColor[character.element] || 'ring-transparent'"
      loading="lazy"
    >
    <div class="flex items-center gap-1">
      <CommonBurstBadge :burst="character.burst" />
      <img
        v-if="elementIconSrc"
        :src="elementIconSrc"
        :alt="t(`element.${character.element}`)"
        :title="t(`element.${character.element}`)"
        class="size-3.5"
      >
      <img
        v-if="weaponIconSrc"
        :src="weaponIconSrc"
        :alt="t(`weapon.${character.weapon}`)"
        :title="t(`weapon.${character.weapon}`)"
        class="size-3.5"
      >
    </div>
    <span class="line-clamp-2 text-xs font-medium leading-tight">
      {{ displayName }}
    </span>
  </button>
</template>
