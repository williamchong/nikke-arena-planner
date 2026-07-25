import { describe, expect, it } from 'vitest'
import { autoFillTeam, useTeamRecommender } from '~/composables/useTeamRecommender'
import { allCharacters, charMap } from './helpers'

const { recommend5v5, recommend15v15, recommendAround } = useTeamRecommender()
const owned = new Set(allCharacters.map(c => c.id))

/**
 * A pin is a hard placement: the character the user pinned to a team must appear in
 * that team. Every path that fails to satisfy a template falls through to autoFillTeam,
 * which used to pick purely by suitability — so pins were silently dropped, and in
 * 15v15 an earlier team could take a character pinned to a later one.
 */
describe('pinned characters', () => {
  describe('5v5', () => {
    for (const pins of [
      ['blanc'],
      ['blanc', 'jackal'],
      ['blanc', 'jackal', 'scarlet'],
      ['blanc', 'jackal', 'scarlet', 'noah'],
    ]) {
      it(`keeps ${pins.length} pinned character(s)`, () => {
        const team = recommend5v5(owned, 'attack', new Set(pins))[0]
        expect(team, 'no team produced').toBeTruthy()
        for (const id of pins) expect(team!.characters).toContain(id)
        expect(team!.characters).toHaveLength(5)
      })
    }

    it('treats a full pin set as the team rather than returning nothing', () => {
      const pins = ['blanc', 'jackal', 'scarlet', 'noah', 'centi']
      const team = recommendAround(pins, owned, 'attack')
      expect(team, 'full pin set produced no team').toBeTruthy()
      expect([...team!.characters].sort()).toEqual([...pins].sort())
    })

    it('reports no team when the pins cannot form a burst chain', () => {
      // three Burst III and nothing else can ever complete a chain
      const team = recommendAround(['scarlet', 'emilia', 'helm-treasure', 'ada', 'liberalio'], owned, 'attack')
      expect(team).toBeNull()
    })

    it('reports no team when more than five characters are pinned', () => {
      const six = ['blanc', 'jackal', 'scarlet', 'noah', 'centi', 'trina']
      expect(recommendAround(six, owned, 'attack')).toBeNull()
    })
  })

  /**
   * Tested directly: every end-to-end path runs the result through simulated
   * annealing, which repairs a poor composition and hides what auto-fill produced.
   */
  describe('autoFillTeam', () => {
    const pool = (ids: string[]) => ids.map(id => charMap.get(id)!)
    const gapsIn = (team: { characters: string[] }) => {
      const bursts = team.characters.map(id => charMap.get(id)!.burst)
      return (['I', 'II', 'III'] as const).filter(b => !bursts.includes(b))
    }

    /**
     * validateBurstChain short-circuits to valid on ANY Λ, so a Λ pin can mask a team
     * with no B1 and no B3. Assert a real rotation instead — Λ may cover at most one
     * gap, because it only fires in one slot.
     */
    it('builds a real rotation around a pinned Λ character', () => {
      const available = pool(['rumani', 'pascal', 'trina', 'anis', 'centi', 'noir', 'sugar', 'drake'])
      const team = autoFillTeam(available, 'attack', pool(['red-hood']))
      expect(team, 'no team produced').toBeTruthy()
      expect(team!.characters).toContain('red-hood')
      expect(
        gapsIn(team!),
        `${team!.characters.join(' + ')} leans on Λ to cover missing bursts`,
      ).toHaveLength(0)
    })

    it('takes Λ when the remaining slots cannot cover every missing burst', () => {
      // four Burst II pinned leaves one slot for two gaps — only Λ can close that
      const team = autoFillTeam(
        pool(['jackal', 'rumani', 'red-hood', 'noir']),
        'attack',
        pool(['trina', 'anis', 'centi', 'nihilister']),
      )
      expect(team, 'no team produced despite a Λ being available').toBeTruthy()
      expect(team!.characters).toContain('red-hood')
    })

    it('is unchanged with no pins — one character per burst, then best suitability', () => {
      const available = pool(['rumani', 'pascal', 'trina', 'anis', 'noir', 'sugar'])
      const team = autoFillTeam(available, 'attack')
      expect(team).toBeTruthy()
      expect(gapsIn(team!)).toHaveLength(0)
    })

    it('reports no team when the pins alone cannot form a chain', () => {
      const team = autoFillTeam([], 'attack', pool(['noir', 'sugar', 'drake', 'maiden-ice-rose', 'snow-white-heavy-arms']))
      expect(team).toBeNull()
    })
  })

  describe('15v15', () => {
    const cases: Record<string, string[][]> = {
      'one per team': [['blanc'], ['jackal'], ['scarlet']],
      'two per team': [['blanc', 'noah'], ['jackal', 'centi'], ['scarlet', 'trina']],
      'a full team plus two empty': [['jackal', 'blanc', 'scarlet', 'centi', 'trina'], [], []],
      'uneven three/one/none': [['blanc', 'noah', 'scarlet'], ['jackal'], []],
    }

    for (const [label, pins] of Object.entries(cases)) {
      it(`places pins in their own team — ${label}`, () => {
        const set = recommend15v15(owned, 'attack', pins.map(p => new Set(p)))[0]
        expect(set, 'no 15v15 set produced').toBeTruthy()
        expect(set).toHaveLength(3)
        pins.forEach((teamPins, i) => {
          for (const id of teamPins) {
            expect(
              set![i]!.characters,
              `${id} was pinned to team ${i + 1} but landed in ${
                set!.findIndex(t => t.characters.includes(id)) + 1 || 'no team'}`,
            ).toContain(id)
          }
        })
        // no character may appear in two teams
        const all = set!.flatMap(t => t.characters)
        expect(new Set(all).size).toBe(all.length)
      })
    }
  })
})
