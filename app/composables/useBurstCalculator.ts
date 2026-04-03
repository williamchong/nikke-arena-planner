import type { ArenaMode, BurstType, Character, SpeedTier } from '~/types/character'

// Tiers used for determining effective speed (fastest to slowest)
export const SPEED_TIERS_ORDERED: SpeedTier[] = ['2RL', '5SG', '3RL', '7SG', '4RL', '5RL']

// All tiers including non-standard ones used in burst gen tables
export const ALL_SPEED_TIERS: SpeedTier[] = ['1RL', '2RL', '3SG', '5SG', '3RL', '7SG', '4RL', '5RL']

export interface BurstResult {
  valid: boolean
  missingBurstTypes?: BurstType[]
  totalBurstGen: Record<SpeedTier, number>
  effectiveTier: SpeedTier
  timings: {
    b1: number
    b2: number
    b3: number
    total: number
  }
}

// RL charge+fire cycle time in seconds (the reference axis)
const RL_CYCLE_TIME = 1.0

// Burst gauge thresholds — each stage requires this much cumulative gen
// The spreadsheet normalizes burst gen values so that 1.0 = full gauge at that speed tier
const FULL_GAUGE = 1.0

/**
 * Check if burst chain is valid.
 * Needs at least one each of B1, B2, B3.
 * Λ (Red Hood) counts as any burst type.
 */
function validateBurstChain(characters: Character[]): { valid: boolean, missing: BurstType[] } {
  const types = new Set(characters.map(c => c.burst))
  const hasLambda = types.has('Λ')

  const missing: BurstType[] = []
  for (const needed of ['I', 'II', 'III'] as BurstType[]) {
    if (!types.has(needed) && !hasLambda) {
      missing.push(needed)
    }
  }

  // If we have Λ, it can fill up to one missing slot
  if (hasLambda && missing.length > 1) {
    // Λ can only fill one slot per Red Hood unit
    const lambdaCount = characters.filter(c => c.burst === 'Λ').length
    if (missing.length > lambdaCount) {
      return { valid: false, missing: missing.slice(lambdaCount) }
    }
  }

  return { valid: missing.length === 0, missing }
}

/**
 * Calculate burst speed for a team of 5 characters.
 */
export function useBurstCalculator() {
  function calculate(characters: Character[], mode: ArenaMode): BurstResult {
    const chainCheck = validateBurstChain(characters)

    const totalBurstGen = {} as Record<SpeedTier, number>
    for (const tier of ALL_SPEED_TIERS) {
      totalBurstGen[tier] = characters.reduce(
        (sum, char) => sum + (char.burstGen[mode][tier] || 0),
        0,
      )
    }

    // Determine effective speed tier
    // The team reaches a speed tier if the total burst gen at that tier >= FULL_GAUGE
    let effectiveTier: SpeedTier = '5RL'
    for (const tier of SPEED_TIERS_ORDERED) {
      if (totalBurstGen[tier] >= FULL_GAUGE) {
        effectiveTier = tier
        break
      }
    }

    // Calculate approximate timings based on effective tier
    // Each RL cycle = ~1s of charge + fire time
    // Speed tier name tells us how many RL cycles to fill gauge
    const tierCycles: Record<SpeedTier, number> = {
      '1RL': 1,
      '2RL': 2,
      '3SG': 1.5,
      '5SG': 2.5,
      '3RL': 3,
      '7SG': 3.5,
      '4RL': 4,
      '5RL': 5,
    }

    const cycles = tierCycles[effectiveTier] || 5
    // Each burst stage transition takes ~0.53s (from spreadsheet B1→B2 and B2→B3 intervals)
    const transitionTime = 0.533

    const timings = {
      b1: cycles * RL_CYCLE_TIME,
      b2: cycles * RL_CYCLE_TIME + transitionTime,
      b3: cycles * RL_CYCLE_TIME + transitionTime * 2,
      total: cycles * RL_CYCLE_TIME + transitionTime * 2,
    }

    return {
      valid: chainCheck.valid,
      missingBurstTypes: chainCheck.missing.length > 0 ? chainCheck.missing : undefined,
      totalBurstGen,
      effectiveTier,
      timings,
    }
  }

  return { calculate, validateBurstChain }
}
