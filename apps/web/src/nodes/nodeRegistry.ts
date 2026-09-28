import type { Component } from 'vue'
import {
  Play,
  FolderOpen,
  Download,
  Image,
  Tags,
} from 'lucide-vue-next'

export type NodeFieldType =
  | 'text'
  | 'number'
  | 'checkbox'
  | 'select'
  | 'folder'

export interface NodeFieldOption {
  label: string
  value: string | number | boolean
}

export interface NodeFieldSchema {
  key: string
  label: string
  type: NodeFieldType
  options?: NodeFieldOption[]
  placeholder?: string
  visibleWhen?: {
    field: string
    equals: any
  }
}

export interface NodePortSchema {
  id: string
  type: 'input' | 'output'
}

export interface NodeDefinition {
  title: string
  category: string
  icon: Component
  defaults: Record<string, unknown>
  ports: {
    inputs: NodePortSchema[]
    outputs: NodePortSchema[]
  }
  fields: NodeFieldSchema[]
}

export const nodeRegistry = {
  start: {
    title: 'Start',
    category: 'Flow',
    icon: Play,
    defaults: {
      face_restore: false,
    },
    ports: {
      inputs: [],
      outputs: [
        {
          id: 'main',
          type: 'output',
        },
      ],
    },
    fields: [],
  },

  folder: {
    title: 'Folder',
    category: 'Input',
    icon: FolderOpen,
    defaults: {
      path: '',
      recursive: true,
      limit: 0,
    },
    ports: {
      inputs: [
        {
          id: 'main',
          type: 'input',
        },
      ],
      outputs: [
        {
          id: 'main',
          type: 'output',
        },
      ],
    },
    fields: [
      {
        key: 'path',
        label: 'Folder Path',
        type: 'folder',
      },
      {
        key: 'recursive',
        label: 'Recursive',
        type: 'checkbox',
      },
      {
        key: 'limit',
        label: 'Limit Files (0 = all)',
        type: 'number',
        placeholder: '0',
      },
    ],
  },

  save: {
    title: 'Save',
    category: 'Output',
    icon: Download,
    defaults: {
      outputFolder: '',
    },
    ports: {
      inputs: [
        {
          id: 'main',
          type: 'input',
        },
      ],
      outputs: [],
    },
    fields: [
      {
        key: 'outputFolder',
        label: 'Output Folder',
        type: 'folder',
      },
    ],
  },

  upscaleImage: {
    title: 'Upscale Image',
    category: 'Image',
    icon: Image,
    defaults: {
      scale: '2x',
      format: 'auto',
      prompt: '',
      patch_size: '512',
      stride: '256',
      scale_by: 'factor',
      target_longest_side: '',
    },
    ports: {
      inputs: [
        {
          id: 'main',
          type: 'input',
        },
      ],
      outputs: [
        {
          id: 'main',
          type: 'output',
        },
      ],
    },
    fields: [
      {
        key: 'scale',
        label: 'Scale',
        type: 'select',
        options: [
          { label: '2x', value: '2x' },
          { label: '4x', value: '4x' },
        ],
      },
      {
        key: 'format',
        label: 'Format',
        type: 'select',
        options: [
          { label: 'Auto (keep original)', value: 'auto' },
          { label: 'PNG', value: 'png' },
          { label: 'JPG', value: 'jpg' },
          { label: 'WEBP', value: 'webp' },
        ],
      },
      {
        key: 'prompt',
        label: 'Prompt (optional)',
        type: 'text',
        placeholder: 'Optional prompt for image enhancement',
      },
      {
        key: 'patch_size',
        label: 'Patch Size',
        type: 'text',
        placeholder: '512',
      },
      {
        key: 'stride',
        label: 'Stride',
        type: 'text',
        placeholder: '256',
      },
      {
        key: 'scale_by',
        label: 'Scale By',
        type: 'select',
        options: [
          { label: 'Factor (2x, 4x)', value: 'factor' },
          { label: 'Longest Side', value: 'longest_side' },
        ],
      },
      {
        key: 'target_longest_side',
        label: 'Target Longest Side (px)',
        type: 'text',
        placeholder: 'e.g. 2048',
        visibleWhen: {
          field: 'scale_by',
          equals: 'longest_side',
        },
      },
    ],
  },

  metadata: {
    title: 'Metadata AI',
    category: 'Processing',
    icon: Tags,
    defaults: {
      provider: 'gemini',
      model_gemini: 'gemini-2.5-flash',
      model_openrouter: 'google/gemma-4-31b-it:free',
      model_mistral: 'pixtral-12b-2409',
      max_title: 200,
      max_keywords: 50,
      max_images: 100,
    },
    ports: {
      inputs: [{ id: 'main', type: 'input' }],
      outputs: [{ id: 'main', type: 'output' }],
    },
    fields: [
      {
        key: 'provider',
        label: 'Provider',
        type: 'select',
        options: [
          { label: 'Gemini (Free)', value: 'gemini' },
          { label: 'OpenRouter (Free)', value: 'openrouter' },
          { label: 'Mistral AI', value: 'mistral' },
        ],
      },
      {
        key: 'model_gemini',
        label: 'Model',
        type: 'select',
        visibleWhen: { field: 'provider', equals: 'gemini' },
        options: [
          { label: 'gemini-2.5-flash', value: 'gemini-2.5-flash' },
          { label: 'gemini-2.5-flash-lite', value: 'gemini-2.5-flash-lite' },
          { label: 'gemini-2.5-pro', value: 'gemini-2.5-pro' },
          { label: 'gemini-3.1-flash-lite', value: 'gemini-3.1-flash-lite' },
          { label: 'gemini-3.5-flash', value: 'gemini-3.5-flash' },
        ],
      },
      {
        key: 'model_openrouter',
        label: 'Model',
        type: 'select',
        visibleWhen: { field: 'provider', equals: 'openrouter' },
        options: [
          { label: 'google/gemma-4-31b-it:free', value: 'google/gemma-4-31b-it:free' },
          { label: 'google/gemma-4-26b-a4b-it:free', value: 'google/gemma-4-26b-a4b-it:free' },
        ],
      },
      {
        key: 'model_mistral',
        label: 'Model',
        type: 'select',
        visibleWhen: { field: 'provider', equals: 'mistral' },
        options: [
          { label: 'pixtral-12b', value: 'pixtral-12b-2409' },
          { label: 'pixtral-large', value: 'pixtral-large-2411' },
        ],
      },
      {
        key: 'max_title',
        label: 'Max Title Length',
        type: 'text',
        placeholder: '200',
      },
      {
        key: 'max_keywords',
        label: 'Max Keywords',
        type: 'text',
        placeholder: '50',
      },
      {
        key: 'max_images',
        label: 'Max Images to Process',
        type: 'text',
        placeholder: '100',
      },
    ],
  },
} satisfies Record<string, NodeDefinition>
