import type { ArenaMode, Character, SpeedTier } from '~/types/character'
import type { TeamComposition, TeamTemplate } from '~/types/template'
import templatesData from '~/data/templates.json'
import { useBurstCalculator } from './useBurstCalculator'
import { useCharacters } from './useCharacters'

const templates: TeamTemplate[] = templatesData as TeamTemplate[]

const PVP_TIER_SCORES: Record<string, number> = {
  SSS: 10, SS: 8, S: 6, A: 4, B: 2, C: 1, D: 0, E: 0, F: 0,
}

const SPEED_TIER_SCORES: Record<SpeedTier, number> = {
  '1RL': 100, '2RL': 90, '3SG': 85, '5SG': 80,
  '3RL': 70, '7SG': 60, '4RL': 50, '5RL': 30,
}

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

export function useTeamRecommender() {
  const { characters: allCharacters } = useCharacters()

  function recommend5v5(ownedIds: Set<string>, mode: ArenaMode): TeamComposition[] {
    const results: TeamComposition[] = []
    const sorted = [...templates].sort((a, b) => a.priority - b.priority)

    for (const template of sorted) {
      const filled = fillTemplate(template, ownedIds, mode)
      if (filled) {
        results.push(buildComposition(template, filled.characters, mode, filled.score))
      }
    }

    return results.sort((a, b) => b.score - a.score).slice(0, 5)
  }

  /**
   * Greedy allocation: for each starting template, build 3 teams
   * by iteratively picking the best available template and removing used characters.
   */
  function recommend15v15(ownedIds: Set<string>, mode: ArenaMode): TeamComposition[][] {
    const bestSets: TeamComposition[][] = []

    const sorted = [...templates]
      .filter(t => t.mode === 'both' || t.mode === mode)
      .sort((a, b) => a.priority - b.priority)

    const starterTemplates = sorted.slice(0, Math.min(5, sorted.length))

    for (const starter of starterTemplates) {
      const teamSet: TeamComposition[] = []
      const usedChars = new Set<string>()
      const usedTemplateIds = new Set<string>()
      let failed = false

      // First team must use the starter template
      const firstFilled = fillTemplate(starter, ownedIds, mode)
      if (!firstFilled) continue

      const firstTeam = buildComposition(starter, firstFilled.characters, mode, firstFilled.score)
      teamSet.push(firstTeam)
      for (const id of firstTeam.characters) usedChars.add(id)
      usedTemplateIds.add(starter.id)

      // Teams 2 and 3: find best remaining template or auto-fill
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

      if (!failed && teamSet.length === 3) {
        bestSets.push(teamSet)
      }
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
