<script setup lang="ts">
import { useCanvasStore }
from '../stores/canvas.store'

const store =
  useCanvasStore()

async function handleExecute() {
  if (store.isCancelling) {
    // Already in the middle of cancelling, ignore
    return
  }

  if (store.isExecuting) {
    await store.cancelWorkflow()
    return
  }

  void store.runWorkflow()
}
</script>

<template>
  <div class="topbar">
    <button
      class="execute"
      :class="{ cancel: store.isExecuting && !store.isCancelling, cancelling: store.isCancelling }"
      :disabled="store.isCancelling"
      @click="handleExecute"
    >
      {{ store.isCancelling ? 'Cancelling...' : store.isExecuting ? 'Cancel' : 'Execute' }}
    </button>
  </div>
</template>

<style scoped>
.topbar {
  position: absolute;

  top: calc(var(--titlebar-height, 0px) + 12px);
  left: 50%;

  transform: translateX(-50%);

  z-index: 3000;
}

  .execute {
    height: 42px;
    padding: 0 22px;
    border: 1px solid rgba(37,99,235,0.4);
    border-radius: 10px;
    background: rgba(37,99,235,0.1);
    color: #60a5fa;
    font-size: 13px;
    font-weight: 600;
    letter-spacing: .02em;
    cursor: pointer;
    transition: transform .18s ease, border-color .18s ease, background .18s ease;
    backdrop-filter: blur(4px);
  }

  .execute:hover {
    transform: translateY(-1px);
    border-color: rgba(37,99,235,0.65);
    background: rgba(37,99,235,0.18);
    color: #93c5fd;
  }

  .execute.cancel {
    border-color: rgba(239, 68, 68, 0.4);
    background: rgba(239, 68, 68, 0.08);
    color: #f87171;
  }

  .execute.cancel:hover {
    border-color: rgba(239, 68, 68, 0.7);
    background: rgba(239, 68, 68, 0.15);
  }

  .execute.cancelling {
    border-color: rgba(239, 68, 68, 0.2);
    background: rgba(239, 68, 68, 0.05);
    color: rgba(248, 113, 113, 0.4);
    cursor: not-allowed;
    opacity: 0.6;
  }
</style>
