import type { WorkflowNode } from '../types/node.types'
import type { FileRuntimeData } from './runtimeFiles'
import { createExecutionLogger } from './executionLogger'
import type { ExecutionLogger } from './executionLogger'

export interface WorkflowContext {
  values: Record<string, unknown>
  runtime?: {
    inputFolderHandle?: FileSystemDirectoryHandle | null
    lastFolderNodeId?: string
    directoryHandles?: Record<
      string,
      FileSystemDirectoryHandle | null
    >
    fileRuntimes?: FileRuntimeData[]
    currentImageId?: string
    executionStartedAt?: number
    executionLogger?: ExecutionLogger
    isCancelled?: boolean
    checkCancelled?: () => boolean
    onRuntimeUpdate?: (
      node: WorkflowNode,
      runtimeData: Record<string, any>,
    ) => void
  }
}

export function createWorkflowContext(): WorkflowContext {
  return {
    values: {},
    runtime: {
      inputFolderHandle: null,
      lastFolderNodeId: '',
      directoryHandles: {},
      fileRuntimes: [],
      currentImageId: '',
      executionStartedAt: Date.now(),
      executionLogger:
        createExecutionLogger(),
      isCancelled: false,
      checkCancelled: () => false,
      onRuntimeUpdate: undefined,
    },
  }
}