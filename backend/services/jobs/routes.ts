import fs from 'fs'
import path from 'path'
import type { Request, Response } from 'express'
import { loadJob, saveJob } from './job-store'

const APP_DATA_DIR = process.env.APP_DATA_DIR
const JOB_DIR = APP_DATA_DIR ? path.join(APP_DATA_DIR, 'jobs') : path.join(process.cwd(), 'backend', 'jobs')

export function registerJobRoutes(app: any): void {
  app.get('/api/job/:id', (req: Request, res: Response) => {
    if (!/^[0-9a-f-]{36}$/.test(req.params.id)) {
      return res.status(400).json({ error: 'Invalid job id' })
    }
    const file = path.join(JOB_DIR, `${req.params.id}.json`)
    if (!fs.existsSync(file)) {
      return res.status(404).json({ success: false })
    }
    const job = JSON.parse(fs.readFileSync(file, 'utf8'))
    console.log(`[BACKEND] Serving job ${req.params.id}: progress=${job.currentFileProgress}, status=${job.status}`)
    res.json(job)
  })

  app.delete('/api/job/:id/cancel', (req: Request, res: Response) => {
    if (!/^[0-9a-f-]{36}$/.test(req.params.id)) {
      return res.status(400).json({ error: 'Invalid job id' })
    }
    const file = path.join(JOB_DIR, `${req.params.id}.json`)
    if (!fs.existsSync(file)) {
      return res.status(404).json({ success: false, reason: 'Job not found' })
    }
    const job = JSON.parse(fs.readFileSync(file, 'utf8'))

    job.status = 'cancelled'
    job.error = 'Cancelled by user'
    fs.writeFileSync(file, JSON.stringify(job, null, 2))
    console.log(`[BACKEND] Marked job ${req.params.id} as cancelled`)

    res.json({ success: true })
  })
}
