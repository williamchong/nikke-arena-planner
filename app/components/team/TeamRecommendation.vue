<script setup lang="ts">
import type { ArenaMode, Character } from '~/types/character'
import type { TeamComposition, TeamTemplate } from '~/types/template'
import type { RatingContext } from '~/types/rating'
import templatesData from '~/data/templates.json'

const props = defineProps<{
  team: TeamComposition
  template?: TeamTemplate
  label?: string
  mode?: ArenaMode
  ratingContext?: RatingContext
  banable?: boolean
}>()

const emit = defineEmits<{
  ban: [id: string]
}>()

const { t } = useI18n()
const localePath = useLocalePath()
const { trackEvent } = useAnalytics()
const { getCharacter } = useCharacters()
const { localize } = useLocalizedField()
const { getAvatarUrl } = useAvatars()
const ratingsStore = useRatingsStore()

const ratingTargetTeam = computed(() => props.ratingContext?.team ?? props.team)

const currentRating = computed(() =>
  props.ratingContext
    ? ratingsStore.getRating(props.ratingContext.arenaMode, ratingTargetTeam.value.characters)
    : null,
)

function handleRate(rating: 'up' | 'down') {
  if (!props.ratingContext) return
  ratingsStore.submitRating(rating, props.ratingContext)
}

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

// Teams that match no archetype still get a "why", built from the speed tier and burst chain
const noArchetype = computed(() => !props.template && overlappingTemplates.value.length === 0)
const hasNotes = computed(() => !!templateNotes.value || overlappingTemplates.value.length > 0 || noArchetype.value)

const showNotes = ref(false)

function toggleNotes() {
  showNotes.value = !showNotes.value
  if (showNotes.value) {
    trackEvent('team_expand_notes', {
      template_id: props.team.templateId ?? 'none',
      arena_mode: effectiveMode.value ?? null,
      overlap_count: overlappingTemplates.value.length,
    })
  }
}

function onTryCalculator() {
  trackEvent('team_try_calculator', {
    template_id: props.team.templateId ?? 'none',
    arena_mode: effectiveMode.value ?? null,
  })
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

    <!-- Characters: one row of 5 on phones, wrapping row from sm up -->
    <div class="grid grid-cols-5 gap-1 sm:flex sm:flex-wrap sm:gap-2">
      <div v-for="(char, i) in characters" :key="char.id" class="flex min-w-0 flex-col items-center gap-1">
        <TeamSlot
          :character="char"
          :position="i + 1"
          :banable="banable"
          fluid
          @ban="emit('ban', char.id)"
        />
        <template v-if="alternatesMap[i]">
          <!-- Phones: a compact chip whose popover lists the swaps by name (no hover on touch) -->
          <UPopover class="sm:hidden">
            <button type="button" class="rounded px-1 text-[10px] text-muted ring-1 ring-default">
              {{ t('recommend.orSwap') }} +{{ alternatesMap[i].length }}
            </button>
            <template #content>
              <ul class="flex flex-col gap-1.5 p-2 text-xs">
                <li v-for="alt in alternatesMap[i]" :key="alt.id" class="flex items-center gap-2">
                  <img
                    v-if="getAvatarUrl(alt.avatarImg)"
                    :src="getAvatarUrl(alt.avatarImg)!"
                    alt=""
                    class="size-6 rounded-full ring-1 ring-default"
                  >
                  {{ localize(alt.name) }}
                </li>
              </ul>
            </template>
          </UPopover>
          <div class="hidden items-center gap-0.5 sm:flex">
            <span class="text-[9px] text-muted">{{ t('recommend.orSwap') }}</span>
            <div
              v-for="alt in alternatesMap[i].slice(0, 3)"
              :key="alt.id"
              :title="localize(alt.name)"
              class="cursor-help"
            >
              <img
                v-if="getAvatarUrl(alt.avatarImg)"
                :src="getAvatarUrl(alt.avatarImg)!"
                :alt="localize(alt.name)"
                loading="lazy"
                class="size-5 rounded-full opacity-60 ring-1 ring-default hover:opacity-100"
              >
            </div>
            <span v-if="alternatesMap[i].length > 3" class="text-[9px] text-muted">+{{ alternatesMap[i].length - 3 }}</span>
          </div>
        </template>
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
        @click="onTryCalculator"
      />
      <button
        v-if="hasNotes"
        class="text-xs text-muted hover:text-default"
        @click="toggleNotes"
      >
        {{ showNotes ? '▼' : '▶' }} {{ t('recommend.whyThisTeam') }}
      </button>

      <!-- Rating buttons: one group so they wrap together -->
      <div v-if="ratingContext" class="ml-auto flex items-center gap-1">
        <UButton
          icon="i-lucide-thumbs-up"
          size="xs"
          :variant="currentRating === 'up' ? 'solid' : 'ghost'"
          :color="currentRating === 'up' ? 'success' : 'neutral'"
          :aria-label="t('rating.thumbsUp')"
          @click="handleRate('up')"
        />
        <UButton
          icon="i-lucide-thumbs-down"
          size="xs"
          :variant="currentRating === 'down' ? 'solid' : 'ghost'"
          :color="currentRating === 'down' ? 'error' : 'neutral'"
          :aria-label="t('rating.thumbsDown')"
          @click="handleRate('down')"
        />
      </div>
    </div>
    <div v-if="showNotes && hasNotes" class="mt-1 space-y-1.5 text-xs text-muted">
      <p v-if="noArchetype">
        {{ t('recommend.noArchetypeReason', { speed: team.burstSpeed }) }}
      </p>
      <p v-if="templateNotes && templateName">
        <span class="font-medium text-default">{{ templateName }}:</span> {{ templateNotes }}
      </p>
      <p v-for="ot in overlappingTemplates" :key="ot.id">
        <span class="font-medium text-default">{{ localize(ot.name) }}:</span> {{ localize(ot.notes) }}
      </p>
    </div>
  </div>
</template>
