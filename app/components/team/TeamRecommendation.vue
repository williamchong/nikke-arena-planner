<script setup lang="ts">
import type { ArenaMode, Character } from '~/types/character'
import type { TeamComposition, TeamTemplate } from '~/types/template'

const props = defineProps<{
  team: TeamComposition
  template?: TeamTemplate
  label?: string
  mode?: ArenaMode
}>()

const { t } = useI18n()
const { getCharacter } = useCharacters()
const { localize } = useLocalizedField()
const { calculate } = useBurstCalculator()
const { getAvatarUrl } = useAvatars()
const { getTemplate } = useTeamRecommender()

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

const burstResult = computed(() => {
  if (characters.value.length !== 5) return null
  return calculate(characters.value, props.mode ?? props.team.mode)
})

const templateName = computed(() =>
  props.template ? localize(props.template.name) : null,
)

const templateNotes = computed(() =>
  props.template ? localize(props.template.notes) : null,
)

const overlappingTemplateNames = computed(() => {
  if (!props.team.matchedArchetypes?.length) return []
  return props.team.matchedArchetypes
    .map(id => getTemplate(id))
    .filter((t): t is TeamTemplate => !!t)
    .map(t => localize(t.name))
})

// Determine which character fires each burst stage based on position order
// In NIKKE, lowest position number with the needed burst type fires first
const burstOrder = computed(() => {
  if (characters.value.length !== 5) return null
  const chars = characters.value.map((c, i) => ({ char: c, pos: i + 1 }))

  function findBurster(burstType: 'I' | 'II' | 'III', exclude: Set<number>) {
    // Λ can fill any slot
    const candidates = chars.filter(c =>
      !exclude.has(c.pos) && (c.char.burst === burstType || c.char.burst === 'Λ'),
    )
    // Prefer exact match over Λ, then lowest position
    const exact = candidates.filter(c => c.char.burst === burstType)
    return (exact.length > 0 ? exact : candidates)[0] ?? null
  }

  const used = new Set<number>()
  const b1 = findBurster('I', used)
  if (b1) used.add(b1.pos)
  const b2 = findBurster('II', used)
  if (b2) used.add(b2.pos)
  const b3 = findBurster('III', used)

  return { b1, b2, b3 }
})

const timelineSegments = computed(() => {
  if (!burstResult.value) return null
  const { b1, b2, b3 } = burstResult.value.timings
  const max = b3
  const order = burstOrder.value
  return {
    charge: { width: (b1 / max) * 100, time: b1, char: order?.b1?.char },
    b1ToB2: { width: ((b2 - b1) / max) * 100, time: b2 - b1, char: order?.b2?.char },
    b2ToB3: { width: ((b3 - b2) / max) * 100, time: b3 - b2, char: order?.b3?.char },
    total: b3,
  }
})

const showNotes = ref(false)
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
        v-for="name in overlappingTemplateNames"
        :key="name"
        color="neutral"
        variant="outline"
        size="xs"
      >
        + {{ name }}
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

    <!-- Burst timeline visualization -->
    <div v-if="timelineSegments" class="mt-3 space-y-1">
      <!-- Visual bar with character names -->
      <div class="flex h-7 overflow-hidden rounded-full text-[10px] font-bold text-white">
        <div
          class="flex items-center justify-center gap-0.5 bg-info"
          :style="{ width: `${timelineSegments.charge.width}%` }"
          :title="timelineSegments.charge.char ? `B1: ${localize(timelineSegments.charge.char.name)}` : 'B1'"
        >
          <span>B1</span>
          <span v-if="timelineSegments.charge.char" class="truncate opacity-80">{{ localize(timelineSegments.charge.char.name) }}</span>
        </div>
        <div
          class="flex items-center justify-center gap-0.5 bg-warning"
          :style="{ width: `${timelineSegments.b1ToB2.width}%` }"
          :title="timelineSegments.b1ToB2.char ? `B2: ${localize(timelineSegments.b1ToB2.char.name)}` : 'B2'"
        >
          <span>B2</span>
          <span v-if="timelineSegments.b1ToB2.char" class="truncate opacity-80">{{ localize(timelineSegments.b1ToB2.char.name) }}</span>
        </div>
        <div
          class="flex items-center justify-center gap-0.5 bg-error"
          :style="{ width: `${timelineSegments.b2ToB3.width}%` }"
          :title="timelineSegments.b2ToB3.char ? `B3: ${localize(timelineSegments.b2ToB3.char.name)}` : 'B3'"
        >
          <span>B3</span>
          <span v-if="timelineSegments.b2ToB3.char" class="truncate opacity-80">{{ localize(timelineSegments.b2ToB3.char.name) }}</span>
        </div>
      </div>

      <!-- Timing labels -->
      <div class="flex items-center gap-3 text-xs">
        <span class="text-info">{{ burstResult!.timings.b1.toFixed(2) }}s</span>
        <span class="text-muted">→</span>
        <span class="text-warning">{{ burstResult!.timings.b2.toFixed(2) }}s</span>
        <span class="text-muted">→</span>
        <span class="text-error">{{ burstResult!.timings.b3.toFixed(2) }}s Full Burst</span>
      </div>
    </div>

    <!-- Notes toggle -->
    <div v-if="templateNotes" class="mt-3">
      <button
        class="text-xs text-muted hover:text-default"
        @click="showNotes = !showNotes"
      >
        {{ showNotes ? '▼' : '▶' }} {{ t('recommend.whyThisTeam') }}
      </button>
      <p v-if="showNotes" class="mt-1 text-xs text-muted">
        {{ templateNotes }}
      </p>
    </div>
  </div>
</template>
