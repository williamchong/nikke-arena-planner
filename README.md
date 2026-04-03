# NIKKE Arena Planner

**Stop losing arena matches. Build better PVP teams in seconds.**

NIKKE Arena Planner analyzes your character roster and instantly recommends the strongest PVP teams you can build for both 5v5 Arena and 15v15 SP Arena. No more guessing which characters to pair. No more losing to teams that burst faster than yours.

## What You Get

- **Instant team recommendations** matched to 26 proven meta archetypes covering all 6 CN meta systems
- **15v15 SP Arena allocation** — 3 non-overlapping teams optimized via simulated annealing
- **Multi-meta detection** — teams fitting multiple archetypes get bonus scoring and show all matched metas
- **Burst speed calculator** with team scoring, timing visualization, and B1→B2→B3 burst order
- **Position-aware** — auto-assigns P1-P5 based on role and burst type
- **Character avatars and in-game icons** for burst, weapon, element, role, and manufacturer
- **Alternate picks** — shows which other owned characters could fill each flex slot
- **Works with any roster size** — whether you have 15 characters or 150
- **Trilingual** — English, 繁體中文, 简体中文

## How It Works

1. Select the characters you own from the full roster of 187 NIKKEs
2. Get instant team recommendations for 5v5 Arena and 15v15 SP Arena
3. See burst speed, timing breakdowns, and why each team works

The planner uses template matching against 26 curated meta archetypes (covering all 6 CN meta systems), then refines results with a simulated annealing optimizer. Teams are position-sorted (defenders→P1/P5, DPS→P3/P4) and scored based on speed tier, character PVP ratings, suitability, and meta overlap. All computation runs client-side — no server, no login, no data collection.

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

Deploys automatically to [nikke.williamchong.cloud](https://nikke.williamchong.cloud) via GitHub Pages on push to master. See `.github/workflows/deploy.yml`.

## Tech Stack

- Nuxt 4 + Vue 3.5 + TypeScript
- Nuxt UI v4 + Tailwind CSS v4
- Pinia + VueUse (state management with localStorage persistence)
- @nuxtjs/i18n (trilingual, prefix_except_default, lazy loading)
- @nuxtjs/sitemap (auto i18n sitemap generation)
- Fully client-side (SSR disabled, no backend)

## Disclaimer

NIKKE Arena Planner is a free, open-source fan tool. Not affiliated with Shift Up or Level Infinite. Character data and arena mechanics based on community research.
