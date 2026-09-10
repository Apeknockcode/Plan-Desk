import { onUnmounted, ref, unref, watch, type MaybeRef, type Ref } from 'vue'
import {
  animationKeyForState,
  defaultPetManifest,
  frameRect,
  type PetAnimationDef,
  type PetManifest
} from '@/lib/petAtlas'
import type { PetInteraction, PetState } from '@/lib/types'

function resolveRunAnim(
  manifest: PetManifest,
  interaction: PetInteraction
): { anim: PetAnimationDef; flipX: boolean } {
  if (interaction === 'run-left') {
    if (manifest.spriteVersionNumber >= 2) {
      return { anim: manifest.states.runLeft, flipX: false }
    }
    return { anim: manifest.states.runRight, flipX: true }
  }
  return { anim: manifest.states.runRight, flipX: false }
}

export function usePetAnimator(
  canvasRef: Ref<HTMLCanvasElement | null>,
  imageRef: Ref<HTMLImageElement | null>,
  options: {
    state: MaybeRef<PetState>
    lookIndex: MaybeRef<number | null>
    interaction?: MaybeRef<PetInteraction>
    manifest?: MaybeRef<PetManifest>
    scale?: MaybeRef<number>
    smooth?: MaybeRef<boolean>
  }
) {
  const getManifest = () => unref(options.manifest) ?? defaultPetManifest
  const getScale = () => unref(options.scale) ?? 1
  const frameIndex = ref(0)
  const elapsed = ref(0)

  let rafId = 0
  let lastTs = 0

  function drawFrame(row: number, col: number, flipX = false) {
    const canvas = canvasRef.value
    const image = imageRef.value
    if (!canvas || !image || !image.complete) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const { sx, sy, sw, sh } = frameRect(getManifest(), row, col)
    const scale = getScale()
    const dw = sw * scale
    const dh = sh * scale

    canvas.width = dw
    canvas.height = dh

    ctx.clearRect(0, 0, dw, dh)
    ctx.imageSmoothingEnabled = unref(options.smooth) ?? false
    ctx.save()
    if (flipX) {
      ctx.translate(dw, 0)
      ctx.scale(-1, 1)
    }
    ctx.drawImage(image, sx, sy, sw, sh, 0, 0, dw, dh)
    ctx.restore()
  }

  function tick(ts: number) {
    if (!lastTs) lastTs = ts
    const dt = ts - lastTs
    lastTs = ts

    const look = unref(options.lookIndex)
    const state = unref(options.state)
    const interaction = unref(options.interaction)
    const manifest = getManifest()

    const useJump = interaction === 'jump'
    const useRun = interaction === 'run-left' || interaction === 'run-right'
    const useFailed = interaction === 'failed' && !useJump && !useRun
    const useWave =
      interaction === 'wave' && state === 'idle' && look === null && !useJump && !useRun && !useFailed
    const useLook =
      look !== null && state !== 'busy' && !useJump && !useRun && !useWave && !useFailed

    let flipX = false

    if (!useLook) {
      let anim: PetAnimationDef
      let oneShot = false

      if (useJump) {
        anim = manifest.states.jump
        oneShot = true
      } else if (useRun) {
        const run = resolveRunAnim(manifest, interaction!)
        anim = run.anim
        flipX = run.flipX
      } else if (useFailed) {
        anim = manifest.states.failed
      } else if (useWave) {
        anim = manifest.states.wave
      } else {
        const key = animationKeyForState(manifest, state)
        anim = manifest.states[key]
      }

      const durations = anim.durations
      const duration = durations[frameIndex.value] ?? durations[durations.length - 1] ?? 200
      elapsed.value += dt
      if (elapsed.value >= duration) {
        elapsed.value = 0
        if (oneShot && frameIndex.value >= anim.frameCount - 1) {
          frameIndex.value = anim.frameCount - 1
        } else {
          frameIndex.value = (frameIndex.value + 1) % anim.frameCount
        }
      }
    }

    let row: number
    let col: number
    if (useLook) {
      row = manifest.states.look.row
      col = look!
    } else if (useJump) {
      row = manifest.states.jump.row
      col = frameIndex.value
    } else if (useRun) {
      const run = resolveRunAnim(manifest, interaction!)
      row = run.anim.row
      col = frameIndex.value
      flipX = run.flipX
    } else if (useFailed) {
      row = manifest.states.failed.row
      col = frameIndex.value
    } else if (useWave) {
      row = manifest.states.wave.row
      col = frameIndex.value
    } else {
      const key = animationKeyForState(manifest, state)
      const anim = manifest.states[key]
      row = anim.row
      col = frameIndex.value
    }

    drawFrame(row, col, flipX)
    rafId = requestAnimationFrame(tick)
  }

  function start() {
    cancelAnimationFrame(rafId)
    lastTs = 0
    rafId = requestAnimationFrame(tick)
  }

  function stop() {
    cancelAnimationFrame(rafId)
  }

  watch(
    () => [unref(options.state), unref(options.lookIndex), unref(options.interaction)],
    () => {
      frameIndex.value = 0
      elapsed.value = 0
    }
  )

  watch(imageRef, (img) => {
    if (img?.complete) start()
  })

  onUnmounted(stop)

  return { start, stop }
}
