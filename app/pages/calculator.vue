<script setup lang="ts">
import type { ArenaMode, Character } from '~/types/character'
import type { TeamTemplate } from '~/types/template'
import { SPEED_TIERS_ORDERED } from '~/composables/useBurstCalculator'
import { SPEED_TIER_SCORES, pvpTierScore } from '~/composables/useSimulatedAnnealing'
import { matchTemplate, findMetaOverlap } from '~/composables/useTeamRecommender'

const { t } = useI18n()
const { localize } = useLocalizedField()

useSeoMeta({
  title: () => t('calculator.title'),
})

const router = useRouter()
const route = useRoute()
const roster = useRosterStore()
const { trackEvent } = useAnalytics()
const { getCharacter } = useCharacters()
const { calculate } = useBurstCalculator()

const mode = ref<ArenaMode>('attack')
// Fixed 5 slots — null means empty, positions are stable
const slots = ref<(string | null)[]>([null, null, null, null, null])
// Locked slot indices — locked slots can't be removed and are preserved during auto-complete
const lockedSlots = ref<Set<number>>(new Set())

// Load from query string (priority) or localStorage on mount
if (import.meta.client) {
  let initialized = false

  onMounted(() => {
    const qTeam = route.query.team as string | undefined
    const qMode = route.query.mode as string | undefined

    if (qTeam) {
      // Query string takes priority — this is a shared link
      const ids = qTeam.split(',').filter(Boolean)
      const validIds = ids.filter(id => getCharacter(id)).slice(0, 5)
      slots.value = Array.from({ length: 5 }, (_, i) => validIds[i] ?? null)
      if (qMode === 'attack' || qMode === 'defense') mode.value = qMode
    }
    else {
      try {
        const saved = localStorage.getItem('nikke-arena-calc')
        if (saved) {
          const data = JSON.parse(saved)
          if (data.mode) mode.value = data.mode
          if (data.slots) slots.value = data.slots
          if (data.lockedSlots) lockedSlots.value = new Set(data.lockedSlots)
        }
      }
      catch { /* ignore corrupt localStorage */ }
    }

    initialized = true
  })

  watch([mode, slots, lockedSlots], () => {
    if (!initialized) return
    localStorage.setItem('nikke-arena-calc', JSON.stringify({
      mode: mode.value,
      slots: slots.value,
      lockedSlots: [...lockedSlots.value],
    }))
    // Sync query string so the URL is always shareable
    const filledIds = slots.value.filter((id): id is string => !!id)
    const query: Record<string, string> = {}
    if (filledIds.length > 0) query.team = filledIds.join(',')
    if (mode.value !== 'attack') query.mode = mode.value
    router.replace({ query })
  })
}
const showPicker = ref(false)

const slotCharacters = computed(() =>
  slots.value.map(id => id ? getCharacter(id) ?? null : null),
)

const filledCharacters = computed(() =>
  slotCharacters.value.filter((c): c is Character => !!c),
)

const result = computed(() => {
  if (filledCharacters.value.length !== 5) return null
  return calculate(filledCharacters.value, mode.value)
})

const teamScore = computed(() => {
  if (!result.value?.valid || filledCharacters.value.length !== 5) return null
  const chars = filledCharacters.value
  let score = SPEED_TIER_SCORES[result.value.effectiveTier] || 0
  score += chars.reduce((sum, c) => sum + c.suitability[mode.value], 0) * 20
  score += chars.reduce((sum, c) => sum + pvpTierScore(c), 0) * 3
  return score
})

const { getTemplate, recommendAround } = useTeamRecommender()

const matched = computed(() => {
  if (filledCharacters.value.length !== 5) return null
  const template = matchTemplate(filledCharacters.value, mode.value)
  if (!template) return null
  const overlap = findMetaOverlap(filledCharacters.value, template.id, mode.value)
  const overlapping = overlap
    .map(id => getTemplate(id))
    .filter((t): t is TeamTemplate => !!t)
  return { template, overlapping }
})

const isSelected = computed(() => new Set(slots.value.filter((id): id is string => !!id)))
const filledCount = computed(() => isSelected.value.size)

// Selected first, then owned, then newest
function pickerSort(a: Character, b: Character) {
  const sel = isSelected.value
  const aS = sel.has(a.id) ? 0 : 1
  const bS = sel.has(b.id) ? 0 : 1
  if (aS !== bS) return aS - bS

  const aOwned = roster.isOwned(a.id) ? 0 : 1
  const bOwned = roster.isOwned(b.id) ? 0 : 1
  if (aOwned !== bOwned) return aOwned - bOwned

  return (b.releaseOrder ?? 0) - (a.releaseOrder ?? 0)
}

function pickerDisabled(id: string) {
  return !isSelected.value.has(id) && filledCount.value >= 5
}

function toggleInPicker(id: string) {
  const next = [...slots.value]
  const existingIdx = next.indexOf(id)
  if (existingIdx !== -1) {
    next[existingIdx] = null
  }
  else {
    const emptyIdx = next.indexOf(null)
    if (emptyIdx === -1) return
    next[emptyIdx] = id
    trackEvent('calc_slot_fill', {
      character_id: id,
      slot_idx: emptyIdx,
      filled_count_after: next.filter(s => s !== null).length,
      arena_mode: mode.value,
    })
    if (!next.includes(null)) {
      showPicker.value = false
    }
  }
  slots.value = next
}

function removeCharacter(index: number) {
  const next = [...slots.value]
  next[index] = null
  slots.value = next
  if (lockedSlots.value.has(index)) {
    const nextLocks = new Set(lockedSlots.value)
    nextLocks.delete(index)
    lockedSlots.value = nextLocks
  }
}

function clearAll() {
  const filledBefore = slots.value.filter(s => s !== null).length
  slots.value = [null, null, null, null, null]
  lockedSlots.value = new Set()
  trackEvent('calc_clear', { filled_count_before: filledBefore })
}

function toggleLock(index: number) {
  const next = new Set(lockedSlots.value)
  if (next.has(index)) next.delete(index)
  else next.add(index)
  lockedSlots.value = next
}

const hasLockedSlots = computed(() => lockedSlots.value.size > 0)
const hasEmptySlots = computed(() => slots.value.some(s => s === null))
const canAutoComplete = computed(() => hasLockedSlots.value && hasEmptySlots.value)

function autoComplete() {
  const lockedCharIds = [...lockedSlots.value]
    .map(i => slots.value[i])
    .filter((id): id is string => !!id)
  if (lockedCharIds.length === 0) return

  const result = recommendAround(lockedCharIds, roster.ownedIds, mode.value)
  if (!result) return
  trackEvent('calc_auto_complete', {
    arena_mode: mode.value,
    locked_count: lockedCharIds.length,
  })

  // Fill empty slots with recommended characters, preserving locked ones
  const recommended = result.characters.filter(id => !lockedCharIds.includes(id))
  const next = [...slots.value]
  let ri = 0
  for (let i = 0; i < 5; i++) {
    if (!lockedSlots.value.has(i) && next[i] === null && ri < recommended.length) {
      next[i] = recommended[ri]!
      ri++
    }
  }
  slots.value = next
}

// Tracked on click rather than via watch(mode), which also fires when the saved mode is restored
function setMode(v: ArenaMode) {
  if (v === mode.value) return
  trackEvent('calc_mode_change', { from: mode.value, to: v })
  mode.value = v
}

const modeOptions = [
  { label: t('calculator.attack'), value: 'attack' as const },
  { label: t('calculator.defense'), value: 'defense' as const },
]

const speedTiers = SPEED_TIERS_ORDERED
</script>

<template>
  <div class="flex flex-col gap-4 sm:gap-6">
    <h1 class="text-xl font-bold sm:text-2xl">
      {{ t('calculator.title') }}
    </h1>

    <div class="grid gap-6 lg:grid-cols-2">
      <!-- Left: Team + controls -->
      <div class="flex flex-col gap-4">
        <div class="flex items-center gap-2">
          <span class="text-sm font-medium">{{ t('calculator.mode') }}:</span>
          <UButton
            v-for="opt in modeOptions"
            :key="opt.value"
            :label="opt.label"
            size="xs"
            :variant="mode === opt.value ? 'solid' : 'outline'"
            :color="mode === opt.value ? 'primary' : 'neutral'"
            @click="setMode(opt.value)"
          />
        </div>

        <!-- Padding keeps the corner badges of each slot inside the scroll box, which would otherwise clip them -->
        <div class="-m-1 flex gap-2 overflow-x-auto p-1">
          <TeamSlot
            v-for="i in 5"
            :key="i"
            :character="slotCharacters[i - 1] ?? null"
            :position="i"
            :removable="!!slotCharacters[i - 1]"
            :lockable="!!slotCharacters[i - 1]"
            :locked="lockedSlots.has(i - 1)"
            @click="showPicker = true"
            @remove="removeCharacter(i - 1)"
            @toggle-lock="toggleLock(i - 1)"
          />
        </div>

        <div class="flex gap-2">
          <UButton
            v-if="canAutoComplete"
            icon="i-lucide-sparkles"
            :label="t('calculator.autoComplete')"
            size="xs"
            variant="outline"
            color="warning"
            :title="t('calculator.autoCompleteDesc')"
            @click="autoComplete"
          />
          <UButton
            v-if="filledCount > 0"
            icon="i-lucide-x"
            :label="t('roster.clearAll')"
            size="xs"
            variant="ghost"
            color="error"
            @click="clearAll"
          />
        </div>
      </div>

      <!-- Right: Results -->
      <div class="flex flex-col gap-4">
        <template v-if="result">
          <div v-if="!result.valid" class="rounded-lg bg-error/10 p-3 text-sm text-error">
            {{ t('calculator.invalidChain') }}
            <span v-if="result.missingBurstTypes">
              ({{ result.missingBurstTypes.map(b => `B${b}`).join(', ') }})
            </span>
          </div>

          <!-- Template & speed badges -->
          <div class="flex flex-wrap items-center gap-2">
            <span class="text-sm font-medium">{{ t('calculator.speed') }}:</span>
            <CommonSpeedTierBadge :tier="result.effectiveTier" />
            <UBadge v-if="matched" color="primary" variant="subtle" size="xs">
              {{ localize(matched.template.name) }}
            </UBadge>
            <UBadge
              v-for="ot in matched?.overlapping"
              :key="ot.id"
              color="neutral"
              variant="outline"
              size="xs"
            >
              + {{ localize(ot.name) }}
            </UBadge>
            <span v-if="teamScore !== null" class="ml-auto text-xs text-muted">
              {{ t('recommend.score') }}: <span class="font-bold text-default">{{ teamScore }}</span>
            </span>
          </div>

          <CommonBurstTimeline :characters="filledCharacters" :mode="mode" />

          <!-- Burst generation bars -->
          <div class="rounded-lg border border-default p-4">
            <h3 class="mb-1 text-sm font-medium">
              {{ t('calculator.burstGen') }}
            </h3>
            <p class="mb-3 text-xs text-muted">
              {{ t('calculator.burstGenHint') }}
            </p>
            <div class="space-y-2">
              <div v-for="tier in speedTiers" :key="tier" class="flex items-center gap-2">
                <span class="w-10 text-xs font-mono text-muted">{{ tier }}</span>
                <div class="flex-1">
                  <div class="h-4 overflow-hidden rounded-full bg-muted/20">
                    <div
                      class="h-full rounded-full transition-all"
                      :class="result.totalBurstGen[tier] >= 1.0 ? 'bg-success' : 'bg-primary'"
                      :style="{ width: `${Math.min(result.totalBurstGen[tier] * 100, 100)}%` }"
                    />
                  </div>
                </div>
                <span class="w-12 text-right text-xs font-mono">
                  {{ result.totalBurstGen[tier].toFixed(3) }}
                </span>
              </div>
            </div>
          </div>
        </template>

        <div v-else class="flex h-full items-center justify-center text-sm text-muted">
          {{ t('calculator.selectCharacters') }}
        </div>
      </div>
    </div>

    <!-- Character Picker Modal — pick up to 5 in one go -->
    <CharacterPickerModal
      v-model:open="showPicker"
      :sort="pickerSort"
      :selected="isSelected"
      :disabled="pickerDisabled"
      @toggle="toggleInPicker"
    >
      <template #title>
        {{ t('calculator.pickerTitle', { n: filledCount }) }}
      </template>
      <template #actions>
        <UButton
          v-if="filledCount > 0"
          icon="i-lucide-x"
          :label="t('roster.clearAll')"
          size="xs"
          variant="ghost"
          color="error"
          @click="clearAll"
        />
      </template>

      <!-- Selected team preview -->
      <div v-if="filledCount > 0" class="flex gap-1">
        <TeamSlot
          v-for="i in 5"
          :key="i"
          :character="slotCharacters[i - 1] ?? null"
          :position="i"
          :removable="!!slotCharacters[i - 1]"
          @remove="removeCharacter(i - 1)"
        />
      </div>
    </CharacterPickerModal>
  </div>
</template>
