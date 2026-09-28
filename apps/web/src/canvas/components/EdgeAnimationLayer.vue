<script setup lang="ts">
import { computed } from 'vue'

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

const store = useCanvasStore()

const viewBox = `${WORLD_PLANE_ORIGIN} ${WORLD_PLANE_ORIGIN} ${WORLD_PLANE_SIZE} ${WORLD_PLANE_SIZE}`

type EdgeItem = {
  id: string
  path: string
  active: boolean
}

const edges = computed<EdgeItem[]>(() => {
  return store.edges
    .map(edge => {
      const source = store.nodes.find(n => n.id === edge.sourceNodeId)
      const target = store.nodes.find(n => n.id === edge.targetNodeId)

      if (!source || !target) return null

      const start = getPortWorldPosition(source, 'output')
      const end = getPortWorldPosition(target, 'input')

      const c2 = getEdgePathEndControl(start.x, end.x, end.y)
      const align = getInputEdgeAlignment(
        end.x,
        end.y,
        c2.x,
        c2.y,
        store.viewport.zoom,
      )

      const path = getEdgePath(
        start.x,
        start.y,
        align.pathEndX,
        align.pathEndY,
        end.x,
        end.y,
      ).replace(/\n/g, ' ').trim()

      const sourceRunning = source.execution?.status === 'running'
      const targetRunning = target.execution?.status === 'running'

      const active = sourceRunning || targetRunning

      return {
        id: edge.id,
        path,
        active,
      }
    })
    .filter((e): e is EdgeItem => e !== null)
})
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
    <g v-for="edge in edges" :key="edge.id">

      <!-- BASE LINE -->
      <path
        :d="edge.path"
        class="edge-base"
        :class="{ active: edge.active }"
      />

      <!-- ANIMATION ONLY WHEN ACTIVE -->
      <template v-if="edge.active">

        <circle
          v-for="i in 20"
          :key="'p'+i"
          r="2"
          fill="#a855f7"
          opacity="0.9"
        >
          <animateMotion
            :path="edge.path"
            dur="0.6s"
            repeatCount="indefinite"
            :begin="`${i * -0.05}s`"
          />
        </circle>

        <circle r="6" fill="rgba(168,85,247,0.4)">
          <animateMotion
            :path="edge.path"
            dur="0.8s"
            repeatCount="indefinite"
          />
          <animate
            attributeName="r"
            values="2;14;2"
            dur="0.6s"
            repeatCount="indefinite"
          />
        </circle>

      </template>

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

.edge-base {
  fill: none;
  stroke: #334155;
  stroke-width: 1.6;
  stroke-linecap: round;
  stroke-linejoin: round;
  transition: stroke 0.2s ease, stroke-width 0.2s ease;
}

.edge-base.active {
  stroke: #a855f7;
  stroke-width: 2.4;
}
</style>
