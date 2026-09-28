import fs from 'fs'
import path from 'path'
import { cleanupJobs } from '../startup/cleanup'

const APP_DATA_DIR = process.env.APP_DATA_DIR
const JOB_DIR = APP_DATA_DIR ? path.join(APP_DATA_DIR, 'jobs') : path.join(process.cwd(), 'backend', 'jobs')

export function loadJob(jobId: string): any {
  const file = path.join(JOB_DIR, `${jobId}.json`)
  if (!fs.existsSync(file)) return null
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'))
  } catch {
    return null
  }
}

export function saveJob(jobId: string, job: any): void {
  const file = path.join(JOB_DIR, `${jobId}.json`)
  const isNew = !fs.existsSync(file)
  fs.writeFileSync(file, JSON.stringify(job, null, 2))
  if (isNew) {
    cleanupJobs()
  }
}

export function deleteJob(jobId: string): void {
  const file = path.join(JOB_DIR, `${jobId}.json`)
  try {
    fs.unlinkSync(file)
  } catch {
    // ignore missing file or delete errors
  }
}
