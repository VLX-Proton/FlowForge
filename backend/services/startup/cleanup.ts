import fs from 'fs'
import path from 'path'

const APP_DATA_DIR = process.env.APP_DATA_DIR
const INPUT_DIR  = APP_DATA_DIR ? path.join(APP_DATA_DIR, 'inputs') : path.join(process.cwd(), 'backend', 'inputs')
const OUTPUT_DIR = APP_DATA_DIR ? path.join(APP_DATA_DIR, 'outputs') : path.join(process.cwd(), 'backend', 'outputs')
const JOB_DIR    = APP_DATA_DIR ? path.join(APP_DATA_DIR, 'jobs')    : path.join(process.cwd(), 'backend', 'jobs')

const MAX_FILES = 50

function cleanupDir(dir: string, label: string): void {
  if (!fs.existsSync(dir)) return
  try {
    const files = fs.readdirSync(dir)
      .map(f => {
        const fp = path.join(dir, f)
        try { return { path: fp, mtime: fs.statSync(fp).mtimeMs } } catch { return null }
      })
      .filter((x): x is { path: string; mtime: number } => x !== null)
      .sort((a, b) => a.mtime - b.mtime)

    let removed = 0
    while (files.length > MAX_FILES) {
      const oldest = files.shift()
      if (oldest) { try { fs.unlinkSync(oldest.path); removed++ } catch {} }
    }
    if (removed > 0) console.log(`[CLEANUP] ${label}: removed ${removed} old file(s) (kept ${MAX_FILES} newest)`)
  } catch {}
}

/** Call after a new input file is saved. Keeps inputs/ at max 50 files. */
export function cleanupInputs():  void { cleanupDir(INPUT_DIR,  'inputs') }

/** Call after a result file is saved to outputs/. Keeps outputs/ at max 50 files. */
export function cleanupOutputs(): void { cleanupDir(OUTPUT_DIR, 'outputs') }

/** Call when a new job JSON is created. Keeps jobs/ at max 50 files. */
export function cleanupJobs():    void { cleanupDir(JOB_DIR,    'jobs') }
