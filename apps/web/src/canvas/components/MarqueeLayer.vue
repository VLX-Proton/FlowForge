<script setup lang="ts">
import { computed } from 'vue'

import { useCanvasStore } from '../stores/canvas.store'

const store = useCanvasStore()

const marqueeStyle = computed(() => {
  const marquee =
    store.marquee

  const left = Math.min(
    marquee.startX,
    marquee.currentX,
  )

  const top = Math.min(
    marquee.startY,
    marquee.currentY,
  )

  const width = Math.abs(
    marquee.currentX -
    marquee.startX,
  )

  const height = Math.abs(
    marquee.currentY -
    marquee.startY,
  )

  return {
    left: `${left}px`,
    top: `${top}px`,
    width: `${width}px`,
    height: `${height}px`,
  }
})
</script>

<template>
  <div class="marquee-layer">
    <div
      v-if="store.marquee.active"
      class="marquee"
      :style="marqueeStyle"
    />
  </div>
</template>

<style scoped>
.marquee-layer {
  position: absolute;
  inset: 0;

  pointer-events: none;
}

.marquee {
  position: absolute;

  border: 1px solid #3b82f6;

  background:
    rgba(
      59,
      130,
      246,
      0.12
    );
}
</style>
