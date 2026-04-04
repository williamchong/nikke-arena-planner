import type { ArenaMode, Character } from '~/types/character'
import type { TeamComposition, TeamTemplate } from '~/types/template'
import templatesData from '~/data/templates.json'
import { useBurstCalculator } from './useBurstCalculator'
import { useCharacters } from './useCharacters'
import { PVP_TIER_SCORES, SPEED_TIER_SCORES, scoreTeamRaw, useSimulatedAnnealing } from './useSimulatedAnnealing'

const templates: TeamTemplate[] = templatesData as TeamTemplate[]

const { calculate, validateBurstChain } = useBurstCalculator()
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
  const actualSpeed = SPEED_TIER_SCORES[result.effectiveTier] || 0
  const preferredSpeed = SPEED_TIER_SCORES[template.preferredSpeed] || actualSpeed
  score += actualSpeed
  score += chars.reduce((sum, c) => sum + c.suitability[mode], 0) * 20
  score += chars.reduce((sum, c) => sum + (PVP_TIER_SCORES[c.pvpTier || 'C'] || 0), 0) * 3

  const matchedArchetypes = findMetaOverlap(chars, template.id, mode)
  // Meta overlap is a tiebreaker, not a driver — small bonus so it doesn't override speed or character quality
  if (matchedArchetypes.length > 0 && actualSpeed >= preferredSpeed) {
    score += 5 * matchedArchetypes.length
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
  optimize = true,
): { characters: Character[], score: number, alternates: Record<number, string[]>, matchedArchetypes: string[] } | null {
  for (const reqId of template.required) {
    if (!availableIds.has(reqId)) return null
  }

  if (template.mode !== 'both' && template.mode !== mode) return null

  const requiredChars: Character[] = []
  const usedByRequired = new Set<string>()

  for (const reqId of template.required) {
    const char = getCharacter(reqId)
    if (!char) return null
    requiredChars.push(char)
    usedByRequired.add(reqId)
  }

  // Collect available options per flex slot
  const flexOptions: { id: string, char: Character }[][] = []
  for (const flex of template.flex) {
    const available = flex.options
      .filter(id => availableIds.has(id) && !usedByRequired.has(id))
      .map(id => ({ id, char: getCharacter(id) }))
      .filter((o): o is { id: string, char: Character } => !!o.char)
    if (available.length === 0) return null
    flexOptions.push(available)
  }

  let team: Character[]
  let score: number
  let matchedArchetypes: string[]
  const alternates: Record<number, string[]> = {}

  if (optimize) {
    // Brute-force all flex combos to find the highest-scoring team
    let bestTeam: Character[] | null = null
    let bestScore = -Infinity
    let bestMatchedArchetypes: string[] = []
    let bestComboIndices: number[] = []

    function tryCombo(slotIdx: number, picked: Character[], usedIds: Set<string>, indices: number[]): void {
      if (slotIdx === flexOptions.length) {
        const candidate = [...requiredChars, ...picked]
        if (candidate.length !== 5) return
        if (!validateBurstChain(candidate).valid) return
        const result = scoreTeam(candidate, template, mode)
        if (result.score > bestScore) {
          bestScore = result.score
          bestTeam = candidate
          bestMatchedArchetypes = result.matchedArchetypes
          bestComboIndices = [...indices]
        }
        return
      }
      for (let i = 0; i < flexOptions[slotIdx]!.length; i++) {
        const opt = flexOptions[slotIdx]![i]!
        if (usedIds.has(opt.id)) continue
        usedIds.add(opt.id)
        picked.push(opt.char)
        indices.push(i)
        tryCombo(slotIdx + 1, picked, usedIds, indices)
        indices.pop()
        picked.pop()
        usedIds.delete(opt.id)
      }
    }

    tryCombo(0, [], new Set(usedByRequired), [])
    if (!bestTeam) return null

    team = bestTeam
    score = bestScore
    matchedArchetypes = bestMatchedArchetypes

    // Build alternates from non-picked options
    for (let i = 0; i < flexOptions.length; i++) {
      const pickedIdx = bestComboIndices[i]!
      const alts = flexOptions[i]!.filter((_, j) => j !== pickedIdx).map(o => o.id)
      if (alts.length > 0) {
        alternates[requiredChars.length + i] = alts
      }
    }
  }
  else {
    // Fast path: pick first available per slot (for 15v15 greedy seeds — SA redistributes later)
    const picked: Character[] = []
    const usedIds = new Set(usedByRequired)
    for (let i = 0; i < flexOptions.length; i++) {
      const opt = flexOptions[i]!.find(o => !usedIds.has(o.id))
      if (!opt) return null
      picked.push(opt.char)
      usedIds.add(opt.id)
      const alts = flexOptions[i]!.filter(o => o.id !== opt.id && !usedIds.has(o.id)).map(o => o.id)
      if (alts.length > 0) {
        alternates[requiredChars.length + i] = alts
      }
    }
    team = [...requiredChars, ...picked]
    if (team.length !== 5) return null
    if (!validateBurstChain(team).valid) return null
    const result = scoreTeam(team, template, mode)
    score = result.score
    matchedArchetypes = result.matchedArchetypes
  }

  // Filter alternates: exclude swaps that would reduce meta overlap
  if (matchedArchetypes.length > 0) {
    const filteredAlternates: Record<number, string[]> = {}
    for (const [posStr, alts] of Object.entries(alternates)) {
      const pos = Number(posStr)
      const kept = alts.filter((altId) => {
        const swapped = team.map((c, i) => i === pos ? getCharacter(altId)! : c)
        return findMetaOverlap(swapped, template.id, mode).length >= matchedArchetypes.length
      })
      if (kept.length > 0) {
        filteredAlternates[pos] = kept
      }
    }
    return { characters: team, score, alternates: filteredAlternates, matchedArchetypes }
  }

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

function toComposition(chars: Character[], mode: ArenaMode, label?: string, preferredSpeed?: string): TeamComposition {
  const positioned = sortByPosition(chars)
  const result = calculate(positioned, mode)
  return {
    id: label || `sa-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    characters: positioned.map(c => c.id),
    mode,
    burstSpeed: result.effectiveTier,
    score: scoreTeamRaw(chars, mode, preferredSpeed),
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

      const bestTpl = getTemplate(bestTemplate.templateId ?? '')
      const saResult = saOptimize5v5(seedTeam, bench, mode, undefined, bestTpl?.preferredSpeed)
      const saScore = scoreTeamRaw(saResult, mode, bestTpl?.preferredSpeed)

      if (saScore > bestTemplate.score) {
        results.unshift(toComposition(saResult, mode, 'sa-optimized', bestTpl?.preferredSpeed))
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

    // Try more starters than the old limit of 5 — some may fail due to missing required chars
    for (const starter of sorted.slice(0, 10)) {
      const teamSet: TeamComposition[] = []
      const matchedTemplates: (TeamTemplate | null)[] = []
      const usedChars = new Set<string>()
      const usedTemplateIds = new Set<string>()
      let failed = false

      const firstFilled = fillTemplate(starter, ownedIds, mode, false)
      if (!firstFilled) continue

      const firstTeam = buildComposition(starter, firstFilled.characters, mode, firstFilled.score, firstFilled.alternates, firstFilled.matchedArchetypes)
      teamSet.push(firstTeam)
      matchedTemplates.push(starter)
      for (const id of firstTeam.characters) usedChars.add(id)
      usedTemplateIds.add(starter.id)

      for (let i = 0; i < 2; i++) {
        const available = new Set([...ownedIds].filter(id => !usedChars.has(id)))
        let team: TeamComposition | null = null
        let matchedTemplate: TeamTemplate | null = null

        for (const t of sorted) {
          if (usedTemplateIds.has(t.id)) continue
          const filled = fillTemplate(t, available, mode, false)
          if (filled) {
            team = buildComposition(t, filled.characters, mode, filled.score, filled.alternates, filled.matchedArchetypes)
            matchedTemplate = t
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
        matchedTemplates.push(matchedTemplate)
        for (const id of team.characters) usedChars.add(id)
      }

      if (failed || teamSet.length !== 3) continue

      // SA refinement: optimize character allocation across the 3 teams
      // Pass preferred speeds so SA doesn't hoard fast chars in one team
      const seedTeams = teamSet.map(t => resolveCharacters(t.characters))
      const preferredSpeeds = matchedTemplates.map(t => t?.preferredSpeed ?? '3RL')
      const allUsed = new Set(teamSet.flatMap(t => t.characters))
      const bench = owned.filter(c => !allUsed.has(c.id))

      const saTeams = saOptimize15v15(seedTeams, bench, mode, undefined, preferredSpeeds)
      const saSet = saTeams.map((team, idx) =>
        toComposition(team, mode, `sa-${starter.id}-t${idx + 1}`, preferredSpeeds[idx]),
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
