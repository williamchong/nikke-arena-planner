<script setup lang="ts">
import type { ArenaMode, BurstType, Character, Element, WeaponType } from '~/types/character'
import { scoreTeamRaw } from '~/composables/useSimulatedAnnealing'

const { t } = useI18n()

useSeoMeta({
  title: () => t('calculator.title'),
})

const roster = useRosterStore()
const { getCharacter, filterCharacters } = useCharacters()
const { calculate } = useBurstCalculator()
const { burstIcon, weaponIcon, elementIcon } = useIcons()

const mode = ref<ArenaMode>('attack')
// Fixed 5 slots — null means empty, positions are stable
const slots = ref<(string | null)[]>([null, null, null, null, null])

// Load from localStorage only on client after mount
if (import.meta.client) {
  onMounted(() => {
    try {
      const saved = localStorage.getItem('nikke-arena-calc')
      if (saved) {
        const data = JSON.parse(saved)
        if (data.mode) mode.value = data.mode
        if (data.slots) slots.value = data.slots
      }
    }
    catch { /* ignore corrupt localStorage */ }
  })

  watch([mode, slots], () => {
    localStorage.setItem('nikke-arena-calc', JSON.stringify({
      mode: mode.value,
      slots: slots.value,
    }))
  }, { deep: true })
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
  if (filledCharacters.value.length !== 5) return null
  return scoreTeamRaw(filledCharacters.value, mode.value)
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
}

function clearAll() {
  slots.value = [null, null, null, null, null]
}

const modeOptions = [
  { label: t('calculator.attack'), value: 'attack' as const },
  { label: t('calculator.defense'), value: 'defense' as const },
]

const burstFilters: { label: string, value: BurstType }[] = [
  { label: 'I', value: 'I' },
  { label: 'II', value: 'II' },
  { label: 'III', value: 'III' },
]

const weaponFilters: WeaponType[] = ['AR', 'SMG', 'SG', 'SR', 'RL', 'MG']
const elementFilters: Element[] = ['fire', 'water', 'wind', 'electric', 'iron']

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
            @click="openPicker"
            @remove="removeCharacter(i - 1)"
          />
        </div>

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

      <!-- Right: Results -->
      <div class="flex flex-col gap-4">
        <template v-if="result">
          <div v-if="!result.valid" class="rounded-lg bg-error/10 p-3 text-sm text-error">
            {{ t('calculator.invalidChain') }}
            <span v-if="result.missingBurstTypes">
              ({{ result.missingBurstTypes.map(b => `B${b}`).join(', ') }})
            </span>
          </div>

          <div class="flex items-center gap-3">
            <span class="text-sm font-medium">{{ t('calculator.speed') }}:</span>
            <CommonSpeedTierBadge :tier="result.effectiveTier" />
          </div>

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

          <div class="rounded-lg border border-default p-4">
            <h3 class="mb-3 text-sm font-medium">
              {{ t('calculator.timing') }}
            </h3>
            <div class="flex gap-4 text-sm">
              <div class="text-center">
                <div class="text-lg font-bold">{{ result.timings.b1.toFixed(2) }}s</div>
                <div class="text-xs text-muted">B1</div>
              </div>
              <div class="text-center">
                <div class="text-lg font-bold">{{ result.timings.b2.toFixed(2) }}s</div>
                <div class="text-xs text-muted">B2</div>
              </div>
              <div class="text-center">
                <div class="text-lg font-bold">{{ result.timings.b3.toFixed(2) }}s</div>
                <div class="text-xs text-muted">Full Burst</div>
              </div>
              <div v-if="teamScore !== null" class="ml-auto text-center">
                <div class="text-lg font-bold">{{ teamScore }}</div>
                <div class="text-xs text-muted">{{ t('recommend.score') }}</div>
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
              v-for="b in burstFilters"
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
              v-for="w in weaponFilters"
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
              v-for="e in elementFilters"
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
