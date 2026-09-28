<script setup lang="ts">
import {
  computed,
  inject,
} from 'vue'

import { nodeRegistry } from '../../nodes/nodeRegistry'
import { useCanvasStore } from '../stores/canvas.store'
import { draggingNodeIdKey } from '../injection'
import type { WorkflowNode } from '../types/node.types'
import NodeInfoBubble from './NodeInfoBubble.vue'
import {
  NODE_BORDER_RADIUS,
  NODE_BORDER_WIDTH,
  NODE_SELECTED_RING_SPREAD,
  NODE_SHADOW_BLUR,
  NODE_SHADOW_OFFSET_Y,
} from '../constants/nodeLayout'
import { snapDisplay } from '../utils/snapDisplay'
import { getNodeValidationState } from '../utils/nodeIntelligence'

const store = useCanvasStore()

const nodeBorderWidth = `${NODE_BORDER_WIDTH}px`
const nodeBorderRadius = `${NODE_BORDER_RADIUS}px`
const nodeShadow = `0 ${NODE_SHADOW_OFFSET_Y}px ${NODE_SHADOW_BLUR}px rgba(0, 0, 0, 0.18)`
const nodeSelectedShadow = `0 0 0 ${NODE_SELECTED_RING_SPREAD}px rgba(255, 255, 255, 0.239)`

const draggingNodeId = inject(
  draggingNodeIdKey,
)!

const nodes = computed(
  () => store.nodes,
)

const nodeValidationErrors = computed(() => {
  const errors: Record<string, string[]> = {}
  store.nodes.forEach(node => {
    const validation = getNodeValidationState(
      node,
      store.edges,
      store.nodePreviewData,
    )
    if (!validation.isValid) {
      errors[node.id] = validation.issues
    }
  })
  return errors
})

let dragOffsetX = 0
let dragOffsetY = 0

function getNodeStatusClass(node: WorkflowNode): string[] {
  const status = node.execution?.status || 'idle'
  const issues = nodeValidationErrors.value[node.id] || []
  if (issues.length > 0) return ['error']
  return [status]
}

function getNodeStyle(node: {
  id: string
  x: number
  y: number
  width: number
  height: number
}) {
  const isDragging =
    draggingNodeId.value === node.id

  const x = isDragging
    ? node.x
    : snapDisplay(node.x)
  const y = isDragging
    ? node.y
    : snapDisplay(node.y)

  return {
    width: `${node.width}px`,
    height: `${node.height}px`,

    transform: `translate3d(${x}px, ${y}px, 0)`,
  }
}

function startDrag(
  event: MouseEvent,
  nodeId: string,
) {
  if (
    (event.target as HTMLElement)
      .closest('.port')
  ) {
    return
  }

  event.stopPropagation()

  const node =
    store.nodes.find(
      n => n.id === nodeId,
    )

  if (!node) return

  draggingNodeId.value = nodeId

  const worldMouseX =
    (event.clientX -
      store.viewport.x) /
    store.viewport.zoom

  const worldMouseY =
    (event.clientY -
      store.viewport.y) /
    store.viewport.zoom

  dragOffsetX =
    worldMouseX - node.x

  dragOffsetY =
    worldMouseY - node.y
}

function handleMouseMove(
  event: MouseEvent,
) {
  if (!draggingNodeId.value) {
    return
  }

  const worldMouseX =
    (event.clientX -
      store.viewport.x) /
    store.viewport.zoom

  const worldMouseY =
    (event.clientY -
      store.viewport.y) /
    store.viewport.zoom

  store.moveNode(
    draggingNodeId.value,
    worldMouseX - dragOffsetX,
    worldMouseY - dragOffsetY,
  )
}

function stopDrag() {
  draggingNodeId.value = null
}

function isSelected(
  nodeId: string,
) {
  return store.selectedNodeIds.includes(
    nodeId,
  )
}

function selectNode(
  event: MouseEvent,
  nodeId: string,
) {
  if (
    event.ctrlKey ||
    event.metaKey
  ) {
    store.toggleNodeSelection(
      nodeId,
    )

    return
  }

  store.selectNode(nodeId)
}

function openPopup(
  nodeId: string,
) {
  store.openPopup(nodeId)
}

function isDragging(
  nodeId: string,
) {
  return (
    draggingNodeId.value === nodeId
  )
}

function getNodeConfig(
  node: WorkflowNode,
) {
  // Return a safe fallback if the node type is missing or has been removed.
  // This prevents runtime errors when localStorage/IndexedDB contains stale nodes.
  return (
    nodeRegistry[node.type] ?? {
      // Provide a dummy component (null) and empty title to avoid rendering errors.
      icon: null as any,
      title: '',
    }
  )
}
</script>

<template>
  <div
    class="node-layer"
    @mousemove="handleMouseMove"
    @mouseup="stopDrag"
    @mouseleave="stopDrag"
  >
    <div
      v-for="node in nodes"
      :key="node.id"
      class="node"
      :class="{
        selected: isSelected(node.id),
        dragging: isDragging(node.id),
      }"
      :style="getNodeStyle(node)"
      @click.stop="
        selectNode(
          $event,
          node.id,
        )
      "
      @dblclick.stop="
        openPopup(node.id)
      "
      @mousedown.left="
        startDrag(
          $event,
          node.id,
        )
      "
    >
<span
          class="node-status-dot"
          :class="getNodeStatusClass(node)"
        />

      <div class="node-content">
        <!-- Guard against missing node definitions (e.g., after clearing storage) -->
        <component
          v-if="getNodeConfig(node) && getNodeConfig(node).icon"
          :is="getNodeConfig(node).icon"
          class="node-icon"
          :size="16"
        />

        <div class="node-label">
          {{
            getNodeConfig(node).title
          }}
        </div>
      </div>
    </div>

    <NodeInfoBubble
      v-for="node in nodes"
      :key="`bubble-${node.id}`"
      :node="node"
    />
  </div>
</template>

<style scoped>
.node-layer {
  position: absolute;
  top: 0;
  left: 0;

  z-index: 2;
}

.node {
  position: absolute;
  top: 0;
  left: 0;

  box-sizing: border-box;

  display: flex;
  align-items: center;
  justify-content: center;

  background: var(--node-bg);
  border: v-bind(nodeBorderWidth) solid var(--node-border);
  border-radius: v-bind(nodeBorderRadius);
  box-shadow: v-bind(nodeShadow);
  color: var(--node-text);

  cursor: pointer;

  user-select: none;
}

.node.selected {
  border-color: #3b82f6;
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.25);
}

.node.dragging {
  cursor: grabbing;
}

.node-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 6px;

  pointer-events: none;

  padding: 0 10px;
}

.node-icon {
  color: var(--node-text);
  flex-shrink: 0;
}

.node-label {
  font-size: 12px;
  font-weight: 500;
  line-height: 1.2;

  text-align: center;

  text-rendering: geometricPrecision;
  -webkit-font-smoothing: antialiased;
}

.node-status-dot {
  position: absolute;
  top: 10px;
  right: 10px;
  width: 8px;
  height: 8px;
  border-radius: 9999px;
  background: rgba(255, 255, 255, 0.18);
  pointer-events: none;
}

.node-status-dot.running {
  background: #00f8b9;
  animation: pulse 1.2s ease-in-out infinite;
}

.node-status-dot.success {
  background: #22c55e;
}

.node-status-dot.error {
  background: #ef4444;
}

@keyframes pulse {
  0%, 100% {
    transform: scale(1);
    opacity: 1;
  }
  50% {
    transform: scale(1.25);
    opacity: 0.8;
  }
}
</style>
