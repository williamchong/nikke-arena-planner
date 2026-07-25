import type { ArenaMode, Character, SpeedTier } from '~/types/character'
import { effectiveSpeedTier, hasValidBurstChain } from './useBurstCalculator'

export interface SAOptions {
  iterations: number
  startTemp: number
  coolingRate: number
}

const DEFAULT_OPTIONS: SAOptions = {
  iterations: 2000,
  startTemp: 100,
  coolingRate: 0.995,
}

export const SPEED_TIER_SCORES: Record<string, number> = {
  '1RL': 100, '2RL': 90, '3SG': 85, '5SG': 80,
  '3RL': 70, '7SG': 60, '4RL': 50, '5RL': 30,
}

export const PVP_TIER_SCORES: Record<string, number> = {
  SSS: 10, SS: 8, S: 6, A: 4, B: 2, C: 1, D: 0, E: 0, F: 0,
}

const BELOW_PREFERRED_PENALTY = 0.5
// Soft synergy penalty: each unmet `prefersTeammate` trait docks this from the raw score.
// ~60 is roughly one speed tier step plus a suitability point — noticeable but not disqualifying.
const MISSING_PREFERRED_TRAIT_PENALTY = 60

// Move probabilities for neighbor generation (cumulative thresholds)
const MOVE_INTER_TEAM = 0.25
const MOVE_SPEED_REBALANCE = 0.40
const MOVE_BENCH_SWAP = 0.65

/**
 * Check whether a `requiresTeammate` / `prefersTeammate` token is satisfied by some other
 * team member. Supports plain trait tags plus tokens: `same-element`, `same-squad`,
 * `role:<role>`, `element:<element>`.
 */
function matchesTeammateReq(char: Character, req: string, team: Character[]): boolean {
  if (req === 'same-element') {
    return team.some(c => c !== char && c.element === char.element)
  }
  if (req === 'same-squad') {
    return !!char.squad && team.some(c => c !== char && c.squad === char.squad)
  }
  if (req.startsWith('role:')) {
    const role = req.slice(5)
    return team.some(c => c !== char && c.role === role)
  }
  if (req.startsWith('element:')) {
    const element = req.slice(8)
    return team.some(c => c !== char && c.element === element)
  }
  return team.some(c => c !== char && !!c.traits?.includes(req))
}

/** PVP tier weight for a character, defaulting untiered records to 'C'. */
export function pvpTierScore(char: Character): number {
  return PVP_TIER_SCORES[char.pvpTier || 'C'] || 0
}

/**
 * Score a team without requiring a template.
 * Based on burst speed, suitability, and PVP tier.
 * If preferredSpeed is provided, speed score is capped at that tier.
 */
export function scoreTeamRaw(chars: Character[], mode: ArenaMode, preferredSpeed?: SpeedTier): number {
  if (!hasValidBurstChain(chars)) return -1000

  let score = 0

  // Hard reject: any character whose `requiresTeammate` is not satisfied.
  // Nero is the canonical case — her kit requires a healer teammate to activate
  // Cat's Repayment and Grumpy Cat's HP Potency buff.
  for (const c of chars) {
    if (!c.requiresTeammate) continue
    for (const req of c.requiresTeammate) {
      if (!matchesTeammateReq(c, req, chars)) return -1000
    }
  }

  for (const c of chars) {
    if (!c.prefersTeammate) continue
    for (const pref of c.prefersTeammate) {
      if (!matchesTeammateReq(c, pref, chars)) score -= MISSING_PREFERRED_TRAIT_PENALTY
    }
  }

  const actualSpeed = SPEED_TIER_SCORES[effectiveSpeedTier(chars, mode)] || 0
  const prefSpeed = preferredSpeed ? (SPEED_TIER_SCORES[preferredSpeed] || actualSpeed) : actualSpeed
  score += Math.min(actualSpeed, prefSpeed)
  if (prefSpeed > actualSpeed) {
    score -= (prefSpeed - actualSpeed) * BELOW_PREFERRED_PENALTY
  }
  let suitability = 0
  let tier = 0
  for (const c of chars) {
    suitability += c.suitability[mode]
    tier += pvpTierScore(c)
  }
  score += suitability * 20
  // Tier is a tiebreaker, not a driver — template priority and speed matter more
  score += tier * 3
  return score
}

function isValidTeam(chars: Character[]): boolean {
  if (chars.length !== 5) return false
  return hasValidBurstChain(chars)
}

function randInt(max: number): number {
  return Math.floor(Math.random() * max)
}

/**
 * Deep copy a teams array (array of arrays of Characters).
 */
function cloneTeams(teams: Character[][]): Character[][] {
  return teams.map(t => [...t])
}

function charBurstGenTotal(c: Character, mode: ArenaMode): number {
  const bg = c.burstGen[mode]
  return (bg['2RL'] || 0) + (bg['3RL'] || 0) + (bg['5SG'] || 0)
}

const NO_LOCKS: Set<string> = new Set()

function countSwappable(team: Character[], lockedIds: Set<string>): number {
  let count = 0
  for (const c of team) {
    if (!lockedIds.has(c.id)) count++
  }
  return count
}

/** Index of the `n`-th unlocked member (0-based), or undefined if there are fewer. */
function nthSwappableIdx(team: Character[], lockedIds: Set<string>, n: number): number | undefined {
  let remaining = n
  for (let i = 0; i < team.length; i++) {
    if (lockedIds.has(team[i]!.id)) continue
    if (remaining === 0) return i
    remaining--
  }
  return undefined
}

function pickSwappableIdx(team: Character[], lockedIds: Set<string>): number | undefined {
  const count = countSwappable(team, lockedIds)
  return count > 0 ? nthSwappableIdx(team, lockedIds, randInt(count)) : undefined
}

/**
 * Pick one of the two unlocked members with the lowest (or highest) burst generation,
 * at random for variety. Ties resolve to the earlier index.
 */
function pickByBurstGen(
  members: Character[],
  mode: ArenaMode,
  lockedIds: Set<string>,
  want: 'lowest' | 'highest',
): number | undefined {
  const lowest = want === 'lowest'
  let firstIdx = -1
  let secondIdx = -1
  let firstBg = 0
  let secondBg = 0

  for (let i = 0; i < members.length; i++) {
    const c = members[i]!
    if (lockedIds.has(c.id)) continue
    const bg = charBurstGenTotal(c, mode)
    if (firstIdx === -1 || (lowest ? bg < firstBg : bg > firstBg)) {
      secondIdx = firstIdx
      secondBg = firstBg
      firstIdx = i
      firstBg = bg
    }
    else if (secondIdx === -1 || (lowest ? bg < secondBg : bg > secondBg)) {
      secondIdx = i
      secondBg = bg
    }
  }

  if (firstIdx === -1) return undefined
  if (secondIdx === -1) return firstIdx
  return randInt(2) === 0 ? firstIdx : secondIdx
}

function swapTeamBench(team: Character[], charIdx: number, bench: Character[], benchIdx: number): void {
  const temp = team[charIdx]!
  team[charIdx] = bench[benchIdx]!
  bench[benchIdx] = temp
}

function generateNeighbor(
  teams: Character[][],
  bench: Character[],
  mode: ArenaMode,
  lockedIds: Set<string>,
): { teams: Character[][], bench: Character[] } {
  // Copy-on-write: a team (or the bench) is duplicated only once a move mutates it, so
  // the inputs are never written through. That is what lets `optimize` keep `current`
  // and `best` pointing at arrays this neighbor may share.
  const newTeams = teams.slice()
  let newBench = bench

  function writableTeam(idx: number): Character[] {
    const team = newTeams[idx]!
    if (team === teams[idx]) {
      const copy = team.slice()
      newTeams[idx] = copy
      return copy
    }
    return team
  }

  function writableBench(): Character[] {
    if (newBench === bench) newBench = bench.slice()
    return newBench
  }

  const move = Math.random()

  if (move < MOVE_INTER_TEAM && newTeams.length > 1) {
    // Swap between two teams (only flex slots)
    const teamAIdx = randInt(newTeams.length)
    let teamBIdx = randInt(newTeams.length)
    while (teamBIdx === teamAIdx) teamBIdx = randInt(newTeams.length)

    const charAIdx = pickSwappableIdx(newTeams[teamAIdx]!, lockedIds)
    const charBIdx = pickSwappableIdx(newTeams[teamBIdx]!, lockedIds)
    if (charAIdx != null && charBIdx != null) {
      const teamA = writableTeam(teamAIdx)
      const teamB = writableTeam(teamBIdx)
      const temp = teamA[charAIdx]!
      teamA[charAIdx] = teamB[charBIdx]!
      teamB[charBIdx] = temp
    }
  }
  else if (move < MOVE_SPEED_REBALANCE && newTeams.length > 1) {
    // Speed-rebalancing: identify slowest team and either swap with fastest team or pull from bench.
    // Ties go to the first index.
    let slowIdx = 0
    let fastIdx = 0
    let slowSpeed = Infinity
    let fastSpeed = -Infinity
    for (let t = 0; t < newTeams.length; t++) {
      const speed = SPEED_TIER_SCORES[effectiveSpeedTier(newTeams[t]!, mode)] || 0
      if (speed < slowSpeed) { slowSpeed = speed; slowIdx = t }
      if (speed > fastSpeed) { fastSpeed = speed; fastIdx = t }
    }
    // Give up the slow team's weakest burst generator
    const si = pickByBurstGen(newTeams[slowIdx]!, mode, lockedIds, 'lowest')
    if (si == null) return { teams: newTeams, bench: newBench }

    if (Math.random() < 0.5 || newBench.length === 0) {
      const fi = slowIdx === fastIdx
        ? undefined
        : pickByBurstGen(newTeams[fastIdx]!, mode, lockedIds, 'highest')
      if (fi != null) {
        const slowTeam = writableTeam(slowIdx)
        const fastTeam = writableTeam(fastIdx)
        const temp = fastTeam[fi]!
        fastTeam[fi] = slowTeam[si]!
        slowTeam[si] = temp
      }
    }
    else {
      const bi = pickByBurstGen(newBench, mode, NO_LOCKS, 'highest')
      if (bi != null) swapTeamBench(writableTeam(slowIdx), si, writableBench(), bi)
    }
  }
  else if (move < MOVE_BENCH_SWAP && newBench.length > 0) {
    // Swap flex slot with bench
    const teamIdx = randInt(newTeams.length)
    const charIdx = pickSwappableIdx(newTeams[teamIdx]!, lockedIds)
    if (charIdx != null) {
      swapTeamBench(writableTeam(teamIdx), charIdx, writableBench(), randInt(newBench.length))
    }
  }
  else if (newBench.length > 0) {
    // Double bench swap on flex slots; falls back to single swap if < 2 unlocked or < 2 bench
    const teamIdx = randInt(newTeams.length)
    const unlockedCount = countSwappable(newTeams[teamIdx]!, lockedIds)
    if (unlockedCount >= 2 && newBench.length >= 2) {
      const pick1 = randInt(unlockedCount)
      let pick2 = randInt(unlockedCount)
      while (pick2 === pick1) pick2 = randInt(unlockedCount)
      const charIdx1 = nthSwappableIdx(newTeams[teamIdx]!, lockedIds, pick1)!
      const charIdx2 = nthSwappableIdx(newTeams[teamIdx]!, lockedIds, pick2)!
      const benchIdx1 = randInt(newBench.length)
      let benchIdx2 = randInt(newBench.length)
      while (benchIdx2 === benchIdx1) benchIdx2 = randInt(newBench.length)

      const team = writableTeam(teamIdx)
      const benchCopy = writableBench()
      const t1 = team[charIdx1]!
      const t2 = team[charIdx2]!
      team[charIdx1] = benchCopy[benchIdx1]!
      team[charIdx2] = benchCopy[benchIdx2]!
      benchCopy[benchIdx1] = t1
      benchCopy[benchIdx2] = t2
    }
    else {
      const charIdx = pickSwappableIdx(newTeams[teamIdx]!, lockedIds)
      if (charIdx != null) {
        swapTeamBench(writableTeam(teamIdx), charIdx, writableBench(), randInt(newBench.length))
      }
    }
  }

  return { teams: newTeams, bench: newBench }
}

/**
 * Run simulated annealing to optimize team allocation.
 *
 * For 15v15: optimizes 3 teams of 5 by swapping characters between teams and with bench.
 * For 5v5: optimizes 1 team of 5 by swapping with bench.
 */
export function useSimulatedAnnealing() {
  function optimize(
    initialTeams: Character[][],
    bench: Character[],
    mode: ArenaMode,
    options: Partial<SAOptions> = {},
    preferredSpeeds?: SpeedTier[],
    lockedIds: Set<string> = NO_LOCKS,
  ): Character[][] {
    const opts = { ...DEFAULT_OPTIONS, ...options }

    let current = cloneTeams(initialTeams)
    let currentBench = [...bench]
    let currentEnergy = -totalScore(current, mode, preferredSpeeds)
    let best = cloneTeams(current)
    let bestEnergy = currentEnergy
    let temp = opts.startTemp

    for (let i = 0; i < opts.iterations; i++) {
      const neighbor = generateNeighbor(current, currentBench, mode, lockedIds)

      // Validate all teams have valid burst chains
      const allValid = neighbor.teams.every(t => isValidTeam(t))
      if (!allValid) {
        temp *= opts.coolingRate
        continue
      }

      const neighborEnergy = -totalScore(neighbor.teams, mode, preferredSpeeds)
      const delta = neighborEnergy - currentEnergy

      // Accept if better, or probabilistically if worse (Metropolis criterion)
      if (delta < 0 || Math.random() < Math.exp(-delta / temp)) {
        current = neighbor.teams
        currentBench = neighbor.bench
        currentEnergy = neighborEnergy

        if (currentEnergy < bestEnergy) {
          best = cloneTeams(current)
          bestEnergy = currentEnergy
        }
      }

      temp *= opts.coolingRate
    }

    return best
  }

  /**
   * Optimize a single 5v5 team by swapping members with bench characters.
   */
  function optimize5v5(
    initialTeam: Character[],
    bench: Character[],
    mode: ArenaMode,
    options?: Partial<SAOptions>,
    preferredSpeed?: SpeedTier,
    lockedIds?: Set<string>,
  ): Character[] {
    const result = optimize([initialTeam], bench, mode, options, preferredSpeed ? [preferredSpeed] : undefined, lockedIds)
    return result[0]!
  }

  /**
   * Optimize 15v15 allocation by swapping characters between 3 teams and with bench.
   * preferredSpeeds: one per team, controls speed score capping during optimization.
   */
  function optimize15v15(
    initialTeams: Character[][],
    bench: Character[],
    mode: ArenaMode,
    options?: Partial<SAOptions>,
    preferredSpeeds?: SpeedTier[],
    lockedIds?: Set<string>,
  ): Character[][] {
    return optimize(initialTeams, bench, mode, options, preferredSpeeds, lockedIds)
  }

  return { optimize5v5, optimize15v15 }
}

function totalScore(teams: Character[][], mode: ArenaMode, preferredSpeeds?: SpeedTier[]): number {
  let sum = 0
  for (let i = 0; i < teams.length; i++) {
    sum += scoreTeamRaw(teams[i]!, mode, preferredSpeeds?.[i])
  }
  return sum
}
