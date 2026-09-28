import fs from 'fs'
import path from 'path'

const APP_DATA_DIR = process.env.APP_DATA_DIR
const KEYS_FILE = APP_DATA_DIR ? path.join(APP_DATA_DIR, 'data', 'api-keys.json') : path.join(process.cwd(), 'backend', 'data', 'api-keys.json')

function readKeysFile(): any {
  if (!fs.existsSync(KEYS_FILE)) {
    return { gemini: [], openrouter: [], mistral: [] }
  }
  return JSON.parse(fs.readFileSync(KEYS_FILE, 'utf8'))
}

function writeKeysFile(data: any): void {
  fs.writeFileSync(KEYS_FILE, JSON.stringify(data, null, 2), 'utf-8')
}

export function getKeys(provider: string): string[] {
  const data = readKeysFile()
  return data[provider] || []
}

export function addKey(provider: string, apiKey: string): void {
  const data = readKeysFile()
  if (!data[provider]) data[provider] = []
  data[provider].push(apiKey)
  writeKeysFile(data)
}

export function removeKey(provider: string, index: number): void {
  const data = readKeysFile()
  if (!data[provider]) return
  data[provider].splice(index, 1)
  writeKeysFile(data)
}

export function getNextKey(provider: string): string | null {
  const keys = getKeys(provider)
  if (keys.length === 0) return null

  const stateFile = APP_DATA_DIR ? path.join(APP_DATA_DIR, 'data', 'key-rotation-state.json') : path.join(process.cwd(), 'backend', 'data', 'key-rotation-state.json')
  let state: any = {}
  if (fs.existsSync(stateFile)) {
    state = JSON.parse(fs.readFileSync(stateFile, 'utf8'))
  }

  const currentIndex = state[provider] || 0
  const nextIndex = currentIndex % keys.length

  state[provider] = (currentIndex + 1) % keys.length
  fs.writeFileSync(stateFile, JSON.stringify(state, null, 2), 'utf-8')

  return keys[nextIndex] || null
}

export function getRotationState(provider: string): { current: number; total: number } {
  const stateFile = APP_DATA_DIR ? path.join(APP_DATA_DIR, 'data', 'key-rotation-state.json') : path.join(process.cwd(), 'backend', 'data', 'key-rotation-state.json')
  let state: any = {}
  if (fs.existsSync(stateFile)) {
    state = JSON.parse(fs.readFileSync(stateFile, 'utf8'))
  }
  const keys = getKeys(provider)
  return {
    current: state[provider] || 0,
    total: keys.length,
  }
}
