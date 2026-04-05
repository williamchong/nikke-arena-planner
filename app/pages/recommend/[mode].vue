<script setup lang="ts">
const { t } = useI18n()
const route = useRoute()
const localePath = useLocalePath()

const roster = useRosterStore()
const { recommend5v5, recommend15v15, getTemplate } = useTeamRecommender()

const mode = computed(() => route.params.mode as string)

useSeoMeta({
  title: () => t('recommend.title'),
})
const is15v15 = computed(() => mode.value === '15v15')

const recommendations5v5 = computed(() => {
  if (is15v15.value) return []
  return recommend5v5(roster.ownedIds, 'defense')
})

const recommendations15v15 = ref<ReturnType<typeof recommend15v15>>([])
const isOptimizing = ref(false)

watch(
  [is15v15, () => roster.ownedIds],
  ([active]) => {
    if (!active) { recommendations15v15.value = []; return }
    isOptimizing.value = true
    // Defer so the browser can paint the loading state before the heavy SA computation
    setTimeout(() => {
      recommendations15v15.value = recommend15v15(roster.ownedIds, 'defense')
      isOptimizing.value = false
    }, 50)
  },
  { immediate: true },
)

const tabs = computed(() => [
  { label: t('recommend.mode5v5'), to: localePath('/recommend/5v5') },
  { label: t('recommend.mode15v15'), to: localePath('/recommend/15v15') },
])

const hasEnoughCharacters = computed(() => {
  if (is15v15.value) return roster.ownedCount >= 15
  return roster.ownedCount >= 5
})

const minRequired = computed(() => is15v15.value ? 15 : 5)

const showRosterPicker = ref(false)
</script>

<template>
  <div class="flex flex-col gap-6">
    <div class="flex items-center justify-between">
      <h1 class="text-2xl font-bold">
        {{ t('recommend.title') }}
      </h1>
      <UBadge color="primary" variant="subtle">
        {{ t('roster.owned', { count: roster.ownedCount, total: 186 }) }}
      </UBadge>
    </div>

    <div class="flex gap-2">
      <UButton
        v-for="tab in tabs"
        :key="tab.to"
        :to="tab.to"
        :label="tab.label"
        :variant="route.path === tab.to ? 'solid' : 'outline'"
        :color="route.path === tab.to ? 'primary' : 'neutral'"
        size="sm"
      />
    </div>

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

    <!-- 5v5 Mode -->
    <template v-else-if="!is15v15">
      <div class="flex items-center justify-between">
        <p class="text-sm text-muted">
          {{ t('recommend.showingResults', { count: recommendations5v5.length }) }}
        </p>
        <UButton
          :label="t('recommend.editRoster')"
          icon="i-lucide-pencil"
          size="xs"
          variant="ghost"
          color="neutral"
          @click="showRosterPicker = !showRosterPicker"
        />
      </div>

      <div v-if="showRosterPicker" class="rounded-lg border border-default p-4">
        <CharacterGrid />
      </div>

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
      />
    </template>

    <!-- 15v15 Mode -->
    <template v-else>
      <div class="flex items-center justify-between">
        <p class="text-sm text-muted">
          {{ t('recommend.showingResults', { count: recommendations15v15.length }) }}
        </p>
        <UButton
          :label="t('recommend.editRoster')"
          icon="i-lucide-pencil"
          size="xs"
          variant="ghost"
          color="neutral"
          @click="showRosterPicker = !showRosterPicker"
        />
      </div>

      <div v-if="showRosterPicker" class="rounded-lg border border-default p-4">
        <CharacterGrid />
      </div>

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
        />
      </div>
    </template>
  </div>
</template>
