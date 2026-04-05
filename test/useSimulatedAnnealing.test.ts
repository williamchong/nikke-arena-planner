import { describe, it, expect } from 'vitest'
import { scoreTeamRaw, useSimulatedAnnealing, SPEED_TIER_SCORES } from '~/composables/useSimulatedAnnealing'
import { useBurstCalculator } from '~/composables/useBurstCalculator'
import { fastRL, makeTeam } from './helpers'

const { calculate, validateBurstChain } = useBurstCalculator()

describe('scoreTeamRaw', () => {
  it('returns negative score for invalid burst chain', () => {
    // All B1 — no B2 or B3
    const team = [
      fastRL('a', 'I'), fastRL('b', 'I'), fastRL('c', 'I'),
      fastRL('d', 'I'), fastRL('e', 'I'),
    ]
    expect(scoreTeamRaw(team, 'defense')).toBeLessThan(0)
  })

  it('scores valid team with positive score', () => {
    const team = makeTeam({ prefix: 'valid', speed: 'fast' })
    const score = scoreTeamRaw(team, 'defense')
    expect(score).toBeGreaterThan(0)
  })

  it('caps speed at preferredSpeed', () => {
    const team = makeTeam({ prefix: 'cap', speed: 'fast' })
    const uncapped = scoreTeamRaw(team, 'defense')
    const capped = scoreTeamRaw(team, 'defense', '4RL')
    // Capped score should be lower since the team is faster than 4RL
    expect(capped).toBeLessThan(uncapped)
  })

  it('applies below-preferred penalty when team is slower than preferred', () => {
    const team = makeTeam({ prefix: 'slow', speed: 'slow' })
    const result = calculate(team, 'defense')
    const actualSpeedScore = SPEED_TIER_SCORES[result.effectiveTier] || 0
    const prefSpeedScore = SPEED_TIER_SCORES['3RL']!

    // Precondition: slow team can't reach 3RL
    expect(actualSpeedScore).toBeLessThan(prefSpeedScore)

    const withPref = scoreTeamRaw(team, 'defense', '3RL')
    const withoutPref = scoreTeamRaw(team, 'defense')
    expect(withPref).toBeLessThan(withoutPref)
  })
})

describe('useSimulatedAnnealing', () => {
  const { optimize5v5, optimize15v15 } = useSimulatedAnnealing()

  describe('optimize5v5', () => {
    it('returns a valid 5-person team', () => {
      const team = makeTeam({ prefix: 'opt5', speed: 'fast' })
      const result = optimize5v5(team, [], 'defense')
      expect(result).toHaveLength(5)
      expect(validateBurstChain(result).valid).toBe(true)
    })

    it('can swap bench characters into team', () => {
      const team = makeTeam({ prefix: 'base', speed: 'slow' })
      const bench = [
        fastRL('bench-b1', 'I', 'SSS'),
        fastRL('bench-b2', 'II', 'SSS'),
      ]
      const result = optimize5v5(team, bench, 'defense')
      expect(validateBurstChain(result).valid).toBe(true)
      // SA should have considered bench chars (may or may not swap depending on scoring)
      expect(result).toHaveLength(5)
    })
  })

  describe('optimize15v15', () => {
    it('returns 3 valid teams of 5', () => {
      const teams = [
        makeTeam({ prefix: 't1', speed: 'fast' }),
        makeTeam({ prefix: 't2', speed: 'fast' }),
        makeTeam({ prefix: 't3', speed: 'slow' }),
      ]
      const result = optimize15v15(teams, [], 'defense', { iterations: 500 })
      expect(result).toHaveLength(3)
      for (const team of result) {
        expect(team).toHaveLength(5)
        expect(validateBurstChain(team).valid).toBe(true)
      }
    })

    it('respects locked character IDs', () => {
      const teams = [
        makeTeam({ prefix: 't1', speed: 'fast' }),
        makeTeam({ prefix: 't2', speed: 'fast' }),
        makeTeam({ prefix: 't3', speed: 'slow' }),
      ]
      // Lock the B1 char of each team
      const lockedIds = new Set(['t1-b1', 't2-b1', 't3-b1'])
      const result = optimize15v15(teams, [], 'defense', { iterations: 1000 }, undefined, lockedIds)

      // Each locked char should still be in its original team
      for (let i = 0; i < 3; i++) {
        const lockedId = [`t1-b1`, `t2-b1`, `t3-b1`][i]!
        const teamIds = result[i]!.map(c => c.id)
        expect(teamIds).toContain(lockedId)
      }
    })

    it('respects locked chars even with bench pressure', () => {
      const teams = [
        makeTeam({ prefix: 't1', speed: 'fast' }),
        makeTeam({ prefix: 't2', speed: 'fast' }),
        makeTeam({ prefix: 't3', speed: 'slow' }),
      ]
      const bench = [
        fastRL('bench-b1', 'I', 'SSS'),
        fastRL('bench-b2', 'II', 'SSS'),
        fastRL('bench-b3', 'III', 'SSS'),
      ]
      const lockedIds = new Set(['t1-b1', 't2-b1', 't3-b1'])
      const result = optimize15v15(teams, bench, 'defense', { iterations: 2000 }, undefined, lockedIds)

      for (let i = 0; i < 3; i++) {
        const lockedId = [`t1-b1`, `t2-b1`, `t3-b1`][i]!
        const teamIds = result[i]!.map((c: { id: string }) => c.id)
        expect(teamIds).toContain(lockedId)
      }
    })

    it('improves speed balance across teams when bench has fast chars', () => {
      const teams = [
        makeTeam({ prefix: 't1', speed: 'fast' }),
        makeTeam({ prefix: 't2', speed: 'fast' }),
        makeTeam({ prefix: 't3', speed: 'slow' }),
      ]
      const bench = [
        fastRL('bench-b1', 'I', 'S'),
        fastRL('bench-b2', 'II', 'S'),
        fastRL('bench-b3', 'III', 'S'),
      ]

      const beforeSpeeds = teams.map(t => calculate(t, 'defense').effectiveTier)
      const result = optimize15v15(
        teams, bench, 'defense',
        { iterations: 2000, startTemp: 150, coolingRate: 0.999 },
        ['3RL', '3RL', '3RL'],
      )
      const afterSpeeds = result.map(t => calculate(t, 'defense').effectiveTier)

      // The slowest team should have improved (or at least not gotten worse)
      const beforeMin = Math.min(...beforeSpeeds.map(t => SPEED_TIER_SCORES[t] || 0))
      const afterMin = Math.min(...afterSpeeds.map(t => SPEED_TIER_SCORES[t] || 0))
      expect(afterMin).toBeGreaterThanOrEqual(beforeMin)
    })

    it('never produces duplicate characters across teams', () => {
      const teams = [
        makeTeam({ prefix: 't1', speed: 'fast' }),
        makeTeam({ prefix: 't2', speed: 'fast' }),
        makeTeam({ prefix: 't3', speed: 'slow' }),
      ]
      const bench = [
        fastRL('bench-1', 'I', 'S'),
        fastRL('bench-2', 'II', 'S'),
      ]
      const result = optimize15v15(teams, bench, 'defense', { iterations: 1000 })

      const allIds = result.flat().map(c => c.id)
      const uniqueIds = new Set(allIds)
      expect(uniqueIds.size).toBe(allIds.length)
    })
  })
})
