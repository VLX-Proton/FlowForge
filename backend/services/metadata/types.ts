export type MetadataProvider = 'gemini' | 'openrouter' | 'mistral'

export interface MetadataRequestBody {
  provider: MetadataProvider
  model?: string
  apiKey: string
  maxTitle?: number
  maxKeywords?: number
}

export interface MetadataResponse {
  title: string
  keywords: string[]
  category: number
}

export interface MetadataPromptParams {
  maxTitle: number
  maxKeywords: number
}
