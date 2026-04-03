<script setup lang="ts">
import type { BurstType, Element, Manufacturer, Role, WeaponType } from '~/types/character'

const { t } = useI18n()
const { burstIcon, roleIcon, weaponIcon, elementIcon, manufacturerIcon } = useIcons()

const search = defineModel<string>('search', { default: '' })
const burst = defineModel<BurstType | null>('burst', { default: null })
const role = defineModel<Role | null>('role', { default: null })
const element = defineModel<Element | null>('element', { default: null })
const weapon = defineModel<WeaponType | null>('weapon', { default: null })
const manufacturer = defineModel<Manufacturer | null>('manufacturer', { default: null })

const burstOptions = [
  { label: 'All', value: null, activeColor: 'primary' as const },
  { label: 'B I', value: 'I' as const, activeColor: 'info' as const },
  { label: 'B II', value: 'II' as const, activeColor: 'warning' as const },
  { label: 'B III', value: 'III' as const, activeColor: 'error' as const },
  { label: 'Λ', value: 'Λ' as const, activeColor: 'success' as const },
]

const elementColorMap: Record<string, string> = {
  fire: 'error',
  water: 'info',
  wind: 'success',
  electric: 'violet',
  iron: 'warning',
}

const roleOptions = computed(() => [
  { label: t('role.attacker'), value: 'attacker' as const },
  { label: t('role.supporter'), value: 'supporter' as const },
  { label: t('role.defender'), value: 'defender' as const },
])

const weaponOptions = [
  { label: 'AR', value: 'AR' as const },
  { label: 'SMG', value: 'SMG' as const },
  { label: 'SG', value: 'SG' as const },
  { label: 'SR', value: 'SR' as const },
  { label: 'RL', value: 'RL' as const },
  { label: 'MG', value: 'MG' as const },
]

const elementOptions = computed(() => [
  { label: t('element.fire'), value: 'fire' as const },
  { label: t('element.water'), value: 'water' as const },
  { label: t('element.wind'), value: 'wind' as const },
  { label: t('element.electric'), value: 'electric' as const },
  { label: t('element.iron'), value: 'iron' as const },
])

const manufacturerOptions = computed(() => [
  { label: t('manufacturer.elysion'), value: 'elysion' as const },
  { label: t('manufacturer.missilis'), value: 'missilis' as const },
  { label: t('manufacturer.tetra'), value: 'tetra' as const },
  { label: t('manufacturer.pilgrim'), value: 'pilgrim' as const },
  { label: t('manufacturer.abnormal'), value: 'abnormal' as const },
])

function clearFilters() {
  search.value = ''
  burst.value = null
  role.value = null
  element.value = null
  weapon.value = null
  manufacturer.value = null
}

const hasFilters = computed(() =>
  search.value || burst.value || role.value || element.value || weapon.value || manufacturer.value,
)
</script>

<template>
  <div class="flex flex-col gap-3">
    <UInput
      v-model="search"
      :placeholder="t('roster.search')"
      icon="i-lucide-search"
      size="lg"
    />

    <div class="flex flex-wrap items-center gap-2">
      <div class="flex gap-1">
        <UButton
          v-for="opt in burstOptions"
          :key="String(opt.value)"
          size="xs"
          :variant="burst === opt.value ? 'solid' : 'outline'"
          :color="burst === opt.value ? (opt.activeColor as any) : 'neutral'"
          @click="burst = burst === opt.value ? null : opt.value"
        >
          <img v-if="opt.value && burstIcon(opt.value)" :src="burstIcon(opt.value)!" :alt="opt.label" :title="opt.label" class="size-4">
          {{ opt.label }}
        </UButton>
      </div>

      <USeparator orientation="vertical" class="h-6" />

      <div class="flex gap-1">
        <UButton
          v-for="opt in roleOptions"
          :key="opt.value"
          size="xs"
          :variant="role === opt.value ? 'solid' : 'outline'"
          :color="role === opt.value ? 'primary' : 'neutral'"
          @click="role = role === opt.value ? null : opt.value"
        >
          <img v-if="roleIcon(opt.value)" :src="roleIcon(opt.value)!" :alt="opt.label" :title="opt.label" class="size-4">
          {{ opt.label }}
        </UButton>
      </div>

      <USeparator orientation="vertical" class="h-6" />

      <div class="flex gap-1">
        <UButton
          v-for="opt in weaponOptions"
          :key="opt.value"
          size="xs"
          :variant="weapon === opt.value ? 'solid' : 'outline'"
          :color="weapon === opt.value ? 'primary' : 'neutral'"
          @click="weapon = weapon === opt.value ? null : opt.value"
        >
          <img v-if="weaponIcon(opt.value)" :src="weaponIcon(opt.value)!" :alt="opt.label" :title="opt.label" class="size-4">
          {{ opt.label }}
        </UButton>
      </div>

      <USeparator orientation="vertical" class="h-6" />

      <div class="flex gap-1">
        <UButton
          v-for="opt in elementOptions"
          :key="opt.value"
          size="xs"
          :variant="element === opt.value ? 'solid' : 'outline'"
          :color="element === opt.value ? (elementColorMap[opt.value] as any) : 'neutral'"
          @click="element = element === opt.value ? null : opt.value"
        >
          <img v-if="elementIcon(opt.value)" :src="elementIcon(opt.value)!" :alt="opt.label" :title="opt.label" class="size-4">
          {{ opt.label }}
        </UButton>
      </div>

      <USeparator orientation="vertical" class="h-6" />

      <div class="flex gap-1">
        <UButton
          v-for="opt in manufacturerOptions"
          :key="opt.value"
          size="xs"
          :variant="manufacturer === opt.value ? 'solid' : 'outline'"
          :color="manufacturer === opt.value ? 'primary' : 'neutral'"
          @click="manufacturer = manufacturer === opt.value ? null : opt.value"
        >
          <img v-if="manufacturerIcon(opt.value)" :src="manufacturerIcon(opt.value)!" :alt="opt.label" :title="opt.label" class="size-4">
          {{ opt.label }}
        </UButton>
      </div>

      <UButton
        v-if="hasFilters"
        icon="i-lucide-x"
        label="Clear"
        size="xs"
        color="neutral"
        variant="ghost"
        @click="clearFilters"
      />
    </div>
  </div>
</template>
