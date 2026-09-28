export function buildHandleKey(
  nodeId: string,
  fieldKey: string,
) {
  return `${nodeId}:${fieldKey}`
}

export function getDirectoryHandlePath(
  handle: FileSystemDirectoryHandle,
): string {
  const anyHandle = handle as any

  if (typeof anyHandle.electronPath === 'string') {
    return anyHandle.electronPath
  }

  if (typeof anyHandle.path === 'string') {
    return anyHandle.path
  }

  if (typeof anyHandle.fullPath === 'string') {
    return anyHandle.fullPath
  }

  if (typeof anyHandle.webkitRelativePath === 'string') {
    return anyHandle.webkitRelativePath
  }

  return handle.name || ''
}

export async function pickDirectoryHandle(): Promise<FileSystemDirectoryHandle | null> {
  if ((window as any).electronAPI?.selectFolder) {
    const folderPath = await (window as any).electronAPI.selectFolder()
    if (!folderPath) return null

      const folderName = folderPath.split('/').pop() || folderPath

      const fakeDirHandle = {
        kind: 'directory',
        name: folderName,
        path: folderPath,
        electronPath: folderPath,
      } as unknown as FileSystemDirectoryHandle

      return fakeDirHandle
  }

  if (!('showDirectoryPicker' in window)) {
    return null
  }

  try {
    const handle = await (window as any).showDirectoryPicker()

    return handle ?? null
  } catch {
    return null
  }
}

const DATABASE_NAME = 'flowforge-directory-handles'
const DATABASE_VERSION = 1
const OBJECT_STORE_NAME = 'directory-handles'

function openHandleDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (!('indexedDB' in window)) {
      reject(new Error('IndexedDB not supported'))
      return
    }

    const request = window.indexedDB.open(
      DATABASE_NAME,
      DATABASE_VERSION,
    )

    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(OBJECT_STORE_NAME)) {
        db.createObjectStore(OBJECT_STORE_NAME)
      }
    }

    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

function requestToPromise<T>(
  request: IDBRequest<T>,
): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

async function getObjectStore(
  mode: 'readonly' | 'readwrite',
): Promise<IDBObjectStore> {
  const db = await openHandleDatabase()
  const transaction = db.transaction(
    OBJECT_STORE_NAME,
    mode,
  )
  return transaction.objectStore(OBJECT_STORE_NAME)
}

export async function savePersistedDirectoryHandle(
  key: string,
  handle: FileSystemDirectoryHandle | null,
): Promise<void> {
  if (!('indexedDB' in window)) {
    return
  }

  if (handle === null) {
    await deletePersistedDirectoryHandle(key)
    return
  }

  try {
    const store = await getObjectStore('readwrite')
    await requestToPromise(store.put(handle, key))
  } catch {
    // ignore persistence failures
  }
}

export async function loadPersistedDirectoryHandle(
  key: string,
): Promise<FileSystemDirectoryHandle | null> {
  if (!('indexedDB' in window)) {
    return null
  }

  try {
    const store = await getObjectStore('readonly')
    const handle = await requestToPromise(
      store.get(key),
    )
    return handle ?? null
  } catch {
    return null
  }
}

export async function deletePersistedDirectoryHandle(
  key: string,
): Promise<void> {
  if (!('indexedDB' in window)) {
    return
  }

  try {
    const store = await getObjectStore('readwrite')
    await requestToPromise(store.delete(key))
  } catch {
    // ignore cleanup failures
  }
}

export async function getPersistedDirectoryHandles(): Promise<
  Record<string, FileSystemDirectoryHandle>
> {
  if (!('indexedDB' in window)) {
    return {}
  }

  try {
    const store = await getObjectStore('readonly')
    const request = store.getAllKeys()
    // The IndexedDB API returns IDBValidKey[] which is compatible with string[] for our usage.
    // Cast to any to satisfy TypeScript.
    const keys = await requestToPromise<any>(request as any)
    const result: Record<string, FileSystemDirectoryHandle> = {}

    for (const key of keys) {
      const handle = await loadPersistedDirectoryHandle(key)
      if (handle) {
        result[key] = handle
      }
    }

    return result
  } catch {
    return {}
  }
}

export async function clearAllPersistedDirectoryHandles(): Promise<void> {
  if (!('indexedDB' in window)) {
    return
  }

  try {
    const store = await getObjectStore('readwrite')
    await requestToPromise(store.clear())
  } catch {
    // ignore cleanup failures
  }
}
