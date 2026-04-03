<script setup lang="ts">
import type { Character } from '~/types/character'

const props = defineProps<{
  character: Character
  size?: 'sm' | 'md'
}>()

const { t } = useI18n()
const { localize } = useLocalizedField()
const { getAvatarUrl } = useAvatars()
const { elementIcon, weaponIcon } = useIcons()

const displayName = computed(() => localize(props.character.name))
const avatarSrc = computed(() => getAvatarUrl(props.character.avatarImg))
const elementSrc = computed(() => elementIcon(props.character.element))
const weaponSrc = computed(() => weaponIcon(props.character.weapon))

const avatarSize = computed(() => props.size === 'sm' ? 'size-10' : 'size-12')
const iconSize = computed(() => props.size === 'sm' ? 'size-3' : 'size-3.5')

const elementColor: Record<string, string> = {
  fire: 'ring-red-400/60',
  water: 'ring-blue-400/60',
  wind: 'ring-green-400/60',
  electric: 'ring-violet-400/60',
  iron: 'ring-yellow-400/60',
}
</script>

<template>
  <div class="flex flex-col items-center gap-1">
    <img
      v-if="avatarSrc"
      :src="avatarSrc"
      :alt="displayName"
      :title="displayName"
      class="rounded-full object-cover ring-2"
      :class="[avatarSize, elementColor[character.element] || 'ring-transparent']"
      loading="lazy"
    >
    <div class="flex items-center gap-0.5">
      <CommonBurstBadge :burst="character.burst" />
      <img
        v-if="elementSrc"
        :src="elementSrc"
        :alt="t(`element.${character.element}`)"
        :title="t(`element.${character.element}`)"
        :class="iconSize"
      >
      <img
        v-if="weaponSrc"
        :src="weaponSrc"
        :alt="t(`weapon.${character.weapon}`)"
        :title="t(`weapon.${character.weapon}`)"
        :class="iconSize"
      >
    </div>
    <span class="line-clamp-2 text-xs font-medium leading-tight">
      {{ displayName }}
    </span>
  </div>
</template>
