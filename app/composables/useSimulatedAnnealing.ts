import type { ArenaMode, Character } from '~/types/character'
import { useBurstCalculator } from './useBurstCalculator'

const { calculate, validateBurstChain } = useBurstCalculator()

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
 * Score a team without requiring a template.
 * Based on burst speed, suitability, and PVP tier.
 * If preferredSpeed is provided, speed score is capped at that tier.
 */
export function scoreTeamRaw(chars: Character[], mode: ArenaMode, preferredSpeed?: string): number {
  const result = calculate(chars, mode)
  if (!result.valid) return -1000

  // Precompute team trait set once — scoreTeamRaw is called from SA's per-iteration hot loop
  // and from fillTemplate's brute-force combo scoring, so the O(n²) naive scan matters.
  const teamTraits = new Set<string>()
  for (const c of chars) {
    for (const t of c.traits ?? []) teamTraits.add(t)
  }

  // Hard reject: characters whose `requiresTeammate` traits are absent from the team
  // (e.g. Nero's kit requires a healer teammate to activate Cat's Repayment and Grumpy Cat buffs).
  for (const c of chars) {
    if (!c.requiresTeammate) continue
    for (const req of c.requiresTeammate) {
      if (!teamTraits.has(req)) return -1000
    }
  }

  let score = 0

  for (const c of chars) {
    if (!c.prefersTeammate) continue
    for (const pref of c.prefersTeammate) {
      if (!teamTraits.has(pref)) score -= MISSING_PREFERRED_TRAIT_PENALTY
    }
  }

  const actualSpeed = SPEED_TIER_SCORES[result.effectiveTier] || 0
  const prefSpeed = preferredSpeed ? (SPEED_TIER_SCORES[preferredSpeed] || actualSpeed) : actualSpeed
  score += Math.min(actualSpeed, prefSpeed)
  if (prefSpeed > actualSpeed) {
    score -= (prefSpeed - actualSpeed) * BELOW_PREFERRED_PENALTY
  }
  score += chars.reduce((sum, c) => sum + c.suitability[mode], 0) * 20
  // Tier is a tiebreaker, not a driver — template priority and speed matter more
  score += chars.reduce((sum, c) => sum + (PVP_TIER_SCORES[c.pvpTier || 'C'] || 0), 0) * 3
  return score
}

function isValidTeam(chars: Character[]): boolean {
  if (chars.length !== 5) return false
  return validateBurstChain(chars).valid
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

/**
 * Generate a neighbor state by performing one random move.
 * Returns new teams and updated bench arrays (copies, not mutated).
 */
function pickSwappableIdx(team: Character[], lockedIds: Set<string>): number | undefined {
  const unlocked = team.map((_, i) => i).filter(i => !lockedIds.has(team[i]!.id))
  return unlocked.length > 0 ? unlocked[randInt(unlocked.length)]! : undefined
}

function swapTeamBench(teams: Character[][], teamIdx: number, charIdx: number, bench: Character[], benchIdx: number): void {
  const temp = teams[teamIdx]![charIdx]!
  teams[teamIdx]![charIdx] = bench[benchIdx]!
  bench[benchIdx] = temp
}

function generateNeighbor(
  teams: Character[][],
  bench: Character[],
  mode: ArenaMode,
  lockedIds: Set<string>,
): { teams: Character[][], bench: Character[] } {
  const newTeams = cloneTeams(teams)
  const newBench = [...bench]

  const move = Math.random()

  if (move < MOVE_INTER_TEAM && newTeams.length > 1) {
    // Swap between two teams (only flex slots)
    const teamAIdx = randInt(newTeams.length)
    let teamBIdx = randInt(newTeams.length)
    while (teamBIdx === teamAIdx) teamBIdx = randInt(newTeams.length)

    const charAIdx = pickSwappableIdx(newTeams[teamAIdx]!, lockedIds)
    const charBIdx = pickSwappableIdx(newTeams[teamBIdx]!, lockedIds)
    if (charAIdx != null && charBIdx != null) {
      const temp = newTeams[teamAIdx]![charAIdx]!
      newTeams[teamAIdx]![charAIdx] = newTeams[teamBIdx]![charBIdx]!
      newTeams[teamBIdx]![charBIdx] = temp
    }
  }
  else if (move < MOVE_SPEED_REBALANCE && newTeams.length > 1) {
    // Speed-rebalancing: identify slowest team and either swap with fastest team or pull from bench
    const teamSpeeds = newTeams.map(t => {
      const result = calculate(t, mode)
      return SPEED_TIER_SCORES[result.effectiveTier] || 0
    })
    const slowIdx = teamSpeeds.indexOf(Math.min(...teamSpeeds))
    const slowBg = newTeams[slowIdx]!
      .map((c, i) => ({ i, bg: charBurstGenTotal(c, mode), locked: lockedIds.has(c.id) }))
      .filter(x => !x.locked)
    if (slowBg.length === 0) { return { teams: newTeams, bench: newBench } }
    slowBg.sort((a, b) => a.bg - b.bg)
    // Pick from bottom 2 (not always #1) for variety
    const si = slowBg[randInt(Math.min(2, slowBg.length))]!.i

    if (Math.random() < 0.5 || newBench.length === 0) {
      const fastIdx = teamSpeeds.indexOf(Math.max(...teamSpeeds))
      if (slowIdx !== fastIdx) {
        const fastBg = newTeams[fastIdx]!
          .map((c, i) => ({ i, bg: charBurstGenTotal(c, mode), locked: lockedIds.has(c.id) }))
          .filter(x => !x.locked)
        if (fastBg.length > 0) {
          fastBg.sort((a, b) => b.bg - a.bg)
          const fi = fastBg[randInt(Math.min(2, fastBg.length))]!.i
          const temp = newTeams[fastIdx]![fi]!
          newTeams[fastIdx]![fi] = newTeams[slowIdx]![si]!
          newTeams[slowIdx]![si] = temp
        }
      }
    }
    else {
      const benchBg = newBench.map((c, i) => ({ i, bg: charBurstGenTotal(c, mode) }))
      benchBg.sort((a, b) => b.bg - a.bg)
      const bi = benchBg[randInt(Math.min(2, benchBg.length))]!.i
      swapTeamBench(newTeams, slowIdx, si, newBench, bi)
    }
  }
  else if (move < MOVE_BENCH_SWAP && newBench.length > 0) {
    // Swap flex slot with bench
    const teamIdx = randInt(newTeams.length)
    const charIdx = pickSwappableIdx(newTeams[teamIdx]!, lockedIds)
    if (charIdx != null) {
      swapTeamBench(newTeams, teamIdx, charIdx, newBench, randInt(newBench.length))
    }
  }
  else if (newBench.length > 0) {
    // Double bench swap on flex slots; falls back to single swap if < 2 unlocked or < 2 bench
    const teamIdx = randInt(newTeams.length)
    const unlocked = newTeams[teamIdx]!.map((_, i) => i).filter(i => !lockedIds.has(newTeams[teamIdx]![i]!.id))
    if (unlocked.length >= 2 && newBench.length >= 2) {
      const pick1 = randInt(unlocked.length)
      let pick2 = randInt(unlocked.length)
      while (pick2 === pick1) pick2 = randInt(unlocked.length)
      const charIdx1 = unlocked[pick1]!
      const charIdx2 = unlocked[pick2]!
      const benchIdx1 = randInt(newBench.length)
      let benchIdx2 = randInt(newBench.length)
      while (benchIdx2 === benchIdx1) benchIdx2 = randInt(newBench.length)

      const t1 = newTeams[teamIdx]![charIdx1]!
      const t2 = newTeams[teamIdx]![charIdx2]!
      newTeams[teamIdx]![charIdx1] = newBench[benchIdx1]!
      newTeams[teamIdx]![charIdx2] = newBench[benchIdx2]!
      newBench[benchIdx1] = t1
      newBench[benchIdx2] = t2
    }
    else if (unlocked.length >= 1) {
      swapTeamBench(newTeams, teamIdx, unlocked[randInt(unlocked.length)]!, newBench, randInt(newBench.length))
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
    preferredSpeeds?: string[],
    lockedIds: Set<string> = new Set(),
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
    preferredSpeed?: string,
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
    preferredSpeeds?: string[],
    lockedIds?: Set<string>,
  ): Character[][] {
    return optimize(initialTeams, bench, mode, options, preferredSpeeds, lockedIds)
  }

  return { optimize5v5, optimize15v15 }
}

function totalScore(teams: Character[][], mode: ArenaMode, preferredSpeeds?: string[]): number {
  return teams.reduce((sum, team, idx) => sum + scoreTeamRaw(team, mode, preferredSpeeds?.[idx]), 0)
}
