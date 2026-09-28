import type { Request, Response } from 'express'
import { handleUpscaleRequest } from './handler'

export function registerUpscaleRoutes(app: any, upload: any): void {
  app.post('/api/upscale', upload.array('files'), handleUpscaleRequest as any)
}
