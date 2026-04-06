<script setup lang="ts">
import type { ArenaMode, Character } from '~/types/character'
import type { TeamComposition, TeamTemplate } from '~/types/template'
import templatesData from '~/data/templates.json'

const props = defineProps<{
  team: TeamComposition
  template?: TeamTemplate
  label?: string
  mode?: ArenaMode
}>()

const { t } = useI18n()
const localePath = useLocalePath()
const { trackEvent } = useAnalytics()
const { getCharacter } = useCharacters()
const { localize } = useLocalizedField()
const { getAvatarUrl } = useAvatars()

const calculatorLink = computed(() => {
  const query: Record<string, string> = { team: props.team.characters.join(',') }
  if (props.mode && props.mode !== 'attack') query.mode = props.mode
  return { path: localePath('/calculator'), query }
})

const characters = computed(() =>
  props.team.characters.map(id => getCharacter(id)).filter((c): c is Character => !!c),
)

const alternatesMap = computed(() => {
  if (!props.team.alternates) return {}
  const map: Record<number, Character[]> = {}
  for (const [posStr, ids] of Object.entries(props.team.alternates)) {
    const pos = Number(posStr)
    const chars = ids.map(id => getCharacter(id)).filter((c): c is Character => !!c)
    if (chars.length > 0) map[pos] = chars
  }
  return map
})

const effectiveMode = computed(() => props.mode ?? props.team.mode)

const templateName = computed(() =>
  props.template ? localize(props.template.name) : null,
)

const templateNotes = computed(() =>
  props.template ? localize(props.template.notes) : null,
)

const allTemplates = templatesData as TeamTemplate[]

const overlappingTemplates = computed(() => {
  if (!props.team.matchedArchetypes?.length) return []
  return props.team.matchedArchetypes
    .map(id => allTemplates.find(t => t.id === id))
    .filter((t): t is TeamTemplate => !!t)
})

const showNotes = ref(false)

function toggleNotes() {
  showNotes.value = !showNotes.value
  if (showNotes.value) trackEvent('team_expand_notes')
}
</script>

<template>
  <div class="rounded-lg border border-default p-4">
    <!-- Header -->
    <div class="mb-3 flex flex-wrap items-center gap-2">
      <span v-if="label" class="text-sm font-bold">{{ label }}</span>
      <UBadge v-if="templateName" color="primary" variant="subtle" size="xs">
        {{ templateName }}
      </UBadge>
      <UBadge
        v-for="ot in overlappingTemplates"
        :key="ot.id"
        color="neutral"
        variant="outline"
        size="xs"
      >
        + {{ localize(ot.name) }}
      </UBadge>
      <CommonSpeedTierBadge :tier="team.burstSpeed" />
    </div>

    <!-- Characters -->
    <div class="flex flex-wrap gap-2">
      <div v-for="(char, i) in characters" :key="char.id" class="flex flex-col items-center gap-1">
        <TeamSlot
          :character="char"
          :position="i + 1"
        />
        <div v-if="alternatesMap[i]" class="flex items-center gap-0.5">
          <span class="text-[9px] text-muted">{{ t('recommend.orSwap') }}</span>
          <div v-for="alt in alternatesMap[i].slice(0, 3)" :key="alt.id" :title="localize(alt.name)" class="cursor-help">
            <img
              v-if="getAvatarUrl(alt.avatarImg)"
              :src="getAvatarUrl(alt.avatarImg)!"
              :alt="localize(alt.name)"
              class="size-5 rounded-full opacity-60 ring-1 ring-default hover:opacity-100"
            >
          </div>
          <span v-if="alternatesMap[i].length > 3" class="text-[9px] text-muted">+{{ alternatesMap[i].length - 3 }}</span>
        </div>
      </div>
    </div>

    <CommonBurstTimeline :characters="characters" :mode="effectiveMode" class="mt-3" />

    <!-- Actions & notes -->
    <div class="mt-3 flex flex-wrap items-center gap-3">
      <UButton
        :to="calculatorLink"
        icon="i-lucide-flask-conical"
        :label="t('recommend.tryInCalculator')"
        size="xs"
        variant="outline"
        color="primary"
        @click="trackEvent('team_try_calculator')"
      />
      <button
        v-if="templateNotes || overlappingTemplates.length > 0"
        class="text-xs text-muted hover:text-default"
        @click="toggleNotes"
      >
        {{ showNotes ? '▼' : '▶' }} {{ t('recommend.whyThisTeam') }}
      </button>
    </div>
    <div v-if="showNotes && (templateNotes || overlappingTemplates.length > 0)" class="mt-1 space-y-1.5 text-xs text-muted">
      <p v-if="templateNotes && templateName">
        <span class="font-medium text-default">{{ templateName }}:</span> {{ templateNotes }}
      </p>
      <p v-for="ot in overlappingTemplates" :key="ot.id">
        <span class="font-medium text-default">{{ localize(ot.name) }}:</span> {{ localize(ot.notes) }}
      </p>
    </div>
  </div>
</template>
