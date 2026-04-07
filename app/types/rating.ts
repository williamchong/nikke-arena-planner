import type { FieldValue } from 'firebase/firestore/lite'
import type { SpeedTier } from './character'
import type { TeamComposition } from './template'

/** Shape of documents written to the Firestore `ratings` collection. */
export interface TeamRating {
  userId: string
  sessionId: string
  timestamp: FieldValue

  rating: 'up' | 'down'
  teamCharacters: string[]
  teamTemplateId: string | null
  teamScore: number
  teamBurstSpeed: SpeedTier
  teamMatchedArchetypes: string[]

  arenaMode: '5v5' | '15v15'
  allTeams?: string[][]
  teamSetIndex?: number
  teamIndexInSet?: number

  otherRatings: Array<{
    teamCharacters: string[]
    rating: 'up' | 'down'
  }>

  roster: string[]
  rosterSize: number
}

export interface RatingContext {
  team: TeamComposition
  arenaMode: '5v5' | '15v15'
  allTeams?: TeamComposition[][]
  teamSetIndex?: number
  teamIndexInSet?: number
}
