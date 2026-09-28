<script setup lang="ts">
import { computed } from 'vue'

import {
  WORLD_PLANE_ORIGIN,
  WORLD_PLANE_SIZE,
} from '../constants/worldPlane'
import { useCanvasStore } from '../stores/canvas.store'
import { getPortWorldPosition } from '../utils/getPortScreenPosition'
import { getEdgePath } from '../utils/getEdgePath'
import { getConnectionPreviewEndpoint } from '../utils/getConnectionPreviewEndpoint'
import {
  getArrowTipWorldOffset,
  getEdgePathEndControl,
  getInputEdgeAlignment,
} from '../utils/edgeMarkerAlignment'

const PREVIEW_STROKE_WIDTH = 2

const store = useCanvasStore()

const viewBox = `${WORLD_PLANE_ORIGIN} ${WORLD_PLANE_ORIGIN} ${WORLD_PLANE_SIZE} ${WORLD_PLANE_SIZE}`

const path = computed(() => {
  if (
    !store.connectionDrag.active
  ) {
    return ''
  }

  const node =
    store.nodes.find(
      n =>
        n.id ===
        store.connectionDrag
          .sourceNodeId,
    )

  if (!node) {
    return ''
  }

  const start =
    getPortWorldPosition(
      node,
      'output',
    )

  const snapped =
    store.connectionDrag
      .targetNodeId
      ? {
          nodeId:
            store.connectionDrag
              .targetNodeId,
          portId:
            store.connectionDrag
              .targetPortId,
        }
      : null

  const tip =
    getConnectionPreviewEndpoint(
      store.connectionDrag.mouseX,
      store.connectionDrag.mouseY,
      store.connectionDrag
        .sourceNodeId,
      store.nodes,
      snapped,
    )

  let curveAnchorX = tip.x
  let curveAnchorY = tip.y
  let usePortCircleAlign = false

  if (snapped) {
    const targetNode =
      store.nodes.find(
        n =>
          n.id ===
          snapped.nodeId,
      )

    if (targetNode) {
      const port =
        getPortWorldPosition(
          targetNode,
          'input',
        )

      curveAnchorX = port.x
      curveAnchorY = port.y
      usePortCircleAlign = true
    }
  }

  const control2 =
    getEdgePathEndControl(
      start.x,
      curveAnchorX,
      curveAnchorY,
    )

  if (usePortCircleAlign) {
    const alignment =
      getInputEdgeAlignment(
        curveAnchorX,
        curveAnchorY,
        control2.x,
        control2.y,
        store.viewport.zoom,
        PREVIEW_STROKE_WIDTH,
      )

    return getEdgePath(
      start.x,
      start.y,
      alignment.pathEndX,
      alignment.pathEndY,
      curveAnchorX,
      curveAnchorY,
    )
  }

  const dx = curveAnchorX - control2.x
  const dy = curveAnchorY - control2.y
  const len =
    Math.hypot(dx, dy) || 1
  const inset = getArrowTipWorldOffset(
    store.viewport.zoom,
    PREVIEW_STROKE_WIDTH,
  )

  return getEdgePath(
    start.x,
    start.y,
    curveAnchorX -
      (dx / len) * inset,
    curveAnchorY -
      (dy / len) * inset,
    curveAnchorX,
    curveAnchorY,
  )
})
</script>

<template>
<svg
  v-if="store.connectionDrag.active"
  class="preview-layer"
  :viewBox="viewBox"
  :width="WORLD_PLANE_SIZE"
  :height="WORLD_PLANE_SIZE"
  shape-rendering="geometricPrecision"
  :style="{
    left: `${WORLD_PLANE_ORIGIN}px`,
    top: `${WORLD_PLANE_ORIGIN}px`,
  }"
>
  <defs>
    <marker
      id="preview-arrow"
      viewBox="0 0 8 8"
      markerWidth="5"
      markerHeight="5"
        refX="3"
        refY="4"
      orient="auto"
      markerUnits="strokeWidth"
    >
      <path
        d="M0 1 L5 4 L0 7 Z"
        fill="#b8c0cc"
      />
    </marker>
  </defs>

  <path
    :d="path"
    class="preview-line vector-stroke"
    marker-end="url(#preview-arrow)"
  />
</svg>
</template>


<style scoped>
.preview-layer {
  position: absolute;

  overflow: visible;

  pointer-events: none;

  z-index: 3;
}

.preview-line {
  fill: none;

  stroke: #d8dee6;

  stroke-width: 2;

  stroke-linecap: round;

  stroke-linejoin: round;

  stroke-dasharray: 6 4;

  opacity: 0.88;
}
</style>
