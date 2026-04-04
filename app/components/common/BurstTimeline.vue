<script setup lang="ts">
import type { ArenaMode, Character } from '~/types/character'

const props = defineProps<{
  characters: Character[]
  mode: ArenaMode
}>()

const { calculate } = useBurstCalculator()
const { localize } = useLocalizedField()

const burstResult = computed(() => {
  if (props.characters.length !== 5) return null
  return calculate(props.characters, props.mode)
})

// Determine which character fires each burst stage based on position order
// In NIKKE, lowest position number with the needed burst type fires first
const burstOrder = computed(() => {
  if (props.characters.length !== 5) return null
  const chars = props.characters.map((c, i) => ({ char: c, pos: i + 1 }))

  function findBurster(burstType: 'I' | 'II' | 'III', exclude: Set<number>) {
    const candidates = chars.filter(c =>
      !exclude.has(c.pos) && (c.char.burst === burstType || c.char.burst === 'Λ'),
    )
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
  if (!burstResult.value?.valid) return null
  const { b1, b2, b3 } = burstResult.value.timings
  const max = b3
  const order = burstOrder.value
  return {
    charge: { width: (b1 / max) * 100, char: order?.b1?.char },
    b1ToB2: { width: ((b2 - b1) / max) * 100, char: order?.b2?.char },
    b2ToB3: { width: ((b3 - b2) / max) * 100, char: order?.b3?.char },
  }
})
</script>

<template>
  <div v-if="timelineSegments && burstResult" class="space-y-1">
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
    <div class="flex items-center gap-3 text-xs">
      <span class="text-info">{{ burstResult.timings.b1.toFixed(2) }}s</span>
      <span class="text-muted">→</span>
      <span class="text-warning">{{ burstResult.timings.b2.toFixed(2) }}s</span>
      <span class="text-muted">→</span>
      <span class="text-error">{{ burstResult.timings.b3.toFixed(2) }}s Full Burst</span>
    </div>
  </div>
</template>
