import type { BurstType, Element, WeaponType } from '~/types/character'

export const BURST_FILTERS: { label: string, value: BurstType }[] = [
  { label: 'I', value: 'I' },
  { label: 'II', value: 'II' },
  { label: 'III', value: 'III' },
]

export const WEAPON_FILTERS: WeaponType[] = ['AR', 'SMG', 'SG', 'SR', 'RL', 'MG']

export const ELEMENT_FILTERS: Element[] = ['fire', 'water', 'wind', 'electric', 'iron']
