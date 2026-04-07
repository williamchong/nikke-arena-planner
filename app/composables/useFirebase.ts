import type { Auth } from 'firebase/auth'
import type { Firestore } from 'firebase/firestore/lite'

const firebaseConfig = {
  apiKey: 'AIzaSyDhKziDmQJQ6nIguaOayYhGn7NvoP9Em2U',
  authDomain: 'nikke-arena-planner.firebaseapp.com',
  projectId: 'nikke-arena-planner',
  storageBucket: 'nikke-arena-planner.firebasestorage.app',
  messagingSenderId: '541313717610',
  appId: '1:541313717610:web:483ec7c1c9a290fe5f0113',
}

let initPromise: Promise<{ db: Firestore; auth: Auth }> | null = null
let userIdPromise: Promise<string | null> | null = null

function init(): Promise<{ db: Firestore; auth: Auth }> {
  if (!initPromise) {
    initPromise = (async () => {
      try {
        const { initializeApp, getApps, getApp } = await import('firebase/app')
        const { getFirestore } = await import('firebase/firestore/lite')
        const { getAuth } = await import('firebase/auth')

        const app = getApps().length ? getApp() : initializeApp(firebaseConfig)
        return { db: getFirestore(app), auth: getAuth(app) }
      }
      catch (error) {
        initPromise = null
        throw error
      }
    })()
  }
  return initPromise
}

/**
 * Lazy-initialized Firebase composable.
 * Firebase SDK is only loaded on first call (dynamic import).
 * Anonymous auth UID is cached across calls; retries on failure.
 */
export function useFirebase() {
  async function getFirebase() {
    if (import.meta.server) throw new Error('Firebase is client-only')
    return init()
  }

  async function getUserId(): Promise<string | null> {
    if (import.meta.server) return null
    if (!userIdPromise) {
      userIdPromise = (async () => {
        try {
          const { auth } = await init()
          await auth.authStateReady?.()
          if (auth.currentUser) {
            return auth.currentUser.uid
          }
          const { signInAnonymously } = await import('firebase/auth')
          const credential = await signInAnonymously(auth)
          return credential.user.uid
        }
        catch {
          userIdPromise = null // Clear cache so next call retries
          return null
        }
      })()
    }
    return userIdPromise
  }

  return { getFirebase, getUserId }
}
