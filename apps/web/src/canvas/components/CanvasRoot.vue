<script setup lang="ts">
import {
  ref,
  computed,
  provide,
  onMounted,
  onUnmounted,
} from 'vue'

import GridLayer from './GridLayer.vue'
import NodeLayer from './NodeLayer.vue'
import PortLayer from './PortLayer.vue'
import MarqueeLayer from './MarqueeLayer.vue'
import SelectionBoundsLayer from './SelectionBoundsLayer.vue'
import ConnectionPreviewLayer from './ConnectionPreviewLayer.vue'
import EdgeLayer from './EdgeLayer.vue'
import EdgeAnimationLayer from './EdgeAnimationLayer.vue'
import AddNodeSidebar from './AddNodeSidebar.vue'
import ProfileMenu from './ProfileMenu.vue'
import ToolWorkflowButton from './ToolWorkflowButton.vue'
import DragPreviewLayer from './DragPreviewLayer.vue'
import NodeConfigPopup from './NodeConfigPopup.vue'
import Topbar from './Topbar.vue'
import CheckpointModal from './CheckpointModal.vue'
import AuthModal from './AuthModal.vue'
import { intersects, } from '../utils/intersects'
import { screenToWorld } from '../utils/coordinates'
import { useCanvasStore } from '../stores/canvas.store'
import { useAuthStore } from '../stores/auth.store'
import { draggingNodeIdKey } from '../injection'

const draggingNodeId = ref<string | null>(
  null,
)

provide(
  draggingNodeIdKey,
  draggingNodeId,
)
import '../styles/canvas-rendering.css'

const workspaceStyle = computed(
  () => ({
    transform: `
      translate3d(
        ${store.viewport.x}px,
        ${store.viewport.y}px,
        0
      )
      scale(
        ${store.viewport.zoom}
      )
    `,
    transformOrigin: '0 0',
  }),
)

const store = useCanvasStore()

const isPanning = ref(false)

const isMarqueeing = ref(false)

let lastX = 0
let lastY = 0

const PAN_SPEED = 2

function handleWheel(event: WheelEvent) {
  event.preventDefault()

  const adjustedDelta =
    (event.deltaY * PAN_SPEED) /
    store.viewport.zoom

  if (event.ctrlKey) {
    store.zoomToPoint(
      event.clientX,
      event.clientY,
      event.deltaY > 0
        ? 0.9
        : 1.1,
    )

    return
  }

  if (event.shiftKey) {
    store.pan(
      -adjustedDelta,
      0,
    )

    return
  }

  store.pan(
    0,
    -adjustedDelta,
  )
}

function handleMouseDown(
  event: MouseEvent,
) {
  if (event.button === 1) {
    isPanning.value = true

    lastX = event.clientX
    lastY = event.clientY

    return
  }

  if (event.button === 0) {
    isMarqueeing.value = true

    store.startMarquee(
      event.clientX,
      event.clientY,
    )
  }
}

function handleMouseMove(
  event: MouseEvent,
) {
  if (
    store.connectionDrag.active
  ) {
    store.updateConnectionDrag(
      event.clientX,
      event.clientY,
    )
  }

  if (isMarqueeing.value) {
    store.updateMarquee(
      event.clientX,
      event.clientY,
    )

    return
  }

  if (!isPanning.value) {
    return
  }

const dx =
  event.clientX - lastX

const dy =
  event.clientY - lastY

  store.pan(dx, dy)

  lastX = event.clientX
  lastY = event.clientY
}
function handleMouseUp() {
  isPanning.value = false

  if (
    store.connectionDrag.active
  ) {
    if (store.connectionDrag.targetNodeId) {
      store.createEdge(
        store.connectionDrag.sourceNodeId,
        store.connectionDrag.sourcePortId,
        store.connectionDrag.targetNodeId,
        store.connectionDrag.targetPortId,
      )
    }
    store.stopConnectionDrag()
  }

  if (isMarqueeing.value) {
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

    const right = Math.max(
      marquee.startX,
      marquee.currentX,
    )

    const bottom = Math.max(
      marquee.startY,
      marquee.currentY,
    )

    const worldTopLeft = screenToWorld(
      { x: left, y: top },
      store.viewport,
    )

    const worldBottomRight = screenToWorld(
      { x: right, y: bottom },
      store.viewport,
    )

    const worldLeft = worldTopLeft.x
    const worldTop = worldTopLeft.y
    const worldRight = worldBottomRight.x
    const worldBottom = worldBottomRight.y

    const selectedIds =
      store.nodes
        .filter(node =>
          intersects(
            {
              left: node.x,
              top: node.y,

              right:
                node.x +
                node.width,

              bottom:
                node.y +
                node.height,
            },
            {
              left: worldLeft,
              top: worldTop,

              right: worldRight,
              bottom: worldBottom,
            },
          ),
        )
        .map(
          node => node.id,
        )

    store.selectNodes(
      selectedIds,
    )

    isMarqueeing.value =
      false

    store.stopMarquee()
  }
}

function handleKeyDown(
  event: KeyboardEvent,
) {
  const target = event.target as HTMLElement
  if (
    target &&
    (target.tagName === 'INPUT' ||
      target.tagName === 'TEXTAREA' ||
      target.isContentEditable)
  ) {
    return
  }

  // Zoom to fit ('1') like n8n
  if (event.key === '1') {
    event.preventDefault()
    store.zoomToFit()
    return
  }

  // Delete
  if (
    event.key === 'Delete' ||
    event.key === 'Backspace'
  ) {
    if (store.selectedNodeIds.length > 0) {
      store.deleteSelectedNodes()
    } else if (store.selectedEdgeId) {
      store.deleteSelectedEdge()
    }

    return
  }

  // Ctrl + A
  if (
    event.ctrlKey &&
    event.key.toLowerCase() === 'a'
  ) {
    event.preventDefault()

    store.selectAllNodes()

    return
  }
}

function resetInteractions() {
  isPanning.value = false

  isMarqueeing.value = false

  draggingNodeId.value = null

  store.stopMarquee()

  store.stopConnectionDrag()
}

const authStore = useAuthStore()

onMounted(() => {
  authStore.initAuth()

  window.addEventListener(
    'keydown',
    handleKeyDown,
  )

  window.addEventListener(
    'mouseup',
    resetInteractions,
  )

  window.addEventListener(
    'blur',
    resetInteractions,
  )

  store
    .restorePersistedWorkflow()
    .then(() =>
      store.restorePersistedDirectoryHandles(),
    )
    .catch(() => {
      // ignore restore failures as they are non-critical
    })

  window.addEventListener(
    'beforeunload',
    () => store.saveWorkflowState(),
  )
})

onUnmounted(() => {
  window.removeEventListener(
    'keydown',
    handleKeyDown,
  )

  window.removeEventListener(
    'mouseup',
    resetInteractions,
  )

  window.removeEventListener(
    'blur',
    resetInteractions,
  )
})
</script>

<template>
<div
  class="canvas-root"
  @wheel.prevent="handleWheel"
  @mousedown="handleMouseDown"
  @mousemove="handleMouseMove"
  @mouseup="handleMouseUp"

  :class="{
    panning: isPanning,
  }"
>
  <div
    class="workspace"
    :class="{ panning: isPanning }"
    :style="workspaceStyle"
  >
    <GridLayer />

    <EdgeLayer />

    <EdgeAnimationLayer />

    <NodeLayer />

    <PortLayer variant="input" />

    <ConnectionPreviewLayer />

    <PortLayer variant="output" />

    <SelectionBoundsLayer />
  </div>

  <MarqueeLayer />

  <AddNodeSidebar />
  <ProfileMenu />
  <ToolWorkflowButton />

  <DragPreviewLayer />

  <NodeConfigPopup />

  <CheckpointModal />

  <Topbar />

  <AuthModal />
</div>
</template>

<style scoped>
/* CanvasRoot now inherits the global dark gradient and applies a subtle blur */
/* CanvasRoot provides a dark semi‑transparent overlay with frosted‑glass effect */
.canvas-root {
  position: absolute;
  inset: 0;
  background: #0a0b0e;
  overflow: hidden;
  cursor: default;
  border-radius: 12px;
}

.canvas-root.panning {
  cursor: grabbing;
}



.workspace {
  position: absolute;
  top: 0;
  left: 0;

  transform-origin: 0 0;

  backface-visibility: hidden;
}

.workspace.panning {
  will-change: transform;
}
</style>