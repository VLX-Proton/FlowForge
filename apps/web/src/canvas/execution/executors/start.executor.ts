import type { WorkflowNode } from '../../types/node.types'
import type { WorkflowContext } from '../context'
import type { ExecutionResult } from '../types'

export async function startExecutor(
  _node: WorkflowNode,
  context: WorkflowContext,
): Promise<ExecutionResult> {
  await new Promise(resolve =>
    setTimeout(resolve, 300),
  )

  return {
    success: true,
    context,
  }
}
