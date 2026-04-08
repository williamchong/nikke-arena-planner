<script setup lang="ts">
import type { BurstType, Character, Element, Manufacturer, Role, WeaponType } from '~/types/character'

const { t } = useI18n()
const roster = useRosterStore()
const { filterCharacters, getAllCharacters } = useCharacters()
const totalCount = getAllCharacters().length

const search = ref('')
const burst = ref<BurstType | null>(null)
const role = ref<Role | null>(null)
const element = ref<Element | null>(null)
const weapon = ref<WeaponType | null>(null)
const manufacturer = ref<Manufacturer | null>(null)

// Snapshot of owned IDs at mount time + when filters change — prevents re-sorting on every toggle
const ownedSnapshot = ref(new Set(roster.ownedIds))

watch([search, burst, role, element, weapon, manufacturer], () => {
  ownedSnapshot.value = new Set(roster.ownedIds)
})

const filtered = computed(() => {
  // Track ownedIds to re-render cards (highlight state), but sort uses snapshot
  void roster.ownedIds

  const chars = filterCharacters({
    search: search.value,
    burst: burst.value,
    role: role.value,
    element: element.value,
    weapon: weapon.value,
    manufacturer: manufacturer.value,
  })

  const snap = ownedSnapshot.value

  // Pair-level ownership and release order so normal + treasure stay adjacent
  // and the whole pair moves into the owned section when either is owned.
  const groupInfo = new Map<string, { owned: boolean, releaseOrder: number }>()
  for (const c of chars) {
    const base = baseId(c.id)
    const rel = c.releaseOrder ?? 0
    const isOwned = snap.has(c.id)
    const existing = groupInfo.get(base)
    if (!existing) {
      groupInfo.set(base, { owned: isOwned, releaseOrder: rel })
    }
    else {
      if (isOwned) existing.owned = true
      if (rel > existing.releaseOrder) existing.releaseOrder = rel
    }
  }

  return [...chars].sort((a: Character, b: Character) => {
    const aBase = baseId(a.id)
    const bBase = baseId(b.id)

    if (aBase !== bBase) {
      const aInfo = groupInfo.get(aBase)!
      const bInfo = groupInfo.get(bBase)!
      const aOwned = aInfo.owned ? 0 : 1
      const bOwned = bInfo.owned ? 0 : 1
      if (aOwned !== bOwned) return aOwned - bOwned
      return bInfo.releaseOrder - aInfo.releaseOrder
    }

    const aTreasure = a.id.endsWith(TREASURE_SUFFIX) ? 1 : 0
    const bTreasure = b.id.endsWith(TREASURE_SUFFIX) ? 1 : 0
    return aTreasure - bTreasure
  })
})

function handleSelectAll() {
  roster.selectAll(filtered.value.map(c => c.id))
}
</script>

<template>
  <div class="flex flex-col gap-4">
    <div class="flex flex-wrap items-center justify-between gap-2">
      <h2 class="text-lg font-semibold">
        {{ t('roster.title') }}
      </h2>
      <div class="flex flex-wrap items-center gap-2">
        <UBadge color="primary" variant="subtle">
          {{ t('roster.owned', { count: roster.ownedCount, total: totalCount }) }}
        </UBadge>
        <UButton
          :label="t('roster.selectAll')"
          size="xs"
          variant="outline"
          color="neutral"
          @click="handleSelectAll"
        />
        <UButton
          :label="t('roster.clearAll')"
          size="xs"
          variant="ghost"
          color="error"
          @click="roster.clearAll()"
        />
      </div>
    </div>

    <CharacterFilters
      v-model:search="search"
      v-model:burst="burst"
      v-model:role="role"
      v-model:element="element"
      v-model:weapon="weapon"
      v-model:manufacturer="manufacturer"
    />

    <div class="grid grid-cols-[repeat(auto-fill,minmax(90px,1fr))] gap-2">
      <CharacterCard
        v-for="char in filtered"
        :key="char.id"
        :character="char"
        :owned="roster.isOwned(char.id)"
        @toggle="roster.toggle"
      />
    </div>

    <p v-if="filtered.length === 0" class="py-8 text-center text-muted">
      No characters match your filters.
    </p>
  </div>
</template>
