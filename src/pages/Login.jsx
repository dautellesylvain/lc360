import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { signInWithEmail, signInWithGoogle } from '@services/firebase'
import styles from './Auth.module.css'

const schema = z.object({
  email:    z.string().email('Email invalide'),
  password: z.string().min(1, 'Mot de passe requis'),
})

export default function Login() {
  const [serverError, setServerError] = useState(null)
  const [loading,     setLoading]     = useState(false)
  const [googleLoad,  setGoogleLoad]  = useState(false)
  const [resetMode,   setResetMode]   = useState(false)
  const [resetSent,   setResetSent]   = useState(false)

  // ⚠️ PAS de useNavigate ici — c'est PublicRoute dans App.jsx qui
  // redirige vers /dashboard dès que authUserAtom passe à non-null.
  // Appeler navigate() manuellement créait une race condition avec
  // onAuthStateChanged → écran noir.

  const { register, handleSubmit, formState: { errors } } = useForm({
    resolver: zodResolver(schema),
  })

  const onSubmit = async ({ email, password }) => {
    setServerError(null)
    setLoading(true)
    try {
      await signInWithEmail(email, password)
      // Pas de navigate() — PublicRoute détecte authUserAtom et redirige
    } catch (err) {
      setServerError(firebaseError(err.code))
      setLoading(false)
    }
  }

  const handleGoogle = async () => {
    setServerError(null)
    setGoogleLoad(true)
    try {
      await signInWithGoogle()
      // Pas de navigate() — PublicRoute détecte authUserAtom et redirige
    } catch (err) {
      if (err.code !== 'auth/popup-closed-by-user') {
        setServerError(firebaseError(err.code))
      }
      setGoogleLoad(false)
    }
  }

  const handleResetPassword = async (email) => {
    setServerError(null)
    setLoading(true)
    try {
      const { sendPasswordResetEmail } = await import('firebase/auth')
      const { auth } = await import('@services/firebase')
      await sendPasswordResetEmail(auth, email)
      setResetSent(true)
      setLoading(false)
    } catch (err) {
      setServerError(firebaseError(err.code))
      setLoading(false)
    }
  }

  return (
    <div className={styles.page}>
      <div className={styles.orb} aria-hidden />
      <div className={styles.card}>

        <div className={styles.cardHeader}>
          <span className={styles.logo}><span className={styles.logoMark}>LC</span>360</span>
          <h1 className={styles.title}>{resetMode ? 'Réinitialiser le mot de passe' : 'Connexion'}</h1>
          <p className={styles.subtitle}>
            {resetMode 
              ? 'Entrez votre email pour recevoir un lien de réinitialisation'
              : 'Accédez à vos visites virtuelles 360°'}
          </p>
        </div>

        {resetSent ? (
          <div style={{ textAlign: 'center', padding: '20px 0' }}>
            <div style={{ fontSize: '48px', marginBottom: '16px' }}>✉️</div>
            <h3 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '8px', color: 'var(--text-1)' }}>
              Email envoyé !
            </h3>
            <p style={{ fontSize: '14px', color: 'var(--text-2)', marginBottom: '20px' }}>
              Consultez votre boîte mail pour réinitialiser votre mot de passe.
            </p>
            <button 
              className={styles.submit} 
              onClick={() => { setResetMode(false); setResetSent(false) }}
              style={{ maxWidth: '200px', margin: '0 auto' }}
            >
              Retour à la connexion
            </button>
          </div>
        ) : resetMode ? (
          <>
            <form onSubmit={handleSubmit(({ email }) => handleResetPassword(email))} className={styles.form} noValidate>
              <div className={styles.field}>
                <label htmlFor="email" className={styles.label}>Email</label>
                <input id="email" type="email"
                  className={`${styles.input} ${errors.email ? styles.inputError : ''}`}
                  placeholder="vous@exemple.com" autoComplete="email"
                  {...register('email')} />
                {errors.email && <span className={styles.error}>{errors.email.message}</span>}
              </div>

              {serverError && <div className={styles.serverError} role="alert">{serverError}</div>}

              <button type="submit" className={styles.submit} disabled={loading}>
                {loading ? <><span className={styles.spinner} />Envoi…</> : 'Envoyer le lien'}
              </button>
            </form>

            <p className={styles.switchLink}>
              <button 
                onClick={() => { setResetMode(false); setServerError(null) }} 
                className={styles.link}
                style={{ background: 'none', border: 'none', padding: 0, font: 'inherit', cursor: 'pointer' }}
              >
                ← Retour à la connexion
              </button>
            </p>
          </>
        ) : (
          <>
            <button className={styles.googleBtn} onClick={handleGoogle} disabled={googleLoad || loading} type="button">
              {googleLoad ? <span className={styles.spinner} /> : (
                <svg width="18" height="18" viewBox="0 0 48 48">
                  <path fill="#4285F4" d="M47.5 24.5c0-1.6-.1-3.1-.4-4.5H24v8.5h13.2c-.6 3-2.3 5.5-4.9 7.2v6h7.9c4.6-4.3 7.3-10.6 7.3-17.2z"/>
                  <path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.9-6c-2.1 1.4-4.8 2.3-8 2.3-6.1 0-11.3-4.1-13.2-9.7H2.6v6.2C6.5 42.5 14.7 48 24 48z"/>
                  <path fill="#FBBC05" d="M10.8 28.8c-.5-1.4-.8-2.8-.8-4.3s.3-3 .8-4.3v-6.2H2.6C1 17.3 0 20.5 0 24s1 6.7 2.6 9.9l8.2-6.1z"/>
                  <path fill="#EA4335" d="M24 9.5c3.4 0 6.5 1.2 8.9 3.5l6.6-6.6C35.9 2.5 30.5 0 24 0 14.7 0 6.5 5.5 2.6 14.1l8.2 6.1C12.7 13.6 17.9 9.5 24 9.5z"/>
                </svg>
              )}
              Continuer avec Google
            </button>

            <div className={styles.divider}><span>ou</span></div>

            <form onSubmit={handleSubmit(onSubmit)} className={styles.form} noValidate>
              <div className={styles.field}>
                <label htmlFor="email" className={styles.label}>Email</label>
                <input id="email" type="email"
                  className={`${styles.input} ${errors.email ? styles.inputError : ''}`}
                  placeholder="vous@exemple.com" autoComplete="email"
                  {...register('email')} />
                {errors.email && <span className={styles.error}>{errors.email.message}</span>}
              </div>

              <div className={styles.field}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <label htmlFor="password" className={styles.label}>Mot de passe</label>
                  <button 
                    type="button"
                    onClick={() => { setResetMode(true); setServerError(null) }}
                    className={styles.link}
                    style={{ background: 'none', border: 'none', padding: 0, fontSize: '13px', cursor: 'pointer' }}
                  >
                    Mot de passe oublié ?
                  </button>
                </div>
                <input id="password" type="password"
                  className={`${styles.input} ${errors.password ? styles.inputError : ''}`}
                  placeholder="••••••••" autoComplete="current-password"
                  {...register('password')} />
                {errors.password && <span className={styles.error}>{errors.password.message}</span>}
              </div>

              {serverError && <div className={styles.serverError} role="alert">{serverError}</div>}

              <button type="submit" className={styles.submit} disabled={loading || googleLoad}>
                {loading ? <><span className={styles.spinner} />Connexion…</> : 'Se connecter'}
              </button>
            </form>

            <p className={styles.switchLink}>
              Pas encore de compte ? <Link to="/register" className={styles.link}>Créer un compte</Link>
            </p>
          </>
        )}
      </div>
    </div>
  )
}

function firebaseError(code) {
  const map = {
    'auth/user-not-found':         'Aucun compte avec cet email.',
    'auth/wrong-password':         'Mot de passe incorrect.',
    'auth/invalid-credential':     'Email ou mot de passe incorrect.',
    'auth/too-many-requests':      'Trop de tentatives. Réessayez plus tard.',
    'auth/user-disabled':          'Ce compte a été désactivé.',
    'auth/network-request-failed': 'Erreur réseau. Vérifiez votre connexion.',
  }
  return map[code] ?? `Erreur : ${code}`
}
