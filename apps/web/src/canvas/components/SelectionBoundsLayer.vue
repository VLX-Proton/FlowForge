<script setup lang="ts">
import {
  computed,
  ref,
} from 'vue'

import {
  getNodesUnionVisualBounds,
  NODE_BORDER_RADIUS,
} from '../constants/nodeLayout'
import { useCanvasStore } from '../stores/canvas.store'
import { screenToWorld } from '../utils/coordinates'

const store = useCanvasStore()

const isDraggingSelection =
  ref(false)

let dragStartX = 0
let dragStartY = 0

const initialPositions =
  new Map<
    string,
    {
      x: number
      y: number
    }
  >()

const bounds = computed(() => {
  if (
    store.selectionSource !==
    'marquee'
  ) {
    return null
  }

  const selectedNodes =
    store.nodes.filter(node =>
      store.selectedNodeIds.includes(
        node.id,
      ),
    )

  if (
    selectedNodes.length < 2
  ) {
    return null
  }

  return getNodesUnionVisualBounds(
    selectedNodes,
    true,
  )
})

const style = computed(() => {
  if (!bounds.value) {
    return {}
  }

  return {
    width: `${bounds.value.width}px`,

    height: `${bounds.value.height}px`,

    borderRadius: `${NODE_BORDER_RADIUS}px`,

    transform: `
      translate(
        ${bounds.value.x}px,
        ${bounds.value.y}px
      )
    `,
  }
})

function handleMouseDown(
  event: MouseEvent,
) {
  event.stopPropagation()

  isDraggingSelection.value =
    true

  dragStartX =
    event.clientX

  dragStartY =
    event.clientY

  initialPositions.clear()

  for (const node of store.nodes) {
    if (
      !store.selectedNodeIds.includes(
        node.id,
      )
    ) {
      continue
    }

    initialPositions.set(
      node.id,
      {
        x: node.x,
        y: node.y,
      },
    )
  }

  window.addEventListener(
    'mousemove',
    handleMouseMove,
  )

  window.addEventListener(
    'mouseup',
    handleMouseUp,
  )
}

function handleMouseMove(
  event: MouseEvent,
) {
  if (
    !isDraggingSelection.value
  ) {
    return
  }

  const start = screenToWorld(
    {
      x: dragStartX,
      y: dragStartY,
    },
    store.viewport,
  )

  const current = screenToWorld(
    {
      x: event.clientX,
      y: event.clientY,
    },
    store.viewport,
  )

  const dx = current.x - start.x
  const dy = current.y - start.y

  for (const nodeId of store.selectedNodeIds) {
    const initial =
      initialPositions.get(
        nodeId,
      )

    if (!initial) {
      continue
    }

    store.moveNode(
      nodeId,
      initial.x + dx,
      initial.y + dy,
    )
  }
}

function handleMouseUp() {
  isDraggingSelection.value =
    false

  window.removeEventListener(
    'mousemove',
    handleMouseMove,
  )

  window.removeEventListener(
    'mouseup',
    handleMouseUp,
  )
}
</script>

<template>
  <div
    v-if="bounds"
    class="selection-bounds"
    :style="style"
    @mousedown.left="
      handleMouseDown
    "
  />
</template>

<style scoped>
.selection-bounds {
  position: absolute;

  z-index: 6;

  border: 1px dashed #60a5fa;

  cursor: move;

  pointer-events: auto;
}
</style>
