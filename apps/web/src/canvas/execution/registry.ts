import { startExecutor } from './executors/start.executor'
import { folderExecutor } from './executors/folder.executor'
import { saveExecutor } from './executors/save.executor'
import { upscaleExecutor } from './executors/upscale.executor'
import { metadataExecutor } from './executors/metadata.executor'
import type { WorkflowExecutor } from './types'

export const executorRegistry: Record<string, WorkflowExecutor> = {
  start: startExecutor,
  folder: folderExecutor,
  save: saveExecutor,
  upscaleImage: upscaleExecutor,
  metadata: metadataExecutor,
}
