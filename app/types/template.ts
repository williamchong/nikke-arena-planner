import type { ArenaMode, BurstType, LocalizedString, SpeedTier } from './character'

export interface TeamTemplate {
  id: string
  name: LocalizedString
  archetype: string
  mode: ArenaMode | 'both'
  required: string[]
  flex: { slot: number; options: string[] }[]
  burstSlots: BurstType[]
  preferredSpeed: SpeedTier
  counters: string[]
  counteredBy: string[]
  priority: number
  notes: LocalizedString
}

export interface TeamComposition {
  id: string
  characters: string[]
  mode: ArenaMode
  templateId?: string
  burstSpeed: SpeedTier
  score: number
}
