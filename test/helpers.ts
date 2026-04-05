import type { Character, SpeedTier } from '~/types/character'
import charactersData from '~/data/characters.json'

export const allCharacters = charactersData as Character[]
export const charMap = new Map(allCharacters.map(c => [c.id, c]))

export function resolve(ids: string[]): Character[] {
  return ids.map(id => charMap.get(id)).filter((c): c is Character => !!c)
}

const ZERO_BURST_GEN: Record<SpeedTier, number> = {
  '1RL': 0, '2RL': 0, '3SG': 0, '5SG': 0, '3RL': 0, '7SG': 0, '4RL': 0, '5RL': 0,
}

let charCounter = 0

export function mockChar(overrides: Partial<Character> & { id: string }): Character {
  charCounter++
  return {
    name: { en: overrides.id, 'zh-TW': overrides.id, 'zh-CN': overrides.id },
    burst: 'I',
    role: 'attacker',
    element: 'fire',
    manufacturer: 'elysion',
    weapon: 'RL',
    weaponDmg: 100,
    ammo: 6,
    reloadTime: 1.5,
    chargeTime: 0,
    maxCharge: null,
    chargeCoefficient: 0,
    hitMultiplier: 1,
    burstGen: {
      attack: { ...ZERO_BURST_GEN },
      defense: { ...ZERO_BURST_GEN },
    },
    suitability: { attack: 0, defense: 0 },
    releaseOrder: charCounter,
    pvpTier: 'A',
    ...overrides,
  }
}

export function fastRL(id: string, burst: 'I' | 'II' | 'III', pvpTier: Character['pvpTier'] = 'S'): Character {
  return mockChar({
    id,
    burst,
    weapon: 'RL',
    pvpTier,
    burstGen: {
      attack: { ...ZERO_BURST_GEN, '2RL': 0.28, '3RL': 0.43, '4RL': 0.55, '5RL': 0.65 },
      defense: { ...ZERO_BURST_GEN, '2RL': 0.28, '3RL': 0.43, '4RL': 0.55, '5RL': 0.65 },
    },
  })
}

export function slowChar(id: string, burst: 'I' | 'II' | 'III', pvpTier: Character['pvpTier'] = 'A'): Character {
  return mockChar({
    id,
    burst,
    weapon: 'MG',
    pvpTier,
    burstGen: {
      attack: { ...ZERO_BURST_GEN, '2RL': 0.05, '3RL': 0.09, '4RL': 0.15, '5RL': 0.20 },
      defense: { ...ZERO_BURST_GEN, '2RL': 0.05, '3RL': 0.09, '4RL': 0.15, '5RL': 0.20 },
    },
  })
}

export function makeTeam(opts: {
  prefix: string
  speed: 'fast' | 'slow'
  pvpTier?: Character['pvpTier']
}): Character[] {
  const { prefix, speed, pvpTier = 'A' } = opts
  const make = speed === 'fast' ? fastRL : slowChar
  return [
    make(`${prefix}-b1`, 'I', pvpTier),
    make(`${prefix}-b2a`, 'II', pvpTier),
    make(`${prefix}-b2b`, 'II', pvpTier),
    make(`${prefix}-b3`, 'III', pvpTier),
    make(`${prefix}-b2c`, 'II', pvpTier),
  ]
}
