import type { BurstType, Element, Manufacturer, Role, WeaponType } from '~/types/character'

const iconModules = import.meta.glob<{ default: string }>('~/assets/icons/*.webp', { eager: true })

const iconMap = new Map<string, string>()
for (const [path, mod] of Object.entries(iconModules)) {
  const filename = path.split('/').pop()?.replace('.webp', '')
  if (filename) {
    iconMap.set(filename, mod.default)
  }
}

const BURST_KEY: Record<string, string> = { I: 'burst_1', II: 'burst_2', III: 'burst_3' }

export function useIcons() {
  function burstIcon(burst: BurstType): string | null {
    return iconMap.get(BURST_KEY[burst] ?? '') ?? null
  }

  function roleIcon(role: Role): string | null {
    return iconMap.get(`class_${role}`) ?? null
  }

  function weaponIcon(weapon: WeaponType): string | null {
    return iconMap.get(`weapon_${weapon.toLowerCase()}`) ?? null
  }

  function elementIcon(element: Element): string | null {
    return iconMap.get(`element_${element}`) ?? null
  }

  function manufacturerIcon(manufacturer: Manufacturer): string | null {
    return iconMap.get(`manufacturer_${manufacturer}`) ?? null
  }

  return { burstIcon, roleIcon, weaponIcon, elementIcon, manufacturerIcon }
}
