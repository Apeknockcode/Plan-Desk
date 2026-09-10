import { ref, watch, type Ref } from 'vue'
import { getBundledPetdexEntry, loadBundledPetdexEntry, resolvePetdexEntry } from '@/lib/petdex/client'
import type { PetdexEntry } from '@/lib/petdex/types'

export function usePetdexEntry(slug: Ref<string | undefined | null>) {
  const entry = ref<PetdexEntry | null>(null)
  const loading = ref(false)
  const error = ref<string | null>(null)

  watch(
    slug,
    async (value) => {
      if (!value) {
        entry.value = null
        error.value = null
        return
      }

      const cached = getBundledPetdexEntry(value)
      if (cached) {
        entry.value = cached
        error.value = null
        loading.value = false
        return
      }

      loading.value = true
      error.value = null
      try {
        const bundled = await loadBundledPetdexEntry(value)
        if (bundled) {
          entry.value = bundled
          return
        }

        entry.value = await resolvePetdexEntry(value)
        if (!entry.value) error.value = '未找到该宠物'
      } catch (err) {
        entry.value = null
        error.value = err instanceof Error ? err.message : '加载失败'
      } finally {
        loading.value = false
      }
    },
    { immediate: true }
  )

  return { entry, loading, error }
}
