# NIKKE Arena Planner

**Stop losing arena matches. Build better PVP teams in seconds.**

NIKKE Arena Planner analyzes your character roster and instantly recommends the strongest PVP teams you can build for both 5v5 Arena and 15v15 SP Arena. No more guessing which characters to pair. No more losing to teams that burst faster than yours.

## What You Get

- **Instant team recommendations** matched to 20 proven meta archetypes covering the current PVP meta
- **15v15 SP Arena allocation** — 3 non-overlapping teams optimized via simulated annealing
- **Multi-meta detection** — teams fitting multiple archetypes get bonus scoring and show all matched metas
- **Burst speed calculator** with team scoring, timing visualization, and B1→B2→B3 burst order
- **Position-aware** — auto-assigns P1-P5 based on role and burst type
- **Character avatars and in-game icons** for burst, weapon, element, role, and manufacturer
- **Alternate picks** — shows which other owned characters could fill each flex slot
- **Works with any roster size** — whether you have 15 characters or 150
- **Trilingual** — English, 繁體中文, 简体中文

## How It Works

1. Select the characters you own from the full roster of 186 NIKKEs
2. Get instant team recommendations for 5v5 Arena and 15v15 SP Arena
3. See burst speed, timing breakdowns, and why each team works

Team recommendation computation runs client-side, and no account or email is required. To improve recommendations, the app sends anonymous thumbs up/down feedback and stores an anonymous Firebase Auth identifier (`userId`), a `sessionId`, and related roster/team recommendation feedback in Firebase/Firestore.

## Recommendation Algorithm

The planner uses a multi-stage pipeline to find the best teams from your roster:

### 1. Template Matching
20 curated meta team templates (Moran system, Blanc indomitable, Scarlet nuke, Noah stall, etc.) are tried against your owned characters. Each template defines required core characters and flex slots with ranked substitutes. Templates have a priority tier: **P1** (meta-defining, +300 score) → **P2** (strong, +200) → **P3** (viable, +100).

### 2. Position Sorting
Characters are assigned to P1-P5 based on role and burst type:
- **Defenders** → P1/P5 (absorb most damage)
- **DPS/Attackers** → P3/P4 (safest positions)
- **B1 holders** placed in lower positions (fires first in burst order)

### 3. Scoring
Each team is scored as: `priority bonus + speed tier (30-100) + suitability (±200) + PVP tier (×3 tiebreaker) + meta overlap (×5 per archetype)`. In the SA optimizer, speed score is capped at the template's preferred speed to distribute burst gen resources across teams in 15v15.

**Meta overlap**: if a team's characters satisfy multiple distinct archetypes (e.g. Scarlet+Blanc+Jackal fits both "Scarlet nuke" and "Blanc Indomitable"), each additional archetype adds +5 (tiebreaker only). Same-archetype variants don't stack. Overlap is only awarded if the team meets its preferred speed target.

### 4. Simulated Annealing
The best template result is refined via simulated annealing (Metropolis criterion). SA swaps characters between the team and bench, accepting improvements deterministically and worse states probabilistically (high temperature = exploration, low temperature = exploitation). Invalid burst chains (missing B1/B2/B3) are hard-rejected. Template required characters are locked during SA — only flex slots are swapped, preserving team archetype identity.

For **15v15**, SA operates across all 3 teams simultaneously (8000 iterations) with four move types: random inter-team swaps, directed speed-rebalancing (swaps burst generators from fast teams to slow teams or pulls them from the bench), random bench swaps, and double bench swaps. Per-team preferred speed caps and a below-preferred penalty ensure burst gen resources are distributed so all teams can reach their speed targets.

### 5. Alternates & Meta Filtering
For each flex slot, other owned characters that could fill it are tracked as alternates. Alternates that would break a multi-meta overlap are filtered out, ensuring swaps don't weaken the composition.

## Development

```bash
npm install
npm run dev
```

## Testing

```bash
npm test            # Run all tests
npm run test:watch  # Watch mode
```

25 tests covering scoring, SA optimization, template locking, speed rebalancing, and integration tests with real character data and competitive meta compositions.

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
- Vitest + @nuxt/test-utils (25 tests)
- Fully client-side (SSR disabled, no backend)

## Disclaimer

NIKKE Arena Planner is a free, open-source fan tool. Not affiliated with Shift Up or Level Infinite. Character data and arena mechanics based on community research.
