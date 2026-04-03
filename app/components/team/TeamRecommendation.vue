<script setup lang="ts">
import type { Character } from '~/types/character'
import type { TeamComposition, TeamTemplate } from '~/types/template'

const props = defineProps<{
  team: TeamComposition
  template?: TeamTemplate
  label?: string
}>()

const { getCharacter } = useCharacters()
const { localize } = useLocalizedField()

const characters = computed(() =>
  props.team.characters.map(id => getCharacter(id)).filter((c): c is Character => !!c),
)

const templateName = computed(() =>
  props.template ? localize(props.template.name) : null,
)

const templateNotes = computed(() =>
  props.template ? localize(props.template.notes) : null,
)

const showNotes = ref(false)
</script>

<template>
  <div class="rounded-lg border border-default p-4">
    <div class="mb-3 flex items-center gap-2">
      <span v-if="label" class="text-sm font-bold">{{ label }}</span>
      <UBadge v-if="templateName" color="primary" variant="subtle" size="xs">
        {{ templateName }}
      </UBadge>
      <CommonSpeedTierBadge :tier="team.burstSpeed" />
    </div>

    <div class="flex gap-2">
      <TeamSlot
        v-for="(char, i) in characters"
        :key="char.id"
        :character="char"
        :position="i + 1"
      />
    </div>

    <div v-if="templateNotes" class="mt-3">
      <button
        class="text-xs text-muted hover:text-default"
        @click="showNotes = !showNotes"
      >
        {{ showNotes ? '▼' : '▶' }} {{ $t('recommend.whyThisTeam') }}
      </button>
      <p v-if="showNotes" class="mt-1 text-xs text-muted">
        {{ templateNotes }}
      </p>
    </div>
  </div>
</template>
