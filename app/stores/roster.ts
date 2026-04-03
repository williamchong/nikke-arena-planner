const STORAGE_KEY = 'nikke-arena-roster'

export const useRosterStore = defineStore('roster', () => {
  const ownedIds = ref<Set<string>>(new Set())

  function loadFromStorage() {
    if (import.meta.client) {
      const saved = localStorage.getItem(STORAGE_KEY)
      if (saved) {
        try {
          ownedIds.value = new Set(JSON.parse(saved))
        }
        catch {
          ownedIds.value = new Set()
        }
      }
    }
  }

  function saveToStorage() {
    if (import.meta.client) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify([...ownedIds.value]))
    }
  }

  function toggle(id: string) {
    const next = new Set(ownedIds.value)
    if (next.has(id)) {
      next.delete(id)
    }
    else {
      next.add(id)
    }
    ownedIds.value = next
    saveToStorage()
  }

  function selectAll(ids: string[]) {
    const next = new Set(ownedIds.value)
    for (const id of ids) {
      next.add(id)
    }
    ownedIds.value = next
    saveToStorage()
  }

  function clearAll() {
    ownedIds.value = new Set()
    saveToStorage()
  }

  function isOwned(id: string) {
    return ownedIds.value.has(id)
  }

  const ownedCount = computed(() => ownedIds.value.size)

  loadFromStorage()

  return { ownedIds, toggle, selectAll, clearAll, isOwned, ownedCount }
})
