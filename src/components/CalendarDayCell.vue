<script setup lang="ts">
import { computed } from 'vue'
import {
  formatFestivalCellLabel,
  getCalendarCellMeta,
  shouldShowLunarInCalendarCell
} from '@/lib/chineseCalendar'

const props = defineProps<{
  year: number
  month: number
  date: number
  taskCount: number
}>()

const meta = computed(() => getCalendarCellMeta(props.year, props.month, props.date))

const festivalDisplay = computed(() => formatFestivalCellLabel(meta.value.festivalLabel))

const showLunarInCell = computed(() => shouldShowLunarInCalendarCell(meta.value))
</script>

<template>
  <div class="cal-cell-root">
    <div
      v-if="showLunarInCell || festivalDisplay"
      class="cal-cell-foot"
      :class="{ 'cal-cell-foot--fest-only': festivalDisplay && !showLunarInCell }"
    >
      <span
        v-if="showLunarInCell"
        class="cal-lunar"
        :class="{
          'cal-lunar--term': meta.isSolarTerm,
          'cal-lunar--holiday': meta.isPublicHoliday,
          'cal-lunar--with-festival': Boolean(festivalDisplay)
        }"
      >
        {{ meta.lunarLabel }}
      </span>
      <span
        v-if="festivalDisplay"
        class="cal-festival"
        :class="{
          'cal-festival--legal': meta.isPublicHoliday,
          'cal-festival--work': meta.isAdjustedWorkday
        }"
        :title="meta.festivalHint ?? meta.festivalLabel ?? undefined"
      >
        {{ festivalDisplay }}
      </span>
    </div>
    <span v-if="taskCount" class="cal-badge">{{ taskCount }}</span>
  </div>
</template>

<style scoped>
.cal-cell-root {
  position: absolute;
  inset: 0;
  z-index: 0;
  pointer-events: none;
}

.cal-cell-foot {
  position: absolute;
  left: 3px;
  right: 3px;
  bottom: 5px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: flex-end;
  gap: 1px;
  max-height: 38%;
  min-height: 0;
}

.cal-cell-foot--fest-only {
  bottom: 7px;
  max-height: 28%;
}

.cal-lunar {
  width: 100%;
  font-size: 10px;
  line-height: 1.2;
  text-align: center;
  color: var(--pd-muted-fg);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  flex-shrink: 0;
}

.cal-lunar--with-festival {
  font-size: 9px;
  opacity: 0.92;
}

.cal-lunar--term {
  color: var(--pd-calendar-term);
  font-weight: 600;
  font-size: 10px;
}

.cal-lunar--holiday {
  color: var(--pd-calendar-holiday);
  font-weight: 600;
}

.cal-festival {
  width: 100%;
  font-size: 9px;
  line-height: 1.2;
  font-weight: 600;
  text-align: center;
  color: color-mix(in srgb, var(--pd-calendar-holiday) 85%, #c2410c);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  flex-shrink: 0;
}

.cal-cell-foot--fest-only .cal-festival {
  font-size: 10px;
  line-height: 1.25;
}

.cal-festival--legal {
  color: var(--pd-calendar-holiday);
}

.cal-festival--work {
  color: var(--pd-muted-fg);
  font-weight: 500;
}

.cal-badge {
  position: absolute;
  top: 5px;
  right: 5px;
  z-index: 3;
  min-width: 16px;
  padding: 0 5px;
  border-radius: 999px;
  font-size: 10px;
  font-weight: 700;
  line-height: 16px;
  text-align: center;
  color: var(--pd-sider-btn-fg, #fff);
  background: var(--pd-sider-btn-bg, var(--pd-body-fg));
  box-shadow: 0 1px 4px color-mix(in srgb, var(--pd-body-fg) 18%, transparent);
  pointer-events: none;
}
</style>
