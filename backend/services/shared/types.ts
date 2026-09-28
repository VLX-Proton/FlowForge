export type JobStatus =
  | 'queued'
  | 'processing'
  | 'paused'
  | 'completed'
  | 'error'
  | 'cancelled'

export interface WorkerInfo {
  workerUrl: string
}
