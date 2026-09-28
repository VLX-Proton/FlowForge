import { nodeRegistry }
from '../../nodes/nodeRegistry'

export type NodeType =
  keyof typeof nodeRegistry

export interface WorkflowNode {
  id: string

  type: NodeType

  x: number
  y: number

  width: number
  height: number

  data: Record<string, any>

  inputs: {
    id: string
    type: string
  }[]

  outputs: {
    id: string
    type: string
  }[]

  execution?: {
    status:
      | 'idle'
      | 'running'
      | 'success'
      | 'error'

    startedAt?: number
    finishedAt?: number

    error?: string
  }
}