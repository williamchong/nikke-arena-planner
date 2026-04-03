import type { ArenaMode, Character } from '~/types/character'
import type { TeamComposition, TeamTemplate } from '~/types/template'
import templatesData from '~/data/templates.json'
import { useBurstCalculator } from './useBurstCalculator'
import { useCharacters } from './useCharacters'
import { PVP_TIER_SCORES, SPEED_TIER_SCORES, scoreTeamRaw, useSimulatedAnnealing } from './useSimulatedAnnealing'

const templates: TeamTemplate[] = templatesData as TeamTemplate[]

const { calculate } = useBurstCalculator()
const { getCharacter } = useCharacters()

function buildComposition(
  template: TeamTemplate,
  chars: Character[],
  mode: ArenaMode,
  score: number,
): TeamComposition {
  return {
    id: template.id,
    characters: chars.map(c => c.id),
    mode,
    templateId: template.id,
    burstSpeed: calculate(chars, mode).effectiveTier,
    score,
  }
}

function scoreTeam(chars: Character[], template: TeamTemplate, mode: ArenaMode): number {
  const result = calculate(chars, mode)

  let score = 0
  score += (4 - template.priority) * 100
  score += SPEED_TIER_SCORES[result.effectiveTier] || 0
  score += chars.reduce((sum, c) => sum + c.suitability[mode], 0) * 20
  score += chars.reduce((sum, c) => sum + (PVP_TIER_SCORES[c.pvpTier || 'C'] || 0), 0) * 10

  return score
}

/**
 * Try to fill a template with available characters.
 * Returns the filled team or null if template can't be satisfied.
 */
function fillTemplate(
  template: TeamTemplate,
  availableIds: Set<string>,
  mode: ArenaMode,
): { characters: Character[], score: number } | null {
  for (const reqId of template.required) {
    if (!availableIds.has(reqId)) return null
  }

  if (template.mode !== 'both' && template.mode !== mode) return null

  const team: Character[] = []
  const used = new Set<string>()

  for (const reqId of template.required) {
    const char = getCharacter(reqId)
    if (!char) return null
    team.push(char)
    used.add(reqId)
  }

  for (const flex of template.flex) {
    let filled = false
    for (const optId of flex.options) {
      if (availableIds.has(optId) && !used.has(optId)) {
        const char = getCharacter(optId)
        if (char) {
          team.push(char)
          used.add(optId)
          filled = true
          break
        }
      }
    }
    if (!filled) return null
  }

  if (team.length !== 5) return null

  const score = scoreTeam(team, template, mode)
  return { characters: team, score }
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

  const result = calculate(team, mode)
  return {
    id: `auto-${Date.now()}`,
    characters: team.map(c => c.id),
    mode,
    burstSpeed: result.effectiveTier,
    score: 0,
  }
}

function resolveCharacters(ids: string[]): Character[] {
  return ids.map(id => getCharacter(id)).filter((c): c is Character => !!c)
}

function toComposition(chars: Character[], mode: ArenaMode, label?: string): TeamComposition {
  const result = calculate(chars, mode)
  return {
    id: label || `sa-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    characters: chars.map(c => c.id),
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
        results.push(buildComposition(template, filled.characters, mode, filled.score))
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

      const firstTeam = buildComposition(starter, firstFilled.characters, mode, firstFilled.score)
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
            team = buildComposition(t, filled.characters, mode, filled.score)
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
