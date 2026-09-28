import type { WorkflowNode } from '../types/node.types'
import type { WorkflowContext } from './context'
import type { ExecutionResult } from './types'
import { executorRegistry } from './registry'

export async function executeNode(
  node: WorkflowNode,
  context: WorkflowContext,
): Promise<ExecutionResult> {
  if (!node.execution) {
    node.execution = {
      status: 'idle',
    }
  }

  if (context.runtime?.isCancelled) {
    node.execution.status = 'idle'
    return {
      success: false,
      context,
      error: 'Cancelled by user',
    }
  }

  node.execution.status = 'running'
  node.execution.startedAt = Date.now()
  node.execution.finishedAt = undefined
  node.execution.error = undefined

  const executor = executorRegistry[node.type]

  if (!executor) {
    const error = `No executor registered for node type "${node.type}"`

    node.execution.status = 'error'
    node.execution.finishedAt = Date.now()
    node.execution.error = error

    return {
      success: false,
      context,
      error,
    }
  }

  try {
    const nodeStart = Date.now()
    const result = await executor(node, context)

    const minVisibleMs =
      node.type === 'folder' ||
      node.type === 'save'
        ? 700
        : 0
    const elapsed = Date.now() - nodeStart
    const remaining = minVisibleMs - elapsed

    if (remaining > 0) {
      await new Promise(resolve =>
        setTimeout(resolve, remaining),
      )
    }

    if (!result.success) {
      node.execution.status = 'error'
      node.execution.finishedAt = Date.now()
      node.execution.error = result.error

      return result
    }

    node.execution.status = 'success'
    node.execution.finishedAt = Date.now()

    return result
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : String(error)

    node.execution.status = 'error'
    node.execution.finishedAt = Date.now()
    node.execution.error = message

    return {
      success: false,
      context,
      error: message,
    }
  }
}
