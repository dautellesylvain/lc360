import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { createStore, Provider } from 'jotai'
import App from './App.jsx'
import { initAuthListener, initPlanListener, authUserAtom } from './store/auth.js'
import './index.css'

const store = createStore()

// Démarre l'écouteur Firebase auth
initAuthListener(store)

// Démarre l'écouteur du plan quand l'utilisateur se connecte
let unsubPlan = null
store.sub(authUserAtom, () => {
  const user = store.get(authUserAtom)
  if (unsubPlan) unsubPlan()
  if (user?.uid) {
    unsubPlan = initPlanListener(store, user.uid)
  }
})

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <Provider store={store}>
      <App />
    </Provider>
  </StrictMode>,
)
