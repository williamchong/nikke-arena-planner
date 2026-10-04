import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import templatesJson from '~/data/templates.json'
import { allCharacters } from './helpers'

const rules = readFileSync(resolve(__dirname, '../firestore.rules'), 'utf8')

/** IDs listed in a `function <name>() { return [...] }` allowlist in firestore.rules. */
function allowlist(name: string): Set<string> {
  const body = rules.match(new RegExp(`function ${name}\\(\\)\\s*{\\s*return \\[([\\s\\S]*?)\\];`))?.[1]
  if (!body) throw new Error(`firestore.rules has no ${name}() allowlist`)
  return new Set([...body.matchAll(/'([^']+)'/g)].map(m => m[1]!))
}

// Rating writes are rejected when the roster or team holds an ID missing from these lists
describe('firestore.rules allowlists', () => {
  it('allow every character in characters.json', () => {
    const allowed = allowlist('allowedCharacterIds')
    expect(allCharacters.map(c => c.id).filter(id => !allowed.has(id))).toEqual([])
  })

  it('allow every template in templates.json', () => {
    const allowed = allowlist('allowedTemplateIds')
    expect(templatesJson.map(t => t.id).filter(id => !allowed.has(id))).toEqual([])
  })
})
