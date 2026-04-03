const avatarModules = import.meta.glob<{ default: string }>('~/assets/avatars/*.webp', { eager: true })

const avatarMap = new Map<string, string>()
for (const [path, mod] of Object.entries(avatarModules)) {
  // path: /assets/avatars/si_c222_00_s.webp -> key: si_c222_00_s
  const filename = path.split('/').pop()?.replace('.webp', '')
  if (filename) {
    avatarMap.set(filename, mod.default)
  }
}

export function useAvatars() {
  function getAvatarUrl(avatarImg: string | undefined): string | null {
    if (!avatarImg) return null
    return avatarMap.get(avatarImg) ?? null
  }

  return { getAvatarUrl }
}
