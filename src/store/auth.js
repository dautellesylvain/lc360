import { atom } from 'jotai'
import { onAuth, signOut as firebaseSignOut, db } from '@services/firebase'
import { doc, onSnapshot } from 'firebase/firestore'

// ── Base atoms ────────────────────────────────────────────────
export const authUserAtom    = atom(null)
export const authLoadingAtom = atom(true)

// ── Derived ───────────────────────────────────────────────────
export const isAuthenticatedAtom = atom((get) => get(authUserAtom) !== null)
export const userUidAtom         = atom((get) => get(authUserAtom)?.uid ?? null)
export const userEmailAtom       = atom((get) => get(authUserAtom)?.email ?? null)
export const userNameAtom        = atom((get) => {
  const u = get(authUserAtom)
  if (!u) return null
  return u.displayName || u.email?.split('@')[0] || 'Utilisateur'
})

// ── Write : signOut ───────────────────────────────────────────
export const signOutAtom = atom(null, async () => {
  await firebaseSignOut()
})

// ── Initialiser l'écouteur Firebase dans main.jsx ─────────────
export function initAuthListener(store) {
  return onAuth((user) => {
    store.set(authUserAtom, user)
    store.set(authLoadingAtom, false)
  })
}

// ── Onboarding ───────────────────────────────────────────────
export const onboardingDoneAtom = atom(null)

// ── Plan utilisateur ─────────────────────────────────────────
export const userPlanAtom  = atom('free')
export const userIsPROAtom = atom((get) => get(userPlanAtom) === 'pro')

// ── Célébrations ─────────────────────────────────────────────
// Stocke les clés des célébrations déjà vues { pro: "2026-...", firstProject: "..." }
export const celebrationsAtom = atom({})

export function initPlanListener(store, uid) {
  if (!uid) return () => {}
  const ref = doc(db, 'users', uid)
  return onSnapshot(ref, (snap) => {
    if (snap.exists()) {
      const data = snap.data()
      store.set(userPlanAtom,       data.plan || 'free')
      store.set(onboardingDoneAtom, data.onboardingDone === true)
      store.set(celebrationsAtom,   data.celebrations || {})
    }
  })
}
