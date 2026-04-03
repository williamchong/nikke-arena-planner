const STORAGE_KEY = 'nikke-arena-roster'

export const useRosterStore = defineStore('roster', () => {
  const storedIds = ref<string[]>([])

  // Load from localStorage only on client after mount
  if (import.meta.client) {
    onNuxtReady(() => {
      try {
        const saved = localStorage.getItem(STORAGE_KEY)
        if (saved) storedIds.value = JSON.parse(saved)
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
    }
    else {
      storedIds.value = [...storedIds.value, id]
    }
    persist()
  }

  function selectAll(ids: string[]) {
    const current = new Set(storedIds.value)
    for (const id of ids) {
      current.add(id)
    }
    storedIds.value = [...current]
    persist()
  }

  function clearAll() {
    storedIds.value = []
    persist()
  }

  function isOwned(id: string) {
    return ownedIds.value.has(id)
  }

  const ownedCount = computed(() => ownedIds.value.size)

  return { ownedIds, toggle, selectAll, clearAll, isOwned, ownedCount }
})
