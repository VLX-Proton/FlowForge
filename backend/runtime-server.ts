import express, { Request, Response, NextFunction } from 'express'
import fs from 'fs'
import path from 'path'
import multer from 'multer'
const { handleMetadataRequest } = require('./services/metadata')
const { registerUpscaleRoutes } = require('./services/upscale/routes')
const { registerJobRoutes } = require('./services/jobs/routes')
const { registerWorkerRoutes } = require('./services/worker/routes')
const { registerStorageRoutes } = require('./services/storage/routes')
const { registerKeysRoutes } = require('./services/keys/routes')
const { runStartup } = require('./services/startup/init')

declare const __dirname: string
const APP_DATA_DIR = process.env.APP_DATA_DIR

const app = express()

app.use(express.json())

app.use((req: Request, res: Response, next: NextFunction) => {
  res.header('Access-Control-Allow-Origin', '*')
  res.header('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS')
  res.header('Access-Control-Allow-Headers', 'Content-Type')
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200)
  }
  next()
})

let healthLoggerState: 'unknown' | 'connected' = 'unknown'

app.get('/api/health', (_req: Request, res: Response) => {
  if (healthLoggerState !== 'connected') {
    console.log('[HEALTH] Backend connected')
    healthLoggerState = 'connected'
  }
  res.json({ ready: true })
})

app.post('/api/health/log', (req: Request, res: Response) => {
  const { event } = req.body || {}
  if (event === 'disconnected') {
    console.log('[HEALTH] Backend disconnected')
    healthLoggerState = 'unknown'
  } else if (event === 'reconnected') {
    console.log('[HEALTH] Backend reconnected')
  }
  res.json({ success: true })
})

const DATA_DIR = APP_DATA_DIR ? path.join(APP_DATA_DIR, 'data') : path.join(__dirname, 'data')
const JOB_DIR = APP_DATA_DIR ? path.join(APP_DATA_DIR, 'jobs') : path.join(__dirname, 'jobs')
const INPUT_DIR = APP_DATA_DIR ? path.join(APP_DATA_DIR, 'inputs') : path.join(__dirname, 'inputs')
const OUTPUT_DIR = APP_DATA_DIR ? path.join(APP_DATA_DIR, 'outputs') : path.join(__dirname, 'outputs')
const WORKER_FILE = path.join(DATA_DIR, 'worker.json')

;[DATA_DIR, JOB_DIR, INPUT_DIR, OUTPUT_DIR].forEach((dir: string) => {
  if (!fs.existsSync(dir as any)) fs.mkdirSync(dir, { recursive: true })
})

if (!fs.existsSync(WORKER_FILE)) {
  fs.writeFileSync(WORKER_FILE, JSON.stringify({ workerUrl: '' }, null, 2))
}

const upload = multer({
  limits: { fileSize: 200 * 1024 * 1024 },
  storage: multer.diskStorage({
    destination: (req: Request, file: Express.Multer.File, cb: any) => {
      cb(null, INPUT_DIR)
    },
    filename: (req: Request, file: Express.Multer.File, cb: any) => {
      cb(null, file.originalname)
    }
  })
})

app.use((req: Request, res: Response, next: NextFunction) => {
  const url = req.url
  if (!url.startsWith('/api/health')) {
    console.log(`[BACKEND] Request: ${req.method} ${req.url}`)
  }
  next()
})

app.post('/api/metadata', upload.single('file'), handleMetadataRequest as any)

registerUpscaleRoutes(app, upload)

registerJobRoutes(app)

registerWorkerRoutes(app)

registerStorageRoutes(app)

registerKeysRoutes(app)

const frontendPath = path.join(__dirname, '../apps/web/dist')
app.use(express.static(frontendPath))
app.get('*', (req: Request, res: Response) => {
  res.sendFile(path.join(frontendPath, 'index.html'))
})

const PORT = 4000
app.listen(PORT, async () => {
  console.log(`Runtime server running on port ${PORT}`)
  await runStartup()
})