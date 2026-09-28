import type { InjectionKey, Ref } from 'vue'

export const draggingNodeIdKey: InjectionKey<
  Ref<string | null>
> = Symbol('draggingNodeId')
