<script setup lang="ts">
import {
  ref,
  computed,
  onUnmounted,
} from 'vue'

import { useCanvasStore }
from '../stores/canvas.store'

import { nodeRegistry }
from '../../nodes/nodeRegistry'

import type { NodeType }
from '../types/node.types'

import type { Component } from 'vue'

type SidebarNodeItem = {
  type: NodeType
  label: string
  icon: Component
}

const groupedNodes =
  computed(() => {

const groups:
  Record<
    string,
    SidebarNodeItem[]
  > = {}

    for (const type of Object.keys(
      nodeRegistry,
    ) as NodeType[]) {
      const config =
        nodeRegistry[type]

      if (
        !groups[
          config.category
        ]
      ) {
        groups[
          config.category
        ] = []
      }

      groups[
        config.category
      ].push({
        type,

        label:
          config.title,

        icon:
          config.icon,
      })
    }

    return Object.entries(
      groups,
    ).map(
      ([category, items]) => ({
        category,
        items,
      }),
    )
})

const store =
  useCanvasStore()

const isOpen =
  ref(false)

const search =
  ref('')

const draggingNode =
  ref<NodeType | null>(null)

const dragStartPoint =
  ref<{ x: number; y: number } | null>(null)

const dragStarted =
  ref(false)

const sidebarRef =
  ref<HTMLElement | null>(null)

function isOutsideSidebar(
  event: MouseEvent,
) {
  const sidebar = sidebarRef.value

  if (!sidebar) {
    return true
  }

  const rect = sidebar.getBoundingClientRect()

  return (
    event.clientX < rect.left ||
    event.clientX > rect.right ||
    event.clientY < rect.top ||
    event.clientY > rect.bottom
  )
}

const filteredNodes =
  computed(() => {

  const query =
    search.value
      .trim()
      .toLowerCase()

  if (!query) {
    return groupedNodes.value
  }

  return groupedNodes.value
    .map(group => ({
      ...group,

      items:
        group.items.filter(
          item =>
            item.label
              .toLowerCase()
              .includes(query),
        ),
    }))
    .filter(
      group =>
        group.items.length > 0,
    )
})

function toggleSidebar() {
  isOpen.value =
    !isOpen.value
}

function startDrag(
  item: SidebarNodeItem,
  event: MouseEvent,
) {
  event.preventDefault()

  draggingNode.value =
    item.type

  dragStartPoint.value = {
    x: event.clientX,
    y: event.clientY,
  }

  dragStarted.value = false

  store.startDragPreview(
    item.type,
  )

  handleMove(event)

  window.addEventListener(
    'mousemove',
    handleMove,
  )

  window.addEventListener(
    'mouseup',
    handleDrop,
  )
}

function handleMove(
  event: MouseEvent,
) {
  if (!draggingNode.value || !dragStartPoint.value) {
    return
  }

  const deltaX =
    Math.abs(
      event.clientX -
        dragStartPoint.value.x,
    )
  const deltaY =
    Math.abs(
      event.clientY -
        dragStartPoint.value.y,
    )

  if (
    !dragStarted.value &&
    (deltaX > 3 || deltaY > 3)
  ) {
    dragStarted.value = true
  }

  const x =
    (event.clientX -
      store.viewport.x) /
    store.viewport.zoom

  const y =
    (event.clientY -
      store.viewport.y) /
    store.viewport.zoom

  store.updateDragPreview(
    x,
    y,
  )
}

function handleDrop(
  event: MouseEvent,
) {

  if (!draggingNode.value) {
    return
  }

  const x =
    (event.clientX -
      store.viewport.x) /
    store.viewport.zoom

  const y =
    (event.clientY -
      store.viewport.y) /
    store.viewport.zoom

  if (
    dragStarted.value &&
    isOutsideSidebar(event)
  ) {
    store.addNode(
      draggingNode.value,
      x,
      y,
    )
  }

  draggingNode.value =
    null
  dragStartPoint.value =
    null
  dragStarted.value =
    false

  store.stopDragPreview()

  window.removeEventListener(
    'mousemove',
    handleMove,
  )

  window.removeEventListener(
    'mouseup',
    handleDrop,
  )
}

onUnmounted(() => {

  window.removeEventListener(
    'mousemove',
    handleMove,
  )

  window.removeEventListener(
    'mouseup',
    handleDrop,
  )
})
</script>

<template>
  <div class="add-node-sidebar">
    <button
      class="add-node-button"
      @click.stop="toggleSidebar"
    >
      {{ isOpen ? '×' : '+' }}
    </button>

    <aside
      v-if="isOpen"
      class="sidebar"
      ref="sidebarRef"
      @mousedown="(e) => e.stopPropagation()" @wheel.stop="() => {}"
    >
      <div class="sidebar-header">
        <h3>Add Node</h3>
      </div>

      <div class="sidebar-content">
        <input
          v-model="search"
          class="search"
          type="text"
          placeholder="Search nodes..."
        />

        <div
          v-for="group in filteredNodes"
          :key="group.category"
          class="group"
        >
          <div class="group-title">
            {{ group.category }}
          </div>

          <div
            v-for="item in group.items"
            :key="item.label"
            class="node-item"
            @mousedown.left="startDrag(item, $event)"
          >
            <div class="node-icon">
              <component :is="item.icon" :size="18" />
            </div>

            <span>{{ item.label }}</span>
          </div>
        </div>
      </div>
    </aside>
  </div>
</template>

<style scoped>
.add-node-sidebar {
  position: absolute;
  inset: 0;
  pointer-events: none;
  z-index: 1000;
}

.add-node-sidebar.is-open {
  pointer-events: auto;
}

/* BUTTON */

  .add-node-button {
    position: absolute;
    top: calc(var(--titlebar-height, 0px) + 12px);
    left: 12px;
    width: 42px;
    height: 42px;
    display: flex;
    align-items: center;
    justify-content: center;
    border: 1px solid #1a1d26;
    border-radius: 10px;
    background: #11131a;
    color: var(--text-light);
    font-size: 24px;
    font-weight: 300;
    line-height: 1;
    cursor: pointer;
    pointer-events: auto;
    z-index: 3;
    transition: transform .18s ease, border-color .18s ease, background .18s ease;
  }

  .add-node-button:hover {
    transform: translateY(-1px);
    border-color: rgba(59, 130, 246, 0.4);
    background: rgba(59, 130, 246, 0.1);
    color: #3b82f6;
  }

.sidebar {
  position: absolute;
  top: calc(var(--titlebar-height, 0px) + 64px);
  left: 12px;
  width: 300px;
  /* Stop 6px above toolbar: titlebar(40) + top-offset(64) + toolbar(70) + gap(6) = 180px total vertical taken */
  max-height: calc(100% - var(--titlebar-height, 0px) - 64px - 76px);
  background: #0a0b0e;
  border: 1px solid #1a1d26;
  border-radius: 10px;
  box-shadow: 0 12px 32px rgba(0,0,0,0.4);
  pointer-events: auto;
  display: flex;
  flex-direction: column;
  animation: popupFade .18s ease;
}

.sidebar-header {
  padding: 16px 20px;
  border-bottom: 1px solid #1a1d26;
  background: #11131a;
  border-radius: 10px 10px 0 0;
  flex-shrink: 0;
}

.sidebar-header h3 {
  margin: 0;
  font-size: 15px;
  font-weight: 600;
  color: #fff;
  letter-spacing: .02em;
}

.sidebar-content {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 12px;
  scrollbar-width: thin;
  scrollbar-color: transparent transparent;
  direction: rtl;
}

.sidebar-content:hover {
  scrollbar-color: rgba(255, 255, 255, 0.1) transparent;
}

.sidebar-content > * {
  direction: ltr;
}

.sidebar-content::-webkit-scrollbar {
  width: 6px;
}

.sidebar-content::-webkit-scrollbar-track {
  background: transparent;
}

.sidebar-content::-webkit-scrollbar-thumb {
  background: transparent;
  border-radius: 3px;
}

.sidebar-content:hover::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.1);
}

.sidebar-content::-webkit-scrollbar-thumb:hover {
  background: rgba(255, 255, 255, 0.2);
}

.sidebar-content::-webkit-scrollbar-thumb:active {
  background: rgba(255, 255, 255, 0.3);
}

.search {
  width: 100%;
  height: 36px;
  padding: 0 12px;
  border-radius: 8px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  background: #151822;
  color: #ffffff;
  outline: none;
  font-size: 13px;
  font-weight: 500;
  transition: all 0.15s ease;
  flex-shrink: 0;
}

.search:focus {
  border-color: #3b82f6;
  background: #151822;
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.2);
}

.search::placeholder {
  color: #64748b;
}

.group {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.group-title {
  margin-bottom: 6px;
  font-size: 13px;
  font-weight: 600;
  color: #eee;
  text-transform: uppercase;
  letter-spacing: .05em;
}

/* NODE ITEM */

.node-item {
  display: flex;
  align-items: center;
  gap: 12px;

  min-height: 42px;

  padding:
    0 14px;

  border-radius: 6px;

  background: rgba(0, 0, 0, 0.2);

  border: 1px solid rgba(255, 255, 255, 0.08);

  color: #ffffff;

  font-size: 13px;

  font-weight: 500;

  letter-spacing: .01em;

  cursor: pointer;

  transition:
    background .15s;
}

.node-item:hover {
  background: rgba(59, 130, 246, 0.1);
  border-color: rgba(59, 130, 246, 0.3);
  color: #3b82f6;
}

.node-item svg {
  width: 16px;
  height: 16px;

  color: currentColor;

  flex-shrink: 0;
}

.node-item:hover svg {
  color: #3b82f6;
}

@keyframes popupFade {
  0% { opacity: 0; transform: translateY(-4px) scale(0.98); }
  100% { opacity: 1; transform: translateY(0) scale(1); }
}
</style>
