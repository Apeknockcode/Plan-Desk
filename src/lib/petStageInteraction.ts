import type { PetInteraction, PetStageMember, PetState } from './types'

export interface PetSlotCenter {
  projectId: string
  x: number
  y: number
}

export interface PetStageInteractionFrame {
  lookTargets: Record<string, { x: number; y: number } | null>
  interactions: Record<string, PetInteraction>
  leanOffsets: Record<string, number>
}

const WAVE_NEAR_PX = 128
const LEAN_NEAR_PX = 160
const LEAN_MAX_PX = 5
const WAVE_COOLDOWN_MS = 9000
const WAVE_DURATION_MS = 1800

export function measureSlotCenters(
  members: PetStageMember[],
  slotEls: (HTMLElement | null)[]
): PetSlotCenter[] {
  return members
    .map((member, index) => {
      const el = slotEls[index]
      if (!el) return null
      const rect = el.getBoundingClientRect()
      return {
        projectId: member.projectId,
        x: rect.left + rect.width / 2,
        y: rect.top + rect.height * 0.42
      }
    })
    .filter((item): item is PetSlotCenter => item !== null)
}

export function closestNeighbor(self: PetSlotCenter, centers: PetSlotCenter[]): PetSlotCenter | null {
  let best: PetSlotCenter | null = null
  let bestDist = Infinity
  for (const other of centers) {
    if (other.projectId === self.projectId) continue
    const dist = Math.hypot(other.x - self.x, other.y - self.y)
    if (dist < bestDist) {
      bestDist = dist
      best = other
    }
  }
  return best
}

export function computeLeanOffset(self: PetSlotCenter, neighbor: PetSlotCenter | null): number {
  if (!neighbor) return 0
  const dx = neighbor.x - self.x
  const dist = Math.abs(dx)
  if (dist > LEAN_NEAR_PX) return 0
  const strength = 1 - dist / LEAN_NEAR_PX
  return Math.sign(dx) * LEAN_MAX_PX * strength
}

export class PetStageInteractionEngine {
  private lastWaveAt = new Map<string, number>()
  private waveUntil = new Map<string, number>()

  tick(
    members: PetStageMember[],
    slotEls: (HTMLElement | null)[],
    petStates: Record<string, PetState>,
    mouse: { x: number; y: number } | null,
    shellHovered: boolean
  ): PetStageInteractionFrame {
    const now = Date.now()
    const centers = measureSlotCenters(members, slotEls)
    const lookTargets: Record<string, { x: number; y: number } | null> = {}
    const interactions: Record<string, PetInteraction> = {}
    const leanOffsets: Record<string, number> = {}

    for (const center of centers) {
      const neighbor = closestNeighbor(center, centers)
      const state = petStates[center.projectId] ?? 'idle'

      if (shellHovered && mouse) {
        lookTargets[center.projectId] = mouse
      } else {
        lookTargets[center.projectId] = neighbor ? { x: neighbor.x, y: neighbor.y } : null
      }

      leanOffsets[center.projectId] = computeLeanOffset(center, neighbor)

      if ((this.waveUntil.get(center.projectId) ?? 0) > now) {
        interactions[center.projectId] = 'wave'
      } else {
        interactions[center.projectId] = null
      }
    }

    for (const center of centers) {
      if (interactions[center.projectId] === 'wave') continue

      const state = petStates[center.projectId] ?? 'idle'
      if (state !== 'idle') continue

      const neighbor = closestNeighbor(center, centers)
      if (!neighbor) continue
      if ((petStates[neighbor.projectId] ?? 'idle') !== 'idle') continue

      const dist = Math.hypot(neighbor.x - center.x, neighbor.y - center.y)
      if (dist > WAVE_NEAR_PX) continue

      const pairKey = [center.projectId, neighbor.projectId].sort().join(':')
      const lastWave = this.lastWaveAt.get(pairKey) ?? 0
      if (now - lastWave < WAVE_COOLDOWN_MS) continue

      this.lastWaveAt.set(pairKey, now)
      this.waveUntil.set(center.projectId, now + WAVE_DURATION_MS)
      this.waveUntil.set(neighbor.projectId, now + WAVE_DURATION_MS)
      interactions[center.projectId] = 'wave'
      interactions[neighbor.projectId] = 'wave'
    }

    return { lookTargets, interactions, leanOffsets }
  }
}

export function maxHorizontalSpread(members: PetStageMember[]): number {
  if (members.length === 0) return 0
  const offsets = members.map((m) => m.offsetX ?? 0)
  return Math.max(0, Math.max(...offsets) - Math.min(...offsets))
}
