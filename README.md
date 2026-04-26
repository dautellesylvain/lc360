# LC360

> Plateforme de visites virtuelles 360° — React 19 + Vite + Firebase + PSV.js

## 🚀 Démarrage rapide

```bash
# 1. Installer les dépendances
npm install

# 2. Configurer Firebase
cp .env.example .env.local
# → Remplissez les valeurs dans .env.local

# 3. Lancer le serveur de dev
npm run dev
# → http://localhost:5173
```

## ⚙️ Configuration Firebase

1. Créez un projet sur [Firebase Console](https://console.firebase.google.com)
2. Activez **Authentication** → Email/Password (+ Google si souhaité)
3. Créez une base **Firestore** (mode test pour commencer)
4. Configurez **Storage**
5. Copiez la config SDK dans `.env.local`

## 📦 Stack

| Technologie | Version |
|---|---|
| React | 19 |
| Vite | 6 |
| Firebase | 11 |
| Jotai | 2 |
| Photo Sphere Viewer | 5 |
| Zod + React Hook Form | latest |

## 📋 Phases de développement

Voir [MEMORY.md](./MEMORY.md) pour le plan complet en 6 phases.
