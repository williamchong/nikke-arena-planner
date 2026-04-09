export type LocalizedString = {
  en: string
  'zh-TW': string
  'zh-CN': string
}

export type SpeedTier = '1RL' | '2RL' | '3SG' | '5SG' | '3RL' | '7SG' | '4RL' | '5RL'

export type PvpTier = 'SSS' | 'SS' | 'S' | 'A' | 'B' | 'C' | 'D' | 'E' | 'F'

export type BurstType = 'I' | 'II' | 'III' | 'Λ'

export type Role = 'attacker' | 'supporter' | 'defender'

export type Element = 'fire' | 'water' | 'wind' | 'electric' | 'iron'

export type Manufacturer = 'elysion' | 'missilis' | 'tetra' | 'pilgrim' | 'abnormal'

export type WeaponType = 'AR' | 'SMG' | 'SG' | 'SR' | 'RL' | 'MG'

export type ArenaMode = 'attack' | 'defense'

export interface Character {
  id: string
  name: LocalizedString
  burst: BurstType
  role: Role
  element: Element
  manufacturer: Manufacturer
  weapon: WeaponType
  weaponDmg: number
  ammo: number
  reloadTime: number
  chargeTime: number
  maxCharge: number | null
  chargeCoefficient: number
  hitMultiplier: number
  burstGen: {
    attack: Record<SpeedTier, number>
    defense: Record<SpeedTier, number>
  }
  suitability: {
    attack: number
    defense: number
  }
  releaseOrder: number
  avatarImg?: string
  pvpTier?: PvpTier
  /** In-game squad affiliation (e.g. 'Happy Zoo', 'Counters'). Used for same-squad synergy. */
  squad?: string
  /** Trait tags provided by this character (e.g. 'healer', 'cover-healer'). */
  traits?: string[]
  /**
   * Synergy requirements that MUST be satisfied by a teammate, otherwise the team is hard-rejected.
   * Supports plain trait lookups and special tokens:
   * - `'healer'` / `'cover-healer'` / … — plain trait name (matches any teammate with that tag)
   * - `'same-element'` — teammate must share this character's element
   * - `'same-squad'` — teammate must share this character's squad
   * - `'role:attacker'` / `'element:fire'` — specific role or element
   */
  requiresTeammate?: string[]
  /** Soft version of `requiresTeammate` — per-miss penalty applied, team still allowed. Same token format. */
  prefersTeammate?: string[]
}
