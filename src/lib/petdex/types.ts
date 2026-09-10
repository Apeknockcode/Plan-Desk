export type PetdexKind = 'character' | 'creature' | 'object' | string

export interface PetdexEntry {
  slug: string
  displayName: string
  kind?: PetdexKind
  submittedBy?: string | null
  spritesheetUrl: string
  petJsonUrl: string
  zipUrl?: string
  spriteVersionNumber?: number
}

export interface PetdexManifestResponse {
  generatedAt?: string
  total?: number
  pets: PetdexEntry[]
}
