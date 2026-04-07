import type { RatingContext } from '~/types/rating'

const STORAGE_KEY = 'nikke-arena-ratings'
const RATE_LIMIT_MS = 2000
const MAX_RATINGS_PER_SESSION = 50

export const useRatingsStore = defineStore('ratings', () => {
  const { trackEvent } = useAnalytics()
  const { getFirebase, getUserId } = useFirebase()
  const roster = useRosterStore()

  const ratedTeams = ref<Record<string, 'up' | 'down'>>({})
  const lastRatingTime = ref(0)
  const sessionRatingCount = ref(0)
  const sessionId = ref('')

  // Generate session ID on client
  if (import.meta.client) {
    sessionId.value = crypto.randomUUID()

    onNuxtReady(() => {
      try {
        const saved = localStorage.getItem(STORAGE_KEY)
        if (saved) {
          const parsed = JSON.parse(saved)
          if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
            const sanitized: Record<string, 'up' | 'down'> = {}
            for (const [id, val] of Object.entries(parsed)) {
              if (val === 'up' || val === 'down') sanitized[id] = val
            }
            ratedTeams.value = sanitized
          }
        }
      }
      catch { /* ignore corrupt localStorage */ }
    })
  }

  function persist() {
    if (import.meta.client) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(ratedTeams.value))
    }
  }

  function ratingKey(arenaMode: string, characters: string[]): string {
    return `${arenaMode}:${[...characters].sort().join(',')}`
  }

  function getRating(arenaMode: string, characters: string[]): 'up' | 'down' | null {
    return ratedTeams.value[ratingKey(arenaMode, characters)] ?? null
  }

  function canRate(): boolean {
    if (sessionRatingCount.value >= MAX_RATINGS_PER_SESSION) return false
    if (Date.now() - lastRatingTime.value < RATE_LIMIT_MS) return false
    return true
  }

  function clearRatings() {
    ratedTeams.value = {}
    lastRatingTime.value = 0
    sessionRatingCount.value = 0
    persist()
  }

  async function submitRating(
    rating: 'up' | 'down',
    context: RatingContext,
  ) {
    const { team, arenaMode, allTeams, teamSetIndex, teamIndexInSet } = context
    const key = ratingKey(arenaMode, team.characters)

    // Toggle off if same rating already exists
    if (ratedTeams.value[key] === rating) {
      const { [key]: _, ...rest } = ratedTeams.value
      ratedTeams.value = rest
      persist()
      trackEvent('rating_remove', { arena_mode: arenaMode })
      return
    }

    if (!canRate()) return

    // Update local state immediately for responsive UI
    ratedTeams.value = { ...ratedTeams.value, [key]: rating }
    lastRatingTime.value = Date.now()
    sessionRatingCount.value++
    persist()

    trackEvent('rating_submit', {
      arena_mode: arenaMode,
      rating,
      template_id: team.templateId ?? 'none',
    })

    const teamSetFlat = allTeams && teamSetIndex != null
      ? allTeams[teamSetIndex] ?? []
      : []
    const otherRatings = teamSetFlat
      .filter(t => ratingKey(arenaMode, t.characters) !== key)
      .map((t) => {
        const r = ratedTeams.value[ratingKey(arenaMode, t.characters)]
        return r ? { teamCharacters: t.characters, rating: r } : null
      })
      .filter((r): r is NonNullable<typeof r> => r !== null)

    // Fire-and-forget Firestore write
    try {
      const userId = await getUserId()
      if (!userId) return

      const { db } = await getFirebase()
      const { collection, addDoc, serverTimestamp } = await import('firebase/firestore/lite')

      await addDoc(collection(db, 'ratings'), {
        userId,
        sessionId: sessionId.value,
        timestamp: serverTimestamp(),

        rating,
        teamCharacters: team.characters,
        teamTemplateId: team.templateId ?? null,
        teamScore: team.score,
        teamBurstSpeed: team.burstSpeed,
        teamMatchedArchetypes: team.matchedArchetypes ?? [],

        arenaMode,
        ...(allTeams && teamSetIndex != null && {
          allTeams: allTeams[teamSetIndex]?.map(t => t.characters) ?? [],
          teamSetIndex,
          ...(teamIndexInSet != null && { teamIndexInSet }),
        }),

        otherRatings,

        roster: [...roster.ownedIds].sort(),
        rosterSize: roster.ownedCount,
      })
    }
    catch {
      // Silent failure — UI already updated, don't break the experience
    }
  }

  return { ratedTeams, getRating, canRate, submitRating, clearRatings }
})
