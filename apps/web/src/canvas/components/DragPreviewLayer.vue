<script setup lang="ts">
import { computed } from 'vue'

import { useCanvasStore }
from '../stores/canvas.store'

import { nodeRegistry }
from '../../nodes/nodeRegistry'

import { worldToScreen }
from '../utils/coordinates'
import {
  DEFAULT_NODE_HEIGHT,
  DEFAULT_NODE_WIDTH,
  NODE_BORDER_RADIUS,
} from '../constants/nodeLayout'

const store =
  useCanvasStore()

const style = computed(() => {
  const screenPoint = worldToScreen(
    {
      x: store.dragPreview.x,
      y: store.dragPreview.y,
    },
    store.viewport,
  )

  return {
    transform: `
      translate3d(
        ${screenPoint.x}px,
        ${screenPoint.y}px,
        0
      )
    `,
  }
})

const previewNodeStyle = computed(() => ({
  width: `${DEFAULT_NODE_WIDTH}px`,
  height: `${DEFAULT_NODE_HEIGHT}px`,
  borderRadius: `${NODE_BORDER_RADIUS}px`,
}))
</script>

<template>
  <div
    v-if="store.dragPreview.active"
    class="preview"
    :style="style"
  >
    <div
      class="preview-node"
      :style="previewNodeStyle"
    >
      <component
        :is="
          nodeRegistry[
            store.dragPreview.type
          ].icon
        "
        :size="20"
      />

      <div class="preview-label">
        {{
          nodeRegistry[
            store.dragPreview.type
          ].title
        }}
      </div>
    </div>
  </div>
</template>

<style scoped>
.preview {
  position: absolute;

  left: 0;
  top: 0;

  pointer-events: none;

  z-index: 9999;
}

.preview-node {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 6px;

  padding: 0 10px;

  border-radius: inherit;

  background: var(--node-bg);
  border: 1px solid var(--node-border);
  color: var(--node-text);

  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.18);

  opacity: 0.96;

  transform: translate(-50%, -50%);
}

.preview-node svg {
  color: #f8fafc;
}

.preview-label {
  font-size: 12px;
  font-weight: 500;
  line-height: 1.2;
  text-align: center;
  text-rendering: geometricPrecision;
  -webkit-font-smoothing: antialiased;
}
</style>