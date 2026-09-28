import { initializeApp, getApps } from 'firebase/app'
import { getAuth } from 'firebase/auth'
import { getFirestore } from 'firebase/firestore'
import { getStorage } from 'firebase/storage'

const firebaseConfig = {
  apiKey: "AIzaSyBJxZ58GKZb-VQ_E8ohXxvbhZngQpWfyns",
  authDomain: "fowforge.firebaseapp.com",
  projectId: "fowforge",
  storageBucket: "fowforge.firebasestorage.app",
  messagingSenderId: "201665680646",
  appId: "1:201665680646:web:7a62a80c53d5f15e367a87"
}

export const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0]
export const auth = getAuth(app)
export const db = getFirestore(app)
export const storage = getStorage(app)
