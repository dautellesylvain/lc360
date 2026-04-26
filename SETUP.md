# 🚀 Lancer LC360 sur votre machine

## Étape 1 — Télécharger les fichiers
Cliquez sur le bouton de téléchargement dans Claude pour récupérer le dossier LC360/

## Étape 2 — Ouvrir un terminal dans le dossier
```bash
cd LC360
```

## Étape 3 — Installer les dépendances
```bash
npm install
```

## Étape 4 — Lancer l'app
```bash
npm run dev
```

## Étape 5 — Ouvrir dans le navigateur
→ http://localhost:5173

---

## ⚠️ Avant de vous connecter
Dans Firebase Console (https://console.firebase.google.com) :
1. Authentication → Sign-in methods → activer Email/Password + Google
2. Firestore → Créer la base (mode test)
3. Storage → Get started

Le fichier .env.local est déjà configuré avec vos credentials.
