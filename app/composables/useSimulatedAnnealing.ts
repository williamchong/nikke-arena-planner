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

/**
 * Score a team without requiring a template.
 * Based on burst speed, suitability, and PVP tier.
 * If preferredSpeed is provided, speed score is capped at that tier.
 */
export function scoreTeamRaw(chars: Character[], mode: ArenaMode, preferredSpeed?: string): number {
  const result = calculate(chars, mode)
  if (!result.valid) return -1000

  let score = 0
  const actualSpeed = SPEED_TIER_SCORES[result.effectiveTier] || 0
  const prefSpeed = preferredSpeed ? (SPEED_TIER_SCORES[preferredSpeed] || actualSpeed) : actualSpeed
  score += Math.min(actualSpeed, prefSpeed)
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

/**
 * Generate a neighbor state by performing one random move.
 * Returns new teams and updated bench arrays (copies, not mutated).
 */
function generateNeighbor(
  teams: Character[][],
  bench: Character[],
): { teams: Character[][], bench: Character[] } {
  const newTeams = cloneTeams(teams)
  const newBench = [...bench]

  const move = Math.random()

  if (move < 0.5 && newTeams.length > 1) {
    // Swap between two teams
    const teamAIdx = randInt(newTeams.length)
    let teamBIdx = randInt(newTeams.length)
    while (teamBIdx === teamAIdx) teamBIdx = randInt(newTeams.length)

    const charAIdx = randInt(newTeams[teamAIdx]!.length)
    const charBIdx = randInt(newTeams[teamBIdx]!.length)

    const temp = newTeams[teamAIdx]![charAIdx]!
    newTeams[teamAIdx]![charAIdx] = newTeams[teamBIdx]![charBIdx]!
    newTeams[teamBIdx]![charBIdx] = temp
  }
  else if (newBench.length > 0) {
    // Swap with bench
    const teamIdx = randInt(newTeams.length)
    const charIdx = randInt(newTeams[teamIdx]!.length)
    const benchIdx = randInt(newBench.length)

    const temp = newTeams[teamIdx]![charIdx]!
    newTeams[teamIdx]![charIdx] = newBench[benchIdx]!
    newBench[benchIdx] = temp
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
  ): Character[][] {
    const opts = { ...DEFAULT_OPTIONS, ...options }

    let current = cloneTeams(initialTeams)
    let currentBench = [...bench]
    let currentEnergy = -totalScore(current, mode, preferredSpeeds)
    let best = cloneTeams(current)
    let bestEnergy = currentEnergy
    let temp = opts.startTemp

    for (let i = 0; i < opts.iterations; i++) {
      const neighbor = generateNeighbor(current, currentBench)

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
  ): Character[] {
    const result = optimize([initialTeam], bench, mode, options, preferredSpeed ? [preferredSpeed] : undefined)
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
  ): Character[][] {
    return optimize(initialTeams, bench, mode, options, preferredSpeeds)
  }

  return { optimize5v5, optimize15v15 }
}

function totalScore(teams: Character[][], mode: ArenaMode, preferredSpeeds?: string[]): number {
  return teams.reduce((sum, team, idx) => sum + scoreTeamRaw(team, mode, preferredSpeeds?.[idx]), 0)
}
