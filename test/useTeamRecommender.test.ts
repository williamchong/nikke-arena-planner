import { describe, it, expect } from 'vitest'
import { useSimulatedAnnealing, SPEED_TIER_SCORES, PVP_TIER_SCORES } from '~/composables/useSimulatedAnnealing'
import { useBurstCalculator } from '~/composables/useBurstCalculator'
import { useTeamRecommender } from '~/composables/useTeamRecommender'
import { allCharacters, charMap, resolve } from './helpers'

const { calculate, validateBurstChain } = useBurstCalculator()
const { optimize15v15 } = useSimulatedAnnealing()

// The user's actual roster that triggered the 3RL×3 issue
const USER_ROSTER = new Set([
  'snow-white-heavy-arms', 'takina', 'chisato', 'milk-blooming-bunny', 'drake-treasure',
  'eunhwa-tactical-upgrade', 'vesti-tactical-upgrade', 'dorothy-serendipity', 'sora', 'eve',
  'mori', 'little-mermaid', 'crust', 'bready', 'liberalio', 'nayuta', 'helm-treasure',
  'rapi-red-hood', 'mast-romantic-maid', 'anchor-innocent-maid', 'mana', 'maiden-ice-rose',
  'flora', 'cinderella', 'rumani', 'quency-escape-queen', 'rouge', 'zwei', 'ein',
  'alice-wonderland-bunny', 'soda-twinkling-bunny', 'crown', 'bay', 'ade', 'privaty-unkind-maid',
  'scarlet-black-shadow', 'tove', 'red-hood', 'tia', 'naga', 'quiry', 'marciana', 'anchor',
  'anis-sparkling-summer', 'mast', 'nero', 'rosanna', 'noir', 'blanc', 'biscuit', 'jackal',
  'guilty', 'quency', 'viper', 'laplace', 'anis', 'centi', 'noah', 'liter', 'diesel', 'emma',
  'privaty-treasure', 'novel', 'miranda', 'alice', 'rupee', 'exia', 'rapi', 'milk', 'eunhwa',
  'poli', 'noise', 'vesti', 'scarlet', 'sugar', 'neon', 'emma-tactical-upgrade', 'snow-white',
  'mihara', 'brid', 'julia', 'signal', 'volume', 'crow', 'ludmilla', 'maxwell', 'cocoa',
  'frima', 'yulha', 'modernia', 'elegg', 'aria', 'trina',
])

describe('real character data', () => {
  it('all roster IDs exist in character data', () => {
    for (const id of USER_ROSTER) {
      expect(charMap.has(id), `Character "${id}" not found in allCharacters.json`).toBe(true)
    }
  })
})

describe('SA with real allCharacters — speed rebalancing', () => {
  // Simulate the problematic scenario: greedy allocation gives 3RL/3RL/4RL
  const team1Ids = ['jackal', 'noise', 'alice', 'biscuit', 'noah']
  const team2Ids = ['blanc', 'little-mermaid', 'scarlet', 'trina', 'centi']
  const team3Ids = ['crown', 'takina', 'rosanna', 'helm-treasure', 'nero']

  const team1 = resolve(team1Ids)
  const team2 = resolve(team2Ids)
  const team3 = resolve(team3Ids)

  it('team3 is initially slower than 3RL', () => {
    const result = calculate(team3, 'defense')
    const speedScore = SPEED_TIER_SCORES[result.effectiveTier] || 0
    expect(speedScore).toBeLessThan(SPEED_TIER_SCORES['3RL']!)
  })

  it('SA improves team3 speed when given bench with fast chars', () => {
    const usedIds = new Set([...team1Ids, ...team2Ids, ...team3Ids])
    const bench = allCharacters
      .filter(c => USER_ROSTER.has(c.id) && !usedIds.has(c.id))
      .filter(c => (PVP_TIER_SCORES[c.pvpTier || 'C'] || 0) >= 4)
      .sort((a, b) => (PVP_TIER_SCORES[b.pvpTier || 'C'] || 0) - (PVP_TIER_SCORES[a.pvpTier || 'C'] || 0))
      .slice(0, 8)

    const result = optimize15v15(
      [team1, team2, team3], bench, 'defense',
      { iterations: 8000, startTemp: 150, coolingRate: 0.999 },
      ['3RL', '3RL', '3RL'],
    )

    // All teams should have valid burst chains
    for (const team of result) {
      expect(team).toHaveLength(5)
      expect(validateBurstChain(team).valid).toBe(true)
    }

    // No duplicate allCharacters across teams
    const allIds = result.flat().map(c => c.id)
    expect(new Set(allIds).size).toBe(allIds.length)

    // The slowest team should reach at least 3RL (the whole point of this change)
    const speeds = result.map(t => SPEED_TIER_SCORES[calculate(t, 'defense').effectiveTier] || 0)
    const minSpeed = Math.min(...speeds)
    expect(minSpeed).toBeGreaterThanOrEqual(SPEED_TIER_SCORES['3RL']!)
  })

  it('locked chars stay in their teams after SA with real bench', () => {
    const usedIds = new Set([...team1Ids, ...team2Ids, ...team3Ids])
    const bench = allCharacters
      .filter(c => USER_ROSTER.has(c.id) && !usedIds.has(c.id))
      .filter(c => (PVP_TIER_SCORES[c.pvpTier || 'C'] || 0) >= 4)
      .slice(0, 8)

    // Lock one required char per team (simulating template required chars)
    const lockedIds = new Set(['jackal', 'little-mermaid', 'helm-treasure'])
    const result = optimize15v15(
      [team1, team2, team3], bench, 'defense',
      { iterations: 8000, startTemp: 150, coolingRate: 0.999 },
      ['3RL', '3RL', '3RL'],
      lockedIds,
    )

    // Jackal must stay in team 1
    expect(result[0]!.map(c => c.id)).toContain('jackal')
    // Little Mermaid must stay in team 2
    expect(result[1]!.map(c => c.id)).toContain('little-mermaid')
    // Helm: Treasure must stay in team 3
    expect(result[2]!.map(c => c.id)).toContain('helm-treasure')
  })
})

describe('useTeamRecommender — 15v15 integration', () => {
  const { recommend15v15 } = useTeamRecommender()

  it('produces 3 options of 3 valid teams each for the user roster', () => {
    const results = recommend15v15(USER_ROSTER, 'defense')
    expect(results.length).toBeGreaterThanOrEqual(1)

    for (const teamSet of results) {
      expect(teamSet).toHaveLength(3)
      for (const team of teamSet) {
        expect(team.characters).toHaveLength(5)
        const chars = resolve(team.characters)
        expect(validateBurstChain(chars).valid).toBe(true)
      }
    }
  })

  it('no duplicate characters within any 15v15 option', () => {
    const results = recommend15v15(USER_ROSTER, 'defense')
    for (const teamSet of results) {
      const allIds = teamSet.flatMap(t => t.characters)
      expect(new Set(allIds).size).toBe(allIds.length)
    }
  })

  it('achieves 3RL×3 for the user roster in at least one option', () => {
    const results = recommend15v15(USER_ROSTER, 'defense')
    const has3RL3 = results.some(teamSet =>
      teamSet.every(team => {
        const speed = SPEED_TIER_SCORES[team.burstSpeed] || 0
        return speed >= SPEED_TIER_SCORES['3RL']!
      }),
    )
    expect(has3RL3).toBe(true)
  })
})
