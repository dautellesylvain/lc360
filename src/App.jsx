import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Suspense, lazy } from 'react'
import { useAtomValue } from 'jotai'
import { authUserAtom, authLoadingAtom } from '@store/auth'
import Header from '@components/Header'
import Login    from '@pages/Login'
import Register from '@pages/Register'
import Landing    from '@pages/Landing'
import Dashboard from '@pages/Dashboard'
import Account   from '@pages/Account'
import Upgrade   from '@pages/Upgrade'
import Admin     from '@pages/Admin'

const ProjectViewer = lazy(() => import('@pages/ProjectViewer'))
const PublicViewer  = lazy(() => import('@pages/PublicViewer'))
const NewProject    = lazy(() => import('@pages/NewProject'))

function Spinner() {
  return (
    <div style={{
      display:'flex', alignItems:'center', justifyContent:'center',
      height:'100dvh', gap:12, color:'var(--text-2)',
      fontFamily:'var(--font-display)', fontSize:13, letterSpacing:'0.1em',
    }}>
      <span style={{
        width:20, height:20,
        border:'2px solid var(--accent)', borderTopColor:'transparent',
        borderRadius:'50%', animation:'spin .7s linear infinite', display:'inline-block',
      }}/>
      CHARGEMENT
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )
}

function ProtectedRoute({ children }) {
  const user    = useAtomValue(authUserAtom)
  const loading = useAtomValue(authLoadingAtom)
  if (loading) return <Spinner />
  if (!user)   return <Navigate to="/login" replace />
  return children
}

function PublicRoute({ children }) {
  const user    = useAtomValue(authUserAtom)
  const loading = useAtomValue(authLoadingAtom)
  if (loading) return <Spinner />
  if (user)    return <Navigate to="/dashboard" replace />
  return children
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Routes publiques */}
        <Route path="/" element={<Landing />} />
        <Route path="/login"    element={<PublicRoute><Login /></PublicRoute>} />
        <Route path="/register" element={<PublicRoute><Register /></PublicRoute>} />

        {/* Routes protégées — layout avec Header */}
        <Route path="/dashboard" element={
          <ProtectedRoute>
            <div style={{ display:'flex', flexDirection:'column', minHeight:'100dvh' }}>
              <Header />
              <main style={{ flex:1 }}><Dashboard /></main>
            </div>
          </ProtectedRoute>
        }/>

        <Route path="/project/new" element={
          <ProtectedRoute>
            <div style={{ display:'flex', flexDirection:'column', minHeight:'100dvh' }}>
              <Header />
              <main style={{ flex:1 }}>
                <Suspense fallback={<Spinner />}><NewProject /></Suspense>
              </main>
            </div>
          </ProtectedRoute>
        }/>

        <Route path="/project/:id" element={
          <ProtectedRoute>
            <div style={{ display:'flex', flexDirection:'column', minHeight:'100dvh' }}>
              <Header />
              <main style={{ flex:1 }}>
                <Suspense fallback={<Spinner />}><ProjectViewer /></Suspense>
              </main>
            </div>
          </ProtectedRoute>
        }/>

        {/* Catch-all */}
        <Route path="/admin" element={
          <ProtectedRoute>
            <Admin />
          </ProtectedRoute>
        } />
        <Route path="/upgrade" element={
          <ProtectedRoute>
            <Upgrade />
          </ProtectedRoute>
        } />
        <Route path="/account" element={
          <ProtectedRoute>
            <Account />
          </ProtectedRoute>
        } />
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        {/* Route publique — sans auth */}
        <Route path="/view/:token" element={
          <Suspense fallback={<Spinner />}><PublicViewer /></Suspense>
        }/>

        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
