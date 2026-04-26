import { useAtomValue } from 'jotai'
import { useEffect, useState } from 'react'
import { authUserAtom } from '@store/auth'
import { Link } from 'react-router-dom'
import { redirectToCheckout } from '@services/stripe'
import { db } from '@services/firebase'
import { doc, getDoc } from 'firebase/firestore'
import styles from './Upgrade.module.css'

const PRO_FEATURES = [
  'Tout le plan Gratuit, plus :',
  'Visites illimitées',
  'Sans watermark',
  'Écran d\'accueil personnalisé (splash screen)',
  'Logo personnalisé',
  'Code d\'accès aux visites',
  'Formulaire contact intégré',
  'Analytics détaillés',
  'Musique d\'ambiance',
  'Export Facebook 360°',
  '🏗️ Extension SketchUp — Illimité !',
]

const FREE_MISSING = [
  'Watermark IZI360',
  'Pas de personnalisation',
]

export default function Upgrade() {
  const user = useAtomValue(authUserAtom)
  const [limits, setLimits] = useState({ scenes_free: 8, projects_free: 3, exports_free: 5 })

  useEffect(() => {
    getDoc(doc(db, 'config', 'limits')).then(snap => {
      if (snap.exists()) setLimits(snap.data())
    }).catch(() => {})
  }, [])

  const handleMonthly = () => redirectToCheckout('monthly', user?.uid, user?.email)
  const handleYearly  = () => redirectToCheckout('yearly',  user?.uid, user?.email)

  const freeFeatures = [
    `${limits.projects_free} visites actives simultanément`,
    `${limits.scenes_free} scènes par visite`,
    'Navigation entre les pièces',
    'Partage par lien, QR code et intégration web',
    `🏗️ Extension SketchUp — ${limits.exports_free} exports/mois`,
  ]

  return (
    <div className={styles.page}>
      <div className={styles.container}>

        <Link to="/dashboard" className={styles.backLink}>← Dashboard</Link>

        <div className={styles.header}>
          <h1 className={styles.title}>Choisissez votre plan</h1>
          <p className={styles.subtitle}>Débloquez toutes les fonctionnalités pour vos visites virtuelles professionnelles</p>
        </div>

        <div className={styles.plansGrid3}>

          {/* Gratuit */}
          <div className={styles.planCard}>
            <div className={styles.planHeader}>
              <h2 className={styles.planName}>Gratuit</h2>
              <div className={styles.planPrice}>
                <span className={styles.planAmount}>0€</span>
                <span className={styles.planPeriod}>/mois</span>
              </div>
              <p className={styles.planDesc}>Pour découvrir la plateforme</p>
            </div>
            <ul className={styles.featureList}>
              {freeFeatures.map(f => (
                <li key={f} className={styles.featureItem}>
                  <span className={styles.featureCheck}>✓</span>{f}
                </li>
              ))}
              {FREE_MISSING.map(f => (
                <li key={f} className={`${styles.featureItem} ${styles.featureMissing}`}>
                  <span className={styles.featureCross}>✗</span>{f}
                </li>
              ))}
            </ul>
            <div className={styles.planCurrent}>Plan actuel</div>
          </div>

          {/* PRO Annuel — mis en avant */}
          <div className={`${styles.planCard} ${styles.planCardBest}`}>
            <div className={styles.bestBadge}>⭐ Meilleure offre</div>
            <div className={styles.planHeader}>
              <h2 className={styles.planName}>PRO Annuel</h2>
              <div className={styles.planPrice}>
                <span className={styles.planAmount}>8,25€</span>
                <span className={styles.planPeriod}>/mois</span>
              </div>
              <p className={styles.yearlyBilling}>Facturé 99€/an</p>
              <div className={styles.savingPill}>Économisez 81€/an</div>
            </div>
            <ul className={styles.featureList}>
              {PRO_FEATURES.map((f, i) => (
                <li key={f} className={styles.featureItem} style={i === 0 ? {color:'var(--text-2)', fontSize:12, fontStyle:'italic'} : {}}>
                  {i === 0 ? f : <><span className={styles.featureCheck}>✓</span>{f}</>}
                </li>
              ))}
            </ul>
            <button className={styles.upgradeBtnBest} onClick={handleYearly}>
              Démarrer — 99€/an
            </button>
            <p className={styles.cancelNote}>Offre de lancement · Prix garanti</p>
          </div>

          {/* PRO Mensuel */}
          <div className={`${styles.planCard} ${styles.planCardPro}`}>
            <div className={styles.proBadge}>PRO</div>
            <div className={styles.planHeader}>
              <h2 className={styles.planName}>PRO Mensuel</h2>
              <div className={styles.planPrice}>
                <span className={styles.planAmount}>15€</span>
                <span className={styles.planPeriod}>/mois</span>
              </div>
              <p className={styles.planDesc}>Sans engagement</p>
            </div>
            <ul className={styles.featureList}>
              {PRO_FEATURES.map((f, i) => (
                <li key={f} className={styles.featureItem} style={i === 0 ? {color:'var(--text-2)', fontSize:12, fontStyle:'italic'} : {}}>
                  {i === 0 ? f : <><span className={styles.featureCheck}>✓</span>{f}</>}
                </li>
              ))}
            </ul>
            <button className={styles.upgradeBtn} onClick={handleMonthly}>
              Démarrer — 15€/mois
            </button>
            <p className={styles.cancelNote}>Sans engagement · Annulable à tout moment</p>
          </div>

        </div>

      </div>
    </div>
  )
}
