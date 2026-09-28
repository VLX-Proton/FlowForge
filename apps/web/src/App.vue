<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import LoadingOverlay from './components/LoadingOverlay.vue'
import CanvasRoot from './canvas/components/CanvasRoot.vue'
import TitleBar from './components/TitleBar.vue'
import { useCanvasStore } from './canvas/stores/canvas.store'

const ready = ref(false)
const error = ref<string | null>(null)
const backendOnline = ref(true)
const reconnectStatus = ref('Initializing services...')
const MIN_LOADING_MS = 10000
const REFRESH_LOADING_MS = 5000
const MAX_WAIT_MS = 300000
const startTime = Date.now()

function getIsRefresh(): boolean {
  if (typeof sessionStorage === 'undefined') return false
  try {
    const navEntry = performance.getEntriesByType('navigation').find(e => e.name === document.location.href)
    if (navEntry && (navEntry as PerformanceNavigationTiming).type === 'reload') {
      return true
    }
    return sessionStorage.getItem('ff-refresh') === 'true'
  } catch {
    return false
  }
}

async function checkHealth(): Promise<boolean> {
  if (!ready.value && Date.now() - startTime > MAX_WAIT_MS) {
    error.value = 'Backend did not become ready within 5 minutes. Check runtime server and port 4000.'
    return false
  }

  try {
    const res = await fetch('/api/health')
    return res.ok
  } catch {
    return false
  }
}

async function logHealthEvent(event: 'disconnected' | 'reconnected'): Promise<void> {
  try {
    await fetch('/api/health/log', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ event }),
    })
  } catch {
    // ignore log failures
  }
}

onMounted(() => {
  // Apply light mode globally ASAP if saved
  if (localStorage.getItem('flowforge-theme') === 'light') {
    document.body.classList.add('light-mode')
    document.documentElement.classList.add('light-mode')
  }

  let reconnectShown = false

  if ((window as any).electronAPI) {
    document.documentElement.classList.add('is-electron')

    const canvasStore = useCanvasStore()

    const refitAfterResize = () => {
      // Wait two frames so the layout fully reflows before recalculating
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          canvasStore.zoomToFit()
        })
      })
    }

    ;(window as any).electronAPI.onMaximized?.(() => {
      document.documentElement.classList.add('is-maximized')
      refitAfterResize()
    })

    ;(window as any).electronAPI.onUnmaximized?.(() => {
      document.documentElement.classList.remove('is-maximized')
      refitAfterResize()
    })
  }

  const startupInterval = setInterval(async () => {
    if (error.value) {
      clearInterval(startupInterval)
      return
    }

    const isHealthy = await checkHealth()
    if (isHealthy) {
      const elapsed = Date.now() - startTime
      const minLoading = getIsRefresh() ? REFRESH_LOADING_MS : MIN_LOADING_MS
      if (elapsed < minLoading) {
        await new Promise(resolve => setTimeout(resolve, minLoading - elapsed))
      }
      ready.value = true
      clearInterval(startupInterval)

      const heartbeat = setInterval(async () => {
        if (await checkHealth()) {
          if (reconnectShown) {
            await logHealthEvent('reconnected')
            reconnectStatus.value = 'Connection restored.'
            await new Promise(resolve => setTimeout(resolve, 1000))
            reconnectStatus.value = 'Initializing services...'
            backendOnline.value = true
            reconnectShown = false
          }
        } else {
          if (!reconnectShown) {
            backendOnline.value = false
            reconnectStatus.value = 'Connection lost. Reconnecting...'
            reconnectShown = true
            logHealthEvent('disconnected')
          }
        }
      }, 2000)

      ;(window as any).__ffHeartbeat = heartbeat
    }
  }, 500)
})

const showLoading = computed(() => !ready.value || !backendOnline.value)
const isElectron = computed(() => !!(window as any).electronAPI)
</script>

<template>
<div id="app-wrapper" :class="{ 'is-electron': isElectron }">
    <TitleBar v-if="isElectron" />
    <div id="app-content">
      <LoadingOverlay v-if="showLoading && !error" :status="reconnectStatus" />
      <div v-else-if="error" class="error-state">
        <div class="error-content">
          <div class="error-title">Unable to start FlowForge</div>
          <div class="error-message">{{ error }}</div>
          <div class="error-hint">Check runtime server, port 4000, and startup logs</div>
        </div>
      </div>
      <CanvasRoot v-else />
    </div>
  </div>
</template>

<style>
html,
body {
  width: 100%;
  height: 100%;
  margin: 0;
  padding: 0;
  overflow: hidden;
  background: transparent;
}

#app {
  width: 100%;
  height: 100%;
  overflow: hidden;
  background: transparent;
}

#app-wrapper {
  width: 100%;
  height: 100%;
  position: relative;
  overflow: hidden;
  background: #0a0b0e;
  box-sizing: border-box;
  border-radius: 12px;
  isolation: isolate;
  transform: translateZ(0);
}

.error-state {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: #0a0a0a;
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 9999;
}

.error-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  text-align: center;
}

.error-title {
  font-size: 20px;
  font-weight: 600;
  color: #ef4444;
}

.error-message {
  font-size: 13px;
  color: #aaa;
}

.error-hint {
  font-size: 12px;
  color: #666;
  margin-top: 8px;
}

html.is-electron #app-wrapper {
  border: 1px solid #1a1d26;
  border-radius: 12px;
}

html.is-electron.is-maximized #app-wrapper {
  border-radius: 0;
  border: none;
}

html.is-electron.is-maximized .title-bar {
  border-radius: 0 !important;
}
</style>