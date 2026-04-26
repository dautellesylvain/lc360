const firebaseConfig = {
  apiKey:            import.meta.env.VITE_FIREBASE_API_KEY            ?? "AIzaSyAHdj1IQb6Ss36IpGKLylREaV_1CLG7XD0",
  authDomain:        import.meta.env.VITE_FIREBASE_AUTH_DOMAIN        ?? "lc360-5d3e9.firebaseapp.com",
  projectId:         import.meta.env.VITE_FIREBASE_PROJECT_ID         ?? "lc360-5d3e9",
  storageBucket:     import.meta.env.VITE_FIREBASE_STORAGE_BUCKET     ?? "lc360-5d3e9.firebasestorage.app",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID ?? "181478645638",
  appId:             import.meta.env.VITE_FIREBASE_APP_ID             ?? "1:181478645638:web:d215a6dbe522298ccdd607",
}

export default firebaseConfig
