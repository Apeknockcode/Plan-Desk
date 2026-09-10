import { onMounted, onUnmounted, ref, type Ref } from 'vue'
import { PetStageInteractionEngine } from '@/lib/petStageInteraction'
import type { PetInteraction, PetStageMember, PetState } from '@/lib/types'

export function usePetStageInteraction(opts: {
  members: Ref<PetStageMember[]>
  slotEls: Ref<(HTMLElement | null)[]>
  petStates: Ref<Record<string, PetState>>
  shellHovered: Ref<boolean>
  isDragging: Ref<boolean>
}) {
  const lookTargets = ref<Record<string, { x: number; y: number } | null>>({})
  const interactions = ref<Record<string, PetInteraction>>({})
  const leanOffsets = ref<Record<string, number>>({})

  const engine = new PetStageInteractionEngine()
  const mouse = ref<{ x: number; y: number } | null>(null)
  let rafId = 0

  function tick() {
    if (opts.isDragging.value) {
      lookTargets.value = {}
      interactions.value = {}
      leanOffsets.value = Object.fromEntries(
        opts.members.value.map((member) => [member.projectId, 0])
      )
      rafId = requestAnimationFrame(tick)
      return
    }

    const frame = engine.tick(
      opts.members.value,
      opts.slotEls.value,
      opts.petStates.value,
      mouse.value,
      opts.shellHovered.value
    )
    lookTargets.value = frame.lookTargets
    interactions.value = frame.interactions
    leanOffsets.value = frame.leanOffsets
    rafId = requestAnimationFrame(tick)
  }

  function onMouseMove(e: MouseEvent) {
    mouse.value = { x: e.clientX, y: e.clientY }
  }

  function onMouseLeave() {
    mouse.value = null
  }

  onMounted(() => {
    window.addEventListener('mousemove', onMouseMove)
    rafId = requestAnimationFrame(tick)
  })

  onUnmounted(() => {
    window.removeEventListener('mousemove', onMouseMove)
    cancelAnimationFrame(rafId)
  })

  return { lookTargets, interactions, leanOffsets, onMouseLeave }
}
