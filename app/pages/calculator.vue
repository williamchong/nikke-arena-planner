<script setup lang="ts">
import type { ArenaMode, BurstType, Character, Element, WeaponType } from '~/types/character'

const { t } = useI18n()
const roster = useRosterStore()
const { getCharacter, filterCharacters } = useCharacters()
const { calculate } = useBurstCalculator()
const { burstIcon, weaponIcon, elementIcon } = useIcons()

const mode = ref<ArenaMode>('attack')
const selectedIds = ref<string[]>([])
const showPicker = ref(false)
const pickerSlot = ref(0)

const pickerSearch = ref('')
const pickerBurst = ref<BurstType | null>(null)
const pickerWeapon = ref<WeaponType | null>(null)
const pickerElement = ref<Element | null>(null)

const selectedCharacters = computed(() =>
  selectedIds.value.map(id => getCharacter(id)).filter((c): c is Character => !!c),
)

const result = computed(() => {
  if (selectedCharacters.value.length !== 5) return null
  return calculate(selectedCharacters.value, mode.value)
})

const pickerCharacters = computed(() => {
  const used = new Set(selectedIds.value)
  const chars = filterCharacters({
    search: pickerSearch.value,
    burst: pickerBurst.value,
    weapon: pickerWeapon.value,
    element: pickerElement.value,
  }).filter(c => !used.has(c.id))

  // Sort owned first, then newest first
  return [...chars].sort((a, b) => {
    const aOwned = roster.isOwned(a.id) ? 0 : 1
    const bOwned = roster.isOwned(b.id) ? 0 : 1
    if (aOwned !== bOwned) return aOwned - bOwned
    return (b.releaseOrder ?? 0) - (a.releaseOrder ?? 0)
  })
})

function openPicker(slot: number) {
  pickerSlot.value = slot
  pickerSearch.value = ''
  pickerBurst.value = null
  pickerWeapon.value = null
  pickerElement.value = null
  showPicker.value = true
}

function pickCharacter(char: Character) {
  const next = [...selectedIds.value]
  if (pickerSlot.value < next.length) {
    next[pickerSlot.value] = char.id
  }
  else {
    next.push(char.id)
  }
  selectedIds.value = next
  showPicker.value = false
}

function removeCharacter(index: number) {
  selectedIds.value = selectedIds.value.filter((_, i) => i !== index)
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
      <!-- Left: Character Picker -->
      <div class="flex flex-col gap-4">
        <p class="text-sm text-muted">
          {{ t('calculator.selectCharacters') }}
        </p>

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
            :character="selectedCharacters[i - 1] ?? null"
            :position="i"
            :removable="!!selectedCharacters[i - 1]"
            @click="openPicker(i - 1)"
            @remove="removeCharacter(i - 1)"
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
                <div class="text-lg font-bold">
                  {{ result.timings.b1.toFixed(2) }}s
                </div>
                <div class="text-xs text-muted">
                  B1
                </div>
              </div>
              <div class="text-center">
                <div class="text-lg font-bold">
                  {{ result.timings.b2.toFixed(2) }}s
                </div>
                <div class="text-xs text-muted">
                  B2
                </div>
              </div>
              <div class="text-center">
                <div class="text-lg font-bold">
                  {{ result.timings.b3.toFixed(2) }}s
                </div>
                <div class="text-xs text-muted">
                  Full Burst
                </div>
              </div>
            </div>
          </div>
        </template>

        <div v-else class="flex h-full items-center justify-center text-sm text-muted">
          {{ t('calculator.selectCharacters') }}
        </div>
      </div>
    </div>

    <!-- Character Picker Modal -->
    <UModal v-model:open="showPicker">
      <template #content>
        <div class="flex flex-col gap-3 p-4">
          <h3 class="font-semibold">
            Select Character for P{{ pickerSlot + 1 }}
          </h3>

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
            <CharacterCard
              v-for="char in pickerCharacters"
              :key="char.id"
              :character="char"
              :owned="roster.isOwned(char.id)"
              @toggle="pickCharacter(char)"
            />
          </div>
        </div>
      </template>
    </UModal>
  </div>
</template>
