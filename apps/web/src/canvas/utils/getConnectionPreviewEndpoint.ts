import type { WorkflowNode }
from '../types/node.types'
import { getPortWorldPosition } from './getPortScreenPosition'

const SNAP_RADIUS = 56
const SNAP_STRENGTH = 0.78

export function getConnectionPreviewEndpoint(
  mouseX: number,
  mouseY: number,
  sourceNodeId: string,
  nodes: WorkflowNode[],
  snappedTarget?: {
    nodeId: string
    portId: string
  } | null,
) {
  if (snappedTarget) {
    const targetNode = nodes.find(
      n =>
        n.id === snappedTarget.nodeId,
    )

    if (targetNode) {
      const port = getPortWorldPosition(
        targetNode,
        'input',
      )

      return {
        x: port.x,
        y: port.y,
      }
    }
  }

  let endX = mouseX
  let endY = mouseY

  let closestDist = SNAP_RADIUS
  let closest: {
    x: number
    y: number
  } | null = null

  for (const node of nodes) {
    if (
      node.id === sourceNodeId ||
      node.inputs.length === 0
    ) {
      continue
    }

    const portPos = getPortWorldPosition(
      node,
      'input',
    )

    const dist = Math.hypot(
      mouseX - portPos.x,
      mouseY - portPos.y,
    )

    if (
      dist < closestDist
    ) {
      closestDist = dist
      closest = portPos
    }
  }

  if (closest) {
    const t =
      1 -
      closestDist / SNAP_RADIUS
    const pull =
      t * t * SNAP_STRENGTH

    endX +=
      (closest.x - endX) * pull
    endY +=
      (closest.y - endY) * pull
  }

  return { x: endX, y: endY }
}
