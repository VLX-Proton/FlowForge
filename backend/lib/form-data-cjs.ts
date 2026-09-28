import { createRequire } from 'module'
const requireCjs = createRequire(import.meta.url)
export const FormData = requireCjs('form-data') as any
