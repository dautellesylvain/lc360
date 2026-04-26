import { useState, useEffect } from 'react'
import { useAtomValue } from 'jotai'
import { authUserAtom, userIsPROAtom } from '@store/auth'
import { auth, db } from '@services/firebase'
import { doc, setDoc, getDoc } from 'firebase/firestore'
import { signOut } from 'firebase/auth'
import { Link } from 'react-router-dom'
import styles from './Account.module.css'

const generateActivationKey = async (uid) => {
  const array = new Uint8Array(24)
  crypto.getRandomValues(array)
  const key = 'sk_' + Array.from(array).map(b => b.toString(16).padStart(2,'0')).join('')
  await setDoc(doc(db, 'users', uid), { sketchupKey: key, sketchupKeyCreatedAt: new Date() }, { merge: true })
  return key
}
const getActivationKey = async (uid) => {
  const snap = await getDoc(doc(db, 'users', uid))
  return snap.exists() ? snap.data().sketchupKey || null : null
}
const revokeActivationKey = async (uid) => {
  await setDoc(doc(db, 'users', uid), { sketchupKey: null, sketchupKeyCreatedAt: null }, { merge: true })
}

export default function Account() {
  const user  = useAtomValue(authUserAtom)
  const isPRO = useAtomValue(userIsPROAtom)
  const [key,         setKey]         = useState(null)
  const [loading,     setLoading]     = useState(true)
  const [generating,  setGenerating]  = useState(false)
  const [revoking,    setRevoking]    = useState(false)
  const [copied,      setCopied]      = useState(false)
  const [showKey,     setShowKey]     = useState(false)
  const [confirmRevoke, setConfirmRevoke] = useState(false)

  useEffect(() => {
    if (!user?.uid) return
    getActivationKey(user.uid).then(k => {
      setKey(k)
      setLoading(false)
    })
  }, [user?.uid])

  const handleGenerate = async () => {
    setGenerating(true)
    const k = await generateActivationKey(user.uid)
    setKey(k)
    setShowKey(true)
    setGenerating(false)
  }

  const handleRevoke = async () => {
    setRevoking(true)
    await revokeActivationKey(user.uid)
    setKey(null)
    setShowKey(false)
    setConfirmRevoke(false)
    setRevoking(false)
  }

  const handleCopy = async () => {
    await navigator.clipboard.writeText(key)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const maskedKey = key ? key.slice(0, 8) + '••••••••••••••••••••••••••••••••' : ''

  return (
    <div className={styles.page}>
      <div className={styles.container}>

        {/* Header */}
        <div className={styles.header}>
          <Link to="/dashboard" className={styles.backLink}>← Dashboard</Link>
          <h1 className={styles.title}>Mon compte</h1>
        </div>

        {/* Infos utilisateur */}
        <div className={styles.card}>
          <div className={styles.cardHeader}>
            <div className={styles.avatar}>
              {user?.email?.[0]?.toUpperCase() || '?'}
            </div>
            <div>
              <p className={styles.userEmail}>{user?.email}</p>
              {isPRO ? (
                <p className={styles.userPlan} style={{color:'#f59e0b', fontWeight:700}}>⭐ Plan PRO</p>
              ) : (
                <p className={styles.userPlan}>Plan Gratuit — <a href="/upgrade" style={{color:'#1d4ed8'}}>Passer en PRO</a></p>
              )}
            </div>
          </div>
        </div>

        {/* Clé d'activation SketchUp */}
        <div className={styles.card}>
          <div className={styles.cardTitleRow}>
            <div className={styles.sketchupIcon}>
              <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>
                <polyline points="3.27 6.96 12 12.01 20.73 6.96"/>
                <line x1="12" y1="22.08" x2="12" y2="12"/>
              </svg>
            </div>
            <div>
              <h2 className={styles.cardTitle}>Extension SketchUp</h2>
              <p className={styles.cardDesc}>Exportez vos scènes SketchUp en panoramas 360° directement dans IZI360.</p>
            </div>
          </div>

          {/* Bouton téléchargement */}
          <a
            href="/izi360.rbz"
            download="izi360.rbz"
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 8,
              background: '#1d4ed8', color: '#fff', textDecoration: 'none',
              borderRadius: 8, padding: '10px 18px', fontSize: 13,
              fontWeight: 700, marginBottom: 16, width: 'fit-content'
            }}
          >
            ⬇ Télécharger l'extension SketchUp (.rbz)
          </a>
          <p style={{fontSize: 12, color: 'var(--text-2)', marginBottom: 16}}>
            Compatible SketchUp 2020 et versions ultérieures. Installez via <strong>Extensions → Gestionnaire d'extensions → Installer l'extension</strong>.
          </p>

          {loading ? (
            <div className={styles.loading}>Chargement…</div>
          ) : key ? (
            <div className={styles.keySection}>
              <div className={styles.keyStatus}>
                <span className={styles.keyStatusDot} />
                Clé d'activation active
              </div>

              <div className={styles.keyBox}>
                <code className={styles.keyCode}>
                  {showKey ? key : maskedKey}
                </code>
                <div className={styles.keyActions}>
                  <button className={styles.keyBtn} onClick={() => setShowKey(v => !v)}>
                    {showKey ? 'Masquer' : 'Afficher'}
                  </button>
                  <button className={`${styles.keyBtn} ${copied ? styles.keyBtnCopied : ''}`} onClick={handleCopy}>
                    {copied ? '✓ Copié !' : 'Copier'}
                  </button>
                </div>
              </div>

              <div className={styles.keyInstructions}>
                <p className={styles.keyInstructionsTitle}>Comment utiliser votre clé :</p>
                <ol className={styles.keyInstructionsList}>
                  <li>Installez l'extension IZI360 dans SketchUp</li>
                  <li>Lancez <strong>Extensions → IZI360 — Exporter en 360°</strong></li>
                  <li>Collez votre clé d'activation quand demandée</li>
                  <li>La clé est mémorisée — plus jamais à ressaisir</li>
                </ol>
              </div>

              {!confirmRevoke ? (
                <button className={styles.revokeBtn} onClick={() => setConfirmRevoke(true)}>
                  Désactiver cette clé
                </button>
              ) : (
                <div className={styles.revokeConfirm}>
                  <p>Désactiver cette clé rendra l'extension SketchUp inutilisable jusqu'à ce que vous en génériez une nouvelle.</p>
                  <div className={styles.revokeConfirmBtns}>
                    <button className={styles.keyBtn} onClick={() => setConfirmRevoke(false)}>Annuler</button>
                    <button className={styles.revokeBtnConfirm} onClick={handleRevoke} disabled={revoking}>
                      {revoking ? 'Désactivation…' : 'Oui, désactiver'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className={styles.noKey}>
              <p className={styles.noKeyDesc}>
                Générez votre clé d'activation personnelle pour connecter l'extension SketchUp à votre compte IZI360.
                Cette clé est unique et ne sera générée qu'une seule fois.
              </p>
              <button className={styles.generateBtn} onClick={handleGenerate} disabled={generating}>
                {generating ? 'Génération…' : '🔑 Générer ma clé d\'activation'}
              </button>
            </div>
          )}
        </div>

        {/* Déconnexion */}
        <button className={styles.signOutBtn} onClick={() => signOut(auth)}>
          Se déconnecter
        </button>

      </div>
    </div>
  )
}
