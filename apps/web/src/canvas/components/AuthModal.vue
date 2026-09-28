<script setup lang="ts">
import { ref } from 'vue'
import { useAuthStore } from '../stores/auth.store'
import { LogIn, UserPlus, ShieldCheck, AlertCircle, Loader2, X, Eye, EyeOff } from 'lucide-vue-next'

const authStore = useAuthStore()

const isRegisterMode = ref(false)
const email = ref('')
const password = ref('')
const confirmPassword = ref('')
const accessCode = ref('')
const localError = ref('')
const showPassword = ref(false)
const showConfirmPassword = ref(false)

function switchMode(register: boolean) {
  isRegisterMode.value = register
  localError.value = ''
  authStore.errorMessage = ''
}

async function handleSubmit() {
  localError.value = ''
  authStore.errorMessage = ''

  if (!email.value.trim()) {
    localError.value = 'Email is required.'
    return
  }
  if (!password.value) {
    localError.value = 'Password is required.'
    return
  }

  if (isRegisterMode.value) {
    if (password.value !== confirmPassword.value) {
      localError.value = 'Password confirmation does not match.'
      return
    }
    if (!accessCode.value.trim()) {
      localError.value = 'Access code is required to register.'
      return
    }
    try {
      await authStore.register(email.value, password.value, accessCode.value.trim())
    } catch {}
  } else {
    try {
      await authStore.login(email.value, password.value)
    } catch {}
  }
}
</script>


<template>
  <div v-if="authStore.authModalOpen" class="auth-overlay" @wheel.stop>
    <div class="auth-card">
      <div class="terminal-header">
        <div class="window-dots">
          <span class="dot red"></span>
          <span class="dot yellow"></span>
          <span class="dot green"></span>
        </div>
        <span class="terminal-title">auth://flowforge_secure.sh</span>
      </div>
      
      <div class="auth-content-wrapper">
        <div class="auth-header">
          <div class="logo-wrapper">
            <ShieldCheck :size="28" class="logo-icon" />
          </div>
          <h2>FlowForge Account</h2>
          <p class="auth-sub">
            Sync workflows and settings across browser & AppImage
          </p>
        </div>

        <!-- Mode Tabs -->
        <div class="auth-tabs">
          <button
            type="button"
            class="tab-btn"
            :class="{ active: !isRegisterMode }"
            @click="switchMode(false)"
          >
            <LogIn :size="15" />
            <span>Login</span>
          </button>
          <button
            type="button"
            class="tab-btn"
            :class="{ active: isRegisterMode }"
            @click="switchMode(true)"
          >
            <UserPlus :size="15" />
            <span>Register</span>
          </button>
        </div>

        <!-- Form -->
        <form class="auth-form" @submit.prevent="handleSubmit">
          <div v-if="authStore.errorMessage || localError" class="error-banner">
            <AlertCircle :size="16" class="error-icon" />
            <span>{{ localError || authStore.errorMessage }}</span>
          </div>

          <div class="input-group">
            <label>Email</label>
            <input
              v-model="email"
              type="email"
              placeholder="name@gmail.com or @proton.me"
              autocomplete="email"
              required
            />
            <span class="hint-text">Gmail & ProtonMail only</span>
          </div>

          <div class="input-group">
            <label>Password</label>
            <div class="password-input-wrap">
              <input
                v-model="password"
                :type="showPassword ? 'text' : 'password'"
                placeholder="Minimum 6 characters"
                autocomplete="current-password"
                required
              />
              <button type="button" class="eye-btn" @click="showPassword = !showPassword">
                <EyeOff v-if="showPassword" :size="15" />
                <Eye v-else :size="15" />
              </button>
            </div>
          </div>

          <div v-if="isRegisterMode" class="input-group">
            <label>Confirm Password</label>
            <div class="password-input-wrap">
              <input
                v-model="confirmPassword"
                :type="showConfirmPassword ? 'text' : 'password'"
                placeholder="Repeat password"
                autocomplete="new-password"
                required
              />
              <button type="button" class="eye-btn" @click="showConfirmPassword = !showConfirmPassword">
                <EyeOff v-if="showConfirmPassword" :size="15" />
                <Eye v-else :size="15" />
              </button>
            </div>
          </div>

          <div v-if="isRegisterMode" class="input-group">
            <label>Access Code</label>
            <input
              v-model="accessCode"
              type="text"
              placeholder="Enter your one-time access code"
              required
            />
          </div>

          <button
            type="submit"
            class="submit-btn"
            :disabled="authStore.loading"
          >
            <Loader2 v-if="authStore.loading" :size="18" class="spin" />
            <span v-else>{{ isRegisterMode ? 'Create Account' : 'Login to FlowForge' }}</span>
          </button>
        </form>

        <div class="auth-footer">
          <span>Secure with Google Firebase</span>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.auth-overlay {
  position: fixed;
  top: var(--titlebar-height, 40px);
  left: 0;
  right: 0;
  bottom: 0;
  background: #0a0b0e;
  display: flex;
  align-items: flex-start;
  justify-content: center;
  z-index: 90000;
  animation: fadeIn 0.2s ease;
  overflow-y: auto;
  padding: 40px 20px;
}

.auth-card {
  margin: auto;
  position: relative;
  width: 100%;
  max-width: 440px;
  background: #0e1017;
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 12px;
  box-shadow: 0 20px 40px rgba(0, 0, 0, 0.6);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.modal-titlebar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 16px;
  background: #151822;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
}

.modal-titlebar span {
  font-size: 11px;
  font-weight: 600;
  color: #94a3b8;
  letter-spacing: 0.05em;
  text-transform: uppercase;
}

.close-btn {
  background: transparent;
  border: none;
  color: #64748b;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 4px;
  border-radius: 6px;
  transition: all 0.15s ease;
}

.close-btn:hover {
  background: rgba(255, 255, 255, 0.1);
  color: #fff;
}

.auth-content-wrapper {
  padding: 24px 28px 32px;
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.auth-header {
  text-align: center;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.logo-wrapper {
  width: 48px;
  height: 48px;
  border-radius: 12px;
  background: linear-gradient(135deg, rgba(255,255,255,0.1), rgba(255,255,255,0.02));
  border: 1px solid rgba(255, 255, 255, 0.15);
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 12px;
}

.logo-icon {
  color: #60a5fa;
}

.auth-header h2 {
  font-size: 20px;
  font-weight: 700;
  color: #fff;
  margin: 0;
  letter-spacing: -0.02em;
}

.auth-sub {
  font-size: 12px;
  color: #94a3b8;
  margin-top: 6px;
  line-height: 1.4;
}

.auth-tabs {
  display: flex;
  gap: 4px;
  background: #0f1117;
  border: 1px solid rgba(255,255,255,0.07);
  border-radius: 12px;
  padding: 4px;
}

.tab-btn {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 7px;
  padding: 9px 16px;
  background: transparent;
  border: none;
  color: #64748b;
  font-size: 13px;
  font-weight: 600;
  border-radius: 9px;
  cursor: pointer;
  transition: all 0.15s;
}

.tab-btn:hover {
  color: #cbd5e1;
}

.tab-btn.active {
  background: #1e293b;
  color: #fff;
  border: none;
  box-shadow: none;
}

.auth-form {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.error-banner {
  background: rgba(239, 68, 68, 0.12);
  border: 1px solid rgba(239, 68, 68, 0.3);
  color: #f87171;
  padding: 10px 14px;
  border-radius: 8px;
  font-size: 12px;
  display: flex;
  align-items: center;
  gap: 10px;
}

.error-icon {
  flex-shrink: 0;
}

.input-group {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.input-group label {
  font-size: 12px;
  font-weight: 600;
  color: #cbd5e1;
}

.input-group input {
  height: 40px;
  background: #151822;
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 8px;
  padding: 0 14px;
  color: #fff;
  font-size: 13px;
  outline: none;
  transition: all 0.15s ease;
}

.input-group input:focus {
  border-color: #3b82f6;
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.2);
}

.hint-text {
  font-size: 11px;
  color: #64748b;
}

.password-input-wrap {
  position: relative;
  display: flex;
  align-items: center;
}

.password-input-wrap input {
  width: 100%;
  padding-right: 40px;
}

.eye-btn {
  position: absolute;
  right: 12px;
  background: transparent;
  border: none;
  color: #64748b;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 4px;
  border-radius: 4px;
  transition: color 0.15s;
}

.eye-btn:hover {
  color: #94a3b8;
}

.submit-btn {
  margin-top: 6px;
  height: 42px;
  background: rgba(37,99,235,0.12);
  border: 1px solid rgba(37,99,235,0.35);
  border-radius: 8px;
  color: #60a5fa;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  transition: all 0.15s ease;
}

.submit-btn:hover:not(:disabled) {
  background: rgba(37,99,235,0.2);
  border-color: rgba(37,99,235,0.6);
  color: #93c5fd;
  transform: translateY(-1px);
}

.submit-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.auth-footer {
  text-align: center;
  font-size: 11px;
  color: #64748b;
  border-top: 1px solid rgba(255, 255, 255, 0.05);
  padding-top: 14px;
}

.terminal-header {
  height: 38px;
  background: #11141c;
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
  display: flex;
  align-items: center;
  padding: 0 16px;
  position: relative;
}
.window-dots {
  display: flex;
  gap: 8px;
}
.dot {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  opacity: 0.8;
  border: none;
  padding: 0;
  margin: 0;
}
button.dot {
  cursor: pointer;
}
button.dot:hover {
  opacity: 1;
}
.dot.red { background: #ff5f56; }
.dot.yellow { background: #ffbd2e; }
.dot.green { background: #27c93f; }

.terminal-title {
  position: absolute;
  right: 16px;
  font-size: 11px;
  font-family: 'SF Mono', 'Fira Code', 'Fira Mono', 'Roboto Mono', monospace;
  color: #64748b;
  letter-spacing: 0.03em;
  pointer-events: none;
  user-select: none;
}

.spin {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

@keyframes fadeIn {
  from { opacity: 0; transform: scale(0.98); }
  to { opacity: 1; transform: scale(1); }
}

.auth-overlay {
  scrollbar-width: thin;
  scrollbar-color: transparent transparent;
}
.auth-overlay:hover {
  scrollbar-color: rgba(255, 255, 255, 0.1) transparent;
}
.auth-overlay::-webkit-scrollbar { width: 6px; }
.auth-overlay::-webkit-scrollbar-track { background: transparent; }
.auth-overlay::-webkit-scrollbar-thumb { background: transparent; border-radius: 3px; }
.auth-overlay:hover::-webkit-scrollbar-thumb { background: rgba(255, 255, 255, 0.1); }
.auth-overlay::-webkit-scrollbar-thumb:hover { background: rgba(255, 255, 255, 0.2) !important; }

/* Light mode for auth-overlay scrollbar */
body.light-mode .auth-overlay:hover {
  scrollbar-color: rgba(0, 0, 0, 0.15) transparent;
}
body.light-mode .auth-overlay:hover::-webkit-scrollbar-thumb { background: rgba(0, 0, 0, 0.15); }
body.light-mode .auth-overlay::-webkit-scrollbar-thumb:hover { background: rgba(0, 0, 0, 0.25) !important; }
</style>
