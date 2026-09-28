<script setup lang="ts">
const props = withDefaults(defineProps<{ show?: boolean; status?: string }>(), {
  show: true,
  status: 'Initializing services...'
})
</script>

<template>
  <Transition name="terminal-fade">
    <div v-if="props.show" class="terminal-overlay">
      <div class="terminal-box">
        <!-- Bingkai Atas Terminal -->
        <div class="terminal-header">
          <div class="window-dots">
            <span class="dot red"></span>
            <span class="dot yellow"></span>
            <span class="dot green"></span>
          </div>
          <span class="title">flow_engine://viloox_core.sh</span>
        </div>

        <!-- Area Konten Utama -->
        <div class="terminal-body">

          <!-- 1. TEXT ASCII MINI BLOCK "FLOWFORGE" (FIXED & ACCURATE) -->
          <div class="brand-group">
            <pre class="ascii-art">
█▀▀ █░░ █▀█ █░█░█ █▀▀ █▀█ █▀█ █▀▀ █▀▀
█▀░ █▄▄ █▄█ ▀▄▀▄▀ █▀░ █▄█ █▀▄ █▄█ ██▄
            </pre>
            <div class="sub-brand">SYSTEM ARCHITECTURE // VILOOX</div>
          </div>

          <!-- 2. PANGGUNG KUBUS 3D ISOMETRIK -->
          <div class="cube-stage">
            <div class="isometric-cube">
              <div class="face top"></div>
              <div class="face left"></div>
              <div class="face right"></div>
            </div>
            <div class="floor-shadow"></div>
          </div>

          <!-- 3. LOG BARIS PERINTAH TERMINAL -->
          <div class="console-log">
            <div class="loader-row">
              <span class="prompt">$</span>
              <span class="status-tag">status:</span>
              <span class="status-value">{{ props.status }}</span>
              <div class="ascii-spinner"></div>
            </div>
            <p class="console-sub">Matrix buffer allocation ... OK</p>
          </div>

        </div>
      </div>
    </div>
  </Transition>
</template>

<style scoped>
/* Kontainer Utama Gelap */
.terminal-overlay {
  position: absolute;
  top: var(--titlebar-height, 0px);
  left: 0;
  right: 0;
  bottom: 0;
  background: #040406;
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
  z-index: 9999;
}

:global(html.is-electron) .terminal-overlay {
  border-radius: 0 0 12px 12px;
}

/* Kotak Jendela Terminal */
.terminal-box {
  width: 100%;
  max-width: 440px;
  background: #0a0b0e;
  border: 1px solid #1a1d26;
  border-radius: 12px;
  box-shadow: 0 30px 60px -15px rgba(0, 0, 0, 0.8);
  overflow: hidden;
  font-family: 'Courier New', Courier, monospace;
}

/* Bagian Header Jendela */
.terminal-header {
  background: #11131a;
  padding: 12px 16px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  border-bottom: 1px solid #1a1d26;
}
.window-dots {
  display: flex;
  gap: 6px;
}
.dot { width: 8px; height: 8px; border-radius: 50%; }
.dot.red { background: #ef4444; }
.dot.yellow { background: #f59e0b; }
.dot.green { background: #10b981; }
.terminal-header .title {
  color: #4b5563;
  font-size: 11px;
  letter-spacing: 0.5px;
}

/* Tata Letak Konten Bertingkat */
.terminal-body {
  padding: 28px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 32px;
}

/* Grup Brand Utama */
.brand-group {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  width: 100%;
}

/* Gaya Teks ASCII FLOWFORGE Hijau Menyala */
.ascii-art {
  margin: 0;
  color: #10b981;
  font-size: 13px;
  font-weight: bold;
  line-height: 1.2;
  text-align: center;
  white-space: pre;
  pointer-events: none;
  text-shadow: 0 0 10px rgba(16, 185, 129, 0.6);
  letter-spacing: 1px;
}

/* Sub-text VILOOX */
.sub-brand {
  font-size: 9px;
  color: #059669;
  letter-spacing: 4px;
  font-weight: bold;
  text-transform: uppercase;
  opacity: 0.85;
}

/* 2. Logika Kubus Isometrik 3D */
.cube-stage {
  display: flex;
  flex-direction: column;
  align-items: center;
  position: relative;
  height: 70px;
  justify-content: flex-end;
}

.isometric-cube {
  position: relative;
  width: 40px;
  height: 40px;
  transform: rotateX(60deg) rotateZ(45deg);
  transform-style: preserve-3d;
  animation: float-cube 1.3s ease-in-out infinite alternate;
  margin-bottom: 20px;
}

.face {
  position: absolute;
  width: 40px;
  height: 40px;
}

/* Warna Hijau Terminal pada Kubus */
.top {
  background: #10b981;
  transform: translateZ(20px);
  box-shadow: inset 0 0 10px rgba(255, 255, 255, 0.4);
}
.left {
  background: #059669;
  transform: rotateY(90deg) translateZ(-20px);
  transform-origin: left;
}
.right {
  background: #047857;
  transform: rotateX(90deg) translateZ(20px);
  transform-origin: bottom;
}

/* Bayangan Bawah Kubus */
.floor-shadow {
  width: 28px;
  height: 7px;
  background: rgba(0, 0, 0, 0.7);
  border-radius: 50%;
  filter: blur(4px);
  position: absolute;
  bottom: 20px;
  animation: shadow-scale 1.3s ease-in-out infinite alternate;
}

/* 3. Gaya Area Cetak Log */
.console-log {
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 6px;
  background: #050608;
  padding: 12px 16px;
  border-radius: 8px;
  border: 1px solid #12141c;
}

.loader-row {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  font-size: 12px;
}

.prompt { color: #4b5563; }
.status-tag { color: #71717a; }
.status-value {
  color: #10b981;
  font-weight: bold;
  text-shadow: 0 0 6px rgba(16, 185, 129, 0.4);
}

/* Animasi Spinner Karakter Konsol */
.ascii-spinner {
  color: #10b981;
  font-weight: bold;
}
.ascii-spinner::after {
  content: "/";
  animation: ascii-spin 0.6s step-start infinite;
}

.console-sub {
  margin: 0;
  font-size: 11px;
  color: #3f3f46;
}

/* Logika Animasi */
@keyframes float-cube {
  0% { transform: rotateX(60deg) rotateZ(45deg) translateZ(0px); }
  100% { transform: rotateX(60deg) rotateZ(45deg) translateZ(16px); }
}

@keyframes shadow-scale {
  0% { transform: scale(1.2); opacity: 0.8; }
  100% { transform: scale(0.8); opacity: 0.2; }
}

@keyframes ascii-spin {
  0% { content: "/"; }
  25% { content: "-"; }
  50% { content: "\\"; }
  75% { content: "|"; }
}

/* Efek Keluar Halus */
.terminal-fade-leave-active {
  transition: opacity 0.4s ease, transform 0.4s cubic-bezier(0.16, 1, 0.3, 1);
}
.terminal-fade-leave-to {
  opacity: 0;
  transform: scale(0.96) translateY(-4px);
}
</style>
