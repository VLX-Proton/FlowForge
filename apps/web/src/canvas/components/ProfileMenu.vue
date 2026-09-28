<script setup lang="ts">
import { ref, onMounted, watch, computed, onUnmounted } from 'vue'
import { Settings, X, Plus, Trash2, User, LogOut, Loader2, Camera, ChevronRight, ArrowLeft, KeyRound, Eye, EyeOff } from 'lucide-vue-next'
import { useAuthStore } from '../stores/auth.store'
import { useCanvasStore } from '../stores/canvas.store'
import { db, auth } from '../../firebase'
import { doc, getDoc, setDoc } from 'firebase/firestore'
import { updateProfile, updatePassword, updateEmail } from 'firebase/auth'

const authStore = useAuthStore()
const canvasStore = useCanvasStore()

type Provider = 'gemini' | 'openrouter' | 'mistral'

const geminiKeys = ref<string[]>([])
const openrouterKeys = ref<string[]>([])
const mistralKeys = ref<string[]>([])
const newGeminiKey = ref('')
const newOpenrouterKey = ref('')
const newMistralKey = ref('')
const showNewGeminiKey = ref(false)
const showNewOpenrouterKey = ref(false)
const showNewMistralKey = ref(false)
const revealedKeys = ref<Set<string>>(new Set())

function toggleRevealedKey(provider: string, index: number) {
  const id = `${provider}-${index}`
  if (revealedKeys.value.has(id)) revealedKeys.value.delete(id)
  else revealedKeys.value.add(id)
}
const loading = ref(false)
const isOpen = ref(false)

// 'main' = popup, 'settings' = full-page settings
const view = ref<'main' | 'settings'>('main')
// settings tab
const settingsTab = ref<'profile' | 'apikeys'>('profile')

import { Cropper } from 'vue-advanced-cropper'
import 'vue-advanced-cropper/dist/style.css'

// Profile edit state
const profilePassword = ref('')
const profileEmail = ref('')
const profileLoading = ref(false)
const profileMessage = ref('')
const isProfileError = ref(false)
const showPassword = ref(false)
const cloudAvatar = ref('')
const photoPreview = ref('')
const photoInputRef = ref<HTMLInputElement | null>(null)

// Cropper state
const showCropModal = ref(false)
const rawImageSrc = ref('')
const cropperRef = ref<any>(null)
const newAvatarBase64 = ref('')

// Light mode — applies globally to body
const lightMode = ref(localStorage.getItem('flowforge-theme') === 'light')
watch(lightMode, (val) => {
  document.body.classList.toggle('light-mode', val)
  document.documentElement.classList.toggle('light-mode', val)
  localStorage.setItem('flowforge-theme', val ? 'light' : 'dark')
}, { immediate: true })

const displayAvatar = computed(() => cloudAvatar.value || authStore.user?.photoURL || '')

watch(isOpen, (val) => {
  if (val) {
    view.value = 'main'
    canvasStore.popupNodeId = ''
    if (authStore.user) {
      profileEmail.value = authStore.user.email || ''
      photoPreview.value = displayAvatar.value
      profilePassword.value = ''
      profileMessage.value = ''
      newAvatarBase64.value = ''
    }
  }
})

onUnmounted(() => {})

watch(view, (val) => {
  if (val === 'settings') {
    settingsTab.value = 'profile'
    if (authStore.user) {
      profileEmail.value = authStore.user.email || ''
      photoPreview.value = displayAvatar.value
      profilePassword.value = ''
      profileMessage.value = ''
      newAvatarBase64.value = ''
    }
  }
})

function onPhotoChange(e: Event) {
  const target = e.target as HTMLInputElement
  const file = target.files?.[0]
  if (!file) return
  rawImageSrc.value = URL.createObjectURL(file)
  showCropModal.value = true
  target.value = '' // clear so same file can be picked again
}

function applyCrop() {
  if (!cropperRef.value) return
  const { canvas } = cropperRef.value.getResult()
  if (canvas) {
    // Resize cropped canvas to 120x120 for Firestore
    const MAX_SIZE = 120
    const finalCanvas = document.createElement('canvas')
    finalCanvas.width = MAX_SIZE
    finalCanvas.height = MAX_SIZE
    const ctx = finalCanvas.getContext('2d')
    ctx?.drawImage(canvas, 0, 0, MAX_SIZE, MAX_SIZE)
    const base64 = finalCanvas.toDataURL('image/jpeg', 0.8)
    
    photoPreview.value = base64
    newAvatarBase64.value = base64
    showCropModal.value = false
  }
}

async function saveProfile() {
  if (!authStore.user) return
  profileLoading.value = true
  profileMessage.value = ''
  isProfileError.value = false
  try {
    let newPhotoURL = authStore.user.photoURL || ''
    let isBase64Saved = false
    
    // Save base64 string to Firestore to avoid 1MB limit / Storage limits
    if (newAvatarBase64.value) {
      newPhotoURL = newAvatarBase64.value
      profileMessage.value = 'Saving photo to cloud...'
      await setDoc(doc(db, 'users', authStore.user.uid, 'settings', 'profile'), {
        photoBase64: newPhotoURL,
        updatedAt: new Date().toISOString()
      }, { merge: true })
      
      cloudAvatar.value = newPhotoURL
      isBase64Saved = true
    }

    // Only update auth profile photoURL if it's a regular url (not base64 to avoid auth limit)
    if (!isBase64Saved && newPhotoURL !== authStore.user.photoURL) {
      await updateProfile(authStore.user, { photoURL: newPhotoURL })
    }
    if (profileEmail.value && profileEmail.value !== authStore.user.email) {
      await updateEmail(authStore.user, profileEmail.value)
    }
    if (profilePassword.value) {
      await updatePassword(authStore.user, profilePassword.value)
    }
    profileMessage.value = 'Profile updated successfully!'
    profilePassword.value = ''
    newAvatarBase64.value = ''
  } catch (e: any) {
    isProfileError.value = true
    if (e.code === 'auth/requires-recent-login') {
      profileMessage.value = 'Please logout and log back in to change this.'
    } else {
      profileMessage.value = e.message || 'An error occurred.'
    }
  } finally {
    profileLoading.value = false
  }
}

async function fetchKeys(provider: Provider) {
  loading.value = true
  try {
    const res = await fetch(`/api/keys/${provider}`)
    const data = await res.json()
    const list = provider === 'gemini' ? geminiKeys : provider === 'openrouter' ? openrouterKeys : mistralKeys
    list.value = data.keys || []
  } catch (e) {
    console.error(`Failed to load ${provider} keys:`, e)
  } finally {
    loading.value = false
  }
}

async function syncKeysToCloud() {
  const currentUser = auth.currentUser
  if (!currentUser) return
  try {
    await setDoc(doc(db, 'users', currentUser.uid, 'settings', 'api_keys'), {
      gemini: geminiKeys.value,
      openrouter: openrouterKeys.value,
      mistral: mistralKeys.value,
      updatedAt: new Date().toISOString()
    }, { merge: true })
  } catch (e) {
    console.warn('[CLOUD SYNC] Failed to save keys to cloud:', e)
  }
}

async function restoreKeysFromCloud() {
  const currentUser = auth.currentUser
  if (!currentUser) return
  try {
    // Fetch profile (for avatar)
    const profileSnap = await getDoc(doc(db, 'users', currentUser.uid, 'settings', 'profile'))
    if (profileSnap.exists() && profileSnap.data().photoBase64) {
      cloudAvatar.value = profileSnap.data().photoBase64
    }

    const snap = await getDoc(doc(db, 'users', currentUser.uid, 'settings', 'api_keys'))
    if (snap.exists()) {
      const data = snap.data()
      for (const provider of ['gemini', 'openrouter', 'mistral'] as Provider[]) {
        const cloudList: string[] = data[provider] || []
        const currentList = keyMap[provider].value
        for (const k of cloudList) {
          if (!currentList.includes(k)) {
            await fetch(`/api/keys/${provider}`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ apiKey: k })
            })
          }
        }
      }
      await fetchKeys('gemini')
      await fetchKeys('openrouter')
      await fetchKeys('mistral')
    } else {
      await syncKeysToCloud()
    }
  } catch (e) {
    console.warn('[CLOUD SYNC] Failed to load keys from cloud:', e)
  }
}

watch(() => authStore.user, async (newUser) => {
  if (newUser) {
    await restoreKeysFromCloud()
    await canvasStore.restorePersistedWorkflow()
  }
})

onMounted(async () => {
  await fetchKeys('gemini')
  await fetchKeys('openrouter')
  await fetchKeys('mistral')
  if (authStore.user) {
    await restoreKeysFromCloud()
  }
})

const keyMap = { gemini: geminiKeys, openrouter: openrouterKeys, mistral: mistralKeys }
const newKeyMap = { gemini: newGeminiKey, openrouter: newOpenrouterKey, mistral: newMistralKey }

async function addKey(provider: Provider) {
  const trimmed = newKeyMap[provider].value.trim()
  if (!trimmed) return
  loading.value = true
  try {
    const res = await fetch(`/api/keys/${provider}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ apiKey: trimmed })
    })
    if (res.ok) {
      keyMap[provider].value = [...keyMap[provider].value, trimmed]
      newKeyMap[provider].value = ''
      await syncKeysToCloud()
    }
  } catch (e) {
    console.error(`Failed to add ${provider} key:`, e)
  } finally {
    loading.value = false
  }
}

async function removeKey(provider: Provider, index: number) {
  loading.value = true
  try {
    const res = await fetch(`/api/keys/${provider}/${index}`, { method: 'DELETE' })
    if (res.ok) {
      keyMap[provider].value = keyMap[provider].value.filter((_, i) => i !== index)
      await syncKeysToCloud()
    }
  } catch (e) {
    console.error(`Failed to remove ${provider} key:`, e)
  } finally {
    loading.value = false
  }
}

function maskKey(key: string) {
  if (key.length <= 8) return '****'
  return key.substring(0, 4) + '...' + key.substring(key.length - 4)
}

const showLogoutConfirm = ref(false)

async function handleLogout() {
  await authStore.logout()
  isOpen.value = false
  showLogoutConfirm.value = false
  canvasStore.popupNodeId = ''
}

const showDeleteConfirm = ref(false)
const deleteLoading = ref(false)
const deleteError = ref('')

async function deleteAccount() {
  if (!auth.currentUser) return
  deleteLoading.value = true
  deleteError.value = ''
  try {
    await auth.currentUser.delete()
    await authStore.logout()
    isOpen.value = false
  } catch (e: any) {
    if (e.code === 'auth/requires-recent-login') {
      deleteError.value = 'Security requires you to re-login before deleting your account.'
    } else {
      deleteError.value = e.message || 'Failed to delete account.'
    }
  } finally {
    deleteLoading.value = false
  }
}

function toggleOpen() {
  isOpen.value = !isOpen.value
}
</script>

<template>
  <div class="pm-wrapper">
    <!-- Hidden file input -->
    <input ref="photoInputRef" type="file" accept="image/*" style="display:none" @change="onPhotoChange" />

    <!-- Profile/User trigger button -->
    <button v-if="authStore.user" class="trigger-btn" @click.stop="toggleOpen" title="Profile">
      <img v-if="displayAvatar" :src="displayAvatar" alt="Profile" class="trigger-photo" />
      <User v-else :size="19" />
    </button>

    <!-- ===== POPUP (main) ===== -->
    <aside v-if="isOpen && view === 'main'" :class="['popup', { 'light': lightMode }]" @mousedown.stop @wheel.stop>

      <!-- Popup header matching AddNodeSidebar -->
      <div class="popup-header">
        <h3>Account</h3>
      </div>

      <!-- User section -->
      <div class="popup-content">
        <div v-if="authStore.user">
          <div class="popup-avatar-row">
            <div class="popup-avatar">
              <img v-if="displayAvatar" :src="displayAvatar" alt="Profile" class="popup-avatar-img" />
              <User v-else :size="18" />
            </div>
            <div class="popup-user-info">
              <span class="popup-user-label">Connected Account</span>
              <span class="popup-user-email" :title="authStore.userEmail">{{ authStore.userEmail }}</span>
            </div>
          </div>

          <!-- Settings button below profile -->
          <button class="popup-settings-btn" @click="view = 'settings'">
            <Settings :size="15" />
            <span>Account Settings</span>
            <ChevronRight :size="14" class="chevron" />
          </button>

          <!-- Light/Dark mode toggle -->
          <button class="popup-settings-btn" style="margin-top: 8px" @click="lightMode = !lightMode">
            <svg v-if="lightMode" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>
            <svg v-else width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="4"/><line x1="12" y1="2" x2="12" y2="4"/><line x1="12" y1="20" x2="12" y2="22"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="2" y1="12" x2="4" y2="12"/><line x1="20" y1="12" x2="22" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>
            <span>{{ lightMode ? 'Dark Mode' : 'Light Mode' }}</span>
          </button>

          <!-- Logout -->
          <div class="popup-divider"></div>
          <div v-if="!showLogoutConfirm">
            <button class="popup-logout-btn" @click="showLogoutConfirm = true">
              <LogOut :size="15" />
              <span>Logout</span>
            </button>
          </div>
          <div v-else class="logout-confirm">
            <p class="logout-confirm-text">Are you sure you want to logout?</p>
            <div class="logout-confirm-actions">
              <button class="logout-cancel-btn" @click="showLogoutConfirm = false">Cancel</button>
              <button class="popup-logout-btn logout-confirm-btn" @click="handleLogout">
                <LogOut :size="13" />
                Logout
              </button>
            </div>
          </div>
        </div>

        <!-- Not logged in -->
        <div v-else class="popup-guest">
          <div class="guest-avatar"><User :size="22" /></div>
          <p class="guest-text">You are not logged in</p>
          <button class="popup-login-btn" @click="authStore.openModal(); isOpen = false">
            Login / Register
          </button>
        </div>
      </div>
    </aside>

    <!-- ===== FULL PAGE SETTINGS ===== -->
    <div v-if="isOpen && view === 'settings'" class="full-page" @mousedown.stop @wheel.stop>
      <!-- Header -->
      <div class="fp-header">
        <button class="fp-back-btn" @click="view = 'main'">
          <ArrowLeft :size="15" />
          Back
        </button>
        <h2 class="fp-title">Settings</h2>
        <span v-if="authStore.user" class="sync-badge">Cloud Sync</span>
        <button class="fp-close-btn" @click="isOpen = false"><X :size="18" /></button>
      </div>

      <!-- Centered content with tab nav -->
      <div class="fp-body">
        <div class="fp-center">
          <!-- Tab navigation -->
          <div class="fp-tabs">
            <button :class="['fp-tab', { active: settingsTab === 'profile' }]" @click="settingsTab = 'profile'">
              <User :size="15" />
              Profile
            </button>
            <button :class="['fp-tab', { active: settingsTab === 'apikeys' }]" @click="settingsTab = 'apikeys'">
              <KeyRound :size="15" />
              API Keys
            </button>
          </div>

          <!-- Profile Tab -->
          <div v-if="settingsTab === 'profile'" class="tab-content">
            <div class="section-label">Profile Photo</div>
            <div class="avatar-section">
              <div class="avatar-wrap" @click="photoInputRef?.click()" title="Click to choose photo from PC">
                <img v-if="photoPreview" :src="photoPreview" alt="Avatar" class="avatar-img" />
                <div v-else class="avatar-ph"><User :size="28" /></div>
                <div class="avatar-ov"><Camera :size="15" /></div>
              </div>
              <div class="avatar-hint">
                <span class="hint-title">Click to change photo</span>
                <span class="hint-sub">JPG, PNG, GIF up to 5MB</span>
              </div>
            </div>

            <!-- Crop Modal Overlay -->
            <div v-if="showCropModal" class="crop-modal">
              <div class="crop-modal-content">
                <div class="crop-header">
                  <h3>Adjust Photo</h3>
                  <button class="fp-close-btn" @click="showCropModal = false"><X :size="18" /></button>
                </div>
                <div class="crop-body">
                  <Cropper
                    ref="cropperRef"
                    :src="rawImageSrc"
                    :stencil-props="{ aspectRatio: 1 }"
                    class="my-cropper"
                  />
                </div>
                <div class="crop-footer">
                  <button class="del-cancel" @click="showCropModal = false">Cancel</button>
                  <button class="save-btn" style="margin:0; width:auto; align-self:stretch; flex:1" @click="applyCrop">Apply Crop</button>
                </div>
              </div>
            </div>

            <div class="section-label" style="margin-top:24px">Account Info</div>
            <div class="form-card">
              <div class="form-field">
                <label>Email Address</label>
                <input v-model="profileEmail" type="email" placeholder="name@gmail.com" />
              </div>
              <div class="form-field">
                <label>New Password</label>
                <div class="password-input-wrap">
                  <input v-model="profilePassword" :type="showPassword ? 'text' : 'password'" placeholder="Leave blank to keep current password" />
                  <button type="button" class="eye-btn" @click="showPassword = !showPassword">
                    <EyeOff v-if="showPassword" :size="15" />
                    <Eye v-else :size="15" />
                  </button>
                </div>
              </div>
              <p class="save-msg" :class="{ error: isProfileError }" v-if="profileMessage">{{ profileMessage }}</p>
              <button class="save-btn" @click="saveProfile" :disabled="profileLoading">
                <Loader2 v-if="profileLoading" :size="15" class="spin" />
                <span v-else>Save Changes</span>
              </button>
            </div>

            <div class="section-label" style="margin-top:32px; color: #ef4444">Danger Zone</div>
            <div class="form-card danger-card">
              <div class="danger-info">
                <h4>Delete Account</h4>
                <p>Permanently delete your account, workflows, and API keys. This action cannot be undone.</p>
              </div>
              <button v-if="!showDeleteConfirm" class="del-account-btn" @click="showDeleteConfirm = true">Delete Account</button>
              <div v-else class="delete-confirm">
                <p>Are you sure? This is permanent!</p>
                <div class="delete-actions">
                  <button class="del-cancel" @click="showDeleteConfirm = false">Cancel</button>
                  <button class="del-confirm" @click="deleteAccount" :disabled="deleteLoading">
                    <Loader2 v-if="deleteLoading" :size="15" class="spin" />
                    <span v-else>Yes, Delete My Account</span>
                  </button>
                </div>
                <p v-if="deleteError" class="delete-error-msg">{{ deleteError }}</p>
              </div>
            </div>
          </div>

          <!-- API Keys Tab -->
          <div v-if="settingsTab === 'apikeys'" class="tab-content">
            <div class="key-section">
              <div class="key-title-row">
                <span class="provider-badge gemini-badge">G</span>
                <h4>Gemini API Keys</h4>
              </div>
              <p class="key-help">Google AI Studio — Free quota available.</p>
              <div class="add-form existing-key-form" v-for="(key, i) in geminiKeys" :key="'g'+i" style="margin-bottom: 8px;">
                <div class="password-input-wrap" style="flex: 1">
                  <input :value="revealedKeys.has('gemini-'+i) ? key : maskKey(key)" type="text" readonly />
                  <button type="button" class="eye-btn" @click="toggleRevealedKey('gemini', i)" style="right: 8px">
                    <EyeOff v-if="revealedKeys.has('gemini-'+i)" :size="15" />
                    <Eye v-else :size="15" />
                  </button>
                </div>
                <button class="add-btn trash-btn" @click="removeKey('gemini', i)"><Trash2 :size="16" /></button>
              </div>

              <div class="add-form">
                <div class="password-input-wrap" style="flex: 1">
                  <input v-model="newGeminiKey" :type="showNewGeminiKey ? 'text' : 'password'" placeholder="Add Gemini API Key..." @keyup.enter="addKey('gemini')" />
                  <button type="button" class="eye-btn" @click="showNewGeminiKey = !showNewGeminiKey" style="right: 8px">
                    <EyeOff v-if="showNewGeminiKey" :size="15" />
                    <Eye v-else :size="15" />
                  </button>
                </div>
                <button class="add-btn" @click="addKey('gemini')" :disabled="!newGeminiKey.trim()"><Plus :size="16" /></button>
              </div>
            </div>

            <div class="key-section" style="margin-top:28px">
              <div class="key-title-row">
                <span class="provider-badge or-badge">OR</span>
                <h4>OpenRouter API Keys</h4>
              </div>
              <p class="key-help">Access multiple vision models via one key.</p>
              <div class="add-form existing-key-form" v-for="(key, i) in openrouterKeys" :key="'or'+i" style="margin-bottom: 8px;">
                <div class="password-input-wrap" style="flex: 1">
                  <input :value="revealedKeys.has('openrouter-'+i) ? key : maskKey(key)" type="text" readonly />
                  <button type="button" class="eye-btn" @click="toggleRevealedKey('openrouter', i)" style="right: 8px">
                    <EyeOff v-if="revealedKeys.has('openrouter-'+i)" :size="15" />
                    <Eye v-else :size="15" />
                  </button>
                </div>
                <button class="add-btn trash-btn" @click="removeKey('openrouter', i)"><Trash2 :size="16" /></button>
              </div>

              <div class="add-form">
                <div class="password-input-wrap" style="flex: 1">
                  <input v-model="newOpenrouterKey" :type="showNewOpenrouterKey ? 'text' : 'password'" placeholder="Add OpenRouter API Key..." @keyup.enter="addKey('openrouter')" />
                  <button type="button" class="eye-btn" @click="showNewOpenrouterKey = !showNewOpenrouterKey" style="right: 8px">
                    <EyeOff v-if="showNewOpenrouterKey" :size="15" />
                    <Eye v-else :size="15" />
                  </button>
                </div>
                <button class="add-btn" @click="addKey('openrouter')" :disabled="!newOpenrouterKey.trim()"><Plus :size="16" /></button>
              </div>
            </div>

            <div class="key-section" style="margin-top:28px">
              <div class="key-title-row">
                <span class="provider-badge mistral-badge">M</span>
                <h4>Mistral AI API Keys</h4>
              </div>
              <p class="key-help">Mistral Pixtral — Best open-source vision model.</p>
              <div class="add-form existing-key-form" v-for="(key, i) in mistralKeys" :key="'m'+i" style="margin-bottom: 8px;">
                <div class="password-input-wrap" style="flex: 1">
                  <input :value="revealedKeys.has('mistral-'+i) ? key : maskKey(key)" type="text" readonly />
                  <button type="button" class="eye-btn" @click="toggleRevealedKey('mistral', i)" style="right: 8px">
                    <EyeOff v-if="revealedKeys.has('mistral-'+i)" :size="15" />
                    <Eye v-else :size="15" />
                  </button>
                </div>
                <button class="add-btn trash-btn" @click="removeKey('mistral', i)"><Trash2 :size="16" /></button>
              </div>

              <div class="add-form">
                <div class="password-input-wrap" style="flex: 1">
                  <input v-model="newMistralKey" :type="showNewMistralKey ? 'text' : 'password'" placeholder="Add Mistral API Key..." @keyup.enter="addKey('mistral')" />
                  <button type="button" class="eye-btn" @click="showNewMistralKey = !showNewMistralKey" style="right: 8px">
                    <EyeOff v-if="showNewMistralKey" :size="15" />
                    <Eye v-else :size="15" />
                  </button>
                </div>
                <button class="add-btn" @click="addKey('mistral')" :disabled="!newMistralKey.trim()"><Plus :size="16" /></button>
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>

  </div>
</template>

<style scoped>
.pm-wrapper {
  position: absolute;
  inset: 0;
  pointer-events: none;
  z-index: 99999;
}

/* ---- Trigger button (User icon, circular) ---- */
.trigger-btn {
  position: absolute;
  top: calc(var(--titlebar-height, 0px) + 12px);
  right: 12px;
  width: 42px;
  height: 42px;
  border-radius: 12px;
  background: #11131a;
  border: 1.5px solid #1a1d26;
  color: #94a3b8;
  cursor: pointer;
  pointer-events: auto;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: border-color 0.18s, transform 0.18s;
  overflow: hidden;
  z-index: 10;
  padding: 0;
}
.trigger-btn:hover { border-color: rgba(59,130,246,0.4); background: rgba(59,130,246,0.1); color: #3b82f6; transform: scale(1.05); }
.trigger-photo { width: 100%; height: 100%; object-fit: cover; border-radius: inherit; }

/* ===== POPUP ===== */
.popup {
  position: absolute;
  top: calc(var(--titlebar-height, 0px) + 64px);
  right: 12px;
  width: 300px;
  background: #0a0b0e;
  border: 1px solid #1a1d26;
  border-radius: 10px;
  box-shadow: 0 8px 32px rgba(0,0,0,0.5);
  pointer-events: auto;
  z-index: 20;
  animation: popupFade 0.18s ease;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

/* Popup header */
.popup-header {
  padding: 16px 20px;
  border-bottom: 1px solid #1a1d26;
  background: #11131a;
  border-radius: 10px 10px 0 0;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.popup-header h3 {
  margin: 0;
  font-size: 15px;
  font-weight: 600;
  color: #fff;
  letter-spacing: 0.02em;
}
.popup-header-actions { display: flex; align-items: center; gap: 4px; }
.popup-icon-btn {
  background: transparent; border: none; color: #64748b;
  cursor: pointer; display: flex; align-items: center; justify-content: center;
  padding: 5px; border-radius: 6px; transition: all 0.15s;
}
.popup-icon-btn:hover { background: rgba(59,130,246,0.1); color: #3b82f6; }

/* Popup content */
.popup-content {
  padding: 16px 20px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.popup-avatar-row {
  display: flex;
  align-items: center;
  gap: 10px;
  padding-bottom: 12px;
  border-bottom: 1px solid rgba(255,255,255,0.06);
  margin-bottom: 4px;
}

.popup-avatar {
  width: 36px; height: 36px;
  border-radius: 10px;
  background: rgba(37,99,235,0.2);
  color: #60a5fa;
  display: flex; align-items: center; justify-content: center;
  flex-shrink: 0; overflow: hidden;
}
.popup-avatar-img { width: 100%; height: 100%; object-fit: cover; border-radius: inherit; }

.popup-user-info { flex: 1; min-width: 0; display: flex; flex-direction: column; }
.popup-user-label { font-size: 10px; color: #475569; text-transform: uppercase; font-weight: 700; letter-spacing: 0.04em; }
.popup-user-email { font-size: 12px; color: #e2e8f0; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

/* Settings button */
.popup-settings-btn {
  display: flex; align-items: center; gap: 9px;
  padding: 9px 12px;
  background: rgba(0,0,0,0.2);
  border: 1px solid rgba(255,255,255,0.08);
  border-radius: 6px;
  color: #fff; font-size: 13px; font-weight: 500;
  cursor: pointer; width: 100%; text-align: left;
  transition: all 0.15s;
}
.popup-settings-btn:hover { background: rgba(59,130,246,0.08); border-color: rgba(59,130,246,0.25); color: #3b82f6; }
.chevron { margin-left: auto; color: #475569; }

/* Logout button */
.popup-logout-btn {
  display: flex; align-items: center; justify-content: center; gap: 8px;
  padding: 9px 12px;
  background: rgba(239,68,68,0.08);
  border: 1px solid rgba(239,68,68,0.15);
  border-radius: 6px;
  color: #f87171; font-size: 13px; font-weight: 500;
  cursor: pointer; width: 100%;
  transition: all 0.15s;
}
.popup-logout-btn:hover { background: rgba(239,68,68,0.15); }
.logout-confirm { display: flex; flex-direction: column; gap: 8px; }
.logout-confirm-text { margin: 0; font-size: 12px; color: #94a3b8; text-align: center; }
.logout-confirm-actions { display: flex; gap: 6px; }
.logout-cancel-btn {
  flex: 1; height: 34px;
  background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1);
  border-radius: 6px; color: #94a3b8; font-size: 12px; font-weight: 500; cursor: pointer;
  transition: all 0.15s;
}
.logout-cancel-btn:hover { background: rgba(255,255,255,0.1); color: #e2e8f0; }
.logout-confirm-btn { flex: 1; height: 34px; font-size: 12px; }

/* Guest */
.popup-guest {
  padding: 20px 0;
  display: flex; flex-direction: column; align-items: center; gap: 10px;
}
.guest-avatar {
  width: 52px; height: 52px; border-radius: 10px;
  background: rgba(37,99,235,0.12); color: #60a5fa;
  display: flex; align-items: center; justify-content: center;
}
.guest-text { margin: 0; font-size: 13px; color: #64748b; }
.popup-login-btn {
  height: 36px; padding: 0 18px;
  background: #2563eb; border: none; border-radius: 6px;
  color: #fff; font-size: 13px; font-weight: 600;
  cursor: pointer; transition: background 0.15s;
}
.popup-login-btn:hover { background: #1d4ed8; }

/* Divider */
.popup-divider { height: 1px; background: rgba(255,255,255,0.07); margin: 4px 0; }
.popup.light .popup-divider { background: #e2e8f0; }

/* ===== POPUP LIGHT MODE (scoped) ===== */
.popup.light {
  background: #f8fafc;
  border-color: #e2e8f0;
  box-shadow: 0 8px 32px rgba(0,0,0,0.15);
}
.popup.light .popup-header { background: #f1f5f9; border-bottom-color: #e2e8f0; }
.popup.light .popup-header h3 { color: #0f172a; }
.popup.light .popup-avatar-row { border-bottom-color: #e2e8f0; }
.popup.light .popup-user-label { color: #94a3b8; }
.popup.light .popup-user-email { color: #0f172a; }
.popup.light .popup-settings-btn { background: rgba(0,0,0,0.04); border-color: #e2e8f0; color: #334155; }
.popup.light .popup-settings-btn:hover { background: rgba(59,130,246,0.08); border-color: rgba(59,130,246,0.3); color: #3b82f6; }
.popup.light .popup-icon-btn:hover { background: rgba(59,130,246,0.1); color: #3b82f6; }

/* ===== FULL PAGE SETTINGS ===== */
.full-page {
  position: fixed;
  top: var(--titlebar-height, 40px);
  left: 0; right: 0; bottom: 0;
  background: #07080c;
  z-index: 999999;
  display: flex; flex-direction: column;
  pointer-events: auto;
  animation: fadeIn 0.18s ease;
  border-radius: 0 0 12px 12px;
}

.fp-header {
  padding: 12px 24px;
  border-bottom: 1px solid #1a1d26;
  background: #0b0c11;
  display: flex; align-items: center; gap: 12px;
  flex-shrink: 0;
}

.fp-title { flex: 1; margin: 0; font-size: 16px; font-weight: 600; color: #fff; }

.fp-back-btn {
  display: flex; align-items: center; gap: 6px;
  background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1);
  border-radius: 8px; color: #94a3b8; font-size: 13px; padding: 6px 12px;
  cursor: pointer; transition: all 0.15s;
}
.fp-back-btn:hover { background: rgba(59,130,246,0.1); border-color: rgba(59,130,246,0.3); color: #3b82f6; }

.fp-close-btn {
  background: transparent; border: none; color: #64748b;
  cursor: pointer; display: flex; align-items: center; justify-content: center;
  padding: 6px; border-radius: 8px; transition: all 0.15s;
}
.fp-close-btn:hover { background: rgba(59,130,246,0.1); color: #3b82f6; }

.sync-badge {
  font-size: 11px; background: rgba(34,197,94,0.12); color: #4ade80;
  border: 1px solid rgba(34,197,94,0.25); padding: 2px 8px;
  border-radius: 12px; font-weight: 600;
}

/* Centered body */
.fp-body {
  flex: 1; overflow-y: auto;
  display: flex; justify-content: center;
  padding: 40px 24px;
  scrollbar-width: thin;
  scrollbar-color: rgba(255, 255, 255, 0.1) transparent;
}
.fp-body::-webkit-scrollbar { width: 6px; }
.fp-body::-webkit-scrollbar-track { background: transparent; }
.fp-body::-webkit-scrollbar-thumb { background: rgba(255, 255, 255, 0.1); border-radius: 3px; }
.fp-body::-webkit-scrollbar-thumb:hover { background: rgba(255, 255, 255, 0.2); }

.fp-center {
  width: 100%;
  max-width: 560px;
  display: flex;
  flex-direction: column;
  gap: 0;
}

/* Tab nav */
.fp-tabs {
  display: flex;
  gap: 4px;
  background: #0f1117;
  border: 1px solid rgba(255,255,255,0.07);
  border-radius: 12px;
  padding: 4px;
  margin-bottom: 28px;
}

.fp-tab {
  flex: 1; display: flex; align-items: center; justify-content: center; gap: 7px;
  padding: 9px 16px; border-radius: 9px; border: none;
  background: transparent; color: #64748b;
  font-size: 13px; font-weight: 600; cursor: pointer;
  transition: all 0.15s;
}
.fp-tab:hover { color: #cbd5e1; }
.fp-tab.active { background: #1e293b; color: #fff; }

.tab-content { display: flex; flex-direction: column; gap: 0; }

.section-label {
  font-size: 11px; font-weight: 700; color: #475569;
  text-transform: uppercase; letter-spacing: 0.06em;
  margin-bottom: 12px;
}

/* Avatar section */
.avatar-section {
  display: flex; align-items: center; gap: 20px;
  padding: 20px;
  background: rgba(255,255,255,0.02);
  border: 1px solid rgba(255,255,255,0.06);
  border-radius: 12px;
}

.avatar-wrap {
  width: 72px; height: 72px; border-radius: 14px;
  position: relative; cursor: pointer; flex-shrink: 0;
}
.avatar-img { width: 100%; height: 100%; object-fit: cover; border-radius: 14px; border: 2px solid rgba(255,255,255,0.1); }
.avatar-ph {
  width: 100%; height: 100%; border-radius: 14px;
  background: rgba(37,99,235,0.15); color: #60a5fa;
  display: flex; align-items: center; justify-content: center;
  border: 2px solid rgba(255,255,255,0.08);
}
.avatar-ov {
  position: absolute; inset: 0; border-radius: 14px;
  background: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center;
  color: #fff; opacity: 0; transition: opacity 0.15s;
}
.avatar-wrap:hover .avatar-ov { opacity: 1; }
.hint-title { display: block; font-size: 14px; font-weight: 600; color: #cbd5e1; }
.hint-sub { display: block; font-size: 12px; color: #64748b; margin-top: 4px; }

/* Form card */
.form-card {
  background: rgba(255,255,255,0.02);
  border: 1px solid rgba(255,255,255,0.06);
  border-radius: 12px;
  padding: 20px;
  display: flex; flex-direction: column; gap: 16px;
}

.form-field { display: flex; flex-direction: column; gap: 6px; }
.form-field label { font-size: 12px; font-weight: 600; color: #64748b; text-transform: uppercase; letter-spacing: 0.04em; }
.form-field input {
  height: 42px; background: #151822;
  border: 1px solid rgba(255,255,255,0.1);
  border-radius: 9px; padding: 0 14px;
  color: #fff; font-size: 14px; outline: none; transition: all 0.15s ease;
}
.form-field input:focus {
  border-color: #3b82f6;
  background: #151822;
  box-shadow: 0 0 0 3px rgba(59,130,246,0.2);
}
.password-input-wrap { position: relative; display: flex; align-items: center; }
.password-input-wrap input { width: 100%; padding-right: 40px; }
.eye-btn { position: absolute; right: 10px; background: transparent; border: none; color: #64748b; cursor: pointer; display: flex; align-items: center; justify-content: center; padding: 4px; border-radius: 4px; transition: color 0.15s; }
.eye-btn:hover { color: #94a3b8; }

.save-msg { font-size: 13px; color: #4ade80; margin: 0; }
.save-msg.error { color: #f87171; }

.save-btn {
  height: 42px;
  background: rgba(37,99,235,0.12);
  border: 1px solid rgba(37,99,235,0.35);
  border-radius: 9px;
  color: #60a5fa; font-size: 14px; font-weight: 600; cursor: pointer;
  display: flex; align-items: center; justify-content: center; gap: 8px;
  align-self: flex-start; padding: 0 28px; transition: all 0.15s;
}
.save-btn:hover:not(:disabled) {
  background: rgba(37,99,235,0.2);
  border-color: rgba(37,99,235,0.6);
  color: #3b82f6;
}
.save-btn:disabled { opacity: 0.4; cursor: not-allowed; }

/* Cropper Modal */
.crop-modal {
  position: fixed; inset: 0; background: rgba(0,0,0,0.8);
  display: flex; align-items: center; justify-content: center;
  z-index: 9999999; padding: 20px;
}
.crop-modal-content {
  background: #0e1017; border: 1px solid rgba(255,255,255,0.1);
  border-radius: 16px; width: 100%; max-width: 400px;
  display: flex; flex-direction: column; overflow: hidden;
  box-shadow: 0 10px 40px rgba(0,0,0,0.5);
}
.crop-header {
  display: flex; align-items: center; justify-content: space-between;
  padding: 16px 20px; border-bottom: 1px solid rgba(255,255,255,0.06);
}
.crop-header h3 { margin: 0; font-size: 15px; font-weight: 600; color: #fff; }
.crop-body {
  width: 100%; height: 350px; background: #000;
  display: flex; align-items: center; justify-content: center;
}
.my-cropper { width: 100%; height: 100%; }
.crop-footer {
  display: flex; gap: 12px; padding: 16px 20px;
  border-top: 1px solid rgba(255,255,255,0.06);
}

/* Danger Zone */
.danger-card { border-color: rgba(239,68,68,0.2); background: rgba(239,68,68,0.02); }
.danger-info h4 { margin: 0; font-size: 14px; font-weight: 600; color: #f87171; }
.danger-info p { margin: 4px 0 0; font-size: 12px; color: #94a3b8; line-height: 1.4; }
.del-account-btn { background: rgba(239,68,68,0.1); border: 1px solid rgba(239,68,68,0.2); color: #f87171; height: 38px; border-radius: 8px; font-size: 13px; font-weight: 600; cursor: pointer; transition: background 0.15s; }
.del-account-btn:hover { background: rgba(239,68,68,0.2); }
.delete-confirm { display: flex; flex-direction: column; gap: 12px; margin-top: 4px; }
.delete-confirm p { margin: 0; font-size: 13px; font-weight: 600; color: #cbd5e1; }
.delete-actions { display: flex; gap: 8px; }
.del-cancel { flex: 1; height: 38px; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); border-radius: 8px; color: #cbd5e1; font-weight: 500; cursor: pointer; }
.del-cancel:hover { background: rgba(255,255,255,0.1); }
.del-confirm { flex: 1; height: 38px; background: #ef4444; border: none; border-radius: 8px; color: #fff; font-weight: 600; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 6px; }
.del-confirm:hover { background: #dc2626; }
.del-confirm:disabled { opacity: 0.5; cursor: not-allowed; }
.delete-error-msg { margin: 0 !important; color: #f87171 !important; font-size: 12px !important; font-weight: 400 !important; }

/* API Keys */
.key-section { display: flex; flex-direction: column; }
.key-title-row { display: flex; align-items: center; gap: 8px; margin-bottom: 4px; }
.key-title-row h4 { margin: 0; font-size: 13px; font-weight: 600; color: #e2e8f0; text-transform: uppercase; letter-spacing: 0.05em; }

.provider-badge {
  display: inline-flex; align-items: center; justify-content: center;
  width: 22px; height: 22px; border-radius: 5px; font-size: 10px; font-weight: 700;
}
.gemini-badge  { background: #1a73e8; color: #fff; }
.or-badge      { background: #6c47ff; color: #fff; }
.mistral-badge { background: #ee6c2c; color: #fff; }

.key-help { font-size: 12px; color: #64748b; margin: 0 0 12px; }

.key-list { display: flex; flex-direction: column; gap: 6px; margin-bottom: 10px; }
.key-item {
  display: flex; align-items: center; justify-content: space-between;
  padding: 9px 12px;
  background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.07);
  border-radius: 8px;
}
.key-val { font-family: monospace; font-size: 13px; color: #e0e0e0; }

.del-btn {
  background: none; border: none; color: #ef4444; cursor: pointer;
  padding: 4px; border-radius: 4px; display: flex; align-items: center; transition: background 0.15s;
}
.del-btn:hover { background: rgba(239,68,68,0.15); }

.add-form { display: flex; gap: 8px; }
.add-form input {
  flex: 1; height: 38px; padding: 0 12px; border-radius: 8px;
  border: 1px solid rgba(255,255,255,0.1); background: #151822;
  color: #fff; font-size: 13px; outline: none; transition: all 0.15s ease;
}
.add-form input:focus {
  border-color: #3b82f6;
  background: #151822;
  box-shadow: 0 0 0 3px rgba(59,130,246,0.2);
}

.add-btn {
  width: 38px; height: 38px; border-radius: 8px;
  background: rgba(255,255,255,0.07); border: 1px solid rgba(255,255,255,0.1);
  color: #fff; cursor: pointer; display: flex; align-items: center; justify-content: center; transition: background 0.15s;
}
.add-btn:not(:disabled):hover { background: rgba(255,255,255,0.13); }
.add-btn:disabled { opacity: 0.35; cursor: not-allowed; }
.trash-btn:hover {
  background: rgba(239, 68, 68, 0.15) !important;
  color: #f87171 !important;
  border-color: rgba(239, 68, 68, 0.3) !important;
}

/* ---- Animations ---- */
.spin { animation: spin 1s linear infinite; }
@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
@keyframes popupFade { 0% { opacity: 0; transform: translateY(-4px) scale(0.98); } 100% { opacity: 1; transform: translateY(0) scale(1); } }
@keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
</style>


