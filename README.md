# NIKKE Arena Planner

**Stop losing arena matches. Build better PVP teams in seconds.**

NIKKE Arena Planner analyzes your character roster and instantly recommends the strongest PVP teams you can build for both 5v5 Arena and 15v15 SP Arena. No more guessing which characters to pair. No more losing to teams that burst faster than yours.

## What You Get

- **Instant team recommendations** matched to proven meta archetypes (Scarlet nuke, Alice stall, Crown burst, and more)
- **15v15 SP Arena allocation** - 3 non-overlapping teams optimized from your roster via simulated annealing
- **Burst speed calculator** showing exact charge timing for any 5-character combination
- **Works with any roster size** - whether you have 15 characters or 150
- **Trilingual** - English, 繁體中文, 简体中文

## How It Works

1. Select the characters you own from the full roster of 187 NIKKEs
2. Get instant team recommendations for 5v5 Arena and 15v15 SP Arena
3. See burst speed, timing breakdowns, and why each team works

The planner uses template matching against 15 curated meta team archetypes, then refines results with a simulated annealing optimizer that swaps characters between teams to maximize total team quality. All computation runs client-side in your browser - no server, no login, no data collection.

## Development

```bash
npm install
npm run dev
```

## Build

```bash
npm run build
```

Static site generation for deployment:

```bash
npx nuxt generate
```

## Deployment

Deploys automatically to GitHub Pages on push to master. See `.github/workflows/deploy.yml`.

## Tech Stack

- Nuxt 4 + Vue 3.5 + TypeScript
- Nuxt UI v4 + Tailwind CSS v4
- Pinia (state management with localStorage persistence)
- @nuxtjs/i18n (trilingual support)
- Fully client-side (SSR disabled, no backend)

## Disclaimer

NIKKE Arena Planner is a free, open-source fan tool. Not affiliated with Shift Up or Level Infinite. Character data and arena mechanics based on community research.
