import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { registerWithEmail, signInWithGoogle } from '@services/firebase'
import styles from './Auth.module.css'

const schema = z.object({
  displayName: z.string().min(2, 'Minimum 2 caractères'),
  email:       z.string().email('Email invalide'),
  password:    z.string().min(6, 'Minimum 6 caractères'),
  confirm:     z.string(),
}).refine((d) => d.password === d.confirm, {
  message: 'Les mots de passe ne correspondent pas',
  path: ['confirm'],
})

export default function Register() {
  const [serverError, setServerError] = useState(null)
  const [loading,     setLoading]     = useState(false)
  const [googleLoad,  setGoogleLoad]  = useState(false)

  // Même fix que Login — pas de navigate() manuel,
  // PublicRoute redirige automatiquement dès que authUserAtom est mis à jour

  const { register, handleSubmit, formState: { errors } } = useForm({
    resolver: zodResolver(schema),
  })

  const onSubmit = async ({ email, password, displayName }) => {
    setServerError(null)
    setLoading(true)
    try {
      await registerWithEmail(email, password, displayName)
      // PublicRoute gère la redirection
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
      // PublicRoute gère la redirection
    } catch (err) {
      if (err.code !== 'auth/popup-closed-by-user') {
        setServerError(firebaseError(err.code))
      }
      setGoogleLoad(false)
    }
  }

  return (
    <div className={styles.page}>
      <div className={styles.orb} aria-hidden />
      <div className={styles.card}>

        <div className={styles.cardHeader}>
          <span className={styles.logo}><span className={styles.logoMark}>LC</span>360</span>
          <h1 className={styles.title}>Créer un compte</h1>
          <p className={styles.subtitle}>Rejoignez LC360 et créez vos visites 360°</p>
        </div>

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
            <label htmlFor="displayName" className={styles.label}>Nom complet</label>
            <input id="displayName" type="text"
              className={`${styles.input} ${errors.displayName ? styles.inputError : ''}`}
              placeholder="Jean Dupont" autoComplete="name"
              {...register('displayName')} />
            {errors.displayName && <span className={styles.error}>{errors.displayName.message}</span>}
          </div>

          <div className={styles.field}>
            <label htmlFor="email" className={styles.label}>Email</label>
            <input id="email" type="email"
              className={`${styles.input} ${errors.email ? styles.inputError : ''}`}
              placeholder="vous@exemple.com" autoComplete="email"
              {...register('email')} />
            {errors.email && <span className={styles.error}>{errors.email.message}</span>}
          </div>

          <div className={styles.field}>
            <label htmlFor="password" className={styles.label}>Mot de passe</label>
            <input id="password" type="password"
              className={`${styles.input} ${errors.password ? styles.inputError : ''}`}
              placeholder="Minimum 6 caractères" autoComplete="new-password"
              {...register('password')} />
            {errors.password && <span className={styles.error}>{errors.password.message}</span>}
          </div>

          <div className={styles.field}>
            <label htmlFor="confirm" className={styles.label}>Confirmer le mot de passe</label>
            <input id="confirm" type="password"
              className={`${styles.input} ${errors.confirm ? styles.inputError : ''}`}
              placeholder="••••••••" autoComplete="new-password"
              {...register('confirm')} />
            {errors.confirm && <span className={styles.error}>{errors.confirm.message}</span>}
          </div>

          {serverError && <div className={styles.serverError} role="alert">{serverError}</div>}

          <button type="submit" className={styles.submit} disabled={loading || googleLoad}>
            {loading ? <><span className={styles.spinner} />Création…</> : 'Créer mon compte'}
          </button>
        </form>

        <p className={styles.switchLink}>
          Déjà un compte ? <Link to="/login" className={styles.link}>Se connecter</Link>
        </p>
      </div>
    </div>
  )
}

function firebaseError(code) {
  const map = {
    'auth/email-already-in-use':   'Un compte existe déjà avec cet email.',
    'auth/invalid-email':          'Email invalide.',
    'auth/weak-password':          'Mot de passe trop faible (6 caractères min).',
    'auth/network-request-failed': 'Erreur réseau. Vérifiez votre connexion.',
  }
  return map[code] ?? `Erreur : ${code}`
}
