<script setup lang="ts">
import { computed, ref } from 'vue'

import {
  WORLD_PLANE_ORIGIN,
  WORLD_PLANE_SIZE,
} from '../constants/worldPlane'
import { useCanvasStore } from '../stores/canvas.store'
import { getPortWorldPosition } from '../utils/getPortScreenPosition'
import { getEdgePath } from '../utils/getEdgePath'
import {
  getEdgePathEndControl,
  getInputEdgeAlignment,
} from '../utils/edgeMarkerAlignment'

const viewBox = `${WORLD_PLANE_ORIGIN} ${WORLD_PLANE_ORIGIN} ${WORLD_PLANE_SIZE} ${WORLD_PLANE_SIZE}`

const store = useCanvasStore()
const hoveredEdgeId = ref<string | null>(null)

const edges = computed(() =>
  store.edges
    .map(edge => {
      const sourceNode =
        store.nodes.find(
          n =>
            n.id === edge.sourceNodeId,
        )

      const targetNode =
        store.nodes.find(
          n =>
            n.id === edge.targetNodeId,
        )

      if (
        !sourceNode ||
        !targetNode
      ) {
        return null
      }

      const start =
        getPortWorldPosition(
          sourceNode,
          'output',
        )

      const port =
        getPortWorldPosition(
          targetNode,
          'input',
        )

      const control2 =
        getEdgePathEndControl(
          start.x,
          port.x,
          port.y,
        )

      const alignment =
        getInputEdgeAlignment(
          port.x,
          port.y,
          control2.x,
          control2.y,
          store.viewport.zoom,
        )

      const startX = start.x
      const startY = start.y
      const endX = alignment.pathEndX
      const endY = alignment.pathEndY
      const curveAnchorX = port.x
      const curveAnchorY = port.y

      // Analytical midpoint calculation at t=0.5 for cubic Bezier curve
      const midX = 0.5 * startX + 0.375 * curveAnchorX + 0.125 * endX
      const midY = 0.5 * startY + 0.375 * curveAnchorY + 0.125 * endY

      return {
        id: edge.id,

        path: getEdgePath(
          startX,
          startY,
          endX,
          endY,
          curveAnchorX,
          curveAnchorY,
        ),
        midX,
        midY,
      }
    })
    .filter(
      (
        edge,
      ): edge is {
        id: string
        path: string
        midX: number
        midY: number
      } => edge !== null,
    ),
)

</script>

<template>
  <svg
    class="edge-layer"
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
      <!-- Normal state marker -->
      <marker
        id="edge-arrow"
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
          fill="var(--edge-color)"
        />
      </marker>
      <!-- Hover state marker -->
      <marker
        id="edge-arrow-hover"
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
          fill="#9ca3af"
        />
      </marker>
      <!-- Selected state marker -->
      <marker
        id="edge-arrow-selected"
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
          fill="#f97316"
        />
      </marker>
    </defs>

    <g
      v-for="edge in edges"
      :key="edge.id"
      class="edge-group"
      :class="{
        hovered: hoveredEdgeId === edge.id,
        selected: store.selectedEdgeId === edge.id,
      }"
    >
      <!-- Invisible hitbox path for easy snapping / selection -->
      <path
        :d="edge.path"
        class="edge-hitbox"
        @mouseenter="hoveredEdgeId = edge.id"
        @mouseleave="hoveredEdgeId = null"
        @mousedown.stop="store.selectEdge(edge.id)"
      />

      <!-- Visible vector stroke path -->
      <path
        :d="edge.path"
        class="edge-visible vector-stroke"
        :marker-end="
          store.selectedEdgeId === edge.id
            ? 'url(#edge-arrow-selected)'
            : hoveredEdgeId === edge.id
            ? 'url(#edge-arrow-hover)'
            : 'url(#edge-arrow)'
        "
      />

      <!-- Centered delete button at curve midpoint (only visible when selected) -->
      <foreignObject
        v-if="store.selectedEdgeId === edge.id"
        :x="edge.midX - 10"
        :y="edge.midY - 10"
        width="20"
        height="20"
        style="overflow: visible;"
        @mousedown.stop
      >
        <button
          class="edge-delete-btn"
          @click.stop="store.deleteEdge(edge.id)"
          @mousedown.stop
          title="Delete Connection"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
        </button>
      </foreignObject>
    </g>
  </svg>
</template>

<style scoped>
.edge-layer {
  position: absolute;
  overflow: visible;
  pointer-events: none;
  z-index: 3;
}

.edge-group {
  cursor: pointer;
}

.edge-hitbox {
  fill: none;
  stroke: transparent;
  stroke-width: 16px;
  pointer-events: stroke;
}

.edge-visible {
  fill: none;
  stroke: var(--edge-color);
  stroke-width: 1.5;
  stroke-linecap: round;
  stroke-linejoin: round;
  transition: stroke 0.15s ease, stroke-width 0.15s ease;
  pointer-events: none;
}

.edge-group:hover .edge-visible {
  stroke: #9ca3af;
  stroke-width: 2;
}

.edge-group.selected .edge-visible {
  stroke: #f97316;
  stroke-width: 2.5;
}

.edge-delete-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  border-radius: 6px;
  background: rgb(29, 29, 29);
  border: 1px solid var(--border-light);
  color: var(--text-light);
  cursor: pointer;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.25);
  transition: transform .18s ease, border-color .18s ease, background .18s ease, color .18s ease;
  pointer-events: auto;
}

.edge-delete-btn:hover {
  transform: translateY(-1px);
  border-color: var(--accent);
  color: var(--accent);
  background: rgb(38, 38, 38);
}
</style>