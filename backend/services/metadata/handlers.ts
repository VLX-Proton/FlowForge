import { Request, Response } from 'express'
const { buildMetadataPrompt } = require('./prompt')
const { callGemini, callOpenRouter, callMistral } = require('./providers')
const { readFileAsBase64, cleanupUploadedFile, resizeImageForAI } = require('./file-utils')
const { getNextKey, getKeys } = require('../keys')

async function callProvider(
  provider: string,
  model: string,
  prompt: string,
  fileBase64: string,
  mimeType: string,
  apiKey: string
): Promise<string> {
  if (provider === 'gemini') return callGemini(prompt, fileBase64, mimeType, apiKey, model)
  if (provider === 'openrouter') return callOpenRouter(prompt, fileBase64, mimeType, apiKey, model)
  if (provider === 'mistral') return callMistral(prompt, fileBase64, mimeType, apiKey, model)
  throw new Error('Unsupported provider: ' + provider)
}

function parseResult(raw: string): any {
  let str = raw.trim()
  if (str.startsWith('```json')) str = str.replace(/^```json/, '')
  if (str.startsWith('```')) str = str.replace(/^```/, '')
  if (str.endsWith('```')) str = str.replace(/```$/, '')
  return JSON.parse(str.trim())
}

export async function handleMetadataRequest(req: any, res: Response): Promise<void> {
  try {
    const { provider, model, maxTitle = 200, maxKeywords = 50 } = req.body

    if (!req.file) {
      res.status(400).json({ error: 'No image uploaded' })
      return
    }

    const prompt = buildMetadataPrompt(maxTitle, maxKeywords)
    const { resizedPath, needsCleanup } = await resizeImageForAI(req.file.path)
    const fileBase64 = readFileAsBase64(resizedPath)
    const mimeType = req.file.mimetype || 'image/jpeg'

    // Ambil semua key yang tersedia untuk fallback
    const allKeys: string[] = getKeys(provider) || []
    if (allKeys.length === 0) {
      res.status(500).json({ error: `No API key available for provider: ${provider}. Please add keys in Settings.` })
      cleanupUploadedFile(req.file.path)
      if (needsCleanup) cleanupUploadedFile(resizedPath)
      return
    }

    // Mulai dari key berikutnya (round-robin)
    const firstKey = getNextKey(provider)
    const usedKeys = new Set<string>()
    let resultJsonStr = ''
    let lastError: any = null
    let success = false

    // Buat urutan key: mulai dari firstKey, lalu sisanya
    const keyQueue: string[] = [firstKey]
    for (const k of allKeys) {
      if (k !== firstKey && !keyQueue.includes(k)) keyQueue.push(k)
    }

    for (const apiKey of keyQueue) {
      if (usedKeys.has(apiKey)) continue
      usedKeys.add(apiKey)

      try {
        resultJsonStr = await callProvider(provider, model, prompt, fileBase64, mimeType, apiKey)
        success = true
        break
      } catch (err: any) {
        lastError = err
        const status = err.response?.status
        if (status === 429 || status === 402 || status === 403) {
          // Rate limit — tunggu sebentar sebelum coba key berikutnya agar tidak memicu limit beruntun
          await new Promise(resolve => setTimeout(resolve, 2000))
          console.warn(`[METADATA] Key rate limited (${status}), trying next key...`)
          continue
        }
        // Error lain (500, network, parse error) — langsung fail
        console.error('[METADATA] API Error:', err.response?.data || err.message)
        break
      }
    }

    if (!success) {
      const status = lastError?.response?.status
      if (status === 429 || status === 402 || status === 403) {
        res.status(429).json({ error: 'All API keys exhausted or rate limited' })
      } else {
        res.status(500).json({ error: lastError?.message || 'Unknown error' })
      }
      cleanupUploadedFile(req.file.path)
      if (needsCleanup) cleanupUploadedFile(resizedPath)
      return
    }

    try {
      const parsed = parseResult(resultJsonStr)
      const startedAt = Date.now()

      // DB persistence removed — metadata history is no longer saved to SQLite

      res.json(parsed)
    } catch (parseErr: any) {
      console.error('[METADATA] Parse Error:', parseErr.message)
      res.status(500).json({ error: 'Failed to parse AI response: ' + parseErr.message })
    } finally {
      cleanupUploadedFile(req.file.path)
      if (needsCleanup) cleanupUploadedFile(resizedPath)
    }

  } catch (err: any) {
    console.error('[METADATA] Server Error:', err)
    res.status(500).json({ error: err.message })
  }
}