const STORAGE_KEY = 'nikke-arena-roster'

export const useRosterStore = defineStore('roster', () => {
  const { trackEvent } = useAnalytics()
  const storedIds = ref<string[]>([])

  // Load from localStorage only on client after mount
  if (import.meta.client) {
    onNuxtReady(() => {
      try {
        const saved = localStorage.getItem(STORAGE_KEY)
        if (saved) {
          const loaded: string[] = JSON.parse(saved)
          // Sanitize: if legacy data has both a normal and treasure variant,
          // prefer the treasure (upgraded) version.
          const kept = new Set(loaded)
          for (const id of loaded) {
            if (id.endsWith(TREASURE_SUFFIX)) {
              kept.delete(treasurePartnerId(id))
            }
          }
          storedIds.value = [...kept]
          if (kept.size !== loaded.length) persist()
        }
      }
      catch { /* ignore corrupt localStorage */ }
    })
  }

  function persist() {
    if (import.meta.client) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(storedIds.value))
    }
  }

  const ownedIds = computed(() => new Set(storedIds.value))

  function toggle(id: string) {
    if (storedIds.value.includes(id)) {
      storedIds.value = storedIds.value.filter((i: string) => i !== id)
      trackEvent('roster_remove')
    }
    else {
      const partner = treasurePartnerId(id)
      storedIds.value = [...storedIds.value.filter((i: string) => i !== partner), id]
      trackEvent('roster_add')
    }
    persist()
  }

  function selectAll(ids: string[]) {
    const current = new Set(storedIds.value)
    for (const id of ids) {
      current.delete(treasurePartnerId(id))
      current.add(id)
    }
    storedIds.value = [...current]
    persist()
    trackEvent('roster_select_all')
  }

  function clearAll() {
    storedIds.value = []
    persist()
    trackEvent('roster_clear_all')
  }

  function isOwned(id: string) {
    return ownedIds.value.has(id)
  }

  const ownedCount = computed(() => ownedIds.value.size)

  return { ownedIds, toggle, selectAll, clearAll, isOwned, ownedCount }
})
