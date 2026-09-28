import type { Request, Response } from 'express'
import { getKeys, addKey, removeKey, getNextKey, getRotationState } from './index'

export function registerKeysRoutes(app: any): void {
  app.get('/api/keys/:provider', (req: Request, res: Response) => {
    const { provider } = req.params
    const keys = getKeys(provider)
    const rotation = getRotationState(provider)
    res.json({ keys, rotation })
  })

  app.post('/api/keys/:provider', (req: Request, res: Response) => {
    const { provider } = req.params
    const { apiKey } = req.body
    if (!apiKey || typeof apiKey !== 'string') {
      return res.status(400).json({ error: 'apiKey is required' })
    }
    addKey(provider, apiKey.trim())
    res.json({ success: true })
  })

  app.delete('/api/keys/:provider/:index', (req: Request, res: Response) => {
    const { provider, index } = req.params
    if (!/^[0-9]+$/.test(index)) {
      return res.status(400).json({ error: 'Invalid index' })
    }
    const idx = parseInt(index, 10)
    if (isNaN(idx)) {
      return res.status(400).json({ error: 'Invalid index' })
    }
    removeKey(provider, idx)
    res.json({ success: true })
  })

  app.get('/api/keys/:provider/next', (req: Request, res: Response) => {
    const { provider } = req.params
    const key = getNextKey(provider)
    if (!key) {
      return res.status(404).json({ error: 'No keys available for provider' })
    }
    res.json({ apiKey: key })
  })
}
