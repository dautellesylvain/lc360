# LC360 — MEMORY.md
> Plan de développement en 6 phases · Dernière mise à jour : Phase 1

---

## 🏗️ PHASE 1 — Scaffold (CURRENT ✅)

**Objectif :** Infrastructure complète React 19 + Vite + Firebase + Jotai + PSV.js

### Livrables
- [x] `package.json` — React 19, Vite 6, Firebase 11, Jotai, PSV.js 5, Zod, React Hook Form
- [x] `vite.config.js` — alias paths (`@/`, `@components/`, `@pages/`, `@services/`, `@store/`)
- [x] `firebase.config.js` — config via env vars (`VITE_FIREBASE_*`)
- [x] `.env.example` — template pour les credentials
- [x] `src/main.jsx` — entry point React 19
- [x] `src/App.jsx` — Router + ProtectedRoute + PublicRoute
- [x] `src/index.css` — design system (tokens CSS, fonts Syne + DM Sans)
- [x] `src/components/Header.jsx` + `.module.css`
- [x] `src/pages/Login.jsx` + `.module.css` (React Hook Form + Zod)
- [x] `src/pages/Dashboard.jsx` + `.module.css` (mock data)
- [x] `src/services/firebase.js` — Auth + Firestore + Storage helpers
- [x] `src/store/auth.js` — Jotai atoms (user, loading, signOut)
- [x] `MEMORY.md` — ce fichier

### Stack technique
| Outil | Version | Rôle |
|---|---|---|
| React | 19 | UI |
| Vite | 6 | Build tool |
| React Router | 6 | Navigation |
| Firebase | 11 | Auth + DB + Storage |
| Jotai | 2 | State management |
| Photo Sphere Viewer | 5 | Viewer 360° |
| Zod | 3 | Validation schémas |
| React Hook Form | 7 | Formulaires |

---

## 🔥 PHASE 2 — Firebase Backend

**Objectif :** Authentification fonctionnelle + Firestore + Security Rules

### Tâches
- [ ] Activer Auth dans Firebase Console (Email/Password + Google)
- [ ] Configurer `.env.local` avec les vraies credentials
- [ ] Tester `signInWithEmail` depuis `Login.jsx`
- [ ] Créer les collections Firestore : `users`, `projects`, `scenes`
- [ ] Security Rules Firestore :
  ```
  users: read/write si uid === request.auth.uid
  projects: read/write si ownerId === request.auth.uid
  scenes: read/write si project.ownerId === request.auth.uid
  ```
- [ ] Security Rules Storage : authenticated users seulement
- [ ] Cloud Functions (optionnel Phase 2) :
  - `onProjectCreated` — initialise métadonnées
  - `generateThumbnail` — crée thumbnail depuis image 360°
- [ ] Tester l'auth complète : login → dashboard → signout

### Schéma Firestore
```
users/{uid}
  ├── uid: string
  ├── email: string
  ├── displayName: string
  ├── role: 'admin' | 'editor' | 'viewer'
  ├── createdAt: Timestamp
  └── updatedAt: Timestamp

projects/{projectId}
  ├── id: string
  ├── ownerId: string (ref → users)
  ├── name: string
  ├── location: string
  ├── description: string
  ├── status: 'draft' | 'review' | 'published'
  ├── scenes: Scene[]
  ├── createdAt: Timestamp
  └── updatedAt: Timestamp

Scene (embedded in project)
  ├── id: string
  ├── name: string
  ├── imageUrl: string (Storage)
  ├── hotspots: Hotspot[]
  └── position: { x, y, z }
```

---

## 🖼️ PHASE 3 — Core Frontend

**Objectif :** Viewer PSV.js + navigation entre scènes

### Tâches
- [ ] `src/pages/ProjectViewer.jsx` — intégration Photo Sphere Viewer
  - Chargement image équirectangulaire depuis Storage URL
  - Plugin Markers pour les hotspots
  - Plugin Virtual Tour pour navigation entre scènes
- [ ] Route `/project/:id` dans `App.jsx`
- [ ] `src/components/SceneList.jsx` — sidebar liste des scènes
- [ ] `src/components/HotspotEditor.jsx` — créer/éditer hotspots (Phase 4+)
- [ ] Remplacer mock data Dashboard par vraies données Firestore
- [ ] `subscribeToProjects` (real-time) dans Dashboard
- [ ] Loading states + Suspense boundaries

### Intégration PSV.js
```jsx
import { Viewer } from '@photo-sphere-viewer/core'
import { MarkersPlugin } from '@photo-sphere-viewer/markers-plugin'
import { VirtualTourPlugin } from '@photo-sphere-viewer/virtual-tour-plugin'
import '@photo-sphere-viewer/core/index.css'

const viewer = new Viewer({
  container: containerRef.current,
  panorama: scene.imageUrl,
  plugins: [
    [MarkersPlugin, { markers: scene.hotspots }],
    [VirtualTourPlugin, { nodes: allScenes }],
  ],
})
```

---

## 👤 PHASE 4 — Users & Auth complet

**Objectif :** Register/Login + profils + rôles + upload PSV

### Tâches
- [ ] `src/pages/Register.jsx` — formulaire inscription (email, nom, password)
- [ ] Route `/register` publique
- [ ] `registerWithEmail()` crée user doc Firestore
- [ ] `src/pages/Profile.jsx` — modifier displayName, avatar
- [ ] Système de rôles : admin peut gérer tous les projets
- [ ] `src/components/FileUpload.jsx` — drag & drop images 360°
  - Barre de progression `uploadBytesResumable`
  - Validation : format JPEG/PNG, taille max 50MB
  - Prévisualisation après upload
- [ ] Lier images uploadées à une scène de projet

---

## ⚙️ PHASE 5 — Features avancées

**Objectif :** Éditeur de projet complet + partage

### Tâches
- [ ] `src/pages/ProjectEditor.jsx` — CRUD scènes + hotspots
- [ ] Éditeur de hotspots : click sur viewer → créer hotspot
- [ ] Types de hotspots : lien vers scène, info-bulle, URL externe
- [ ] Réorganisation des scènes (drag & drop)
- [ ] Système de partage :
  - Lien public `/view/:shareToken`
  - Viewer embarquable (iframe)
  - Contrôle d'accès par token
- [ ] `src/pages/PublicViewer.jsx` — vue sans auth
- [ ] Analytics basiques : vues, durée de session

---

## 🚀 PHASE 6 — Production & Déploiement

**Objectif :** App prête pour la production

### Tâches
- [ ] Optimisations Vite : code splitting, lazy loading routes
- [ ] PWA : `vite-plugin-pwa`, manifest, service worker
- [ ] SEO : meta tags dynamiques, Open Graph
- [ ] Tests :
  - Vitest + Testing Library pour composants critiques
  - Cypress pour E2E (login, upload, visualisation)
- [ ] CI/CD GitHub Actions :
  - Lint + tests sur PR
  - Deploy Firebase Hosting sur `main`
- [ ] Monitoring : Firebase Crashlytics + Performance
- [ ] Domaine custom + HTTPS
- [ ] Documentation utilisateur

---

## 📁 Structure finale du projet

```
LC360/
├── .env.local              # Firebase credentials (git-ignored)
├── .env.example
├── firebase.config.js
├── vite.config.js
├── package.json
├── index.html
├── MEMORY.md
├── firestore.rules
├── storage.rules
├── functions/              # Cloud Functions (Phase 2)
│   └── index.js
└── src/
    ├── main.jsx
    ├── App.jsx
    ├── index.css
    ├── components/
    │   ├── Header.jsx
    │   ├── Header.module.css
    │   ├── FileUpload.jsx      # Phase 4
    │   ├── SceneList.jsx       # Phase 3
    │   └── HotspotEditor.jsx   # Phase 5
    ├── pages/
    │   ├── Login.jsx
    │   ├── Register.jsx        # Phase 4
    │   ├── Dashboard.jsx
    │   ├── ProjectViewer.jsx   # Phase 3
    │   ├── ProjectEditor.jsx   # Phase 5
    │   ├── Profile.jsx         # Phase 4
    │   └── PublicViewer.jsx    # Phase 5
    ├── services/
    │   └── firebase.js
    ├── store/
    │   ├── auth.js
    │   └── projects.js         # Phase 3
    ├── hooks/
    │   ├── useProjects.js      # Phase 3
    │   └── useUpload.js        # Phase 4
    └── utils/
        ├── validators.js
        └── formatters.js
```

---

## 🔑 Notes importantes

- **Auth listener** : initialiser `authListenerEffect` dans `main.jsx` via `useAtom`
- **jotai-effect** : ajouter `jotai-effect` au package.json si `atomEffect` est utilisé, sinon initialiser l'écouteur Firebase dans `main.jsx` manuellement
- **PSV.js CSS** : importer `@photo-sphere-viewer/core/index.css` dans le composant viewer
- **Storage rules** : toujours valider côté serveur la taille et le type des fichiers
- **Env vars** : toutes les variables Firebase commencent par `VITE_` pour être exposées au client
