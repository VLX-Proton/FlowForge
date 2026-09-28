import axios from 'axios'

export async function isWorkerAlive(url: string): Promise<boolean> {
  try {
    const resp = await axios.get(`${url}/health`, { timeout: 8000 })
    return resp.status === 200
  } catch {
    return false
  }
}
