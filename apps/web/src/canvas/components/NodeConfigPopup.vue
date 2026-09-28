<script setup lang="ts">
import {
  computed,
  ref,
  onUnmounted,
} from 'vue'

import { nodeRegistry } from '../../nodes/nodeRegistry'
import type { NodeFieldSchema } from '../../nodes/nodeRegistry'
// Fixed import syntax (single line)
import { useCanvasStore } from '../stores/canvas.store'

const store = useCanvasStore()

const node = computed(() => {
  return store.nodes.find(
    n =>
      n.id === store.popupNodeId,
  )
})

const fields = computed<NodeFieldSchema[]>(
  () => {
    if (!node.value) {
      return []
    }

    const allFields = nodeRegistry[node.value.type]
      .fields

    return allFields.filter(
      (field: any) => {
        if (!field.visibleWhen) {
          return true
        }

        const fieldValue =
          node.value!.data[
            field.visibleWhen.field
          ]

        return (
          fieldValue ===
          field.visibleWhen.equals
        )
      },
    )
  },
)

const pos = ref({
  x:
    window.innerWidth / 2 - 170,

  y:
    window.innerHeight / 2 - 220,
})

async function chooseFolder(
  field: NodeFieldSchema,
) {
  if (!node.value) {
    return
  }

  await store.pickDirectoryHandle(
    node.value.id,
    field.key,
  )
}

let offsetX = 0
let offsetY = 0
// state to indicate dragging – used for cursor style
const dragging = ref(false)

function close() {
  store.closePopup()
}

function startDrag(event: MouseEvent) {
  offsetX = event.clientX - pos.value.x
  offsetY = event.clientY - pos.value.y
  dragging.value = true
  window.addEventListener('mousemove', handleMove)
  window.addEventListener('mouseup', stopDrag)
}

function handleMove(
  event: MouseEvent,
) {
  pos.value.x =
    event.clientX - offsetX

  pos.value.y =
    event.clientY - offsetY
}

function stopDrag() {
  window.removeEventListener('mousemove', handleMove)
  window.removeEventListener('mouseup', stopDrag)
  dragging.value = false
}
// Close popup when clicking outside of it
function handleOutsideClick(event: MouseEvent) {
  const target = event.target as HTMLElement
  // If the click is not inside the popup element, close it
  if (!target.closest('.popup')) {
    close()
  }
}

// Close on Escape key
function handleEsc(event: KeyboardEvent) {
  if (event.key === 'Escape') {
    close()
  }
}

// Re‑center on window resize (optional but keeps behaviour similar to n8n)
function handleResize() {
  pos.value.x = window.innerWidth / 2 - 170
  pos.value.y = window.innerHeight / 2 - 220
}

window.addEventListener('mousedown', handleOutsideClick)
window.addEventListener('keydown', handleEsc)
window.addEventListener('resize', handleResize)

onUnmounted(() => {
  window.removeEventListener('mousedown', handleOutsideClick)
  window.removeEventListener('keydown', handleEsc)
  window.removeEventListener('resize', handleResize)
})

</script>

<template>
  <div
    v-if="node"
    class="popup"
    :class="{ dragging: dragging }"
    :style="{ left: `${pos.x}px`, top: `${pos.y}px` }"
    @mousedown.stop
    >

    <div
      class="header"
      @mousedown.left.prevent="
        startDrag($event)
      "
    >
      <div class="title">
        Node Settings
      </div>

      <button
        class="close"
        @click="close"
      >
        ×
      </button>
    </div>

    <div class="content">
      <div
        v-if="fields.length === 0"
        class="no-fields"
      >
        No settings available
      </div>

      <div
        v-else
        v-for="field in fields"
        :key="field.key"
        class="field"
        :class="{
          checkbox:
            field.type === 'checkbox',
        }"
      >
        <label>
          {{ field.label }}
        </label>

        <input
          v-if="field.type === 'text'"
          v-model="
            node.data[field.key]
          "
        />

        <input
          v-else-if="field.type === 'number'"
          type="number"
          v-model.number="
            node.data[field.key]
          "
        />

        <input
          v-else-if="field.type === 'checkbox'"
          type="checkbox"
          v-model="
            node.data[field.key]
          "
        />

        <select
          v-else-if="field.type === 'select'"
          v-model="node.data[field.key]"
        >
          <option disabled :value="undefined">
            {{ field.placeholder || 'Select...' }}
          </option>
          <option
            v-for="option in field.options || []"
            :key="String(option.value)"
            :value="option.value"
          >
            {{ option.label }}
          </option>
        </select>

        <div
          v-else-if="field.type === 'folder'"
          class="folder-field"
        >
          <button
            type="button"
            class="folder-button"
            @click="chooseFolder(field)"
          >
            Choose Folder
          </button>

          <div class="folder-path">
            {{ node.data[field.key] || 'No folder selected' }}
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
  .popup {
    position: absolute;
    isolation: isolate;
    width: 300px;
    overflow: hidden;
    background: #0e1017;
    /* No blur as requested */
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 10px; /* keep max 10px as requested */
    box-shadow: inset 0 0 0 1px rgba(255,255,255,.04),
                0 0 30px rgba(0, 0, 0, 0.6);
    z-index: 99999;
    animation: popupFade .18s ease;
  }

  /* Change cursor when dragging the popup */
  .popup.dragging {
    cursor: grabbing;
  }

/* Aurora effect removed */

.popup::after {
  content: '';

  position: absolute;
  inset: 0;

  background-image:
    repeating-linear-gradient(
      0deg,
      transparent,
      transparent 2px,
      rgba(255,255,255,.015) 2px,
      rgba(255,255,255,.015) 4px
    );

  opacity: .25;

  pointer-events: none;

  z-index: 1;
}

.popup > * {
  position: relative;

  z-index: 2;
}

/* HEADER */

  .header {
    height: 52px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0 16px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.06);
    cursor: grab;
    user-select: none;
    background: #11141c;
  }

.header:active {
  cursor: grabbing;
}

  .title {
    color: #ffffff;

  font-size: 11px;
  font-weight: 700;

  letter-spacing: .12em;

  text-transform: uppercase;
}

  .close {
    width: 32px;
    height: 32px;
    border: 1px solid rgba(255, 255, 255, 0.15);
    border-radius: 8px; /* keep within 10px */
    background: rgba(255,255,255,.04);
    color: #e0e0e0;

  cursor: pointer;

  transition:
    background .18s ease,
    border-color .18s ease,
    transform .18s ease;
}

.close:hover {
  transform: translateY(-1px);

    background: rgba(255,255,255,.07);

    border-color: rgba(255, 255, 255, 0.3);
}

/* CONTENT */

.content {
  padding: 18px;

  display: flex;
  flex-direction: column;
  gap: 18px;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.field label {
  color: #ffffff;

  font-size: 12px;
  font-weight: 600;
}

/* INPUT */

  .field input,
  .field select {
    height: 42px;
    padding: 0 14px;
    border-radius: 8px;
    border: 1px solid rgba(255, 255, 255, 0.1);
    background: #151822;
    color: #ffffff;

  outline: none;

  font-size: 13px;
  font-weight: 500;

  transition: all 0.15s ease;
}

.field select {
  appearance: none;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6' viewBox='0 0 10 6'%3E%3Cpath d='M1 1l4 4 4-4' stroke='%23ffffff' stroke-width='1.5' fill='none' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E");
  background-position: calc(100% - 12px) center;
  background-repeat: no-repeat;
  background-size: 10px 6px;
}

.field select option {
  background-color: #151822;
  color: #ffffff;
  padding: 10px;
}

.field input:focus,
.field select:focus {
    border-color: #3b82f6;
    background: #151822;
    box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.2);
}

.folder-field {
  display: grid;
  gap: 10px;
}

.folder-button {
  height: 42px;
  padding: 0 14px;
  border-radius: 8px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  background: #151822;
  color: #ffffff;
  cursor: pointer;
  text-align: left;
  transition: all 0.15s ease;
  font-size: 13px;
  font-weight: 500;
}

.folder-button:hover {
  border-color: rgba(255, 255, 255, 0.3);
}

.folder-button:focus {
  border-color: #3b82f6;
  background: #151822;
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.2);
  outline: none;
}

.folder-path {
  min-height: 42px;
  display: flex;
  align-items: center;
  padding: 0 14px;
  border-radius: 8px;
  border: 1px solid rgba(255, 255, 255, 0.314);
  background: rgba(0, 0, 0, 0.168);
  color: rgb(250, 250, 250);
  font-size: 13px;
  word-break: break-all;
}

.no-fields {
  color: #fb0505;
  font-size: 13px;
  line-height: 1.6;
  padding: 10px 0;
}

/* CHECKBOX */

.checkbox {
  flex-direction: row;
  align-items: center;
  justify-content: space-between;
}

.checkbox input {
  width: 18px;
  height: 18px;
}

@keyframes popupFade {
  from {
    opacity: 0;

    filter: blur(10px);
  }

  to {
    opacity: 1;

    filter: blur(0);
  }
}
</style>
