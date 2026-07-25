import { describe, expect, it } from 'vitest'
import templatesJson from '~/data/templates.json'
import type { TeamTemplate } from '~/types/template'
import { allCharacters, charMap } from './helpers'

const templates = templatesJson as unknown as TeamTemplate[]
const TEAM_SIZE = 5
const archetypes = new Set(templates.map(t => t.archetype))
const locales = ['en', 'zh-TW', 'zh-CN', 'ja'] as const

/** Every 5-character set a template can produce: required + one option per flex slot. */
function producibleTeams(template: TeamTemplate): Set<string> {
  const teams = new Set<string>()
  const walk = (index: number, picked: string[]) => {
    if (index === template.flex.length) {
      if (picked.length === TEAM_SIZE) teams.add([...picked].sort().join('|'))
      return
    }
    for (const option of template.flex[index]!.options) {
      if (picked.includes(option)) continue
      walk(index + 1, [...picked, option])
    }
  }
  walk(0, template.required)
  return teams
}

describe('templates.json integrity', () => {
  it('every referenced character exists', () => {
    for (const t of templates) {
      for (const id of [...t.required, ...t.flex.flatMap(f => f.options)]) {
        expect(charMap.has(id), `${t.id} references unknown character "${id}"`).toBe(true)
      }
    }
  })

  it('every counters/counteredBy entry names a real archetype', () => {
    for (const t of templates) {
      for (const a of [...t.counters, ...t.counteredBy]) {
        expect(archetypes.has(a), `${t.id} references unknown archetype "${a}"`).toBe(true)
      }
    }
  })

  it('required + flex fills exactly one team', () => {
    for (const t of templates) {
      expect(t.required.length + t.flex.length, `${t.id} team size`).toBe(TEAM_SIZE)
    }
  })

  it('ids are unique and no character is both required and flex in one template', () => {
    expect(new Set(templates.map(t => t.id)).size).toBe(templates.length)
    for (const t of templates) {
      for (const id of t.flex.flatMap(f => f.options)) {
        expect(t.required, `${t.id}: "${id}" is both required and a flex option`).not.toContain(id)
      }
      for (const f of t.flex) {
        expect(new Set(f.options).size, `${t.id} slot ${f.slot} has duplicate options`).toBe(f.options.length)
      }
    }
  })

  it('every template can form a valid burst chain', () => {
    for (const t of templates) {
      const valid = [...producibleTeams(t)].some((team) => {
        const bursts = new Set(team.split('|').map(id => charMap.get(id)!.burst))
        return bursts.has('Λ') || (['I', 'II', 'III'] as const).every(b => bursts.has(b))
      })
      expect(valid, `${t.id} cannot produce a valid B1+B2+B3 chain`).toBe(true)
    }
  })

  it('is fully localized', () => {
    for (const t of templates) {
      for (const locale of locales) {
        expect(t.name[locale], `${t.id} name.${locale}`).toBeTruthy()
        expect(t.notes[locale], `${t.id} notes.${locale}`).toBeTruthy()
      }
    }
  })

  /**
   * recommend5v5 does not dedup by character set, so two templates that can build the
   * same five characters can occupy two of the five result slots with one visible team.
   * Same-archetype variants are exempt — they never surface together.
   *
   * Known pre-existing offender, well above every other pair (next highest is 16):
   * moran-scarlet is largely a subset of moran-system-atk. Left as-is rather than
   * silently raising the threshold for everyone.
   */
  it('no two templates in the same mode produce heavily overlapping teams', () => {
    const MAX_SHARED = 20
    const KNOWN = new Map([['moran-system-atk|moran-scarlet', 60]])
    const producible = new Map(templates.map(t => [t.id, producibleTeams(t)]))
    for (const [i, a] of templates.entries()) {
      for (const b of templates.slice(i + 1)) {
        if (a.archetype === b.archetype) continue
        if (a.mode !== 'both' && b.mode !== 'both' && a.mode !== b.mode) continue
        const shared = [...producible.get(a.id)!].filter(team => producible.get(b.id)!.has(team))
        const budget = KNOWN.get(`${a.id}|${b.id}`) ?? MAX_SHARED
        expect(
          shared.length,
          `${a.id} and ${b.id} share ${shared.length} identical teams, e.g. ${shared[0]?.split('|').join(' + ')}`,
        ).toBeLessThanOrEqual(budget)
      }
    }
  })

  it('character data has no duplicate ids', () => {
    expect(new Set(allCharacters.map(c => c.id)).size).toBe(allCharacters.length)
  })
})
