<script setup lang="ts">
const { t } = useI18n()

const tiers = [
  { name: '2RL', key: '2rl', time: '~2.5s' },
  { name: '5SG', key: '5sg', time: '~3.0s' },
  { name: '3RL', key: '3rl', time: '~3.5s' },
  { name: '7SG', key: '7sg', time: '~4.0s' },
  { name: '4RL', key: '4rl', time: '~4.5s' },
  { name: '5RL', key: '5rl', time: '~5.5s' },
]

useSeoMeta({
  title: () => t('about.title'),
  description: () => t('about.metaDescription'),
})

const faqItems = computed(() => [
  {
    q: t('about.whatTitle'),
    a: t('about.whatBody'),
  },
  {
    q: `What does 2RL mean in NIKKE PVP?`,
    a: t('about.tier_2rl'),
  },
  {
    q: `What does 3RL mean in NIKKE PVP?`,
    a: t('about.tier_3rl'),
  },
  {
    q: `What is a burst chain in NIKKE?`,
    a: t('about.termDesc_burstChain'),
  },
  {
    q: `What is burst generation in NIKKE PVP?`,
    a: t('about.termDesc_burstGen'),
  },
  {
    q: `What positions should I use in NIKKE Arena?`,
    a: t('about.termDesc_position'),
  },
  {
    q: `What is the CP penalty in NIKKE Arena?`,
    a: t('about.termDesc_cpPenalty'),
  },
  {
    q: `What is Lambda (Λ) burst in NIKKE?`,
    a: t('about.termDesc_lambda'),
  },
])

useHead({
  script: computed(() => [
    {
      type: 'application/ld+json',
      innerHTML: JSON.stringify({
        '@context': 'https://schema.org',
        '@type': 'FAQPage',
        'mainEntity': faqItems.value.map(item => ({
          '@type': 'Question',
          'name': item.q,
          'acceptedAnswer': {
            '@type': 'Answer',
            'text': item.a,
          },
        })),
      }),
    },
  ]),
})
</script>

<template>
  <div class="mx-auto max-w-3xl space-y-8">
    <h1 class="text-2xl font-bold">
      {{ t('about.title') }}
    </h1>

    <!-- What is this tool -->
    <section class="space-y-3">
      <h2 class="text-lg font-semibold">
        {{ t('about.whatTitle') }}
      </h2>
      <p class="text-sm leading-relaxed text-muted">
        {{ t('about.whatBody') }}
      </p>
    </section>

    <!-- How to use -->
    <section class="space-y-3">
      <h2 class="text-lg font-semibold">
        {{ t('about.howTitle') }}
      </h2>
      <div class="space-y-4">
        <div v-for="step in ['step1', 'step2', 'step3', 'step4'] as const" :key="step" class="flex gap-3">
          <div class="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
            {{ step.slice(-1) }}
          </div>
          <div class="text-sm leading-relaxed text-muted">
            {{ t(`about.${step}`) }}
          </div>
        </div>
      </div>
    </section>

    <!-- Speed tier terminology -->
    <section id="speed-tiers" class="space-y-3">
      <h2 class="text-lg font-semibold">
        {{ t('about.speedTitle') }}
      </h2>
      <p class="text-sm leading-relaxed text-muted">
        {{ t('about.speedIntro') }}
      </p>
      <div class="overflow-hidden rounded-lg border border-default">
        <table class="w-full text-sm">
          <thead>
            <tr class="border-b border-default bg-elevated">
              <th class="px-4 py-2 text-left font-medium">
                {{ t('about.tierColumn') }}
              </th>
              <th class="px-4 py-2 text-left font-medium">
                {{ t('about.meaningColumn') }}
              </th>
              <th class="px-4 py-2 text-left font-medium">
                {{ t('about.speedColumn') }}
              </th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="tier in tiers" :key="tier.name" class="border-b border-default last:border-0">
              <td class="px-4 py-2">
                <CommonSpeedTierBadge :tier="(tier.name as any)" />
              </td>
              <td class="px-4 py-2 text-muted">
                {{ t(`about.tier_${tier.key}`) }}
              </td>
              <td class="px-4 py-2 text-muted">
                {{ tier.time }}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <p class="text-xs text-muted">
        {{ t('about.speedNote') }}
      </p>
    </section>

    <!-- Other terminology -->
    <section class="space-y-3">
      <h2 class="text-lg font-semibold">
        {{ t('about.termsTitle') }}
      </h2>
      <dl class="space-y-3 text-sm">
        <div v-for="term in ['burstChain', 'burstGen', 'position', 'cpPenalty', 'lambda'] as const" :key="term">
          <dt class="font-medium">
            {{ t(`about.term_${term}`) }}
          </dt>
          <dd class="mt-0.5 text-muted">
            {{ t(`about.termDesc_${term}`) }}
          </dd>
        </div>
      </dl>
    </section>

    <!-- Data credits -->
    <section class="space-y-3">
      <h2 class="text-lg font-semibold">
        {{ t('about.creditsTitle') }}
      </h2>
      <p class="text-sm text-muted">
        {{ t('about.creditsIntro') }}
      </p>
      <ul class="space-y-2 text-sm">
        <li>
          <a href="https://nikke.gg/" target="_blank" rel="noopener" class="font-medium text-primary hover:underline">nikke.gg</a>
          <span class="text-muted"> — {{ t('about.creditNikkeGg') }}</span>
        </li>
        <li>
          <a href="https://www.prydwen.gg/" target="_blank" rel="noopener" class="font-medium text-primary hover:underline">Prydwen.gg</a>
          <span class="text-muted"> — {{ t('about.creditPrydwen') }}</span>
        </li>
        <li>
          <a href="https://space.bilibili.com/8724249" target="_blank" rel="noopener" class="font-medium text-primary hover:underline">左猫猫ZuoCatcat</a>
          <span class="text-muted"> — {{ t('about.creditZuoCatcat') }}</span>
        </li>
        <li>
          <a href="https://nikke-goddess-of-victory-international.fandom.com/wiki/Home" target="_blank" rel="noopener" class="font-medium text-primary hover:underline">NIKKE Fandom Wiki</a>
          <span class="text-muted"> — {{ t('about.creditFandom') }}</span>
        </li>
      </ul>
    </section>

    <!-- Disclaimer -->
    <section class="rounded-lg bg-muted/10 p-4 text-xs text-muted">
      {{ t('landing.footer') }}
    </section>
  </div>
</template>
