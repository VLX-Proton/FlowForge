import type { WorkflowContext } from './context'
import type { WorkflowNode } from '../types/node.types'

export interface ExecutionResult {
  success: boolean
  context: WorkflowContext
  error?: string
}

export type WorkflowExecutor = (
  node: WorkflowNode,
  context: WorkflowContext,
) => Promise<ExecutionResult>
