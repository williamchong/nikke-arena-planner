<script setup lang="ts">
const { t } = useI18n()
const route = useRoute()
const roster = useRosterStore()
const { recommend5v5, recommend15v15, getTemplate } = useTeamRecommender()

const mode = computed(() => route.params.mode as string)
const is15v15 = computed(() => mode.value === '15v15')

const recommendations5v5 = computed(() => {
  if (is15v15.value) return []
  return recommend5v5(roster.ownedIds, 'defense')
})

const recommendations15v15 = computed(() => {
  if (!is15v15.value) return []
  return recommend15v15(roster.ownedIds, 'defense')
})

const tabs = [
  { label: t('recommend.mode5v5'), to: '/recommend/5v5' },
  { label: t('recommend.mode15v15'), to: '/recommend/15v15' },
]

const hasEnoughCharacters = computed(() => {
  if (is15v15.value) return roster.ownedCount >= 15
  return roster.ownedCount >= 5
})
</script>

<template>
  <div class="flex flex-col gap-6">
    <h1 class="text-2xl font-bold">
      {{ t('recommend.title') }}
    </h1>

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

    <template v-if="!hasEnoughCharacters">
      <div class="rounded-lg bg-warning/10 p-6 text-center">
        <p class="text-sm text-warning">
          {{ t('recommend.noTeams') }}
        </p>
        <UButton
          :label="t('nav.roster')"
          to="/"
          class="mt-3"
          size="sm"
          variant="outline"
        />
      </div>
    </template>

    <!-- 5v5 Mode -->
    <template v-else-if="!is15v15">
      <div v-if="recommendations5v5.length === 0" class="py-8 text-center text-muted">
        {{ t('recommend.noTeams') }}
      </div>
      <TeamRecommendation
        v-for="(team, i) in recommendations5v5"
        :key="team.id"
        :team="team"
        :template="team.templateId ? getTemplate(team.templateId) : undefined"
        :label="`#${i + 1}`"
      />
    </template>

    <!-- 15v15 Mode -->
    <template v-else>
      <div v-if="recommendations15v15.length === 0" class="py-8 text-center text-muted">
        {{ t('recommend.noTeams') }}
      </div>
      <div
        v-for="(teamSet, setIdx) in recommendations15v15"
        :key="setIdx"
        class="flex flex-col gap-3 rounded-xl border border-default p-4"
      >
        <h3 class="text-sm font-bold">
          Option {{ setIdx + 1 }}
        </h3>
        <TeamRecommendation
          v-for="(team, teamIdx) in teamSet"
          :key="team.id"
          :team="team"
          :template="team.templateId ? getTemplate(team.templateId) : undefined"
          :label="t('recommend.team', { n: teamIdx + 1 })"
        />
      </div>
    </template>
  </div>
</template>
