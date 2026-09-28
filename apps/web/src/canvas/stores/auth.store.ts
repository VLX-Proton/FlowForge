import { defineStore } from 'pinia'
import type { User } from 'firebase/auth'
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
} from 'firebase/auth'
import { doc, getDoc, setDoc } from 'firebase/firestore'
import { auth, db } from '../../firebase'

const ALLOWED_DOMAINS = ['@gmail.com', '@proton.me', '@protonmail.com']

export const useAuthStore = defineStore('auth', {
  state: () => ({
    user: null as User | null,
    isInitialized: false,
    loading: false,
    authModalOpen: false,
    errorMessage: '',
  }),

  getters: {
    isAuthenticated: (state) => !!state.user,
    userEmail: (state) => state.user?.email || '',
    userUid: (state) => state.user?.uid || '',
  },

  actions: {
    initAuth() {
      onAuthStateChanged(auth, async (currentUser) => {
        this.user = currentUser
        this.isInitialized = true
        if (currentUser) {
          this.authModalOpen = false
          this.errorMessage = ''
        } else {
          this.authModalOpen = true
        }
      })
    },

    validateEmailDomain(email: string): boolean {
      const lower = email.trim().toLowerCase()
      return ALLOWED_DOMAINS.some(domain => lower.endsWith(domain))
    },

    async login(email: string, pass: string) {
      this.loading = true
      this.errorMessage = ''
      try {
        const cleanEmail = email.trim()
        if (!this.validateEmailDomain(cleanEmail)) {
          throw new Error('Only Gmail (@gmail.com) and ProtonMail (@proton.me / @protonmail.com) are allowed.')
        }
        await signInWithEmailAndPassword(auth, cleanEmail, pass)
        this.authModalOpen = false
      } catch (err: any) {
        let msg = err.message || 'Login failed.'
        if (err.code === 'auth/invalid-credential' || err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password') {
          msg = 'Incorrect email or password.'
        } else if (err.code === 'auth/invalid-email') {
          msg = 'Invalid email format.'
        }
        this.errorMessage = msg
        throw err
      } finally {
        this.loading = false
      }
    },

    async register(email: string, pass: string, accessCode: string) {
      this.loading = true
      this.errorMessage = ''
      try {
        const cleanEmail = email.trim()
        if (!this.validateEmailDomain(cleanEmail)) {
          throw new Error('Registration is only allowed using Gmail (@gmail.com) or ProtonMail (@proton.me / @protonmail.com).')
        }
        if (pass.length < 6) {
          throw new Error('Password must be at least 6 characters.')
        }
        
        // 1. Verifikasi Kode Akses
        const codeRef = doc(db, 'access_codes', accessCode)
        const codeSnap = await getDoc(codeRef).catch(err => {
          throw new Error('Failed to verify access code. Please check your connection.')
        })
        
        if (!codeSnap.exists()) {
          throw new Error('Invalid access code.')
        }
        if (codeSnap.data().status === 'used') {
          throw new Error('This access code has already been used.')
        }

        // 2. Buat akun jika kode valid
        const credential = await createUserWithEmailAndPassword(auth, cleanEmail, pass)
        
        // 3. Update status kode menjadi 'used' dan tautkan ke user
        await setDoc(codeRef, {
          status: 'used',
          usedBy: cleanEmail,
          usedAt: new Date().toISOString()
        }, { merge: true })

        // Simpan dokumen awal user di Firestore
        await setDoc(doc(db, 'users', credential.user.uid), {
          email: cleanEmail,
          createdAt: new Date().toISOString(),
        }, { merge: true })

        this.authModalOpen = false
      } catch (err: any) {
        let msg = err.message || 'Registration failed.'
        if (err.code === 'auth/email-already-in-use') {
          msg = 'This email is already registered. Please log in.'
        } else if (err.code === 'auth/weak-password') {
          msg = 'Password is too weak (minimum 6 characters).'
        } else if (err.code === 'auth/invalid-email') {
          msg = 'Invalid email format.'
        }
        this.errorMessage = msg
        throw err
      } finally {
        this.loading = false
      }
    },

    async logout() {
      this.loading = true
      try {
        await signOut(auth)
        this.user = null
        this.authModalOpen = true
      } finally {
        this.loading = false
      }
    },

    openModal() {
      this.authModalOpen = true
      this.errorMessage = ''
    },

    closeModal() {
      if (this.isAuthenticated) {
        this.authModalOpen = false
      }
    }
  }
})
