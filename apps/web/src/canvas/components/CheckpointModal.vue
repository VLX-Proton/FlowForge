<script setup lang="ts">
import { useCanvasStore } from '../stores/canvas.store'

const store = useCanvasStore()
</script>

<template>
  <div v-if="store.checkpointPrompt?.active" class="checkpoint-modal-overlay">
    <div class="checkpoint-modal">
      <div class="modal-header">
        <h3>Proses Terhenti Ditemukan</h3>
      </div>
      
      <div class="modal-body">
        <p>
          Sebelumnya proses <strong>{{ store.checkpointPrompt.nodeName }}</strong> 
          terhenti pada gambar <strong>{{ store.checkpointPrompt.progress }}</strong>.
        </p>
        <p>Apakah Anda ingin melanjutkannya atau mengulang dari awal?</p>
      </div>

      <div class="modal-actions">
        <button 
          class="action-btn restart-btn"
          @click="store.checkpointPrompt?.resolve('restart')"
        >
          Hapus & Ulang
        </button>
        <button 
          class="action-btn resume-btn"
          @click="store.checkpointPrompt?.resolve('resume')"
        >
          Lanjutkan Proses
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.checkpoint-modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.7);
  backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 9999;
}

.checkpoint-modal {
  background: #1e1e1e;
  border: 1px solid #333;
  border-radius: 12px;
  width: 400px;
  max-width: 90vw;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.5);
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.modal-header {
  padding: 16px 20px;
  border-bottom: 1px solid #333;
}

.modal-header h3 {
  margin: 0;
  color: #fff;
  font-size: 16px;
  font-weight: 600;
}

.modal-body {
  padding: 20px;
  color: #aaa;
  font-size: 14px;
  line-height: 1.5;
}

.modal-body strong {
  color: #fff;
}

.modal-body p {
  margin-top: 0;
  margin-bottom: 12px;
}

.modal-body p:last-child {
  margin-bottom: 0;
}

.modal-actions {
  padding: 16px 20px;
  background: #151515;
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  border-top: 1px solid #333;
}

.action-btn {
  padding: 8px 16px;
  border-radius: 6px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
  border: none;
  outline: none;
}

.restart-btn {
  background: transparent;
  color: #ef4444;
  border: 1px solid rgba(239, 68, 68, 0.3);
}

.restart-btn:hover {
  background: rgba(239, 68, 68, 0.1);
  border-color: #ef4444;
}

.resume-btn {
  background: #3b82f6;
  color: white;
}

.resume-btn:hover {
  background: #2563eb;
}
</style>
