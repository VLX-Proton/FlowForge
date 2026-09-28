import type { WorkflowNode } from '../types/node.types'
import type { WorkflowEdge } from '../types/edge.types'

export interface NodePreviewState {
  label: string
  icon?: string
  details: string[]
}

export interface NodeValidationState {
  isValid: boolean
  issues: string[]
}

export interface NodeRuntimeState {
  label: string
  details?: string[]
  progress?: {
    current: number
    total: number
  }
  eta?: number
  stage?: string
}

export function getNodePreviewState(
  node: WorkflowNode,
  previewData?: Record<string, any>,
): NodePreviewState {
  switch (node.type) {
    case 'start':
      return {
        label: 'Workflow entry point',
        details: ['Ready'],
      }

    case 'folder':
      if (!node.data.path) {
        return {
          label: 'No folder selected',
          details: [],
        }
      }

      const folderPreview =
        previewData?.[node.id]

      if (!folderPreview) {
        return {
          label: node.data.path,
          details: ['Ready'],
        }
      }

      return {
        label: node.data.path,
        details: [
          folderPreview.fileCount
            ? `${folderPreview.fileCount} files (${folderPreview.formats})`
            : 'No files found',
        ],
      }

    case 'save':
      // Save node now only has an output folder selection.
      return {
        label: 'Save files',
        details: [
          node.data.outputFolder
            ? `Folder: ${node.data.outputFolder}`
            : 'No folder selected',
        ],
      }

    // ---------------------------------------------------------------------
    // Upscale Image node preview
    // ---------------------------------------------------------------------
    // The info-bubble should display the selected scale and format, e.g.:
    //   Scale: 2x
    //   Format: Auto
    // Prompt is intentionally omitted.
    case 'upscaleImage': {
      const formatRaw = node.data.format as string | undefined
      const formatLabel = formatRaw
        ? formatRaw === 'auto'
          ? 'Auto'
          : formatRaw.toUpperCase()
        : 'Auto'

      const scaleRaw = node.data.scale as string | undefined
      const scaleLabel = scaleRaw ?? '2x'

      return {
        label: '',
        details: [
          `Scale: ${scaleLabel}`,
          `Format: ${formatLabel}`,
        ],
      }
    }

    case 'metadata': {
      const provider = node.data.provider as string | undefined
      const modelGemini = node.data.model_gemini as string | undefined
      const modelOpenrouter = node.data.model_openrouter as string | undefined
      const modelMistral = node.data.model_mistral as string | undefined
      const maxImages = node.data.max_images as string | number | undefined
      const maxKeywords = node.data.max_keywords as string | number | undefined
      const maxTitle = node.data.max_title as string | number | undefined

      const details: string[] = []

      if (!provider || provider === 'gemini') {
        details.push('Provider: Gemini')
        if (!modelGemini) {
          details.push('Model: gemini-2.5-flash')
        } else {
          details.push(`Model: ${modelGemini}`)
        }
      } else if (provider === 'openrouter') {
        details.push('Provider: OpenRouter')
        if (!modelOpenrouter) {
          details.push('Model not selected')
        } else {
          details.push(`Model: ${modelOpenrouter}`)
        }
      } else if (provider === 'mistral') {
        details.push('Provider: Mistral')
        if (!modelMistral) {
          details.push('Model not selected')
        } else {
          details.push(`Model: ${modelMistral}`)
        }
      } else {
        details.push('Provider not selected')
      }

      details.push(`Max Images: ${maxImages ?? 100}`)
      details.push(`Max Keywords: ${maxKeywords ?? 50}`)
      details.push(`Max Title: ${maxTitle ?? 200}`)

      return {
        label: '',
        details,
      }
    }

    default:
      return {
        label: 'Node',
        details: [],
      }
  }
}

export function getNodeValidationState(
  node: WorkflowNode,
  edges: WorkflowEdge[],
  previewData?: Record<string, any>,
): NodeValidationState {
  const issues: string[] = []

  switch (node.type) {
    case 'start':
      const hasOutgoing = edges.some(
        e => e.sourceNodeId === node.id,
      )

      if (!hasOutgoing) {
        issues.push('No outgoing connection')
      }
      break

case 'folder':
  if (!node.data.path) {
    issues.push('No folder selected')
  } else {
    // Check if folder preview is properly loaded
    const folderPreview = previewData?.[node.id]
    if (folderPreview?.fileCount === 0) {
      issues.push('Folder is empty')
    }
  }
  break


    case 'save':
      // Only need at least one input connection; folder selection is optional.
      const saveInputs = edges.filter(
        e => e.targetNodeId === node.id,
      )

      if (saveInputs.length === 0) {
        issues.push('No input connection')
      }
      break

    case 'upscaleImage':
      const upscaleInputs = edges.filter(
        e => e.targetNodeId === node.id,
      )

      if (upscaleInputs.length === 0) {
        issues.push('No input connection')
      }
      break

          case 'metadata':
      const metadataInputs = edges.filter(
        e => e.targetNodeId === node.id,
      )

      if (metadataInputs.length === 0) {
        issues.push('No input connection')
      }
      break
  }

  return {
    isValid: issues.length === 0,
    issues,
  }
}

export function getNodeRuntimeState(
  node: WorkflowNode,
  runtimeData?: any,
): NodeRuntimeState | null {
  // Log level reduced for debugging
// Removed verbose node state logs
  if (
    node.execution?.status !== 'running'
  ) {
    return null
  }

  switch (node.type) {
    case 'folder':
      return {
        label:
          runtimeData?.stage ||
          'Scanning folder...',
        details:
          runtimeData?.stageDetails ||
          runtimeData?.fileRuntimes?.length
            ? [
                `${runtimeData.fileRuntimes?.length ?? 0} files detected`,
              ]
            : undefined,
      }


    case 'upscaleImage': {
      const progressPct = runtimeData?.progressPct ?? 0
      const totalFiles = runtimeData?.totalFiles ?? runtimeData?.fileRuntimes?.length ?? 0
      const currentFileNum = runtimeData?.currentFileIndex ?? runtimeData?.currentFile ?? 0
      const currentFileName = runtimeData?.currentFile ?? ''
      const workerStatus: string = runtimeData?.workerStatus ?? ''

      // ── Paused / connection-lost state ──────────────────────────────
      if (workerStatus === 'paused') {
        const pausedAt: number | undefined = runtimeData?.pausedAt
        const elapsedSec = pausedAt ? Math.floor((Date.now() - pausedAt) / 1000) : 0
        const elapsedMin = Math.floor(elapsedSec / 60)
        const elapsedLabel =
          elapsedMin > 0
            ? `${elapsedMin}m ${elapsedSec % 60}s`
            : `${elapsedSec}s`
        const pauseReason: string =
          runtimeData?.pauseReason ?? 'Backend offline — waiting for Colab'
        return {
          label: '⚠ Connection Paused',
          details: [
            pauseReason,
            `Waiting ${elapsedLabel} / max 30m`,
            currentFileNum > 0 && totalFiles > 0
              ? `File [${currentFileNum}/${totalFiles}]`
              : '',
          ].filter(Boolean),
          progress: {
            current: progressPct,
            total: 100,
          },
        }
      }

      // ── Downloading state ──────────────────────────────────────────
      if (workerStatus === 'downloading') {
        const downloadPct = runtimeData?.downloadProgress ?? progressPct
        return {
          label: 'Downloading...',
          details: [
            currentFileNum > 0 && totalFiles > 0
              ? `[${currentFileNum}/${totalFiles}] ${currentFileName || ''}`
              : 'Preparing download...',
          ].filter(Boolean),
          progress: {
            current: downloadPct,
            total: 100,
          },
        }
      }

      // ── Normal upscaling state ───────────────────────────────────────
      return {
        label: 'Upscaling...',
        details: [
          currentFileNum > 0 && totalFiles > 0
            ? `[${currentFileNum}/${totalFiles}] ${currentFileName || ''}`
            : 'Preparing...',
        ],
        progress: {
          current: progressPct,
          total: 100,
        },
      }
    }

    case 'save': {
      return {
        label: 'Save to...',
        details: node.data.outputFolder
          ? [`Folder: ${node.data.outputFolder}`]
          : ['No folder selected'],
      }
    }

case 'metadata': {
       const totalFiles = runtimeData?.totalFiles ?? 0
       const processedCount = runtimeData?.processedCount ?? 0
       const currentFile = runtimeData?.currentFile ?? ''
       const retryAttempt = runtimeData?.retryAttempt ?? 0

       if (retryAttempt > 0) {
        return {
          label: 'Metadata...',
          details: [
            `Retry ${retryAttempt}/3`,
            currentFile
          ].filter(Boolean),
        }
      }

      return {
        label: 'Metadata...',
        details: [
          `${processedCount} / ${totalFiles} processed`
        ],
      }
    }

    default:
       return {
         label: 'Running...',
       }
  }
}