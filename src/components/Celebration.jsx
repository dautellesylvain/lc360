import { useState, useEffect, useCallback } from 'react'
import { db } from '@services/firebase'
import { doc, updateDoc, getDoc } from 'firebase/firestore'

// ── Confetti presets ─────────────────────────────────────────
export const fireworks = async () => {
  const confetti = (await import('canvas-confetti')).default
  const duration = 3000
  const end = Date.now() + duration
  const colors = ['#1d4ed8', '#f59e0b', '#22c55e', '#ec4899', '#8b5cf6']
  const frame = () => {
    confetti({ particleCount: 3, angle: 60, spread: 55, origin: { x: 0 }, colors })
    confetti({ particleCount: 3, angle: 120, spread: 55, origin: { x: 1 }, colors })
    if (Date.now() < end) requestAnimationFrame(frame)
  }
  frame()
}

export const starburst = async () => {
  const confetti = (await import('canvas-confetti')).default
  confetti({ particleCount: 120, spread: 360, startVelocity: 30, origin: { x: 0.5, y: 0.5 }, colors: ['#f59e0b', '#fbbf24', '#fde68a', '#fff', '#1d4ed8'], shapes: ['star'], scalar: 1.2 })
}

export const gentleRain = async () => {
  const confetti = (await import('canvas-confetti')).default
  confetti({ particleCount: 60, spread: 80, origin: { x: 0.5, y: 0 }, colors: ['#1d4ed8', '#60a5fa', '#93c5fd', '#22c55e', '#86efac'] })
}

// ── Celebrations config ──────────────────────────────────────
export const CELEBRATIONS = {
  pro: {
    emoji: '⭐',
    title: 'Bienvenue dans le club PRO !',
    message: 'Toutes les fonctionnalités sont débloquées. Créez des visites illimitées, sans watermark, avec votre propre logo.',
    color: '#f59e0b',
    confetti: fireworks,
  },
  firstPublish: {
    emoji: '🚀',
    title: 'Visite publiée !',
    message: 'Votre visite virtuelle est maintenant en ligne. Partagez le lien avec vos clients — accessible sur tous les appareils.',
    color: '#22c55e',
    confetti: starburst,
  },
  firstVisitor: {
    emoji: '👁️',
    title: 'Premier visiteur externe !',
    message: 'Quelqu\'un vient de découvrir votre visite virtuelle pour la première fois. Votre travail est apprécié !',
    color: '#8b5cf6',
    confetti: gentleRain,
  },
  hundredVisitors: {
    emoji: '💯',
    title: '100 visiteurs uniques !',
    message: 'Incroyable — 100 personnes ont découvert vos visites virtuelles. Vous créez de la valeur réelle pour vos clients.',
    color: '#ec4899',
    confetti: fireworks,
  },
  firstProject: {
    emoji: '🎉',
    title: 'Votre aventure commence !',
    message: 'Vous venez de créer votre première visite virtuelle 360°. Ajoutez vos panoramas et partagez-la avec vos clients.',
    color: '#1d4ed8',
    confetti: gentleRain,
  },
  fiveProjects: {
    emoji: '🏆',
    title: 'Créateur actif !',
    message: 'Vous avez créé 5 visites virtuelles. Vous maîtrisez l\'outil — continuez sur cette lancée !',
    color: '#8b5cf6',
    confetti: gentleRain,
  },
  tenProjects: {
    emoji: '💎',
    title: 'Expert 360° !',
    message: 'Impressionnant — 10 visites virtuelles créées ! Vous faites partie des utilisateurs les plus actifs.',
    color: '#ec4899',
    confetti: fireworks,
  },
}

// ── Marquer une célébration comme vue dans Firestore ─────────
export const markCelebrationSeen = async (uid, type) => {
  if (!uid) return
  try {
    await updateDoc(doc(db, 'users', uid), {
      [`celebrations.${type}`]: new Date().toISOString()
    })
  } catch(e) {}
}

// ── Vérifier si une célébration a déjà été vue ───────────────
export const hasCelebrationBeenSeen = async (uid, type) => {
  if (!uid) return true
  try {
    const snap = await getDoc(doc(db, 'users', uid))
    return !!snap.data()?.celebrations?.[type]
  } catch(e) { return true }
}

// ── Celebration Modal ────────────────────────────────────────
export function CelebrationModal({ type, onClose }) {
  const [visible, setVisible] = useState(false)
  const cel = CELEBRATIONS[type]

  useEffect(() => {
    if (!cel) return
    setVisible(true)
    cel.confetti?.()
    const timer = setTimeout(() => {
      setVisible(false)
      setTimeout(onClose, 300)
    }, 6000)
    return () => clearTimeout(timer)
  }, [type])

  if (!cel || !visible) return null

  return (
    <div
      onClick={() => { setVisible(false); setTimeout(onClose, 300) }}
      style={{
        position: 'fixed', inset: 0, zIndex: 99999,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'rgba(0,0,0,.6)',
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: 'var(--surface)',
          border: `2px solid ${cel.color}`,
          borderRadius: 20,
          padding: '40px 48px',
          maxWidth: 440,
          width: '90%',
          textAlign: 'center',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 16,
          animation: 'celebrationPop .4s cubic-bezier(.34,1.56,.64,1)',
        }}
      >
        <div style={{ fontSize: 72, lineHeight: 1, animation: 'celebrationBounce 1s ease infinite alternate' }}>
          {cel.emoji}
        </div>
        <h2 style={{ fontSize: 22, fontWeight: 800, color: cel.color, margin: 0 }}>
          {cel.title}
        </h2>
        <p style={{ fontSize: 14, color: 'var(--text-2)', lineHeight: 1.6, margin: 0 }}>
          {cel.message}
        </p>
        <button
          onClick={() => { setVisible(false); setTimeout(onClose, 300) }}
          style={{
            marginTop: 8, background: cel.color, border: 'none', borderRadius: 10,
            padding: '10px 28px', fontSize: 14, fontWeight: 700, color: '#fff', cursor: 'pointer',
          }}
        >
          Super ! 🎊
        </button>
        <p style={{ fontSize: 11, color: 'var(--text-3)', margin: 0 }}>Cliquez n\'importe où pour fermer</p>
      </div>
      <style>{`
        @keyframes celebrationPop { from { transform: scale(0.5); opacity: 0; } to { transform: scale(1); opacity: 1; } }
        @keyframes celebrationBounce { from { transform: translateY(0) rotate(-5deg); } to { transform: translateY(-8px) rotate(5deg); } }
      `}</style>
    </div>
  )
}

// ── Hook célébration ─────────────────────────────────────────
export function useCelebration() {
  const [celebration, setCelebration] = useState(null)
  const celebrate = useCallback((type) => setCelebration(type), [])
  const dismiss   = useCallback(() => setCelebration(null), [])
  return { celebration, celebrate, dismiss }
}

// ── Message de bonjour quotidien ─────────────────────────────
const GREETINGS = {
  morning:   ['☀️ Bonne journée', '🌅 Bonjour', '☕ Prêt à créer'],
  afternoon: ['🌤️ Bon après-midi', '💪 Belle journée', '🎯 En pleine forme'],
  evening:   ['🌙 Bonsoir', '🌆 Belle soirée', '✨ Bonne fin de journée'],
}

const WEEKLY = {
  1: '💪 Bonne semaine productive !',
  5: '🎉 Bon weekend !',
  0: '☀️ Bon dimanche !',
}

export function DailyGreeting({ userName, projectCount }) {
  const [visible, setVisible] = useState(false)
  const [message, setMessage] = useState('')

  useEffect(() => {
    const lastGreeting = localStorage.getItem('lc360_last_greeting')
    const today = new Date().toDateString()
    if (lastGreeting === today) return

    // Petite animation confetti discrète une fois par jour
    setTimeout(async () => {
      const confetti = (await import('canvas-confetti')).default
      confetti({ particleCount: 20, spread: 60, origin: { x: 0.5, y: 0 }, colors: ['#1d4ed8', '#60a5fa', '#f59e0b'], startVelocity: 20, gravity: 1.2 })
    }, 800)

    const hour = new Date().getHours()
    const day  = new Date().getDay()

    let greeting = ''
    if (WEEKLY[day]) {
      greeting = WEEKLY[day]
    } else {
      const slot = hour < 12 ? 'morning' : hour < 18 ? 'afternoon' : 'evening'
      const options = GREETINGS[slot]
      greeting = options[Math.floor(Math.random() * options.length)]
    }

    const name = userName?.split(' ')[0] || ''
    const context = projectCount > 0
      ? ` Vous avez ${projectCount} visite${projectCount > 1 ? 's' : ''} active${projectCount > 1 ? 's' : ''}.`
      : ' Créez votre première visite aujourd\'hui !'

    setMessage(`${greeting}${name ? ` ${name}` : ''} !${context}`)
    setVisible(true)
    localStorage.setItem('lc360_last_greeting', today)
  }, [])

  if (!visible) return null

  return (
    <div style={{
      background: 'linear-gradient(135deg, rgba(29,78,216,.15), rgba(139,92,246,.1))',
      border: '1px solid rgba(29,78,216,.2)',
      borderRadius: 12,
      padding: '12px 18px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 12,
      marginBottom: 16,
      animation: 'slideDown .3s ease',
    }}>
      <p style={{ fontSize: 14, color: 'var(--text-1)', margin: 0, fontWeight: 500 }}>
        {message}
      </p>
      <button
        onClick={() => setVisible(false)}
        style={{ background: 'none', border: 'none', color: 'var(--text-2)', cursor: 'pointer', fontSize: 16, padding: '0 4px' }}
      >
        ✕
      </button>
      <style>{`@keyframes slideDown { from { opacity:0; transform:translateY(-8px) } to { opacity:1; transform:translateY(0) } }`}</style>
    </div>
  )
}
