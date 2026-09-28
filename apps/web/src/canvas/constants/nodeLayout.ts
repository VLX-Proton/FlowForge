import type { WorkflowNode }
from '../types/node.types'

/** Must match `.node` styles in NodeLayer.vue (via v-bind) */
export const NODE_BORDER_WIDTH = 2

export const NODE_BORDER_RADIUS = 8

/** Default node shadow: `0 1px 2px` */
export const NODE_SHADOW_OFFSET_Y = 1
export const NODE_SHADOW_BLUR = 2

/** Selected ring: `0 0 0 Npx` */
export const NODE_SELECTED_RING_SPREAD = 4

/** Outer size (border-box) — n8n GRID_SIZE × 6 */
export const DEFAULT_NODE_WIDTH = 96
export const DEFAULT_NODE_HEIGHT = 96

export interface WorldRect {
  x: number
  y: number
  width: number
  height: number
}

/** Outset from node border-box for shadow / focus ring (world px). */
export function getNodeVisualPadding(
  selected = true,
): number {
  if (selected) {
    return NODE_SELECTED_RING_SPREAD
  }

  return (
    NODE_SHADOW_BLUR +
    NODE_SHADOW_OFFSET_Y
  )
}

/** Visual bounds including outer shadow/ring (world coordinates). */
export function getNodeVisualBounds(
  node: WorkflowNode,
  selected = true,
): WorldRect {
  const pad =
    getNodeVisualPadding(selected)

  return {
    x: node.x - pad,
    y: node.y - pad,
    width: node.width + pad * 2,
    height: node.height + pad * 2,
  }
}

/** Union of visual bounds for multiple nodes. */
export function getNodesUnionVisualBounds(
  nodes: WorkflowNode[],
  selected = true,
): WorldRect | null {
  if (nodes.length === 0) {
    return null
  }

  const pad =
    getNodeVisualPadding(selected)

  const minX = Math.min(
    ...nodes.map(n => n.x),
  )
  const minY = Math.min(
    ...nodes.map(n => n.y),
  )
  const maxX = Math.max(
    ...nodes.map(
      n => n.x + n.width,
    ),
  )
  const maxY = Math.max(
    ...nodes.map(
      n => n.y + n.height,
    ),
  )

  return {
    x: minX - pad,
    y: minY - pad,
    width: maxX - minX + pad * 2,
    height: maxY - minY + pad * 2,
  }
}
