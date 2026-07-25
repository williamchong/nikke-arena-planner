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

// Number of RL cycles each tier needs to fill the gauge
const TIER_CYCLES: Record<SpeedTier, number> = {
  '1RL': 1,
  '2RL': 2,
  '3SG': 1.5,
  '5SG': 2.5,
  '3RL': 3,
  '7SG': 3.5,
  '4RL': 4,
  '5RL': 5,
}

// Each burst stage transition takes ~0.53s (from spreadsheet B1→B2 and B2→B3 intervals)
const TRANSITION_TIME = 0.533

/**
 * Fastest tier whose team burst-gen total reaches a full gauge, or '5RL' if none do.
 * Split out of `calculate` because the annealing hot path needs only the tier.
 */
export function effectiveSpeedTier(characters: Character[], mode: ArenaMode): SpeedTier {
  for (const tier of SPEED_TIERS_ORDERED) {
    let total = 0
    for (const char of characters) {
      total += char.burstGen[mode][tier] || 0
    }
    if (total >= FULL_GAUGE) return tier
  }
  return '5RL'
}

/**
 * Whether a team can complete its burst chain: at least one each of B1, B2 and B3, or
 * any Λ (Red Hood), which acts as a wildcard for the whole chain.
 *
 * The authoritative rule — `validateBurstChain` defers to it and only adds the list of
 * which types are missing.
 */
export function hasValidBurstChain(characters: Character[]): boolean {
  let found = 0
  for (const char of characters) {
    // Λ (Red Hood) acts as wildcard — can fill any burst type in the chain
    if (char.burst === 'Λ') return true
    if (char.burst === 'I') found |= 1
    else if (char.burst === 'II') found |= 2
    else if (char.burst === 'III') found |= 4
  }
  return found === 7
}

/**
 * `hasValidBurstChain` plus which burst types are missing, for the calculator's
 * invalid-chain message.
 */
function validateBurstChain(characters: Character[]): { valid: boolean, missing: BurstType[] } {
  if (hasValidBurstChain(characters)) return { valid: true, missing: [] }

  const types = new Set(characters.map(c => c.burst))
  return {
    valid: false,
    missing: (['I', 'II', 'III'] as BurstType[]).filter(b => !types.has(b)),
  }
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

    const effectiveTier = effectiveSpeedTier(characters, mode)

    // Calculate approximate timings based on effective tier
    // Each RL cycle = ~1s of charge + fire time
    // Speed tier name tells us how many RL cycles to fill gauge
    const cycles = TIER_CYCLES[effectiveTier] || 5

    const timings = {
      b1: cycles * RL_CYCLE_TIME,
      b2: cycles * RL_CYCLE_TIME + TRANSITION_TIME,
      b3: cycles * RL_CYCLE_TIME + TRANSITION_TIME * 2,
      total: cycles * RL_CYCLE_TIME + TRANSITION_TIME * 2,
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
