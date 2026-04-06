<script setup lang="ts">
import type { ArenaMode, BurstType, Character, Element, WeaponType } from '~/types/character'
import type { TeamTemplate } from '~/types/template'
import { SPEED_TIER_SCORES, PVP_TIER_SCORES } from '~/composables/useSimulatedAnnealing'
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
const { getCharacter, filterCharacters } = useCharacters()
const { calculate } = useBurstCalculator()
const { burstIcon, weaponIcon, elementIcon } = useIcons()

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

const pickerSearch = ref('')
const pickerBurst = ref<BurstType | null>(null)
const pickerWeapon = ref<WeaponType | null>(null)
const pickerElement = ref<Element | null>(null)

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
  score += chars.reduce((sum, c) => sum + (PVP_TIER_SCORES[c.pvpTier || 'C'] || 0), 0) * 3
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

const pickerCharacters = computed(() => {
  const chars = filterCharacters({
    search: pickerSearch.value,
    burst: pickerBurst.value,
    weapon: pickerWeapon.value,
    element: pickerElement.value,
  })

  const sel = isSelected.value
  return [...chars].sort((a, b) => {
    // Selected first, then owned, then newest
    const aS = sel.has(a.id) ? 0 : 1
    const bS = sel.has(b.id) ? 0 : 1
    if (aS !== bS) return aS - bS

    const aOwned = roster.isOwned(a.id) ? 0 : 1
    const bOwned = roster.isOwned(b.id) ? 0 : 1
    if (aOwned !== bOwned) return aOwned - bOwned

    return (b.releaseOrder ?? 0) - (a.releaseOrder ?? 0)
  })
})

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
    if (!next.includes(null)) {
      showPicker.value = false
    }
  }
  slots.value = next
}

function openPicker() {
  pickerSearch.value = ''
  pickerBurst.value = null
  pickerWeapon.value = null
  pickerElement.value = null
  showPicker.value = true
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
  slots.value = [null, null, null, null, null]
  lockedSlots.value = new Set()
  trackEvent('calc_clear')
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
  trackEvent('calc_auto_complete')

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

watch(mode, (v) => {
  trackEvent(v === 'attack' ? 'calc_mode_attack' : 'calc_mode_defense')
})

const modeOptions = [
  { label: t('calculator.attack'), value: 'attack' as const },
  { label: t('calculator.defense'), value: 'defense' as const },
]

const speedTiers = ['2RL', '5SG', '3RL', '7SG', '4RL', '5RL'] as const
</script>

<template>
  <div class="flex flex-col gap-6">
    <h1 class="text-2xl font-bold">
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
            @click="mode = opt.value"
          />
        </div>

        <div class="flex gap-2">
          <TeamSlot
            v-for="i in 5"
            :key="i"
            :character="slotCharacters[i - 1] ?? null"
            :position="i"
            :removable="!!slotCharacters[i - 1]"
            :lockable="!!slotCharacters[i - 1]"
            :locked="lockedSlots.has(i - 1)"
            @click="openPicker"
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
            <h3 class="mb-3 text-sm font-medium">
              {{ t('calculator.burstGen') }}
            </h3>
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
    <UModal v-model:open="showPicker">
      <template #content>
        <div class="flex flex-col gap-3 p-4">
          <div class="flex items-center justify-between">
            <h3 class="font-semibold">
              {{ t('calculator.selectCharacters') }} ({{ filledCount }}/5)
            </h3>
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

          <UInput
            v-model="pickerSearch"
            placeholder="Search..."
            icon="i-lucide-search"
            size="sm"
            autofocus
          />

          <!-- Compact icon-only filters -->
          <div class="flex flex-wrap items-center gap-1">
            <button
              v-for="b in BURST_FILTERS"
              :key="b.value"
              class="flex size-7 items-center justify-center rounded border transition-colors"
              :class="pickerBurst === b.value ? 'border-primary bg-primary/15' : 'border-default hover:bg-elevated'"
              :title="`Burst ${b.label}`"
              @click="pickerBurst = pickerBurst === b.value ? null : b.value"
            >
              <img v-if="burstIcon(b.value)" :src="burstIcon(b.value)!" :alt="`Burst ${b.label}`" class="size-4">
            </button>

            <span class="mx-0.5 text-muted">|</span>

            <button
              v-for="w in WEAPON_FILTERS"
              :key="w"
              class="flex size-7 items-center justify-center rounded border transition-colors"
              :class="pickerWeapon === w ? 'border-primary bg-primary/15' : 'border-default hover:bg-elevated'"
              :title="w"
              @click="pickerWeapon = pickerWeapon === w ? null : w"
            >
              <img v-if="weaponIcon(w)" :src="weaponIcon(w)!" :alt="w" class="size-4">
            </button>

            <span class="mx-0.5 text-muted">|</span>

            <button
              v-for="e in ELEMENT_FILTERS"
              :key="e"
              class="flex size-7 items-center justify-center rounded border transition-colors"
              :class="pickerElement === e ? 'border-primary bg-primary/15' : 'border-default hover:bg-elevated'"
              :title="t(`element.${e}`)"
              @click="pickerElement = pickerElement === e ? null : e"
            >
              <img v-if="elementIcon(e)" :src="elementIcon(e)!" :alt="t(`element.${e}`)" class="size-4">
            </button>
          </div>

          <div class="grid max-h-96 grid-cols-4 gap-1 overflow-y-auto">
            <button
              v-for="char in pickerCharacters"
              :key="char.id"
              class="flex flex-col items-center gap-1 rounded-lg border p-1.5 text-center transition-all"
              :class="isSelected.has(char.id)
                ? 'border-primary bg-primary/10 ring-1 ring-primary/30'
                : 'border-default hover:border-primary/50'"
              :disabled="!isSelected.has(char.id) && filledCount >= 5"
              @click="toggleInPicker(char.id)"
            >
              <CharacterAvatar :character="char" size="sm" />
            </button>
          </div>
        </div>
      </template>
    </UModal>
  </div>
</template>
