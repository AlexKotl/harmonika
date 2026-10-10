<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { ROWS, type Row } from '../data/layout'
import HarmonicaButton from './HarmonicaButton.vue'

defineProps<{
  tuningOffset: number
  bellows: 'push' | 'pull'
}>()

// How far down each row's first button starts, in "key cell" units. The
// outer row (1) starts highest; each inner row is staggered half a key
// lower, matching the wedge shape of a real diskant keyboard.
const ROW_OFFSET: Record<Row['row'], number> = { 1: 0, 2: 0.5, 3: 1, 4: 1.5 }
const MAX_ROW_LENGTH = Math.max(...ROWS.map((row) => row.buttons.length))
const MAX_OFFSET = Math.max(...Object.values(ROW_OFFSET))

// Columns are displayed left (innermost, row 4) to right (outermost, row 1),
// which is how a player sees the keyboard held in front of them.
const columns = computed<Row[]>(() => [...ROWS].sort((a, b) => b.row - a.row))

const boardEl = ref<HTMLElement | null>(null)
const keySize = ref(56)

const KEY_GAP = 10
const COLUMN_GAP = 14
const BOARD_PADDING = 18

function recomputeKeySize(): void {
  const el = boardEl.value
  if (!el) return
  const { width, height } = el.getBoundingClientRect()

  const availableWidth = width - BOARD_PADDING * 2 - COLUMN_GAP * (columns.value.length - 1)
  const byWidth = availableWidth / columns.value.length

  const verticalCells = MAX_ROW_LENGTH + MAX_OFFSET
  const availableHeight = height - BOARD_PADDING * 2 - KEY_GAP * (MAX_ROW_LENGTH - 1 + MAX_OFFSET)
  const byHeight = availableHeight / verticalCells

  keySize.value = Math.max(26, Math.min(110, byWidth, byHeight))
}

let resizeObserver: ResizeObserver | null = null

onMounted(() => {
  recomputeKeySize()
  if (boardEl.value) {
    resizeObserver = new ResizeObserver(() => recomputeKeySize())
    resizeObserver.observe(boardEl.value)
  }
  window.addEventListener('orientationchange', recomputeKeySize)
})

onBeforeUnmount(() => {
  resizeObserver?.disconnect()
  window.removeEventListener('orientationchange', recomputeKeySize)
})
</script>

<template>
  <div
    ref="boardEl"
    class="fingerboard"
    :style="{
      '--key-size': `${keySize}px`,
      '--key-gap': `${KEY_GAP}px`,
      '--column-gap': `${COLUMN_GAP}px`,
      '--board-padding': `${BOARD_PADDING}px`,
    }"
  >
    <div v-for="column in columns" :key="column.row" class="column" :style="{ '--row-offset': ROW_OFFSET[column.row] }">
      <HarmonicaButton
        v-for="button in column.buttons"
        :key="button.id"
        :button="button"
        :tuning-offset="tuningOffset"
        :bellows="bellows"
      />
    </div>
  </div>
</template>
