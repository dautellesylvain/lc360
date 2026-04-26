import { initializeApp, getApps } from 'firebase/app'
import {
  getAuth,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  GoogleAuthProvider,
  signInWithPopup,
  sendPasswordResetEmail,
  updateProfile,
} from 'firebase/auth'
import {
  getFirestore,
  collection,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  getDocs,
  onSnapshot,
  serverTimestamp,
  Timestamp,
  increment,
} from 'firebase/firestore'
import firebaseConfig from '../../firebase.config.js'

// ── Initialize Firebase ───────────────────────────────────────
const app = getApps().length === 0
  ? initializeApp(firebaseConfig)
  : getApps()[0]

export const auth = getAuth(app)
export const db   = getFirestore(app)

// ── Auth : Email/Password ─────────────────────────────────────

export const signInWithEmail = (email, password) =>
  signInWithEmailAndPassword(auth, email, password)

export const registerWithEmail = async (email, password, displayName) => {
  const cred = await createUserWithEmailAndPassword(auth, email, password)
  if (displayName) await updateProfile(cred.user, { displayName })
  await setDoc(doc(db, 'users', cred.user.uid), {
    uid:         cred.user.uid,
    email,
    displayName: displayName ?? '',
    ownerId:     cred.user.uid,
    role:        'admin',
    createdAt:   serverTimestamp(),
  })
  return cred
}

// ── Auth : Google ─────────────────────────────────────────────

export const signInWithGoogle = async () => {
  const provider = new GoogleAuthProvider()
  provider.setCustomParameters({ prompt: 'select_account' })
  const cred    = await signInWithPopup(auth, provider)
  const userRef = doc(db, 'users', cred.user.uid)
  const snap    = await getDoc(userRef)
  if (!snap.exists()) {
    await setDoc(userRef, {
      uid:         cred.user.uid,
      email:       cred.user.email,
      displayName: cred.user.displayName ?? '',
      ownerId:     cred.user.uid,
      role:        'admin',
      createdAt:   serverTimestamp(),
    })
  }
  return cred
}

export const signOut       = () => firebaseSignOut(auth)
export const resetPassword = (email) => sendPasswordResetEmail(auth, email)
export const onAuth        = (cb)    => onAuthStateChanged(auth, cb)

// ── Firestore : Users ─────────────────────────────────────────

export const getUserDoc    = (uid)       => getDoc(doc(db, 'users', uid))
export const updateUserDoc = (uid, data) =>
  updateDoc(doc(db, 'users', uid), { ...data, updatedAt: serverTimestamp() })

// ── Firestore : Projects ──────────────────────────────────────

export const getUserProjects = (uid) =>
  getDocs(query(
    collection(db, 'projects'),
    where('ownerId', '==', uid),
    orderBy('updatedAt', 'desc'),
  ))

export const subscribeToProjects = (uid, callback) =>
  onSnapshot(
    query(
      collection(db, 'projects'),
      where('ownerId', '==', uid),
      orderBy('updatedAt', 'desc'),
    ),
    callback
  )

export const createProject = (uid, data) => {
  const newRef = doc(collection(db, 'projects'))
  return setDoc(newRef, {
    ...data,
    id:        newRef.id,
    ownerId:   uid,
    scenes:    [],
    status:    'draft',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  })
}

export const updateProject = (projectId, data) =>
  updateDoc(doc(db, 'projects', projectId), { ...data, updatedAt: serverTimestamp() })

export const deleteProject = (projectId) =>
  deleteDoc(doc(db, 'projects', projectId))

export { serverTimestamp, Timestamp }

// ── Partage public ────────────────────────────────────────────

/** Génère un token unique et active le partage public d'un projet */
export const enableSharing = async (projectId) => {
  const token = crypto.randomUUID().replace(/-/g, '').slice(0, 16)
  await updateDoc(doc(db, 'projects', projectId), {
    shareToken:  token,
    shareEnabled: true,
    sharedAt:    serverTimestamp(),
  })
  return token
}

/** Désactive le partage public */
export const disableSharing = (projectId) =>
  updateDoc(doc(db, 'projects', projectId), {
    shareEnabled: false,
    shareToken:   null,
  })

/** Récupère un projet via son token public (sans auth) */
export const getProjectByToken = async (token) => {
  const q    = query(collection(db, 'projects'), where('shareToken', '==', token), where('shareEnabled', '==', true), where('published', '==', true))
  const snap = await getDocs(q)
  if (snap.empty) return null
  return { id: snap.docs[0].id, ...snap.docs[0].data() }
}

// ── Analytics ─────────────────────────────────────────────────

/** Retourne ou crée un visitorId anonyme dans localStorage */
export const getVisitorId = () => {
  let id = localStorage.getItem('lc360_visitor_id')
  if (!id) {
    id = crypto.randomUUID()
    localStorage.setItem('lc360_visitor_id', id)
  }
  return id
}

/** Enregistre le début d'une visite — retourne le visitId */
export const trackVisitStart = async (projectId) => {
  const visitorId = getVisitorId()
  const visitRef  = doc(collection(db, 'analytics', projectId, 'visits'))
  const device    = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent) ? 'mobile' : 'desktop'
  await setDoc(visitRef, {
    visitorId,
    device,
    startedAt:      serverTimestamp(),
    duration:       0,
    scenesVisited:  [],
    hotspotsClicked: [],
  })
  return { visitId: visitRef.id, visitorId }
}

/** Met à jour la durée et les données de visite */
export const trackVisitEnd = async (projectId, visitId, data) => {
  try {
    await updateDoc(doc(db, 'analytics', projectId, 'visits', visitId), {
      ...data,
      endedAt: serverTimestamp(),
    })
  } catch(e) {}
}

/** Enregistre un clic sur un hotspot */
export const trackHotspotClick = async (projectId, visitId, hotspotId, hotspotLabel) => {
  try {
    const ref = doc(db, 'analytics', projectId, 'visits', visitId)
    const snap = await getDoc(ref)
    if (!snap.exists()) return
    const clicks = snap.data().hotspotsClicked || []
    const existing = clicks.find(h => h.id === hotspotId)
    if (existing) {
      existing.count = (existing.count || 1) + 1
      await updateDoc(ref, { hotspotsClicked: clicks })
    } else {
      await updateDoc(ref, { hotspotsClicked: [...clicks, { id: hotspotId, label: hotspotLabel, count: 1 }] })
    }
  } catch(e) {}
}

/** Enregistre une scène visitée */
export const trackSceneVisit = async (projectId, visitId, sceneId, sceneName) => {
  try {
    const ref = doc(db, 'analytics', projectId, 'visits', visitId)
    const snap = await getDoc(ref)
    if (!snap.exists()) return
    const scenes = snap.data().scenesVisited || []
    if (!scenes.find(s => s.id === sceneId)) {
      await updateDoc(ref, { scenesVisited: [...scenes, { id: sceneId, name: sceneName }] })
    }
  } catch(e) {}
}

/** Récupère toutes les visites d'un projet */
export const getProjectVisits = (projectId) =>
  getDocs(query(
    collection(db, 'analytics', projectId, 'visits'),
    orderBy('startedAt', 'desc')
  ))

// ── Clé d'activation SketchUp ─────────────────────────────────

/** Génère une nouvelle clé d'activation pour l'extension SketchUp */
export const generateActivationKey = async (uid) => {
  const key = 'sk_' + Array.from(crypto.getRandomValues(new Uint8Array(24)))
    .map(b => b.toString(16).padStart(2,'0')).join('')
  await setDoc(doc(db, 'users', uid), {
    sketchupKey:          key,
    sketchupKeyCreatedAt: new Date(),
  }, { merge: true })
  return key
}

/** Récupère la clé d'activation existante */
export const getActivationKey = async (uid) => {
  const snap = await getDoc(doc(db, 'users', uid))
  return snap.exists() ? snap.data().sketchupKey || null : null
}

/** Révoque la clé d'activation */
export const revokeActivationKey = async (uid) => {
  await setDoc(doc(db, 'users', uid), {
    sketchupKey:          null,
    sketchupKeyCreatedAt: null,
  }, { merge: true })
}
