<script setup lang="ts">
import type { BurstType, Character, Element, WeaponType } from '~/types/character'

const open = defineModel<boolean>('open', { required: true })

const props = defineProps<{
  sort: (a: Character, b: Character) => number
  include?: (c: Character) => boolean
  selected: Set<string>
  disabled?: (id: string) => boolean
  dimmed?: Set<string>
  color?: 'primary' | 'warning'
}>()

const emit = defineEmits<{ toggle: [id: string] }>()

const { t } = useI18n()
const { filterCharacters } = useCharacters()
const { burstIcon, weaponIcon, elementIcon } = useIcons()
const { hasFinePointer, pickerModalContent } = usePickerFocus()

const search = ref('')
const burst = ref<BurstType | null>(null)
const weapon = ref<WeaponType | null>(null)
const element = ref<Element | null>(null)

// Each open starts unfiltered
watch(open, (isOpen) => {
  if (!isOpen) return
  search.value = ''
  burst.value = null
  weapon.value = null
  element.value = null
})

const characters = computed(() => {
  const chars = filterCharacters({
    search: search.value,
    burst: burst.value,
    weapon: weapon.value,
    element: element.value,
  })
  return (props.include ? chars.filter(props.include) : chars).sort(props.sort)
})

// Full class strings, so Tailwind's scanner sees them
const TILE_CLASSES = {
  primary: {
    selected: 'border-primary bg-primary/10 ring-1 ring-primary/30',
    idle: 'border-default hover:border-primary/50',
  },
  warning: {
    selected: 'border-warning bg-warning/10 ring-1 ring-warning/30',
    idle: 'border-default hover:border-warning/50',
  },
}

function tileClass(id: string) {
  const classes = TILE_CLASSES[props.color ?? 'primary']
  if (props.selected.has(id)) return classes.selected
  if (props.dimmed?.has(id)) return 'border-muted bg-muted/10 opacity-50'
  return classes.idle
}
</script>

<template>
  <UModal v-model:open="open" :content="pickerModalContent">
    <template #content>
      <div class="flex flex-col gap-3 p-4">
        <div class="flex items-center justify-between gap-2">
          <h3 class="font-semibold">
            <slot name="title" />
          </h3>
          <div class="flex shrink-0 items-center gap-1">
            <slot name="actions" />
            <UButton :label="t('common.done')" size="xs" @click="open = false" />
          </div>
        </div>

        <slot />

        <UInput
          v-model="search"
          :placeholder="t('roster.search')"
          icon="i-lucide-search"
          size="sm"
          :autofocus="hasFinePointer"
        />

        <!-- Compact icon-only filters -->
        <div class="flex flex-wrap items-center gap-1">
          <button
            v-for="b in BURST_FILTERS"
            :key="b.value"
            class="flex size-7 items-center justify-center rounded border transition-colors"
            :class="burst === b.value ? 'border-primary bg-primary/15' : 'border-default hover:bg-elevated'"
            :title="`Burst ${b.label}`"
            @click="burst = burst === b.value ? null : b.value"
          >
            <CommonMonoIcon v-if="burstIcon(b.value)" :src="burstIcon(b.value)!" :label="`Burst ${b.label}`" class="size-4" />
          </button>

          <span class="mx-0.5 hidden text-muted sm:inline">|</span>

          <button
            v-for="w in WEAPON_FILTERS"
            :key="w"
            class="flex size-7 items-center justify-center rounded border transition-colors"
            :class="weapon === w ? 'border-primary bg-primary/15' : 'border-default hover:bg-elevated'"
            :title="w"
            @click="weapon = weapon === w ? null : w"
          >
            <CommonMonoIcon v-if="weaponIcon(w)" :src="weaponIcon(w)!" :label="w" class="size-4" />
          </button>

          <span class="mx-0.5 hidden text-muted sm:inline">|</span>

          <button
            v-for="e in ELEMENT_FILTERS"
            :key="e"
            class="flex size-7 items-center justify-center rounded border transition-colors"
            :class="element === e ? 'border-primary bg-primary/15' : 'border-default hover:bg-elevated'"
            :title="t(`element.${e}`)"
            @click="element = element === e ? null : e"
          >
            <CommonMonoIcon v-if="elementIcon(e)" :src="elementIcon(e)!" :label="t(`element.${e}`)" class="size-4" />
          </button>
        </div>

        <div class="grid max-h-96 grid-cols-4 gap-1 overflow-y-auto">
          <button
            v-for="char in characters"
            :key="char.id"
            class="flex flex-col items-center gap-1 rounded-lg border p-1.5 text-center transition-all"
            :class="tileClass(char.id)"
            :disabled="disabled?.(char.id)"
            @click="emit('toggle', char.id)"
          >
            <CharacterAvatar :character="char" size="sm" />
          </button>
        </div>
      </div>
    </template>
  </UModal>
</template>
