import type { ArenaMode } from '~/types/character'
import type { TeamComposition } from '~/types/template'
import { useTeamRecommender } from '~/composables/useTeamRecommender'

// Sets don't survive postMessage, so ID sets travel as arrays
export interface Recommend15v15Request {
  ownedIds: string[]
  mode: ArenaMode
  teamLocks?: string[][]
}

export interface Recommend15v15Response {
  result: TeamComposition[][]
}

const { recommend15v15 } = useTeamRecommender()

self.onmessage = ({ data }: MessageEvent<Recommend15v15Request>) => {
  const result = recommend15v15(new Set(data.ownedIds), data.mode, data.teamLocks?.map(ids => new Set(ids)))
  self.postMessage({ result } satisfies Recommend15v15Response)
}
