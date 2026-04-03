import { useLocalStorage } from '@vueuse/core'

export const useRosterStore = defineStore('roster', () => {
  const storedIds = useLocalStorage<string[]>('nikke-arena-roster', [])

  const ownedIds = computed(() => new Set(storedIds.value))

  function toggle(id: string) {
    if (storedIds.value.includes(id)) {
      storedIds.value = storedIds.value.filter((i: string) => i !== id)
    }
    else {
      storedIds.value = [...storedIds.value, id]
    }
  }

  function selectAll(ids: string[]) {
    const current = new Set(storedIds.value)
    for (const id of ids) {
      current.add(id)
    }
    storedIds.value = [...current]
  }

  function clearAll() {
    storedIds.value = []
  }

  function isOwned(id: string) {
    return ownedIds.value.has(id)
  }

  const ownedCount = computed(() => ownedIds.value.size)

  return { ownedIds, toggle, selectAll, clearAll, isOwned, ownedCount }
})
