import { defineStore } from 'pinia'
import { createWorkflowNode } from '../../nodes/createWorkflowNode'
import type { NodeType, WorkflowNode } from '../types/node.types'
import type { WorkflowEdge } from '../types/edge.types'
import {
  DEFAULT_NODE_HEIGHT,
  DEFAULT_NODE_WIDTH,
} from '../constants/nodeLayout'
import { createWorkflowContext } from '../execution/context'
import { executeNode as executeNodeUtil } from '../execution/executeNode'
import { runWorkflow as runWorkflowEngine } from '../execution/runWorkflow'
import {
  buildHandleKey,
  clearAllPersistedDirectoryHandles,
  deletePersistedDirectoryHandle,
  getDirectoryHandlePath,
  getPersistedDirectoryHandles,
  pickDirectoryHandle,
  savePersistedDirectoryHandle,
} from '../utils/folderPicker'
import { getPortWorldPosition } from '../utils/getPortScreenPosition'
import { db, auth } from '../../firebase'
import { doc, getDoc, setDoc } from 'firebase/firestore'

const WORKFLOW_STORAGE_KEY =
  'flowforge-workflow'

const MIN_ZOOM = 0.2
const MAX_ZOOM = 4

export const useCanvasStore = defineStore('canvas', {
  state: () => ({
    viewport: {
      x: 0,
      y: 0,
      zoom: 1,
    },

    nodes: [] as WorkflowNode[],

    edges: [] as WorkflowEdge[],

    selectedNodeIds: [] as string[],

    selectedEdgeId: '' as string,

    popupNodeId: '' as string,

    dragPreview: {
      active: false,
      x: 0,
      y: 0,
      type: 'start' as NodeType,
    },

    marquee: {
      active: false,

      startX: 0,
      startY: 0,

      currentX: 0,
      currentY: 0,
    },

    selectionSource:
      'click' as
        | 'click'
        | 'marquee',

    connectionDrag: {
      active: false,

      sourceNodeId: '',
      sourcePortId: '',

      mouseX: 0,
      mouseY: 0,

      targetNodeId: '',
      targetPortId: '',
    },

    directoryHandles: {} as Record<string, FileSystemDirectoryHandle | null>,
    fileHandles: {} as Record<string, FileSystemFileHandle | null>,
    nodePreviewData: {} as Record<string, any>,
    nodeRuntimeData: {} as Record<string, any>,
    isExecuting: false,
    isWorkflowCancelled: false,
    isCancelling: false,
    
    checkpointPrompt: null as {
      active: boolean
      nodeName: string
      progress: string
      resolve: (choice: 'resume' | 'restart') => void
    } | null,
  }),

  actions: {
    setZoom(zoom: number) {
      this.viewport.zoom = Math.max(
        MIN_ZOOM,
        Math.min(MAX_ZOOM, zoom),
      )
    },

    zoomBy(factor: number) {
      this.setZoom(
        this.viewport.zoom * factor,
      )
    },

    pan(dx: number, dy: number) {
      this.viewport.x += dx
      this.viewport.y += dy
    },

    setViewport(
      x: number,
      y: number,
      zoom: number,
    ) {
      this.viewport.x = x
      this.viewport.y = y
      this.viewport.zoom = zoom
    },

    moveNode(
      nodeId: string,
      x: number,
      y: number,
    ) {
      const node =
      this.nodes.find(
      n => n.id === nodeId,
    )

      if (!node) return

      node.x = x
      node.y = y
      this.saveWorkflowState()
    },

    selectNode(nodeId: string) {
      this.selectedNodeIds = [nodeId]
      this.selectionSource = 'click'
      this.selectedEdgeId = ''
    },

    toggleNodeSelection(
      nodeId: string,
    ) {
      this.selectedEdgeId = ''
      const index =
        this.selectedNodeIds.indexOf(
          nodeId,
        )

      if (index >= 0) {
        this.selectedNodeIds.splice(
          index,
          1,
        )

        return
      }

      this.selectedNodeIds.push(
        nodeId,
      )
      this.selectionSource = 'click'
    },

    clearSelection() {
      this.selectedNodeIds = []
      this.selectedEdgeId = ''

      this.selectionSource =
        'click'
    },

    selectEdge(edgeId: string) {
      this.selectedEdgeId = edgeId
      this.selectedNodeIds = []
    },

    deleteEdge(edgeId: string) {
      this.edges = this.edges.filter(e => e.id !== edgeId)
      if (this.selectedEdgeId === edgeId) {
        this.selectedEdgeId = ''
      }
      this.saveWorkflowState()
    },

    deleteSelectedEdge() {
      if (this.selectedEdgeId) {
        this.deleteEdge(this.selectedEdgeId)
      }
    },

    deleteSelectedNodes() {
      const removedIds =
        new Set(this.selectedNodeIds)

      this.nodes = this.nodes.filter(
        node => !removedIds.has(node.id),
      )

      this.edges = this.edges.filter(
        edge =>
          !removedIds.has(
            edge.sourceNodeId,
          ) &&
          !removedIds.has(
            edge.targetNodeId,
          ),
      )

      if (
        this.popupNodeId &&
        removedIds.has(this.popupNodeId)
      ) {
        this.closePopup()
      }

      for (const nodeId of removedIds) {
        const prefix = `${nodeId}:`

        for (const key of Object.keys(
          this.directoryHandles,
        )) {
          if (key.startsWith(prefix)) {
            delete this.directoryHandles[key]
          }
        }

        for (const key of Object.keys(
          this.fileHandles,
        )) {
          if (key.startsWith(prefix)) {
            delete this.fileHandles[key]
          }
        }
      }

      this.clearSelection()
      this.saveWorkflowState()
    },

    async pickDirectoryHandle(
      nodeId: string,
      fieldKey: string,
    ) {
      const handle = await pickDirectoryHandle()

      if (!handle) {
        return null
      }

      const key = buildHandleKey(
        nodeId,
        fieldKey,
      )

      this.directoryHandles[key] = handle

      const node = this.nodes.find(
        n => n.id === nodeId,
      )

      if (node) {
        node.data[fieldKey] =
          getDirectoryHandlePath(handle)
      }

      if (node?.type === 'folder') {
        await this.updateFolderPreview(
          nodeId,
        )
      }

      await savePersistedDirectoryHandle(
        key,
        handle,
      )

      return handle
    },

    async restorePersistedWorkflow() {
      // 1. Coba load dari Cloud Firestore jika user sudah login
      const currentUser = auth.currentUser
      if (currentUser) {
        try {
          const userDoc = await getDoc(doc(db, 'users', currentUser.uid, 'workflows', 'default'))
          if (userDoc.exists()) {
            const data = userDoc.data()
            if (Array.isArray(data.nodes) && Array.isArray(data.edges)) {
              this.nodes = data.nodes
              this.edges = data.edges
              setTimeout(() => {
                this.zoomToFit()
              }, 50)
              return
            }
          }
        } catch (e) {
          console.warn('[CLOUD SYNC] Failed to load cloud workflow, falling back to local:', e)
        }
      }

      // 2. Fallback ke localStorage
      const raw =
        window.localStorage.getItem(
          WORKFLOW_STORAGE_KEY,
        )
      if (!raw) {
        return
      }

      try {
        const parsed = JSON.parse(raw)
        if (
          Array.isArray(parsed.nodes) &&
          Array.isArray(parsed.edges)
        ) {
          this.nodes = parsed.nodes
          this.edges = parsed.edges
          
          setTimeout(() => {
            this.zoomToFit()
          }, 50)
        }
      } catch {
        // ignore invalid saved workflow
      }
    },

    saveWorkflowState() {
      // 1. Simpan ke local storage
      try {
        const payload = JSON.stringify({
          nodes: this.nodes,
          edges: this.edges,
        })
        window.localStorage.setItem(
          WORKFLOW_STORAGE_KEY,
          payload,
        )
      } catch {
        // ignore storage failures
      }

      // 2. Simpan ke Cloud Firestore (jika user login)
      const currentUser = auth.currentUser
      if (currentUser) {
        try {
          setDoc(doc(db, 'users', currentUser.uid, 'workflows', 'default'), {
            nodes: JSON.parse(JSON.stringify(this.nodes)),
            edges: JSON.parse(JSON.stringify(this.edges)),
            updatedAt: new Date().toISOString()
          }, { merge: true }).catch(err => {
            console.warn('[CLOUD SYNC] Error auto-saving workflow to cloud:', err)
          })
        } catch (e) {
          console.warn('[CLOUD SYNC] Error prepping cloud save:', e)
        }
      }
    },

    async restorePersistedDirectoryHandles() {
      if ((window as any).electronAPI) {
        for (const node of this.nodes) {
          if (node.type === 'folder' && node.data.path) {
            const fakeDirHandle = {
              kind: 'directory',
              name: node.data.path.split('/').pop() || node.data.path,
              path: node.data.path,
              electronPath: node.data.path,
            } as unknown as FileSystemDirectoryHandle

            const key = buildHandleKey(node.id, 'path')
            this.directoryHandles[key] = fakeDirHandle

            await this.updateFolderPreview(node.id)
          }

          if (node.type === 'save' && node.data.outputFolder) {
            const fakeDirHandle = {
              kind: 'directory',
              name: node.data.outputFolder.split('/').pop() || node.data.outputFolder,
              path: node.data.outputFolder,
              electronPath: node.data.outputFolder,
            } as unknown as FileSystemDirectoryHandle

            const key = buildHandleKey(node.id, 'outputFolder')
            this.directoryHandles[key] = fakeDirHandle
          }
        }
        return
      }
      const persisted = await getPersistedDirectoryHandles()

      for (const [key, handle] of Object.entries(
        persisted,
      )) {
        const [nodeId, fieldKey] = key.split(':')
        const node = this.nodes.find(
          n => n.id === nodeId,
        )

        if (!node) {
          continue
        }

        const anyHandle = handle as any
        if (
          typeof anyHandle.queryPermission === 'function' &&
          !(window as any).electronAPI
        ) {
          try {
            const status = await anyHandle.queryPermission({
              mode: 'readwrite',
            })
            if (status === 'denied') {
              await deletePersistedDirectoryHandle(
                key,
              )
              continue
            }
          } catch {
            await deletePersistedDirectoryHandle(
              key,
            )
            continue
          }
        }

        this.directoryHandles[key] = handle

        if (!node.data[fieldKey]) {
          node.data[fieldKey] =
            getDirectoryHandlePath(handle)
        }

        if (node.type === 'folder') {
          await this.updateFolderPreview(node.id)
        }
      }
    },

    getDirectoryHandle(
      nodeId: string,
      fieldKey: string,
    ) {
      return this.directoryHandles[
        buildHandleKey(nodeId, fieldKey)
      ]
    },

    async setFileHandle(
      nodeId: string,
      fieldKey: string,
      handle: FileSystemFileHandle,
    ) {
      this.fileHandles[
        buildHandleKey(nodeId, fieldKey)
      ] = handle
    },

    selectNodes(
      nodeIds: string[],
    ) {
      this.selectedNodeIds =
        nodeIds

      this.selectionSource =
        'marquee'
      this.selectedEdgeId = ''
    },

    selectAllNodes() {
      this.selectedEdgeId = ''
      this.selectedNodeIds =
      this.nodes.map(
        node => node.id,
      )
    },

    zoomToPoint(
      mouseX: number,
      mouseY: number,
      factor: number,
    ) {
      const oldZoom =
        this.viewport.zoom

      const newZoom = Math.max(
        MIN_ZOOM,
        Math.min(
          MAX_ZOOM,
          oldZoom * factor,
        ),
      )

      const worldX =
        (mouseX - this.viewport.x) /
        oldZoom

      const worldY =
        (mouseY - this.viewport.y) /
        oldZoom

      this.viewport.zoom =
        newZoom

      this.viewport.x =
        mouseX -
        worldX * newZoom

      this.viewport.y =
        mouseY -
        worldY * newZoom
    },

    startMarquee(
      x: number,
      y: number,
    ) {
      this.marquee.active = true

      this.marquee.startX = x
      this.marquee.startY = y

      this.marquee.currentX = x
      this.marquee.currentY = y
    },

    updateMarquee(
      x: number,
      y: number,
    ) {
      this.marquee.currentX = x
      this.marquee.currentY = y
    },

    stopMarquee() {
      this.marquee.active = false
    },

    startConnectionDrag(
      nodeId: string,
      portId: string,
      mouseX: number,
      mouseY: number,
    ) {
      this.connectionDrag.active =
        true

      this.connectionDrag.sourceNodeId =
        nodeId

      this.connectionDrag.sourcePortId =
        portId

      this.connectionDrag.mouseX =
        (mouseX - this.viewport.x) /
        this.viewport.zoom

      this.connectionDrag.mouseY =
        (mouseY - this.viewport.y) /
        this.viewport.zoom
    },

    updateConnectionDrag(
      mouseX: number,
      mouseY: number,
    ) {
      const worldX =
        (mouseX - this.viewport.x) /
        this.viewport.zoom

      const worldY =
        (mouseY - this.viewport.y) /
        this.viewport.zoom

      this.connectionDrag.mouseX = worldX
      this.connectionDrag.mouseY = worldY

      // Snap to closest input port within 50px snap radius
      let closestPort: { nodeId: string; portId: string } | null = null
      let minDistance = 50

      for (const node of this.nodes) {
        if (node.id === this.connectionDrag.sourceNodeId) {
          continue
        }

        for (const port of node.inputs) {
          const portPos = getPortWorldPosition(node, 'input')
          const dist = Math.hypot(worldX - portPos.x, worldY - portPos.y)
          if (dist < minDistance) {
            minDistance = dist
            closestPort = { nodeId: node.id, portId: port.id }
          }
        }
      }

      if (closestPort) {
        this.connectionDrag.targetNodeId = closestPort.nodeId
        this.connectionDrag.targetPortId = closestPort.portId
      } else {
        this.connectionDrag.targetNodeId = ''
        this.connectionDrag.targetPortId = ''
      }
    },

    setConnectionTarget(
      nodeId: string,
      portId: string,
    ) {
      this.connectionDrag.targetNodeId =
        nodeId
      this.connectionDrag.targetPortId =
        portId
    },

    clearConnectionTarget() {
      this.connectionDrag.targetNodeId = ''
      this.connectionDrag.targetPortId = ''
    },

    stopConnectionDrag() {
      this.connectionDrag.active =
        false

      this.connectionDrag.sourceNodeId =
        ''

      this.connectionDrag.sourcePortId =
        ''

      this.connectionDrag.targetNodeId =
        ''

      this.connectionDrag.targetPortId =
        ''

      this.connectionDrag.mouseX = 0
      this.connectionDrag.mouseY = 0
    },

    createEdge(
      sourceNodeId: string,
      sourcePortId: string,
      targetNodeId: string,
      targetPortId: string,
    ) {
      this.edges.push({
        id: crypto.randomUUID(),
        sourceNodeId,
        sourcePortId,
        targetNodeId,
        targetPortId,
      })
      this.saveWorkflowState()
    },

    openPopup(nodeId: string) {
      this.popupNodeId = nodeId
    },

    closePopup() {
      this.popupNodeId = ''
    },

    startDragPreview(
      type: NodeType,
    ) {
      this.dragPreview.active = true
      this.dragPreview.type = type
    },

    updateDragPreview(
      x: number,
      y: number,
    ) {
      this.dragPreview.x = x
      this.dragPreview.y = y
    },

    stopDragPreview() {
      this.dragPreview.active = false
    },

    addNode(
      type: NodeType,
      x: number,
      y: number,
    ) {
      this.selectedEdgeId = ''
      const node = createWorkflowNode(
        type,
        x - DEFAULT_NODE_WIDTH / 2,
        y - DEFAULT_NODE_HEIGHT / 2,
      )

      this.nodes.push(node)
      this.saveWorkflowState()
    },

    async executeNode(
      nodeId: string,
    ) {
      const node = this.nodes.find(
        n => n.id === nodeId,
      )

      if (!node) {
        return null
      }

      return executeNodeUtil(
        node,
        createWorkflowContext(),
      )
    },

    setNodePreviewData(
      nodeId: string,
      data: any,
    ) {
      this.nodePreviewData[nodeId] = data
    },

setNodeRuntimeData(
         nodeId: string,
         data: any,
       ) {
         const existing = this.nodeRuntimeData[nodeId] || {}
this.nodeRuntimeData[nodeId] = {
                           ...existing,
                           ...data,
                         }
                         this.nodeRuntimeData = { ...this.nodeRuntimeData }
       },

    async updateFolderPreview(
      nodeId: string,
    ) {
      const { scanFolderForFiles } =
        await import(
          '../utils/folderScanner'
        )

      const node = this.nodes.find(
        n => n.id === nodeId,
      )

      if (!node) {
        return
      }

      const handle =
        this.getDirectoryHandle(
          nodeId,
          'path',
        )

      if (!handle) {
        this.setNodePreviewData(
          nodeId,
          null,
        )

        return
      }

      const scanResult =
        await scanFolderForFiles(handle)

        console.log('SCAN RESULT:', scanResult)

      this.setNodePreviewData(nodeId, {
        fileCount:
          scanResult.files.length,
        formats: Array.from(
          scanResult.formats,
        ).join('/'),
        sampleFilenames:
          scanResult.sampleFilenames,
      })
    },

    async runWorkflow() {
      if (this.isExecuting) {
        return null
      }

      this.isExecuting = true
      this.isWorkflowCancelled = false
      this.isCancelling = false

      try {
        return await runWorkflowEngine(
          this.nodes,
          this.edges,
          this.directoryHandles,
          () => this.isWorkflowCancelled,
          (nodeId, runtimeData) => {
            const existing = this.nodeRuntimeData[nodeId] || {}
            this.setNodeRuntimeData(nodeId, {
              ...existing,
              ...runtimeData,
            })
          },
        )
      } finally {
        this.isExecuting = false
        this.isCancelling = false
      }
    },

    async cancelWorkflow() {
      this.isCancelling = true
      this.isWorkflowCancelled = true
      // Wait up to 3 seconds for the executor to stop, then force-reset
      await new Promise<void>((resolve) => {
        const timeout = setTimeout(() => {
          clearInterval(check)
          resolve()
        }, 3000)
        const check = setInterval(() => {
          if (!this.isExecuting) {
            clearInterval(check)
            clearTimeout(timeout)
            resolve()
          }
        }, 100)
      })
      // Force reset regardless
      this.isExecuting = false
      this.isCancelling = false
    },

    async deleteWorkflow() {
      // Clear all nodes and edges
      this.nodes = []
      this.edges = []
      this.selectedNodeIds = []
      this.popupNodeId = ''
      this.directoryHandles = {}
      this.fileHandles = {}
      this.nodePreviewData = {}
      this.nodeRuntimeData = {}
      this.isExecuting = false
      this.isWorkflowCancelled = false

      // Clear persisted workflow from localStorage
      try {
        window.localStorage.removeItem('flowforge-workflow')
      } catch {
        // ignore
      }

      // Clear all persisted directory handles from IndexedDB
      await clearAllPersistedDirectoryHandles()
    },

    zoomToFit() {
      if (this.nodes.length === 0) {
        this.setViewport(window.innerWidth / 2, window.innerHeight / 2, 1)
        return
      }

      let minX = Infinity
      let maxX = -Infinity
      let minY = Infinity
      let maxY = -Infinity

      for (const node of this.nodes) {
        minX = Math.min(minX, node.x)
        maxX = Math.max(maxX, node.x + node.width)
        minY = Math.min(minY, node.y)
        maxY = Math.max(maxY, node.y + node.height)
      }

      const padding = 80
      const contentWidth = (maxX - minX) + padding * 2
      const contentHeight = (maxY - minY) + padding * 2

      const containerWidth = window.innerWidth
      const containerHeight = window.innerHeight

      const scaleX = containerWidth / contentWidth
      const scaleY = containerHeight / contentHeight
      const optimalZoom = Math.max(0.2, Math.min(1, Math.min(scaleX, scaleY)))

      // Center the content in the viewport
      const scaledContentW = contentWidth * optimalZoom
      const scaledContentH = contentHeight * optimalZoom
      const viewportX = (containerWidth - scaledContentW) / 2 - (minX - padding) * optimalZoom
      const viewportY = (containerHeight - scaledContentH) / 2 - (minY - padding) * optimalZoom

      this.setViewport(viewportX, viewportY, optimalZoom)
    },

    zoomFromCenter(factor: number) {
      const cx = window.innerWidth / 2
      const cy = window.innerHeight / 2
      this.zoomToPoint(cx, cy, factor)
    },

    autoLayout() {
      if (this.nodes.length === 0) return

      const adj: Record<string, string[]> = {}
      const inDegree: Record<string, number> = {}

      for (const node of this.nodes) {
        adj[node.id] = []
        inDegree[node.id] = 0
      }

      for (const edge of this.edges) {
        if (adj[edge.sourceNodeId] && adj[edge.targetNodeId] !== undefined) {
          adj[edge.sourceNodeId].push(edge.targetNodeId)
          inDegree[edge.targetNodeId]++
        }
      }

      const layers: Record<string, number> = {}
      const queue: { id: string; depth: number }[] = []

      for (const node of this.nodes) {
        if (inDegree[node.id] === 0) {
          queue.push({ id: node.id, depth: 0 })
          layers[node.id] = 0
        }
      }

      if (queue.length === 0 && this.nodes.length > 0) {
        queue.push({ id: this.nodes[0].id, depth: 0 })
        layers[this.nodes[0].id] = 0
      }

      while (queue.length > 0) {
        const { id, depth } = queue.shift()!
        const currentDepth = layers[id] ?? depth

        for (const neighbor of adj[id]) {
          const nextDepth = currentDepth + 1
          if (layers[neighbor] === undefined || nextDepth > layers[neighbor]) {
            layers[neighbor] = nextDepth
            queue.push({ id: neighbor, depth: nextDepth })
          }
        }
      }

      for (const node of this.nodes) {
        if (layers[node.id] === undefined) {
          layers[node.id] = 0
        }
      }

      const layerGroups: Record<number, string[]> = {}
      for (const node of this.nodes) {
        const d = layers[node.id]
        if (!layerGroups[d]) {
          layerGroups[d] = []
        }
        layerGroups[d].push(node.id)
      }


      const horizontalGap = 320
      const verticalGap = 140

      // Reassign nodes array to trigger Vue reactivity
      this.nodes = this.nodes.map(node => {
        const depth = layers[node.id] ?? 0
        const layerGroup = layerGroups[depth]
        const index = layerGroup.indexOf(node.id)
        const totalHeight = (layerGroup.length - 1) * verticalGap
        const startY = -totalHeight / 2
        return {
          ...node,
          x: depth * horizontalGap,
          y: startY + index * verticalGap,
        }
      })

      this.saveWorkflowState()
      this.zoomToFit()
    },

    showCheckpointPrompt(
      nodeName: string,
      progress: string,
    ): Promise<'resume' | 'restart'> {
      return new Promise(resolve => {
        this.checkpointPrompt = {
          active: true,
          nodeName,
          progress,
          resolve: (choice) => {
            this.checkpointPrompt = null
            resolve(choice)
          },
        }
      })
    },

  },
})
