<script setup lang="ts">
import {
  computed,
  inject,
  onUnmounted,
} from 'vue'

import { useCanvasStore } from '../stores/canvas.store'
import type { WorkflowNode } from '../types/node.types'
import {
  getPortHitboxLayout,
  type PortSide,
} from '../constants/portLayout'
import { draggingNodeIdKey } from '../injection'
import { snapDisplay } from '../utils/snapDisplay'

/** Screen pixels — intentional drag before connection starts. */
const OUTPUT_DRAG_THRESHOLD = 8
const OUTPUT_DRAG_THRESHOLD_SQ =
  OUTPUT_DRAG_THRESHOLD *
  OUTPUT_DRAG_THRESHOLD

const props = defineProps<{
  variant: PortSide
}>()

const store = useCanvasStore()

const draggingNodeId = inject(
  draggingNodeIdKey,
)!

const isConnecting = computed(
  () => store.connectionDrag.active,
)

const nodes = computed(
  () => store.nodes,
)

let pendingOutputDrag: {
  nodeId: string
  portId: string
  startClientX: number
  startClientY: number
} | null = null

function getPorts(node: WorkflowNode) {
  return props.variant === 'input'
    ? node.inputs
    : node.outputs
}

function getNodeAnchorStyle(
  node: WorkflowNode,
) {
  const isDragging =
    draggingNodeId.value === node.id

  const x = isDragging
    ? node.x
    : snapDisplay(node.x)
  const y = isDragging
    ? node.y
    : snapDisplay(node.y)

  return {
    transform: `translate3d(${x}px, ${y}px, 0)`,
  }
}

function getPortHitboxStyle(
  node: WorkflowNode,
) {
  const layout = getPortHitboxLayout(
    node,
    props.variant,
  )

  return {
    left: `${layout.left}px`,
    top: `${layout.top}px`,
    width: `${layout.width}px`,
    height: `${layout.height}px`,
  }
}

function clearPendingOutputDrag() {
  pendingOutputDrag = null

  window.removeEventListener(
    'mousemove',
    handlePendingOutputMove,
  )

  window.removeEventListener(
    'mouseup',
    handlePendingOutputUp,
  )
}

function handlePendingOutputMove(
  event: MouseEvent,
) {
  if (
    !pendingOutputDrag ||
    event.buttons === 0
  ) {
    return
  }

  const dx =
    event.clientX -
    pendingOutputDrag.startClientX
  const dy =
    event.clientY -
    pendingOutputDrag.startClientY

  if (
    dx * dx + dy * dy <
    OUTPUT_DRAG_THRESHOLD_SQ
  ) {
    return
  }

  const pending = pendingOutputDrag

  clearPendingOutputDrag()

  store.startConnectionDrag(
    pending.nodeId,
    pending.portId,
    event.clientX,
    event.clientY,
  )
}

function handlePendingOutputUp() {
  if (!pendingOutputDrag) {
    return
  }

  clearPendingOutputDrag()
}

function beginOutputPortDrag(
  event: MouseEvent,
  nodeId: string,
  portId: string,
) {
  clearPendingOutputDrag()

  pendingOutputDrag = {
    nodeId,
    portId,
    startClientX: event.clientX,
    startClientY: event.clientY,
  }

  window.addEventListener(
    'mousemove',
    handlePendingOutputMove,
  )

  window.addEventListener(
    'mouseup',
    handlePendingOutputUp,
  )
}

function beginInputPortDrag(
  event: MouseEvent,
  nodeId: string,
  portId: string,
) {
  const connectedEdge = store.edges.find(
    edge => edge.targetNodeId === nodeId && edge.targetPortId === portId
  )

  if (!connectedEdge) {
    return
  }

  const sourceNodeId = connectedEdge.sourceNodeId
  const sourcePortId = connectedEdge.sourcePortId

  // Remove the existing connection
  store.deleteEdge(connectedEdge.id)

  // Start drag connection from the source port to the cursor
  store.startConnectionDrag(
    sourceNodeId,
    sourcePortId,
    event.clientX,
    event.clientY,
  )
}

function hasConnection(nodeId: string, portId: string): boolean {
  return store.edges.some(
    edge => edge.targetNodeId === nodeId && edge.targetPortId === portId
  )
}

function isSnapped(
  nodeId: string,
  portId: string,
) {
  return (
    store.connectionDrag
      .targetNodeId === nodeId
    &&
    store.connectionDrag
      .targetPortId === portId
  )
}

onUnmounted(() => {
  clearPendingOutputDrag()
})
</script>

<template>
  <div
    class="port-layer"
    :class="`port-layer--${variant}`"
  >
    <div
      v-for="node in nodes"
      :key="`${variant}-${node.id}`"
      class="node-port-anchor"
      :style="getNodeAnchorStyle(node)"
    >
      <div
        v-for="port in getPorts(node)"
        :key="`${variant}-${node.id}-${port.id}`"
        class="port"
        :class="[
          variant === 'input'
            ? 'input-port'
            : 'output-port',
          {
            connecting: isConnecting,
            snapped: isSnapped(
              node.id,
              port.id,
            ),
            reconnectable: variant === 'input' && hasConnection(node.id, port.id),
          },
        ]"
        :style="getPortHitboxStyle(node)"
        @mousedown.left.stop.prevent="
          variant === 'output'
            ? beginOutputPortDrag(
                $event,
                node.id,
                port.id,
              )
            : beginInputPortDrag(
                $event,
                node.id,
                port.id,
              )
        "
      >
        <div class="port-pill" />
      </div>
    </div>
  </div>
</template>

<style scoped>
.port-layer {
  position: absolute;
  top: 0;
  left: 0;

  pointer-events: none;
}

.port-layer--input {
  z-index: 4;
}

.port-layer--output {
  z-index: 5;
}

.node-port-anchor {
  position: absolute;
  top: 0;
  left: 0;

  pointer-events: none;
}

.port {
  position: absolute;

  display: flex;
  align-items: center;
  justify-content: center;

  pointer-events: auto;
}

 .port-pill {
   width: 8px;
   height: 16px;
   flex-shrink: 0;
   border-radius: 0;
   /* Use neutral border color for ports */
   background: var(--node-border);
   border: none;
   box-sizing: border-box;
   pointer-events: none;
 }

.input-port {
  cursor: default;
}

.input-port.reconnectable {
  cursor: grab;
}

.input-port.reconnectable:hover .port-pill {
  background: var(--accent);
}

.output-port {
  cursor: crosshair;
}

 .output-port:hover .port-pill {
   background: var(--accent);
 }

.input-port.connecting .port-pill {
  opacity: 0.45;
}

 .input-port.connecting.snapped .port-pill {
   opacity: 1;
   background: var(--accent);
 }
</style>
