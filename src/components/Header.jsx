import { Link, useNavigate, useLocation } from 'react-router-dom'
import { useAtomValue, useSetAtom } from 'jotai'
import { authUserAtom, userNameAtom, signOutAtom } from '@store/auth'
import styles from './Header.module.css'

const NAV_LINKS = [
  { to: '/dashboard',   label: 'Dashboard' },
  { to: '/project/new', label: '+ Nouveau' },
  { to: '/upgrade',     label: '⭐ PRO' },
  { to: '/account',     label: 'Mon compte' },
]

function Avatar({ user }) {
  const initials = (user?.displayName || user?.email || '?')
    .split(/[\s@]/)
    .filter(Boolean)
    .map(s => s[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)

  if (user?.photoURL) {
    return <img src={user.photoURL} alt="Avatar" className={styles.avatarImg} referrerPolicy="no-referrer" />
  }
  return <span className={styles.avatarInitials}>{initials}</span>
}

export default function Header() {
  const user        = useAtomValue(authUserAtom)
  const displayName = useAtomValue(userNameAtom)
  const doSignOut   = useSetAtom(signOutAtom)
  const navigate    = useNavigate()
  const location    = useLocation()

  const handleSignOut = async () => {
    await doSignOut()
    navigate('/login', { replace: true })
  }

  return (
    <header className={styles.header}>
      <div className={styles.inner}>

        <Link to="/dashboard" className={styles.logo}>
          <span className={styles.logoMark}>LC</span>360
        </Link>

        <nav className={styles.nav} aria-label="Navigation principale">
          {NAV_LINKS.map(({ to, label }) => (
            <Link
              key={to}
              to={to}
              className={`${styles.navLink} ${location.pathname === to ? styles.active : ''}`}
            >
              {label}
            </Link>
          ))}
        </nav>

        {user && (
          <div className={styles.actions}>
            <div className={styles.userInfo}>
              <div className={styles.avatar}><Avatar user={user} /></div>
              <span className={styles.userEmail}>{displayName}</span>
            </div>
            <button className={styles.signOutBtn} onClick={handleSignOut} title="Se déconnecter">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
                <polyline points="16 17 21 12 16 7"/>
                <line x1="21" y1="12" x2="9" y2="12"/>
              </svg>
              Déconnexion
            </button>
          </div>
        )}

      </div>
    </header>
  )
}
