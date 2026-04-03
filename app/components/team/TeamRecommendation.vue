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

const characters = computed(() =>
  props.team.characters.map(id => getCharacter(id)).filter((c): c is Character => !!c),
)

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

const showDetails = ref(false)
</script>

<template>
  <div class="rounded-lg border border-default p-4">
    <div class="mb-3 flex flex-wrap items-center gap-2">
      <span v-if="label" class="text-sm font-bold">{{ label }}</span>
      <UBadge v-if="templateName" color="primary" variant="subtle" size="xs">
        {{ templateName }}
      </UBadge>
      <CommonSpeedTierBadge :tier="team.burstSpeed" />
      <span v-if="burstResult" class="text-xs text-muted">
        {{ burstResult.timings.total.toFixed(2) }}s {{ t('calculator.timing') }}
      </span>
    </div>

    <div class="flex flex-wrap gap-2">
      <TeamSlot
        v-for="(char, i) in characters"
        :key="char.id"
        :character="char"
        :position="i + 1"
      />
    </div>

    <!-- Expandable details -->
    <div class="mt-3 flex flex-wrap gap-3">
      <button
        class="text-xs text-muted hover:text-default"
        @click="showDetails = !showDetails"
      >
        {{ showDetails ? '▼' : '▶' }} {{ t('recommend.details') }}
      </button>
    </div>

    <div v-if="showDetails" class="mt-3 space-y-2">
      <!-- Burst timing breakdown -->
      <div v-if="burstResult" class="flex gap-4 text-xs">
        <div class="text-center">
          <div class="font-bold">{{ burstResult.timings.b1.toFixed(2) }}s</div>
          <div class="text-muted">B1</div>
        </div>
        <div class="text-center">
          <div class="font-bold">{{ burstResult.timings.b2.toFixed(2) }}s</div>
          <div class="text-muted">B2</div>
        </div>
        <div class="text-center">
          <div class="font-bold">{{ burstResult.timings.b3.toFixed(2) }}s</div>
          <div class="text-muted">Full Burst</div>
        </div>
        <div class="ml-auto text-right">
          <div class="font-bold">{{ team.score }}</div>
          <div class="text-muted">{{ t('recommend.score') }}</div>
        </div>
      </div>

      <!-- Burst gen bar at 3RL -->
      <div v-if="burstResult" class="flex items-center gap-2 text-xs">
        <span class="w-16 text-muted">3RL gen:</span>
        <div class="flex-1">
          <div class="h-3 overflow-hidden rounded-full bg-muted/20">
            <div
              class="h-full rounded-full transition-all"
              :class="burstResult.totalBurstGen['3RL'] >= 1.0 ? 'bg-success' : 'bg-primary'"
              :style="{ width: `${Math.min(burstResult.totalBurstGen['3RL'] * 100, 100)}%` }"
            />
          </div>
        </div>
        <span class="w-12 text-right font-mono">{{ burstResult.totalBurstGen['3RL'].toFixed(3) }}</span>
      </div>

      <!-- Template notes -->
      <p v-if="templateNotes" class="text-xs text-muted">
        {{ templateNotes }}
      </p>
    </div>
  </div>
</template>
