import fs from 'fs'
import path from 'path'
import type { Request, Response } from 'express'
import { loadJob } from '../jobs/job-store'
import { getFileExtension } from './directories'

const APP_DATA_DIR = process.env.APP_DATA_DIR
const OUTPUT_DIR = APP_DATA_DIR ? path.join(APP_DATA_DIR, 'outputs') : path.join(process.cwd(), 'backend', 'outputs')

export function registerStorageRoutes(app: any): void {
  app.get('/api/download/:id', (req: Request, res: Response) => {
    const job = loadJob(req.params.id)
    if (!job) {
      return res.status(404).end()
    }
    if (job.status !== 'completed') {
      return res.status(400).json({ success: false })
    }

    const index = req.query.index ? parseInt(req.query.index as string) : 0
    const resultPath = job.outputPaths?.[index] || job.outputPaths?.[0]

    if (!resultPath) {
      return res.status(404).end()
    }

    res.download(resultPath)
  })

  app.get('/api/outputs/:filename', (req: Request, res: Response) => {
    const filename = path.basename(req.params.filename)
    const filePath = path.join(OUTPUT_DIR, filename)

    if (!filePath.startsWith(OUTPUT_DIR)) {
      return res.status(403).end()
    }

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ success: false, error: 'File not found' })
    }

    res.sendFile(filePath)
  })
}
