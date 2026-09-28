export type JobStatus = 'queued' | 'processing' | 'paused' | 'completed' | 'error' | 'cancelled'

export interface UpscaleJob {
  jobId: string
  status: JobStatus
  inputPaths: string[]
  inputNames: string[]
  scale: number
  format: string
  prompt: string
  patchSize: number
  stride: number
  scaleBy: string
  targetLongestSide: number | null
  createdAt: number
  workerUrlUsed: string
  outputPaths: string[]
  totalFiles: number
  currentFileIndex: number
  currentFileName: string
  currentFileProgress: number
  completedFiles: number
  pauseReason: string | null
  pausedAt: number | null
  resumedAt: number | null
  workerJobId?: string
  error?: string
  phase?: 'uploading' | 'queued' | 'processing' | 'downloading' | 'done'
  downloadAttempt?: number
}

export interface UpscaleRequestBody {
  scale?: number
  format?: string
  prompt?: string
  patch_size?: number
  stride?: number
  scale_by?: string
  target_longest_side?: number
}

export interface UpscaleResponse {
  success: boolean
  jobId?: string
  outputPaths?: string[]
  totalFiles?: number
  error?: string
}

export interface WorkerJobInfo {
  progress?: number
  status?: string
  error?: string
}
