<script setup lang="ts">
import type { BurstType, Element, WeaponType } from '~/types/character'
import { watchDebounced } from '@vueuse/core'

const { t } = useI18n()
const route = useRoute()
const localePath = useLocalePath()

const roster = useRosterStore()
const { trackEvent } = useAnalytics()
const { recommend5v5, recommend15v15, getTemplate } = useTeamRecommender()
const { getCharacter, filterCharacters } = useCharacters()
const { burstIcon, weaponIcon, elementIcon } = useIcons()

const mode = computed(() => route.params.mode as string)
const is15v15 = computed(() => mode.value === '15v15')

const modes = computed(() => ({
  '5v5': { label: t('recommend.mode5v5'), desc: t('recommend.mode5v5Desc'), icon: 'i-lucide-swords', to: localePath('/recommend/5v5') },
  '15v15': { label: t('recommend.mode15v15'), desc: t('recommend.mode15v15Desc'), icon: 'i-lucide-layers-3', to: localePath('/recommend/15v15') },
}))
const currentMode = computed(() => modes.value[mode.value as '5v5' | '15v15'] ?? modes.value['5v5'])

useSeoMeta({
  title: () => `${currentMode.value.label} — ${t('recommend.title')}`,
})

// --- Lock slots: team-formation style ---
const TEAM_SIZE = 5
const emptyTeam = (): (string | null)[] => Array.from({ length: TEAM_SIZE }, () => null)

// lockSlots[teamIdx][slotIdx] = characterId | null
const lockSlots = ref<(string | null)[][]>([emptyTeam()])

// Adjust number of team rows when switching modes
watch(is15v15, (v) => {
  if (v && lockSlots.value.length < 3) {
    lockSlots.value = [...lockSlots.value, ...Array.from({ length: 3 - lockSlots.value.length }, emptyTeam)]
  }
  else if (!v && lockSlots.value.length > 1) {
    lockSlots.value = [lockSlots.value[0] ?? emptyTeam()]
  }
}, { immediate: true })

// Persist to localStorage
if (import.meta.client) {
  onMounted(() => {
    try {
      const saved = localStorage.getItem('nikke-arena-locked')
      if (saved) {
        const parsed = JSON.parse(saved)
        if (Array.isArray(parsed) && Array.isArray(parsed[0])) {
          lockSlots.value = parsed
        }
      }
    }
    catch { /* ignore */ }
    // Ensure team count matches current mode after restoring from localStorage
    if (is15v15.value && lockSlots.value.length < 3) {
      lockSlots.value = [...lockSlots.value, ...Array.from({ length: 3 - lockSlots.value.length }, emptyTeam)]
    }
  })
  watch(lockSlots, (v) => {
    localStorage.setItem('nikke-arena-locked', JSON.stringify(v))
  })
}

// Derive locked character objects per team for display
const lockSlotCharacters = computed(() =>
  lockSlots.value.map(team =>
    team.map(id => id ? getCharacter(id) ?? null : null),
  ),
)

// All locked IDs across all teams (for filtering picker)
const allLockedIds = computed(() => {
  const ids = new Set<string>()
  for (const team of lockSlots.value) {
    for (const id of team) {
      if (id) ids.add(id)
    }
  }
  return ids
})

// Per-team locked sets for recommend15v15
const perTeamLocked = computed(() =>
  lockSlots.value.map(team => {
    const ids = team.filter((id): id is string => !!id)
    return new Set(ids)
  }),
)

// Flat locked set for recommend5v5 — reads team 0 directly to avoid cascade from 15v15 team changes
const lockedIds5v5 = computed(() => {
  const team0 = lockSlots.value[0]
  if (!team0) return undefined
  const ids = team0.filter((id): id is string => !!id)
  return ids.length > 0 ? new Set(ids) : undefined
})

const hasAnyLocks = computed(() => allLockedIds.value.size > 0)

function clearLocks() {
  lockSlots.value = is15v15.value
    ? [emptyTeam(), emptyTeam(), emptyTeam()]
    : [emptyTeam()]
  trackEvent('recommend_clear_locks')
}

function removeFromSlot(teamIdx: number, slotIdx: number) {
  const next = lockSlots.value.map(t => [...t])
  next[teamIdx]![slotIdx] = null
  lockSlots.value = next
}

// Picker modal state
const showPicker = ref(false)
const pickerTeamIdx = ref(0)
const pickerSearch = ref('')
const pickerBurst = ref<BurstType | null>(null)
const pickerWeapon = ref<WeaponType | null>(null)
const pickerElement = ref<Element | null>(null)

const pickerCharacters = computed(() => {
  const chars = filterCharacters({
    search: pickerSearch.value,
    burst: pickerBurst.value,
    weapon: pickerWeapon.value,
    element: pickerElement.value,
  }).filter(c => roster.isOwned(c.id))

  const locked = allLockedIds.value
  return [...chars].sort((a, b) => {
    const aL = locked.has(a.id) ? 0 : 1
    const bL = locked.has(b.id) ? 0 : 1
    if (aL !== bL) return aL - bL
    return (b.releaseOrder ?? 0) - (a.releaseOrder ?? 0)
  })
})

function openPicker(teamIdx: number) {
  pickerTeamIdx.value = teamIdx
  pickerSearch.value = ''
  pickerBurst.value = null
  pickerWeapon.value = null
  pickerElement.value = null
  showPicker.value = true
}

function toggleInPicker(id: string) {
  const teamIdx = pickerTeamIdx.value
  const team = lockSlots.value[teamIdx]
  if (!team) return

  const next = lockSlots.value.map(t => [...t])
  const currentTeam = next[teamIdx]!

  // If already in this team, remove it
  const existingIdx = currentTeam.indexOf(id)
  if (existingIdx !== -1) {
    currentTeam[existingIdx] = null
  }
  else {
    trackEvent('recommend_lock')
    // If in another team, remove from there first
    for (const t of next) {
      const idx = t.indexOf(id)
      if (idx !== -1) t[idx] = null
    }
    // Place in first empty slot of target team
    const emptyIdx = currentTeam.indexOf(null)
    if (emptyIdx === -1) return
    currentTeam[emptyIdx] = id
    // Auto-close when team is full
    if (!currentTeam.includes(null)) showPicker.value = false
  }
  lockSlots.value = next
}

// Which IDs are in the currently-being-edited team (for picker highlighting)
const pickerTeamIds = computed(() =>
  new Set(lockSlots.value[pickerTeamIdx.value]?.filter((id): id is string => !!id) ?? []),
)

// --- Recommendations ---
const recommendations5v5 = computed(() => {
  if (is15v15.value) return []
  return recommend5v5(roster.ownedIds, 'defense', lockedIds5v5.value)
})

watchDebounced(recommendations5v5, (result) => {
  if (result.length > 0) trackEvent('recommend_5v5')
}, { debounce: 500 })

const recommendations15v15 = ref<ReturnType<typeof recommend15v15>>([])
const isOptimizing = ref(false)
let pendingTimeout: ReturnType<typeof setTimeout> | null = null

watch(
  [is15v15, () => roster.ownedIds, lockSlots],
  ([active]) => {
    if (pendingTimeout !== null) { clearTimeout(pendingTimeout); pendingTimeout = null }
    if (!active) { recommendations15v15.value = []; isOptimizing.value = false; return }
    isOptimizing.value = true
    pendingTimeout = setTimeout(() => {
      pendingTimeout = null
      const teamLocks = perTeamLocked.value
      const hasLocks = teamLocks.some(s => s.size > 0)
      const start = performance.now()
      recommendations15v15.value = recommend15v15(
        roster.ownedIds, 'defense',
        hasLocks ? teamLocks : undefined,
      )
      if (recommendations15v15.value.length > 0) {
        trackEvent('recommend_15v15', { value: Math.round(performance.now() - start) })
      }
      isOptimizing.value = false
    }, 50)
  },
  { immediate: true },
)

const tabs = computed(() => Object.values(modes.value))

const hasEnoughCharacters = computed(() => {
  if (is15v15.value) return roster.ownedCount >= 15
  return roster.ownedCount >= 5
})

const minRequired = computed(() => is15v15.value ? 15 : 5)

const showLockUI = ref(false)
const showRosterPicker = ref(false)

const resultCount = computed(() =>
  is15v15.value ? recommendations15v15.value.length : recommendations5v5.value.length,
)
</script>

<template>
  <div class="flex flex-col gap-4 sm:gap-6">
    <div class="grid grid-cols-2 gap-2">
      <UButton
        v-for="tab in tabs"
        :key="tab.to"
        :to="tab.to"
        :label="tab.label"
        :icon="tab.icon"
        :variant="route.path === tab.to ? 'solid' : 'outline'"
        :color="route.path === tab.to ? 'primary' : 'neutral'"
        size="lg"
        block
      />
    </div>

    <div class="flex flex-wrap items-start justify-between gap-2">
      <div class="flex items-center gap-3">
        <div class="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <UIcon :name="currentMode.icon" class="size-6" />
        </div>
        <div>
          <h1 class="text-xl font-bold leading-tight sm:text-2xl">
            {{ currentMode.label }}
          </h1>
          <p class="text-xs text-muted sm:text-sm">
            {{ currentMode.desc }}
          </p>
        </div>
      </div>
      <UBadge color="primary" variant="subtle" class="shrink-0">
        {{ t('roster.owned', { count: roster.ownedCount, total: 186 }) }}
      </UBadge>
    </div>

    <!-- Character picker modal -->
    <UModal v-model:open="showPicker">
      <template #content>
        <div class="flex flex-col gap-3 p-4">
          <div class="flex items-center justify-between">
            <h3 class="font-semibold">
              {{ t('recommend.lockCharacters') }}
              <span v-if="is15v15" class="text-muted">
                — {{ t('recommend.team', { n: pickerTeamIdx + 1 }) }}
              </span>
            </h3>
          </div>

          <p class="text-xs text-muted">
            {{ t('recommend.lockDesc') }}
          </p>

          <!-- Preview of current team being edited -->
          <div class="flex gap-1.5">
            <TeamSlot
              v-for="(char, slotIdx) in lockSlotCharacters[pickerTeamIdx]"
              :key="slotIdx"
              :character="char"
              :position="slotIdx + 1"
              :removable="!!char"
              @remove="removeFromSlot(pickerTeamIdx, slotIdx)"
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
              :class="[
                pickerTeamIds.has(char.id)
                  ? 'border-warning bg-warning/10 ring-1 ring-warning/30'
                  : allLockedIds.has(char.id)
                    ? 'border-muted bg-muted/10 opacity-50'
                    : 'border-default hover:border-warning/50',
              ]"
              :disabled="allLockedIds.has(char.id) && !pickerTeamIds.has(char.id)"
              @click="toggleInPicker(char.id)"
            >
              <CharacterAvatar :character="char" size="sm" />
            </button>
          </div>
        </div>
      </template>
    </UModal>

    <!-- Not enough characters: guide to pick roster -->
    <template v-if="!hasEnoughCharacters">
      <div class="rounded-lg border-2 border-dashed border-primary/30 bg-primary/5 p-6">
        <div class="mb-4 text-center">
          <UIcon name="i-lucide-user-plus" class="mb-2 size-8 text-primary" />
          <h3 class="text-lg font-semibold">
            {{ t('recommend.pickRoster') }}
          </h3>
          <p class="mt-1 text-sm text-muted">
            {{ t('recommend.pickRosterDesc', { min: minRequired, current: roster.ownedCount }) }}
          </p>
        </div>

        <div class="flex justify-center gap-2">
          <UButton
            :label="t('recommend.selectHere')"
            icon="i-lucide-check-square"
            :variant="showRosterPicker ? 'solid' : 'outline'"
            @click="showRosterPicker = !showRosterPicker"
          />
          <UButton
            :label="t('nav.roster')"
            :to="localePath('/roster')"
            icon="i-lucide-external-link"
            variant="ghost"
            color="neutral"
          />
        </div>

        <div v-if="showRosterPicker" class="mt-4">
          <CharacterGrid />
        </div>
      </div>

      <!-- SEO landing content when no roster selected -->
      <div class="mt-8 space-y-6 text-sm leading-relaxed text-muted">
        <div>
          <h2 class="mb-2 text-lg font-semibold text-default">
            {{ t('landing.heading') }}
          </h2>
          <p>{{ t('landing.intro') }}</p>
        </div>

        <div>
          <h3 class="mb-1 font-semibold text-default">
            {{ t('landing.howItWorksTitle') }}
          </h3>
          <ol class="list-inside list-decimal space-y-1">
            <li>{{ t('landing.step1') }}</li>
            <li>{{ t('landing.step2') }}</li>
            <li>{{ t('landing.step3') }}</li>
          </ol>
        </div>

        <div>
          <h3 class="mb-1 font-semibold text-default">
            {{ t('landing.featuresTitle') }}
          </h3>
          <ul class="list-inside list-disc space-y-1">
            <li>{{ t('landing.feature1') }}</li>
            <li>{{ t('landing.feature2') }}</li>
            <li>{{ t('landing.feature3') }}</li>
            <li>{{ t('landing.feature4') }}</li>
            <li>{{ t('landing.feature5') }}</li>
          </ul>
        </div>

        <p class="text-xs text-muted">
          {{ t('landing.footer') }}<NuxtLink :to="`${localePath('/about')}#credits`" class="text-primary hover:underline">{{ t('landing.footerLink') }}</NuxtLink>{{ t('landing.footerEnd') }}
        </p>
      </div>
    </template>

    <!-- Shared controls for both modes -->
    <template v-if="hasEnoughCharacters">
      <div class="flex flex-wrap items-center justify-between gap-2">
        <p class="text-sm text-muted">
          {{ t('recommend.showingResults', { count: resultCount }) }}
        </p>
        <div class="flex flex-wrap gap-1">
          <UButton
            :label="t('recommend.lockCharacters')"
            icon="i-lucide-pin"
            size="xs"
            :variant="showLockUI || hasAnyLocks ? 'soft' : 'ghost'"
            :color="hasAnyLocks ? 'warning' : 'neutral'"
            @click="showLockUI = !showLockUI"
          />
          <UButton
            :label="t('recommend.editRoster')"
            icon="i-lucide-pencil"
            size="xs"
            variant="ghost"
            color="neutral"
            @click="showRosterPicker = !showRosterPicker"
          />
        </div>
      </div>

      <div v-if="showLockUI || hasAnyLocks" class="flex flex-col gap-3 rounded-lg border border-default p-3">
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-1.5">
            <UIcon name="i-lucide-pin" class="size-4 text-warning" />
            <span class="text-sm font-medium">{{ t('recommend.lockCharacters') }}</span>
          </div>
          <UButton
            v-if="hasAnyLocks"
            :label="t('recommend.clearLocks')"
            icon="i-lucide-x"
            size="xs"
            variant="ghost"
            color="neutral"
            @click="clearLocks"
          />
        </div>
        <p class="text-xs text-muted">
          {{ t('recommend.lockDesc') }}
        </p>
        <div
          v-for="(team, teamIdx) in lockSlotCharacters"
          :key="teamIdx"
          class="flex flex-col gap-1.5 sm:flex-row sm:items-center sm:gap-2"
        >
          <span v-if="is15v15" class="text-xs font-medium text-muted sm:w-10">
            {{ t('recommend.team', { n: teamIdx + 1 }) }}
          </span>
          <div class="flex gap-1.5 overflow-x-auto">
            <TeamSlot
              v-for="(char, slotIdx) in team"
              :key="slotIdx"
              :character="char"
              :position="slotIdx + 1"
              :removable="!!char"
              @click="openPicker(teamIdx)"
              @remove="removeFromSlot(teamIdx, slotIdx)"
            />
          </div>
        </div>
      </div>

      <div v-if="showRosterPicker" class="rounded-lg border border-default p-4">
        <CharacterGrid />
      </div>
    </template>

    <!-- 5v5 Mode -->
    <template v-if="hasEnoughCharacters && !is15v15">
      <div v-if="recommendations5v5.length === 0" class="py-8 text-center text-muted">
        {{ t('recommend.noTeams') }}
      </div>
      <TeamRecommendation
        v-for="(team, i) in recommendations5v5"
        :key="team.id"
        :team="team"
        :template="team.templateId ? getTemplate(team.templateId) : undefined"
        :label="`#${i + 1}`"
        mode="defense"
        :rating-context="{ team, arenaMode: '5v5' as const }"
      />
    </template>

    <!-- 15v15 Mode -->
    <template v-if="hasEnoughCharacters && is15v15">
      <div v-if="isOptimizing" class="flex flex-col items-center gap-3 py-12">
        <UIcon name="i-lucide-loader-2" class="size-6 animate-spin text-primary" />
        <p class="text-sm text-muted">
          {{ t('recommend.optimizing') }}
        </p>
      </div>
      <div v-else-if="recommendations15v15.length === 0" class="py-8 text-center text-muted">
        {{ t('recommend.noTeams') }}
      </div>
      <div
        v-for="(teamSet, setIdx) in recommendations15v15"
        :key="setIdx"
        class="flex flex-col gap-3 rounded-xl border border-default p-4"
      >
        <h3 class="text-sm font-bold">
          {{ t('recommend.option', { n: setIdx + 1 }) }}
        </h3>
        <TeamRecommendation
          v-for="(team, teamIdx) in teamSet"
          :key="team.id"
          :team="team"
          :template="team.templateId ? getTemplate(team.templateId) : undefined"
          :label="t('recommend.team', { n: teamIdx + 1 })"
          mode="defense"
          :rating-context="{ team, arenaMode: '15v15' as const, allTeams: recommendations15v15, teamSetIndex: setIdx, teamIndexInSet: teamIdx }"
        />
      </div>
    </template>
  </div>
</template>
