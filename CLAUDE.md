# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm install          # Install dependencies
npm run dev          # Dev server (localhost:3000)
npm run build        # Production build
npx nuxt generate   # Static site generation (for GitHub Pages)
npx nuxt typecheck  # Type checking (requires Node 22+)
npm run lint         # ESLint (requires Node 22+, needs nuxt prepare first)
npx nuxt prepare    # Regenerate .nuxt types (run after config changes)
```

## Architecture

Client-side Nuxt 4 SPA (SSR disabled) for NIKKE PVP team building. No backend — all computation runs in the browser.

### Data Flow

```
characters.json (187 chars) + templates.json (26 meta archetypes)
  → useCharacters() (lookup/filter)
  → useBurstCalculator() (burst speed at each tier)
  → useTeamRecommender() (template match → SA refinement → position sort)
  → recommend page (reactive computed from roster store)
```

### Recommendation Pipeline

1. **Template matching**: Try 26 curated meta templates against owned roster in priority order. Fill required characters, then flex slots with best available. Track alternates per flex slot.
2. **Position sorting**: Assign P1-P5 based on role (defenders→P1/P5, DPS→P3/P4) and burst type (B1 holders in lower positions).
3. **Simulated annealing**: Refine template results by swapping characters between teams and bench (2000 iterations, Metropolis criterion). For 15v15, optimizes allocation across all 3 teams.
4. **Meta overlap bonus**: Teams fitting multiple distinct archetypes get +30 per overlap. Same-archetype variants don't stack.
5. **Scoring**: `templatePriority * 100 + speedTierScore + suitability * 20 + pvpTier * 3 + metaOverlap * 30`

### Key Domain Concepts

- **Burst chain**: Teams need B1 + B2 + B3 (or Λ wildcard). Hard constraint — SA rejects invalid chains.
- **Speed tiers**: Burst gen normalized so `1.0 = full gauge`. Effective tier = fastest tier reaching 1.0. Order: `2RL > 5SG > 3RL > 7SG > 4RL > 5RL`.
- **ArenaMode**: Always explicit `'attack'` or `'defense'` — characters have different burst gen and suitability per mode.
- **Λ (Lambda)**: Red Hood's burst type. Acts as wildcard for any B1/B2/B3 slot.
- **PVP Tier**: SSS through F ratings from Prydwen tier list. Used as tiebreaker in scoring (×3 weight).

### Composable Dependencies

- `useTeamRecommender` → `useBurstCalculator`, `useCharacters`, `useSimulatedAnnealing`
- `useSimulatedAnnealing` → `useBurstCalculator` (scoring + validation)
- `useAvatars` → `import.meta.glob` (eager, build-time resolved)
- `useIcons` → `import.meta.glob` for burst/role/weapon/element/manufacturer icons
- Scoring constants (`SPEED_TIER_SCORES`, `PVP_TIER_SCORES`) live in `useSimulatedAnnealing.ts`

### State Persistence

- `useRosterStore`: owned character IDs via VueUse `useLocalStorage`
- Calculator page: team slots and mode via VueUse `useLocalStorage`
- `CharacterGrid` uses an **owned snapshot** (captured on filter change, not on toggle) to prevent sort order jumping

### i18n

Three locales: `en`, `zh-TW`, `zh-CN`. Files in `i18n/locales/`. Strategy: `prefix_except_default`. Lazy loading automatic (v10). Browser language detection on root with `redirectOn: 'root'`. SEO: `useLocaleHead()` for hreflang/og:locale via `<Html>/<Head>` template components.

### SEO

- `useSeoMeta` for og: tags (type-safe)
- `titleTemplate` in app.vue (pages just set title)
- JSON-LD: WebApplication + WebSite (app.vue), FAQPage (about.vue)
- `@nuxtjs/sitemap` with i18n auto-detection
- Per-page titles via `useSeoMeta`

### Deployment

GitHub Pages at nikke.williamchong.cloud via `.github/workflows/deploy.yml`. Custom domain configured via CNAME. Static generation with `nuxt generate`.

### Roadmap

See `docs/roadmap.md` for completion status and post-MVP feature plan.
