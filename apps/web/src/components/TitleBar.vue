<template>
  <div class="title-bar">
    <div class="traffic-lights">
      <button class="traffic-light close" @click="closeWindow"></button>
      <button class="traffic-light minimize" @click="minimizeWindow"></button>
      <button class="traffic-light maximize" @click="maximizeWindow"></button>
    </div>
    <button v-if="isElectron" class="devtools-btn" @click="openDevTools"></button>
    <div class="title">FlowForge</div>
  </div>
</template>

<script setup lang="ts">
import { onMounted } from 'vue'

const isElectron = !!(window as any).electronAPI

onMounted(() => {
  document.documentElement.style.setProperty('--titlebar-height', '40px')
})

const minimizeWindow = () => window.electronAPI?.minimizeWindow()
const maximizeWindow = () => window.electronAPI?.maximizeWindow()
const closeWindow = () => window.electronAPI?.closeWindow()
const openDevTools = () => window.electronAPI?.openDevTools()
</script>

<style scoped>
.title-bar {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 40px;
  background: #11131a;
  border-bottom: 1px solid #1a1d26;
  z-index: 99999;
  display: flex;
  align-items: center;
  -webkit-app-region: drag;
  border-radius: 12px 12px 0 0;
}

.traffic-lights {
  display: flex;
  align-items: center;
  margin-left: 16px;
  gap: 8px;
}

.traffic-light {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  border: none;
  cursor: pointer;
  -webkit-app-region: no-drag;
  position: relative;
}

.traffic-light::before {
  content: '';
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  color: transparent;
  font-size: 10px;
}

.traffic-light:hover::before {
  color: #000;
}

.close {
  background: #ef4444;
}
.close::before {
  content: '✕';
}

.minimize {
  background: #f59e0b;
}
.minimize::before {
  content: '−';
}

.maximize {
  background: #10b981;
}
.maximize::before {
  content: '⤢';
}

.title {
  position: absolute;
  left: 50%;
  top: 50%;
  transform: translate(-50%, -50%);
  color: #4b5563;
  font-size: 11px;
  letter-spacing: 0.5px;
  pointer-events: none;
  -webkit-app-region: no-drag;
}

.devtools-btn {
  position: absolute;
  right: 12px;
  width: 24px;
  height: 24px;
  background: transparent;
  border: none;
  color: #ffffff;
  opacity: 0.3;
  font-size: 12px;
  cursor: pointer;
  -webkit-app-region: no-drag;
  display: flex;
  align-items: center;
  justify-content: center;
}

.devtools-btn:hover {
  opacity: 0.7;
}

.devtools-btn::before {
  content: '</>';
}
</style>
