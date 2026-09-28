import { nodeRegistry } from './nodeRegistry'
import type { NodeType, WorkflowNode } from '../canvas/types/node.types'
import {
  DEFAULT_NODE_HEIGHT,
  DEFAULT_NODE_WIDTH,
} from '../canvas/constants/nodeLayout'

export function createWorkflowNode(
  type: NodeType,
  x: number,
  y: number,
): WorkflowNode {
  const config = nodeRegistry[type]

  return {
    id: crypto.randomUUID(),
    type,
    x,
    y,
    width: DEFAULT_NODE_WIDTH,
    height: DEFAULT_NODE_HEIGHT,
    data: structuredClone(config.defaults),
    inputs: config.ports.inputs.map(
      port => ({
        id: port.id,
        type: port.type,
      }),
    ),
    outputs: config.ports.outputs.map(
      port => ({
        id: port.id,
        type: port.type,
      }),
    ),
    execution: {
      status: 'idle',
    },
  }
}
