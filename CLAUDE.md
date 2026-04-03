# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm install          # Install dependencies
npm run dev          # Dev server (localhost:3000)
npm run build        # Production build
npx nuxt generate   # Static site generation (for GitHub Pages)
npx nuxt typecheck  # Type checking
npm run lint         # ESLint
npx nuxt prepare    # Regenerate .nuxt types (run after config changes)
```

## Architecture

Client-side Nuxt 4 SPA (SSR disabled) for NIKKE PVP team building. No backend — all computation runs in the browser.

### Data Flow

```
characters.json (187 chars) + templates.json (15 meta archetypes)
  → useCharacters() (lookup/filter)
  → useBurstCalculator() (burst speed at each tier)
  → useTeamRecommender() (template match → SA refinement)
  → recommend page (reactive computed from roster store)
```

### Recommendation Pipeline

1. **Template matching**: Try 15 curated meta templates against owned roster in priority order. Fill required characters, then flex slots with best available.
2. **Simulated annealing**: Refine template results by swapping characters between teams and bench (2000 iterations, Metropolis criterion). For 15v15, optimizes allocation across all 3 teams.
3. **Scoring**: `templatePriority * 100 + speedTierScore + suitability * 20 + pvpTier * 10`

### Key Domain Concepts

- **Burst chain**: Teams need B1 + B2 + B3 (or Λ wildcard). Hard constraint — SA rejects invalid chains.
- **Speed tiers**: Burst gen normalized so `1.0 = full gauge`. Effective tier = fastest tier reaching 1.0. Order: `2RL > 5SG > 3RL > 7SG > 4RL > 5RL`.
- **ArenaMode**: Always explicit `'attack'` or `'defense'` — characters have different burst gen and suitability per mode.
- **Λ (Lambda)**: Red Hood's burst type. Acts as wildcard for any B1/B2/B3 slot.

### Composable Dependencies

- `useTeamRecommender` → `useBurstCalculator`, `useCharacters`, `useSimulatedAnnealing`
- `useSimulatedAnnealing` → `useBurstCalculator` (scoring + validation)
- `useAvatars` → `import.meta.glob` (eager, build-time resolved)
- Scoring constants (`SPEED_TIER_SCORES`, `PVP_TIER_SCORES`) live in `useSimulatedAnnealing.ts` and are imported by `useTeamRecommender.ts`

### Roster Store Pattern

`useRosterStore` persists owned character IDs to localStorage. `CharacterGrid` uses an **owned snapshot** (captured on filter change, not on toggle) to prevent sort order from jumping when clicking characters.

### i18n

Three locales: `en`, `zh-TW`, `zh-CN`. Files in `i18n/locales/`. Strategy: `no_prefix`. Character/template names use `LocalizedString` type resolved via `useLocalizedField().localize()`.

### Deployment

GitHub Pages at nikke.williamchong.cloud via `.github/workflows/deploy.yml`. Custom domain configured via CNAME. Static generation with `nuxt generate`.

### Roadmap

See `docs/roadmap.md` for MVP completion status and post-MVP feature plan.
