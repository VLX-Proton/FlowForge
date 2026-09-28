import type { WorkflowNode }
from '../types/node.types'
import {
  getPortAnchor,
  type PortSide,
} from '../constants/portLayout'

export function getPortWorldPosition(
  node: WorkflowNode,
  portType: PortSide,
) {
  return getPortAnchor(node, portType)
}
