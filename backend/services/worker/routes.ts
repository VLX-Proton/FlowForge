import fs from 'fs'
import path from 'path'
import type { Request, Response } from 'express'
import { syncWorkerUrl } from './gist-sync'
import { isWorkerAlive } from './health'

const APP_DATA_DIR = process.env.APP_DATA_DIR
const WORKER_FILE = APP_DATA_DIR ? path.join(APP_DATA_DIR, 'data', 'worker.json') : path.join(process.cwd(), 'backend', 'data', 'worker.json')

export function registerWorkerRoutes(app: any): void {
  app.get('/api/worker-ready', async (req: Request, res: Response) => {
    const expectedUrl = req.query.url
    if (!expectedUrl) {
      return res.status(400).json({ ready: false, reason: 'Missing url param' })
    }

    const latestUrl = await syncWorkerUrl()

    if (latestUrl !== expectedUrl) {
      return res.json({ ready: false, reason: 'URL mismatch — Gist not yet updated' })
    }

    const alive = await isWorkerAlive(latestUrl)
    if (!alive) {
      return res.json({ ready: false, reason: 'Worker not reachable yet' })
    }

    res.json({ ready: true, url: latestUrl })
  })

  app.post('/worker/update', (req: Request, res: Response) => {
    const url = req.body.workerUrl
    if (typeof url !== 'string' || !url.startsWith('https://')) {
      return res.status(400).json({ error: 'Invalid workerUrl' })
    }
    fs.writeFileSync(
      WORKER_FILE,
      JSON.stringify({ workerUrl: req.body.workerUrl }, null, 2)
    )
    console.log('Worker updated:', req.body.workerUrl)
    res.json({ success: true })
  })

  app.get('/worker', async (req: Request, res: Response) => {
    await syncWorkerUrl()
    const data = JSON.parse(fs.readFileSync(WORKER_FILE, 'utf8'))
    res.json(data)
  })
}
