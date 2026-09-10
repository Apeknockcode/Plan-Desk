<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { NInput, NSpin, NText } from 'naive-ui'
import PetdexPreviewThumb from '@/components/widget/PetdexPreviewThumb.vue'
import { FEATURED_PETDEX_SLUGS } from '@/lib/petdex/constants'
import {
  fetchPetdexManifest,
  filterPetdexEntries,
  getBundledPetdexEntry,
  loadBundledPetdexEntry
} from '@/lib/petdex/client'
import type { PetdexEntry } from '@/lib/petdex/types'

const props = withDefaults(
  defineProps<{
    modelValue?: string
    disabled?: boolean
    /** 嵌入弹窗时使用紧凑布局 */
    embedded?: boolean
  }>(),
  { embedded: false }
)

const emit = defineEmits<{
  select: [slug: string]
}>()

const featuredPets = ref<PetdexEntry[]>([])
const featuredLoading = ref(false)

const query = ref('')
const searchExpanded = ref(false)
const searching = ref(false)
const searchError = ref<string | null>(null)
const remotePets = ref<PetdexEntry[]>([])
const manifestLoaded = ref(false)

const isSearchMode = computed(() => query.value.trim().length > 0)

const searchResults = computed(() => {
  if (!isSearchMode.value) return []
  return filterPetdexEntries(remotePets.value, { query: query.value })
    .slice(0, 36)
    .map((pet) => getBundledPetdexEntry(pet.slug) ?? pet)
})

let searchTimer = 0

async function ensureManifestLoaded(): Promise<void> {
  if (manifestLoaded.value) return
  const manifest = await fetchPetdexManifest()
  remotePets.value = manifest.pets ?? []
  manifestLoaded.value = true
}

async function loadFeaturedPets(): Promise<void> {
  featuredLoading.value = true
  try {
    await ensureManifestLoaded()
    const pets = await Promise.all(
      FEATURED_PETDEX_SLUGS.map(async (slug) => {
        const cached = getBundledPetdexEntry(slug)
        if (cached) return cached
        const bundled = await loadBundledPetdexEntry(slug)
        if (bundled) return bundled
        return remotePets.value.find((p) => p.slug === slug)
      })
    )
    featuredPets.value = pets.filter((pet): pet is PetdexEntry => Boolean(pet))
  } catch {
    const bundled = await loadBundledPetdexEntry('tiko')
    featuredPets.value = bundled ? [bundled] : []
  } finally {
    featuredLoading.value = false
  }
}

onMounted(() => {
  void loadFeaturedPets()
})

watch(query, (value) => {
  window.clearTimeout(searchTimer)
  if (!value.trim()) {
    searching.value = false
    searchError.value = null
    return
  }

  searchTimer = window.setTimeout(() => {
    void loadSearchResults()
  }, 280)
})

async function loadSearchResults() {
  if (!query.value.trim()) return
  searching.value = true
  searchError.value = null
  try {
    await ensureManifestLoaded()
  } catch (err) {
    searchError.value = err instanceof Error ? err.message : '搜索失败，请检查网络'
  } finally {
    searching.value = false
  }
}

function selectPet(slug: string) {
  if (props.disabled) return
  emit('select', slug)
}

function openSearch() {
  searchExpanded.value = true
}
</script>

<template>
  <div class="petdex-picker" :class="{ 'petdex-picker--embedded': embedded }">
    <template v-if="!isSearchMode">
      <NSpin v-if="featuredLoading" size="small" class="petdex-picker__spin" />

      <div
        v-else
        class="petdex-grid"
        :class="embedded ? 'petdex-grid--featured-row' : 'petdex-grid--featured'"
      >
        <button
          v-for="pet in featuredPets"
          :key="pet.slug"
          type="button"
          class="pet-card"
          :class="{ 'pet-card--selected': modelValue === pet.slug }"
          :disabled="disabled"
          @click="selectPet(pet.slug)"
        >
          <PetdexPreviewThumb :entry="pet" :compact="embedded" />
          <span class="pet-card__name">{{ pet.displayName }}</span>
        </button>
      </div>

      <button
        v-if="embedded && !searchExpanded"
        type="button"
        class="petdex-picker__search-trigger"
        :disabled="disabled"
        @click="openSearch"
      >
        <span class="petdex-picker__search-icon" aria-hidden="true">⌕</span>
        搜索 Petdex 图库（4800+）
      </button>

      <div v-else class="petdex-picker__search">
        <NInput
          v-model:value="query"
          size="small"
          placeholder="输入名称搜索更多桌宠…"
          clearable
          :disabled="disabled"
        >
          <template #prefix>
            <span class="petdex-picker__search-icon" aria-hidden="true">⌕</span>
          </template>
        </NInput>
      </div>

      <NText v-if="!embedded" depth="3" class="petdex-picker__footer">
        图库来自
        <a href="https://petdex.dev/zh" target="_blank" rel="noopener noreferrer">Petdex</a>
        · 推荐款需联网加载
      </NText>
    </template>

    <template v-else>
      <div class="petdex-picker__search">
        <NInput
          v-model:value="query"
          size="small"
          placeholder="输入名称搜索更多桌宠…"
          clearable
          :disabled="disabled"
        >
          <template #prefix>
            <span class="petdex-picker__search-icon" aria-hidden="true">⌕</span>
          </template>
        </NInput>
      </div>

      <NSpin v-if="searching && !manifestLoaded" size="small" class="petdex-picker__spin" />

      <NText v-else-if="searchError" depth="3" class="petdex-picker__error">
        {{ searchError }}
      </NText>

      <div v-else-if="searchResults.length" class="petdex-grid">
        <button
          v-for="pet in searchResults"
          :key="pet.slug"
          type="button"
          class="pet-card"
          :class="{ 'pet-card--selected': modelValue === pet.slug }"
          :disabled="disabled"
          @click="selectPet(pet.slug)"
        >
          <PetdexPreviewThumb :entry="pet" />
          <span class="pet-card__name">{{ pet.displayName }}</span>
        </button>
      </div>

      <NText v-else-if="manifestLoaded && !searching" depth="3" class="petdex-picker__empty">
        没有匹配的宠物，换个关键词试试
      </NText>
    </template>
  </div>
</template>

<style scoped>
.petdex-picker {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.petdex-picker--embedded {
  gap: 8px;
}

.petdex-picker__search-icon {
  font-size: 13px;
  opacity: 0.55;
  line-height: 1;
}

.petdex-picker__search-trigger {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  width: 100%;
  padding: 8px 12px;
  border: 1px dashed var(--n-border-color);
  border-radius: 10px;
  background: transparent;
  color: var(--n-text-color-3);
  font-size: 12px;
  cursor: pointer;
  transition:
    border-color 0.15s ease,
    color 0.15s ease,
    background-color 0.15s ease;
}

.petdex-picker__search-trigger:hover:not(:disabled) {
  border-color: var(--n-border-color-hover);
  color: var(--n-text-color-2);
  background: var(--n-color-hover);
}

.petdex-picker__search-trigger:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.petdex-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 8px;
  max-height: 260px;
  overflow-y: auto;
  padding-right: 2px;
}

.petdex-grid--featured {
  max-height: none;
  overflow: visible;
}

.petdex-grid--featured-row {
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 8px;
  max-height: none;
  overflow: visible;
}

.pet-card {
  display: flex;
  flex-direction: column;
  align-items: stretch;
  gap: 4px;
  padding: 6px;
  border: 1.5px solid transparent;
  border-radius: 10px;
  background: var(--n-color-modal);
  color: inherit;
  cursor: pointer;
  text-align: center;
  transition:
    border-color 0.15s ease,
    background-color 0.15s ease,
    box-shadow 0.15s ease;
}

.petdex-picker--embedded .pet-card {
  padding: 8px 6px 6px;
  border-color: color-mix(in srgb, var(--n-border-color) 80%, transparent);
}

.pet-card:hover:not(:disabled) {
  border-color: var(--n-border-color-hover);
  background: var(--n-color-hover);
}

.pet-card--selected {
  border-color: var(--n-color-target);
  background: color-mix(in srgb, var(--n-color-target) 8%, var(--n-color-modal));
  box-shadow: 0 0 0 1px color-mix(in srgb, var(--n-color-target) 25%, transparent);
}

.pet-card__name {
  font-size: 10px;
  font-weight: 600;
  line-height: 1.2;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.petdex-picker--embedded .pet-card__name {
  font-size: 10px;
}

.petdex-picker__footer {
  font-size: 11px;
  text-align: center;
}

.petdex-picker__footer a {
  color: var(--n-color-target);
  text-decoration: none;
}

.petdex-picker__footer a:hover {
  text-decoration: underline;
}

.petdex-picker__spin {
  padding: 16px 0;
}

.petdex-picker__error {
  font-size: 12px;
  color: var(--n-error-color);
}

.petdex-picker__empty {
  font-size: 12px;
  padding: 4px 0;
  text-align: center;
}
</style>
