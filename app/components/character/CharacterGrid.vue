<script setup lang="ts">
import type { BurstType, Element, Manufacturer, Role, WeaponType } from '~/types/character'

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

const filtered = computed(() =>
  filterCharacters({
    search: search.value,
    burst: burst.value,
    role: role.value,
    element: element.value,
    weapon: weapon.value,
    manufacturer: manufacturer.value,
  }),
)

function handleSelectAll() {
  roster.selectAll(filtered.value.map(c => c.id))
}
</script>

<template>
  <div class="flex flex-col gap-4">
    <div class="flex items-center justify-between">
      <h2 class="text-lg font-semibold">
        {{ t('roster.title') }}
      </h2>
      <div class="flex items-center gap-2">
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
