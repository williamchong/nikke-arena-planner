import type { ArenaMode, Character } from '~/types/character'
import type { TeamComposition, TeamTemplate } from '~/types/template'
import templatesData from '~/data/templates.json'
import { useBurstCalculator } from './useBurstCalculator'
import { useCharacters } from './useCharacters'
import { PVP_TIER_SCORES, SPEED_TIER_SCORES, scoreTeamRaw, useSimulatedAnnealing } from './useSimulatedAnnealing'

const templates: TeamTemplate[] = templatesData as TeamTemplate[]

const { calculate } = useBurstCalculator()
const { getCharacter } = useCharacters()

/**
 * Sort a team of 5 characters into optimal P1-P5 positions.
 * Rules:
 * - Defenders → P1/P5 (absorb damage)
 * - Attackers → P3/P4 (safest positions)
 * - Supporters → P2/P5 (flexible)
 * - Within role groups, place B1 holders in lower positions (fires first)
 */
function sortByPosition(chars: Character[]): Character[] {
  if (chars.length !== 5) return chars

  const defenders = chars.filter(c => c.role === 'defender')
  const attackers = chars.filter(c => c.role === 'attacker')
  const supporters = chars.filter(c => c.role === 'supporter')

  // Sort each group: B1 first (lowest burst type fires first from lower position)
  const burstPriority: Record<string, number> = { I: 0, Λ: 1, II: 2, III: 3 }
  const byBurst = (a: Character, b: Character) =>
    (burstPriority[a.burst] ?? 3) - (burstPriority[b.burst] ?? 3)

  defenders.sort(byBurst)
  attackers.sort(byBurst)
  supporters.sort(byBurst)

  // Assign positions: P1(tank), P2(support/flex), P3-P4(dps), P5(tank/support)
  const slots: (Character | null)[] = [null, null, null, null, null]
  const placed = new Set<string>()

  function place(char: Character, pos: number) {
    if (slots[pos] || placed.has(char.id)) return false
    slots[pos] = char
    placed.add(char.id)
    return true
  }

  // P1: first defender
  for (const d of defenders) {
    if (place(d, 0)) break
  }

  // P5: second defender, or a supporter
  for (const d of defenders) {
    if (!placed.has(d.id) && place(d, 4)) break
  }
  if (!slots[4]) {
    for (const s of supporters) {
      if (!placed.has(s.id) && place(s, 4)) break
    }
  }

  // P3, P4: attackers
  for (const a of attackers) {
    if (placed.has(a.id)) continue
    if (!slots[2] && place(a, 2)) continue
    if (!slots[3] && place(a, 3)) break
  }

  // Fill remaining slots with unplaced characters
  const unplaced = chars.filter(c => !placed.has(c.id)).sort(byBurst)
  for (const c of unplaced) {
    for (let i = 0; i < 5; i++) {
      if (place(c, i)) break
    }
  }

  return slots.filter((c): c is Character => !!c)
}

function buildComposition(
  template: TeamTemplate,
  chars: Character[],
  mode: ArenaMode,
  score: number,
  alternates?: Record<number, string[]>,
  matchedArchetypes?: string[],
): TeamComposition {
  const positioned = sortByPosition(chars)

  // Remap alternates indices from unsorted to sorted positions
  let remappedAlternates: Record<number, string[]> | undefined
  if (alternates) {
    remappedAlternates = {}
    for (const [oldIdx, alts] of Object.entries(alternates)) {
      const charId = chars[Number(oldIdx)]?.id
      const newIdx = positioned.findIndex(c => c.id === charId)
      if (newIdx !== -1 && alts.length > 0) {
        remappedAlternates[newIdx] = alts
      }
    }
  }

  return {
    id: template.id,
    characters: positioned.map(c => c.id),
    mode,
    templateId: template.id,
    burstSpeed: calculate(positioned, mode).effectiveTier,
    score,
    alternates: remappedAlternates,
    matchedArchetypes: matchedArchetypes?.length ? matchedArchetypes : undefined,
  }
}

/**
 * Count how many distinct meta archetypes this team's characters satisfy
 * beyond the current one. Same-archetype variants (e.g. scarlet-jackal-2rl
 * and scarlet-jackal-3rl) count as one.
 */
function findMetaOverlap(chars: Character[], currentTemplateId: string, mode: ArenaMode): string[] {
  const charIds = new Set(chars.map(c => c.id))
  const currentArchetype = templates.find(t => t.id === currentTemplateId)?.archetype
  const matched = new Map<string, string>()
  for (const t of templates) {
    if (t.id === currentTemplateId) continue
    if (t.archetype === currentArchetype) continue
    if (t.mode !== 'both' && t.mode !== mode) continue
    if (matched.has(t.archetype)) continue
    if (t.required.every(r => charIds.has(r))) {
      matched.set(t.archetype, t.id)
    }
  }
  return [...matched.values()]
}

function scoreTeam(chars: Character[], template: TeamTemplate, mode: ArenaMode): { score: number, matchedArchetypes: string[] } {
  const result = calculate(chars, mode)

  let score = 0
  score += (4 - template.priority) * 100
  score += SPEED_TIER_SCORES[result.effectiveTier] || 0
  score += chars.reduce((sum, c) => sum + c.suitability[mode], 0) * 20
  score += chars.reduce((sum, c) => sum + (PVP_TIER_SCORES[c.pvpTier || 'C'] || 0), 0) * 3

  const matchedArchetypes = findMetaOverlap(chars, template.id, mode)
  if (matchedArchetypes.length > 0) {
    score += 30 * matchedArchetypes.length
  }

  return { score, matchedArchetypes }
}

/**
 * Try to fill a template with available characters.
 * Returns the filled team or null if template can't be satisfied.
 */
function fillTemplate(
  template: TeamTemplate,
  availableIds: Set<string>,
  mode: ArenaMode,
): { characters: Character[], score: number, alternates: Record<number, string[]>, matchedArchetypes: string[] } | null {
  for (const reqId of template.required) {
    if (!availableIds.has(reqId)) return null
  }

  if (template.mode !== 'both' && template.mode !== mode) return null

  const team: Character[] = []
  const used = new Set<string>()
  const alternates: Record<number, string[]> = {}

  for (const reqId of template.required) {
    const char = getCharacter(reqId)
    if (!char) return null
    team.push(char)
    used.add(reqId)
  }

  for (const flex of template.flex) {
    let filled = false
    const alts: string[] = []
    for (const optId of flex.options) {
      if (availableIds.has(optId) && !used.has(optId)) {
        const char = getCharacter(optId)
        if (char) {
          if (!filled) {
            team.push(char)
            used.add(optId)
            filled = true
          }
          else {
            alts.push(optId)
          }
        }
      }
    }
    if (!filled) return null
    if (alts.length > 0) {
      alternates[team.length - 1] = alts
    }
  }

  if (team.length !== 5) return null

  const { score, matchedArchetypes } = scoreTeam(team, template, mode)
  return { characters: team, score, alternates, matchedArchetypes }
}

/**
 * Auto-fill a team from available characters ensuring burst chain validity.
 */
function autoFillTeam(available: Character[], mode: ArenaMode): TeamComposition | null {
  const byBurst: Record<string, Character[]> = { I: [], II: [], III: [], Λ: [] }
  for (const c of available) {
    byBurst[c.burst]?.push(c)
  }

  for (const group of Object.values(byBurst)) {
    group.sort((a, b) => b.suitability[mode] - a.suitability[mode])
  }

  const team: Character[] = []
  const used = new Set<string>()

  for (const burst of ['I', 'II', 'III'] as const) {
    const candidates = byBurst[burst]!.filter(c => !used.has(c.id))
    if (candidates.length > 0) {
      team.push(candidates[0]!)
      used.add(candidates[0]!.id)
    }
    else {
      const lambdas = byBurst['Λ']!.filter(c => !used.has(c.id))
      if (lambdas.length > 0) {
        team.push(lambdas[0]!)
        used.add(lambdas[0]!.id)
      }
      else {
        return null
      }
    }
  }

  const remaining = available
    .filter(c => !used.has(c.id))
    .sort((a, b) => b.suitability[mode] - a.suitability[mode])

  for (const c of remaining.slice(0, 2)) {
    team.push(c)
    used.add(c.id)
  }

  if (team.length < 5) return null

  const positioned = sortByPosition(team)
  const result = calculate(positioned, mode)
  return {
    id: `auto-${Date.now()}`,
    characters: positioned.map(c => c.id),
    mode,
    burstSpeed: result.effectiveTier,
    score: 0,
  }
}

function resolveCharacters(ids: string[]): Character[] {
  return ids.map(id => getCharacter(id)).filter((c): c is Character => !!c)
}

function toComposition(chars: Character[], mode: ArenaMode, label?: string): TeamComposition {
  const positioned = sortByPosition(chars)
  const result = calculate(positioned, mode)
  return {
    id: label || `sa-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    characters: positioned.map(c => c.id),
    mode,
    burstSpeed: result.effectiveTier,
    score: scoreTeamRaw(chars, mode),
  }
}

export function useTeamRecommender() {
  const { characters: allCharacters } = useCharacters()
  const { optimize5v5: saOptimize5v5, optimize15v15: saOptimize15v15 } = useSimulatedAnnealing()

  function recommend5v5(ownedIds: Set<string>, mode: ArenaMode): TeamComposition[] {
    const results: TeamComposition[] = []
    const sorted = [...templates].sort((a, b) => a.priority - b.priority)

    // Phase 1: Template matching
    for (const template of sorted) {
      const filled = fillTemplate(template, ownedIds, mode)
      if (filled) {
        results.push(buildComposition(template, filled.characters, mode, filled.score, filled.alternates, filled.matchedArchetypes))
      }
    }

    // Phase 2: SA refinement on the best template result
    const owned = allCharacters.filter(c => ownedIds.has(c.id))
    if (results.length > 0 && owned.length >= 5) {
      const bestTemplate = results.sort((a, b) => b.score - a.score)[0]!
      const seedTeam = resolveCharacters(bestTemplate.characters)
      const bench = owned.filter(c => !bestTemplate.characters.includes(c.id))

      const saResult = saOptimize5v5(seedTeam, bench, mode)
      const saScore = scoreTeamRaw(saResult, mode)

      if (saScore > bestTemplate.score) {
        results.unshift(toComposition(saResult, mode, 'sa-optimized'))
      }
    }
    else if (owned.length >= 5 && results.length === 0) {
      // No templates matched — SA from auto-fill seed
      const autoTeam = autoFillTeam(owned, mode)
      if (autoTeam) {
        const seedTeam = resolveCharacters(autoTeam.characters)
        const bench = owned.filter(c => !autoTeam.characters.includes(c.id))
        const saResult = saOptimize5v5(seedTeam, bench, mode)
        results.push(toComposition(saResult, mode, 'sa-optimized'))
      }
    }

    return results.sort((a, b) => b.score - a.score).slice(0, 5)
  }

  /**
   * Greedy template allocation → SA refinement.
   * 1. Build initial 3 teams via greedy template matching
   * 2. Run simulated annealing to swap characters between teams and bench
   */
  function recommend15v15(ownedIds: Set<string>, mode: ArenaMode): TeamComposition[][] {
    const bestSets: TeamComposition[][] = []
    const owned = allCharacters.filter(c => ownedIds.has(c.id))

    const sorted = [...templates]
      .filter(t => t.mode === 'both' || t.mode === mode)
      .sort((a, b) => a.priority - b.priority)

    const starterTemplates = sorted.slice(0, Math.min(5, sorted.length))

    for (const starter of starterTemplates) {
      const teamSet: TeamComposition[] = []
      const usedChars = new Set<string>()
      const usedTemplateIds = new Set<string>()
      let failed = false

      const firstFilled = fillTemplate(starter, ownedIds, mode)
      if (!firstFilled) continue

      const firstTeam = buildComposition(starter, firstFilled.characters, mode, firstFilled.score, firstFilled.alternates, firstFilled.matchedArchetypes)
      teamSet.push(firstTeam)
      for (const id of firstTeam.characters) usedChars.add(id)
      usedTemplateIds.add(starter.id)

      for (let i = 0; i < 2; i++) {
        const available = new Set([...ownedIds].filter(id => !usedChars.has(id)))
        let team: TeamComposition | null = null

        for (const t of sorted) {
          if (usedTemplateIds.has(t.id)) continue
          const filled = fillTemplate(t, available, mode)
          if (filled) {
            team = buildComposition(t, filled.characters, mode, filled.score, filled.alternates, filled.matchedArchetypes)
            usedTemplateIds.add(t.id)
            break
          }
        }

        if (!team) {
          const avail = allCharacters.filter(c => available.has(c.id))
          team = autoFillTeam(avail, mode)
        }

        if (!team) {
          failed = true
          break
        }

        teamSet.push(team)
        for (const id of team.characters) usedChars.add(id)
      }

      if (failed || teamSet.length !== 3) continue

      // SA refinement: optimize character allocation across the 3 teams
      const seedTeams = teamSet.map(t => resolveCharacters(t.characters))
      const allUsed = new Set(teamSet.flatMap(t => t.characters))
      const bench = owned.filter(c => !allUsed.has(c.id))

      const saTeams = saOptimize15v15(seedTeams, bench, mode)
      const saSet = saTeams.map((team, idx) =>
        toComposition(team, mode, `sa-${starter.id}-t${idx + 1}`),
      )

      // Keep whichever is better: original greedy or SA-refined
      const greedyTotal = teamSet.reduce((sum, t) => sum + t.score, 0)
      const saTotal = saSet.reduce((sum, t) => sum + t.score, 0)

      bestSets.push(saTotal > greedyTotal ? saSet : teamSet)
    }

    return bestSets
      .sort((a, b) => {
        const scoreA = a.reduce((sum, t) => sum + t.score, 0)
        const scoreB = b.reduce((sum, t) => sum + t.score, 0)
        return scoreB - scoreA
      })
      .slice(0, 3)
  }

  function getTemplate(id: string): TeamTemplate | undefined {
    return templates.find(t => t.id === id)
  }

  return { recommend5v5, recommend15v15, getTemplate, templates }
}
