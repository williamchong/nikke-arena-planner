import type { BurstType, Character, Element, Manufacturer, Role, WeaponType } from '~/types/character'
import charactersData from '~/data/characters.json'

const characters: Character[] = charactersData as Character[]
const characterMap = new Map(characters.map(c => [c.id, c]))

export interface CharacterFilters {
  search?: string
  burst?: BurstType | null
  role?: Role | null
  element?: Element | null
  weapon?: WeaponType | null
  manufacturer?: Manufacturer | null
  ownedOnly?: boolean
}

export function useCharacters() {
  function getCharacter(id: string): Character | undefined {
    return characterMap.get(id)
  }

  function getAllCharacters(): Character[] {
    return characters
  }

  function filterCharacters(filters: CharacterFilters, ownedIds?: Set<string>): Character[] {
    return characters.filter((c) => {
      if (filters.search) {
        const q = filters.search.toLowerCase()
        const matchesName = c.name.en.toLowerCase().includes(q)
          || c.name['zh-TW'].includes(q)
          || c.name['zh-CN'].includes(q)
        if (!matchesName) return false
      }
      if (filters.burst && c.burst !== filters.burst) return false
      if (filters.role && c.role !== filters.role) return false
      if (filters.element && c.element !== filters.element) return false
      if (filters.weapon && c.weapon !== filters.weapon) return false
      if (filters.manufacturer && c.manufacturer !== filters.manufacturer) return false
      if (filters.ownedOnly && ownedIds && !ownedIds.has(c.id)) return false
      return true
    })
  }

  return { getCharacter, getAllCharacters, filterCharacters, characters }
}
