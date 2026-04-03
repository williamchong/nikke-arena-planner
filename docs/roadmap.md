# Roadmap

## MVP (Completed)

- [x] Character database (187 characters with PVP stats, burst gen, release dates, PVP tier ratings)
- [x] Character roster selector with search, filters, in-game icons, avatars, and localStorage persistence
- [x] Roster sorting: owned first, then newest characters first (stable sort on toggle)
- [x] Burst speed calculator with team scoring, B1→B2→B3 timing, and modal multi-pick
- [x] Template-based team recommender (26 curated meta archetypes covering all 6 CN meta systems)
- [x] Simulated annealing optimization for 5v5 and 15v15 team allocation
- [x] Position-aware sorting (defenders→P1/P5, DPS→P3/P4, B1 in lowest position)
- [x] Multi-meta overlap detection with bonus scoring and UI badges
- [x] Alternate character picks shown per flex slot (filtered to preserve meta overlap)
- [x] Visual burst timeline showing which character fires B1/B2/B3
- [x] 5v5 Arena recommendations (up to 5 team suggestions)
- [x] 15v15 SP Arena recommendations (3 non-overlapping teams, multiple allocation options)
- [x] In-game icons for burst type, weapon, element, role, manufacturer
- [x] Character avatars (169 unique images via Vite asset imports)
- [x] Element-colored avatar rings
- [x] Trilingual UI (English, 繁體中文, 简体中文)
- [x] Dark/light mode toggle
- [x] Onboarding flow: team builder as default landing, inline roster picker
- [x] About page with usage guide, speed tier glossary, key terms, and data credits
- [x] SEO: meta tags, JSON-LD (WebApplication, WebSite, FAQPage), sitemap, hreflang
- [x] i18n SEO: prefix_except_default strategy, lazy loading, browser detection, useLocaleHead
- [x] GitHub Pages deployment with custom domain (nikke.williamchong.cloud)
- [x] CI pipeline (lint + typecheck on every push)

## Post-MVP

### High Priority

#### Counter-Matching
Input an opponent's defense team composition and get attack team recommendations that specifically counter it. Uses the existing `counters`/`counteredBy` fields in team templates, plus character-level counter logic (e.g., Rosanna dispels Jackal links, Noah blocks Scarlet AoE).

#### CP Distribution Optimizer
Input per-character CP values and optimize 15v15 allocation to avoid the 84.6% CP penalty threshold. Characters with higher CP get distributed across teams to balance total team CP.

### Medium Priority

#### Character Detail Pages
`/characters/[id]` pages showing:
- Full stats table and skill descriptions
- Burst gen chart across speed tiers (attack vs defense)
- Which templates use this character
- Suitability ratings and PVP tier

#### URL Team Sharing
Encode team compositions as compact URL parameters (e.g., `/share?t=scarlet,jackal,centi,anis,blanc`). Share link renders team read-only with burst speed and timing.

#### Cube Recommendations
Add cube data (Lost Fortress, Lost Restoration, Lost Acceleration, etc.) and suggest optimal cube assignment per character/team based on PVP role.

### Low Priority

#### PWA Offline Support
Add `@vite-pwa/nuxt` for offline capability. The app is already fully client-side, making PWA conversion straightforward. Cache character data and avatar images.

#### Roster Import
Import owned characters from game screenshots via OCR, or from community tools that export roster data. Reduces manual selection of 187 characters.

#### Champion Arena Mode
5-team mode (25 characters required). No CP penalty, sync-locked to level 400. Different scoring since CP doesn't matter — pure team composition optimization.

#### Community Team Sharing
Backend integration (Supabase or similar) for:
- Saving and publishing team compositions
- Upvote/downvote system
- Filtering by archetype, speed tier, characters used
- Weekly meta snapshots

### Data Maintenance

#### Character Updates
When new characters are released:
1. Re-run the spreadsheet extraction script (not in repo, kept locally)
2. Add EN name mapping in `scripts/name-map-en.json`
3. Fetch release date from fandom wiki
4. Download avatar from dotgg CDN
5. Update `app/data/characters.json`

#### Template Updates
When the meta shifts:
1. Review prydwen.gg PVP tier list changes
2. Add/modify templates in `app/data/templates.json`
3. Update `counters`/`counteredBy` relationships
4. Adjust priority values based on current meta strength
