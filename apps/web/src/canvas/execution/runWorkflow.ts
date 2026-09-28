import type { WorkflowEdge } from '../types/edge.types'
import type { WorkflowNode } from '../types/node.types'
import type { ExecutionResult } from './types'
import { createWorkflowContext } from './context'
import { executeNode } from './executeNode'
import { buildHandleKey } from '../utils/folderPicker'
import { useCanvasStore } from '../stores/canvas.store'

async function ensureHandleWritable(handle: FileSystemDirectoryHandle | null | undefined): Promise<boolean> {
  if (!handle) return false
    if ((window as any).electronAPI) return true
      const anyHandle = handle as any
      if (typeof anyHandle.queryPermission !== 'function') return true
        try {
          const status = await anyHandle.queryPermission({ mode: 'readwrite' })
          if (status === 'granted') return true
            if (typeof anyHandle.requestPermission === 'function') {
              const req = await anyHandle.requestPermission({ mode: 'readwrite' })
              return req === 'granted'
            }
        } catch {
          // ignore
        }
        return false
}

function scheduleIdleReset(nodes: WorkflowNode[]) {
  setTimeout(() => {
    nodes.forEach(node => {
      if (node.execution) {
        node.execution.status = 'idle'
    node.execution.startedAt = undefined
    node.execution.finishedAt = undefined
    node.execution.error = undefined
      }
    })
  }, 10000)
}

export async function runWorkflow(
  nodes: WorkflowNode[],
  edges: WorkflowEdge[],
  directoryHandles?: Record<
  string,
  FileSystemDirectoryHandle | null
  >,
  isCancelled?: () => boolean,
                                  runtimeUpdate?: (
                                    nodeId: string,
                                    runtimeData: Record<string, any>,
                                  ) => void,
): Promise<ExecutionResult> {
  const startNodes = nodes.filter(
    node => node.type === 'start',
  )

  nodes.forEach(node => {
    if (!node.execution) {
      node.execution = {
        status: 'idle',
      }
      return
    }

    node.execution.status = 'idle'
  node.execution.startedAt = undefined
  node.execution.finishedAt = undefined
  node.execution.error = undefined
  })

  const context = createWorkflowContext()

  if (context.runtime) {
    context.runtime.directoryHandles = directoryHandles || {}
    context.runtime.checkCancelled = () => isCancelled?.() ?? false
    context.runtime.onRuntimeUpdate = (
      node: WorkflowNode,
      runtimeData: Record<string, any>,
    ) => {
      if (!runtimeUpdate) {
        return
      }

      runtimeUpdate(node.id, {
        ...runtimeData,
        executionStartedAt:
        node.execution?.startedAt,
      })
    }
  }

  if (startNodes.length !== 1) {
    scheduleIdleReset(nodes)
    return {
      success: false,
      context,
      error:
      startNodes.length === 0
      ? 'Workflow requires exactly one start node.'
      : 'Workflow must contain only one start node.',
    }
  }

  if (
    directoryHandles &&
    context.runtime
  ) {
    const folderNode = nodes.find(
      n => n.type === 'folder',
    )

    if (folderNode) {
      const key = buildHandleKey(
        folderNode.id,
        'path',
      )

      const handle = directoryHandles[key]

      if (handle) {
        const ok = await ensureHandleWritable(handle)
        if (!ok) {
          throw new Error('Permission denied for folder access. Please re-select the folder.')
        }

        context.runtime.inputFolderHandle =
        handle
        context.runtime.lastFolderNodeId =
        folderNode.id

        const { scanFolderForFiles } =
        await import(
          '../utils/folderScanner'
        )

        const scanResult =
        await scanFolderForFiles(handle)

        context.runtime.fileRuntimes =
        scanResult.files
      }
    }
  }

  context.runtime!.isCancelled = false

  // Preflight permission checks: for folder input and any save nodes with custom output
  try {
    const store = useCanvasStore()

    const folderNode = nodes.find(n => n.type === 'folder')
    if (folderNode) {
      const inputHandle = context.runtime?.inputFolderHandle
      const ok = await ensureHandleWritable(inputHandle)
      if (!ok) {
        // prompt user to reselect input folder (user gesture from run action)
        const picked = await store.pickDirectoryHandle(folderNode.id, 'path')
        if (picked) {
          context.runtime!.inputFolderHandle = picked
          context.runtime!.lastFolderNodeId = folderNode.id
        } else {
          scheduleIdleReset(nodes)
          return {
            success: false,
            context,
            error: 'Input folder permission required',
          }
        }
      }
    }

    // check save nodes
    for (const n of nodes) {
      if (n.type !== 'save') continue
        // Save node now only requires an output folder handle (if any).
        const key = buildHandleKey(n.id, 'outputFolder')
        const handle = context.runtime?.directoryHandles?.[key]
        if (handle) {
          const ok = await ensureHandleWritable(handle)
          if (!ok) {
            const picked = await store.pickDirectoryHandle(n.id, 'outputFolder')
            if (picked) {
              context.runtime!.directoryHandles = {
                ...context.runtime!.directoryHandles,
                [key]: picked,
              }
            } else {
              scheduleIdleReset(nodes)
              return {
                success: false,
                context,
                error: `Output folder permission required for node ${n.id}`,
              }
            }
          }
        }
    }
  } catch (e) {
    // if preflight fails unexpectedly, continue and let nodes handle fallback
    // do not block run
  }

  const visited = new Set<string>()
  const queue = [startNodes[0].id]

  while (queue.length > 0) {
    if (isCancelled?.()) {
      context.runtime!.isCancelled = true

      const logger =
      context.runtime!.executionLogger

      if (logger) {
        logger.warn('Workflow cancelled by user')
      }

      break
    }

    const nodeId = queue.shift()

    if (!nodeId || visited.has(nodeId)) {
      continue
    }

    visited.add(nodeId)

    const node = nodes.find(
      n => n.id === nodeId,
    )

    if (!node) {
      continue
    }

    const result = await executeNode(node, context)

    if (!result.success) {
      scheduleIdleReset(nodes)
      return result
    }

    for (const edge of edges) {
      if (edge.sourceNodeId !== nodeId) {
        continue
      }

      if (!visited.has(edge.targetNodeId)) {
        queue.push(edge.targetNodeId)
      }
    }
  }

  scheduleIdleReset(nodes)

  return {
    success: true,
    context,
  }
}
