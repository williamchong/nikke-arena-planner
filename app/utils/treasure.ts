export const TREASURE_SUFFIX = '-treasure'

// Treasure variants are in-game upgrades of the normal version, so a user
// can only own one or the other — never both. Pair-aware code uses these
// helpers to treat `X` and `X-treasure` as a single slot.

export function baseId(id: string): string {
  return id.endsWith(TREASURE_SUFFIX) ? id.slice(0, -TREASURE_SUFFIX.length) : id
}

export function treasurePartnerId(id: string): string {
  return id.endsWith(TREASURE_SUFFIX)
    ? id.slice(0, -TREASURE_SUFFIX.length)
    : `${id}${TREASURE_SUFFIX}`
}
