<script setup lang="ts">
import {
  computed,
  inject,
} from 'vue'

import { useCanvasStore } from '../stores/canvas.store'
import { draggingNodeIdKey } from '../injection'
import type { WorkflowNode } from '../types/node.types'
import {
  getNodePreviewState,
  getNodeValidationState,
  getNodeRuntimeState,
} from '../utils/nodeIntelligence'

const store = useCanvasStore()
inject(draggingNodeIdKey)!

interface Props {
  node: WorkflowNode
}

const props = defineProps<Props>()

const isVisible = computed(() => {
  const isSelected =
    store.selectedNodeIds.includes(
      props.node.id,
    )

  const isRunning =
    props.node.execution?.status ===
    'running'

  const isError =
    props.node.execution?.status ===
    'error'

  return isSelected || isRunning || isError
})

const previewState = computed(() =>
  getNodePreviewState(
    props.node,
    store.nodePreviewData,
  ),
)

const validationState = computed(() =>
  getNodeValidationState(
    props.node,
    store.edges,
    store.nodePreviewData,
  ),
)

const runtimeState = computed(() =>
  getNodeRuntimeState(
    props.node,
    store.nodeRuntimeData[props.node.id],
  ),
)

const bubbleContent = computed(() => {
  if (props.node.execution?.status === 'error') {
    return {
      lines: [
        '⚠ Execution Error',
        props.node.execution.error || 'Unknown runtime error',
      ],
      type: 'validation',
    }
  }

  if (runtimeState.value) {
    // Detect paused connection state from the label
    const isPaused = runtimeState.value.label === '⚠ Connection Paused'
    const progressLine = runtimeState.value.progress
      ? `Progress: ${runtimeState.value.progress.current}%`
      : null

    return {
      lines: [
        runtimeState.value.label,
        ...(runtimeState.value.details || []),
        ...(progressLine ? [progressLine] : []),
        ...(runtimeState.value.eta
          ? [`ETA ${runtimeState.value.eta}s`]
          : []),
      ],
      type: isPaused ? 'paused' : 'runtime',
    }
  }

  if (!validationState.value.isValid) {
    if (props.node.type === 'folder' && validationState.value.issues.includes('Folder is empty')) {
      return {
        lines: [
          '⚠ Folder is empty',
          previewState.value.details[0] || 'No files found',
        ],
        type: 'validation',
      }
    }

    return {
      lines: [
        '⚠ Issues found',
        ...validationState.value.issues,
      ],
      type: 'validation',
    }
  }

  return {
    lines: [
      previewState.value.label,
      ...previewState.value.details,
    ],
    type: 'preview',
  }
})

const bubbleStyle = computed(() => ({
  left: `${props.node.x + props.node.width / 2}px`,
  top: `${props.node.y + props.node.height + 8}px`,
}))
</script>

<template>
  <div
    v-if="isVisible"
    class="info-bubble"
    :class="[bubbleContent.type]"
    :style="bubbleStyle"
  >
    <div
      v-for="(line, idx) in bubbleContent.lines"
      :key="idx"
      class="bubble-line"
    >
      {{ line }}
    </div>
  </div>
</template>

<style scoped>
.info-bubble {
  position: absolute;
  transform: translateX(-50%);
  z-index: 10;

  background: rgba(0, 0, 0, 0.4);
  backdrop-filter: blur(12px);
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 8px;
  padding: 10px 14px;

  font-size: 12px;
  color: rgba(255, 255, 255, 0.9);
  line-height: 1.5;
  white-space: nowrap;

  animation: bubbleFade 0.18s ease;

  pointer-events: none;
}

.info-bubble.validation {
  border-color: rgba(239, 68, 68, 0.5);
  background: rgba(127, 29, 29, 0.3);
}

.info-bubble.runtime {
  border-color: rgba(0, 248, 185, 0.5);
  background: rgba(0, 80, 60, 0.3);
}

.info-bubble.paused {
  border-color: rgba(251, 191, 36, 0.6);
  background: rgba(120, 80, 0, 0.35);
  color: rgba(255, 230, 140, 0.95);
}

.bubble-line {
  color: inherit;
}

@keyframes bubbleFade {
  from {
    opacity: 0;
    transform: translateX(-50%) translateY(-4px);
    filter: blur(4px);
  }

  to {
    opacity: 1;
    transform: translateX(-50%) translateY(0);
    filter: blur(0);
  }
}
</style>


