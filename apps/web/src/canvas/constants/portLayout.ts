import type { WorkflowNode }
from '../types/node.types'

export {
  DEFAULT_NODE_HEIGHT,
  DEFAULT_NODE_WIDTH,
} from './nodeLayout'

export const PORT_HIT_SIZE = 16
export const PORT_PILL_WIDTH = 8
export const PORT_PILL_HEIGHT = 16

export type PortSide = 'input' | 'output'

/**
 * Geser port dari tepi border node (world/local px).
 * Negatif = ke kiri, positif = ke kanan.
 *
 * Contoh:
 *   PORT_INPUT_OFFSET_X = -2  → input lebih keluar dari node
 *   PORT_OUTPUT_OFFSET_X = 2  → output lebih ke dalam node
 */
export const PORT_INPUT_OFFSET_X = 0
export const PORT_OUTPUT_OFFSET_X = 0

export interface PortAnchor {
  x: number
  y: number
}

export interface PortRectLayout {
  left: number
  top: number
  width: number
  height: number
}

export function getPortEdgeX(
  node: WorkflowNode,
  side: PortSide,
): number {
  const base =
    side === 'input' ? 0 : node.width
  const offset =
    side === 'input'
      ? PORT_INPUT_OFFSET_X
      : PORT_OUTPUT_OFFSET_X

  return base + offset
}

export function getPortAnchor(
  node: WorkflowNode,
  side: PortSide,
): PortAnchor {
  return {
    x: node.x + getPortEdgeX(node, side),
    y: node.y + node.height / 2,
  }
}

export function getPortConnectionInset(
  _side: PortSide,
): number {
  return PORT_PILL_WIDTH / 2
}

export function getPortHitboxLayout(
  node: WorkflowNode,
  side: PortSide,
): PortRectLayout {
  const half = PORT_HIT_SIZE / 2
  const centerY = node.height / 2
  const edgeX = getPortEdgeX(node, side)

  return {
    left: edgeX - half,
    top: centerY - half,
    width: PORT_HIT_SIZE,
    height: PORT_HIT_SIZE,
  }
}
