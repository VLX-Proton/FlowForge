<script setup lang="ts">
import { ZoomIn, ZoomOut, Maximize2, Wand2, Trash2 } from 'lucide-vue-next'
import { useCanvasStore } from '../stores/canvas.store'

const store = useCanvasStore()

async function handleDeleteWorkflow() {
  if (!confirm('Delete this workflow? This cannot be undone.')) return
  await store.deleteWorkflow()
}
</script>

<template>
  <div class="canvas-toolbar">
    <!-- Zoom In (anchored to screen center) -->
    <button
      class="toolbar-button"
      title="Zoom In"
      @click.stop="store.zoomFromCenter(1.2)"
    >
      <ZoomIn :size="16" />
    </button>

    <!-- Zoom Out (anchored to screen center) -->
    <button
      class="toolbar-button"
      title="Zoom Out"
      @click.stop="store.zoomFromCenter(1 / 1.2)"
    >
      <ZoomOut :size="16" />
    </button>

    <!-- Zoom to Fit -->
    <button
      class="toolbar-button"
      title="Zoom to Fit"
      @click.stop="store.zoomToFit()"
    >
      <Maximize2 :size="16" />
    </button>

    <!-- Auto Layout (Tidy Up) -->
    <button
      class="toolbar-button"
      title="Auto Layout (Tidy Up)"
      @click.stop="store.autoLayout()"
    >
      <Wand2 :size="16" />
    </button>

    <div class="toolbar-separator" />

    <!-- Delete Workflow -->
    <button
      class="toolbar-button delete-button"
      title="Delete Workflow"
      @click.stop="handleDeleteWorkflow"
    >
      <Trash2 :size="16" />
    </button>
  </div>
</template>

<style scoped>
.canvas-toolbar {
  position: absolute;
  bottom: 16px;
  left: 16px;
  display: flex;
  align-items: center;
  gap: 8px;
  pointer-events: auto;
  z-index: 1000;
  background: #11131a;
  padding: 6px;
  border-radius: 14px;
  border: 1px solid #1a1d26;
}

.toolbar-button {
  width: 42px;
  height: 42px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 1px solid #1a1d26;
  border-radius: 10px;
  background: #11131a;
  color: var(--text-light);
  cursor: pointer;
  transition: transform .18s ease, border-color .18s ease, background .18s ease, color .18s ease;
}

.toolbar-button:hover {
  transform: translateY(-1px);
  border-color: rgba(59,130,246,0.3);
  color: #3b82f6;
  background: rgba(59,130,246,0.08);
}

.delete-button:hover {
  border-color: #ff4d4f;
  color: #ff4d4f;
  background: rgba(255, 77, 79, 0.08);
}

.toolbar-separator {
  width: 1px;
  height: 24px;
  background: var(--border-light);
  margin: 0 4px;
}
</style>
