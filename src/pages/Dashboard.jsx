import { useEffect, useState, useRef } from 'react'
import { useNavigate, useLocation, Link } from 'react-router-dom'
import { useAtomValue } from 'jotai'
import { authUserAtom, userNameAtom, userIsPROAtom, userPlanAtom, onboardingDoneAtom, celebrationsAtom } from '@store/auth'
import { useDashboardTour } from '@hooks/useOnboardingTour'
import { subscribeToProjects, updateProject, deleteProject, db } from '@services/firebase'
import { doc, getDoc } from 'firebase/firestore'
import { uploadImage } from '@services/cloudinary'
import styles from './Dashboard.module.css'
import EditProjectModal from './EditProjectModal'
import { CelebrationModal, useCelebration, DailyGreeting, markCelebrationSeen, hasCelebrationBeenSeen } from '@components/Celebration'
import ProjectAnalytics from './ProjectAnalytics'
import ShareModal from '@components/ShareModal'
import ElfsightChat from '@components/ElfsightChat'



export default function Dashboard() {
  const user           = useAtomValue(authUserAtom)
  const displayName    = useAtomValue(userNameAtom)
  const isPRO          = useAtomValue(userIsPROAtom)
  const userPlan       = useAtomValue(userPlanAtom)
  const onboardingDone  = useAtomValue(onboardingDoneAtom)
  const celebrations    = useAtomValue(celebrationsAtom)
  const navigate       = useNavigate()
  const location       = useLocation()

  const { celebration, celebrate, dismiss } = useCelebration()
  const { startTour }  = useDashboardTour(user?.uid, onboardingDone)

  const [projectsLimit, setProjectsLimit] = useState(3)

  // Debug — exposer celebrate dans la console
  useEffect(() => {
    getDoc(doc(db, 'config', 'limits')).then(snap => {
      if (snap.exists()) setProjectsLimit(snap.data().projects_free || 3)
    }).catch(() => {})
  }, [])

  useEffect(() => { window.__celebrate = celebrate }, [celebrate])

  // Célébration PRO — déclencher si plan=pro et pas encore célébré
  const celebrationsRef = useRef(celebrations)
  useEffect(() => { celebrationsRef.current = celebrations }, [celebrations])

  useEffect(() => {
    if (!user?.uid || userPlan !== 'pro') return
    const timer = setTimeout(() => {
      if (!celebrationsRef.current?.pro) {
        celebrate('pro')
        markCelebrationSeen(user.uid, 'pro')
      }
    }, 1500)
    return () => clearTimeout(timer)
  }, [user?.uid, userPlan])

  // Vérifier les milestones visiteurs en attente
  const prevCelebrationsRef = useRef({})
  useEffect(() => {
    if (!user?.uid) return
    const prev = prevCelebrationsRef.current
    ;['hundredVisitors'].forEach(m => {
      if (celebrations[m] && !prev[m]) {
        celebrate(m)
      }
    })
    prevCelebrationsRef.current = celebrations
  }, [user?.uid, celebrations])

  // Célébration passage PRO
  useEffect(() => {
    if (location.search.includes('upgrade=success') && user?.uid) {
      hasCelebrationBeenSeen(user.uid, 'pro').then(seen => {
        if (!seen) { celebrate('pro'); markCelebrationSeen(user.uid, 'pro') }
      })
      navigate('/dashboard', { replace: true })
    }
  }, [location.search, user?.uid])

  const [projects,     setProjects]     = useState([])
  const prevProjectCount = useRef(null)
  const [loading,      setLoading]      = useState(true)
  const [shareProject, setShareProject] = useState(null)
  const [editProject,      setEditProject]      = useState(null)  // modal édition
  const [analyticsProject, setAnalyticsProject] = useState(null)  // modal analytics

  useEffect(() => {
    if (!user?.uid) return
    const unsub = subscribeToProjects(user.uid, (snap) => {
      setProjects(snap.docs.map(d => ({ id: d.id, ...d.data() })))
      setLoading(false)
    })
    return unsub
  }, [user?.uid])

  const published   = projects.filter(p => p.published === true).length
  const totalScenes = projects.reduce((a, p) => a + (p.scenes?.length || 0), 0)

  return (
    <div className={styles.page}>
      {celebration && <CelebrationModal type={celebration} onClose={dismiss} />}
      <ElfsightChat />
      {onboardingDone === false && (
        <button
          onClick={startTour}
          style={{position:'fixed', bottom:24, right:24, zIndex:9999, background:'#1d4ed8', color:'#fff', border:'none', borderRadius:50, padding:'12px 20px', fontSize:13, fontWeight:700, cursor:'pointer', boxShadow:'0 4px 20px rgba(29,78,216,.4)', display:'flex', alignItems:'center', gap:8}}
        >
          🎯 Guide de démarrage
        </button>
      )}
      <div className={styles.container}>

        <DailyGreeting userName={displayName} projectCount={projects.length} />

        <div className={styles.pageHeader}>
          <div>
            <h1 className={styles.greeting}>
              Bonjour, <span className={styles.name}>{displayName}</span>
            </h1>
            <p className={styles.subtitle}>
              {loading ? '…' : `${projects.length} projet${projects.length !== 1 ? 's' : ''} · ${published} publié${published !== 1 ? 's' : ''}`}
            </p>
          </div>
          {isPRO || projects.length < projectsLimit ? (
            <button data-tour="new-project" className={styles.newBtn} onClick={() => navigate('/project/new')}>
              + Nouveau projet
            </button>
          ) : (
            <button className={styles.newBtn} onClick={() => navigate('/upgrade')} style={{background:'#f59e0b'}}>
              ⭐ Limite atteinte — Passer en PRO
            </button>
          )}
        </div>

        <div className={styles.stats}>
          {[
            { label: 'Projets',        value: loading ? '—' : projects.length },
            { label: 'Scènes totales', value: loading ? '—' : totalScenes },
            { label: 'Publiés',        value: loading ? '—' : published },
            { label: 'Non publiés',    value: loading ? '—' : projects.filter(p => !p.published).length },
          ].map(({ label, value }) => (
            <div key={label} className={styles.statCard}>
              <span className={styles.statValue}>{value}</span>
              <span className={styles.statLabel}>{label}</span>
            </div>
          ))}
        </div>

        <section>
          <h2 className={styles.sectionTitle}>Mes projets</h2>
          {loading ? (
            <div className={styles.loadingGrid}>
              {[1,2,3].map(i => <div key={i} className={styles.skeleton} />)}
            </div>
          ) : projects.length === 0 ? (
            <EmptyState onNavigate={() => navigate('/project/new')} />
          ) : (
            <div className={styles.grid}>
              {projects.map(p => (
                <ProjectCard
                  key={p.id}
                  project={p}
                  onOpen={() => navigate(`/project/${p.id}`)}
                  onShare={() => setShareProject(p)}
                  onEdit={() => setEditProject(p)}
                  isPRO={isPRO}
                  onAnalytics={() => isPRO ? setAnalyticsProject(p) : navigate('/upgrade')}
                />
              ))}
            </div>
          )}
        </section>
      </div>

      {shareProject && (
        <ShareModal
          project={shareProject}
          onClose={() => setShareProject(null)}
          onFirstPublish={() => {
            celebrate('firstPublish')
          }}
        />
      )}

      {analyticsProject && (
        <AnalyticsModal
          project={analyticsProject}
          onClose={() => setAnalyticsProject(null)}
        />
      )}
      {editProject && (
        <EditProjectModal
          project={editProject}
          onClose={() => setEditProject(null)}
          onDeleted={() => { setEditProject(null) }}
        />
      )}
    </div>
  )
}

// ── Modal édition projet ───────────────────────────────────────
// ── Carte projet ───────────────────────────────────────────────
function EmptyState({ onNavigate }) {
  return (
    <div style={{textAlign:'center', padding:'60px 20px', color:'var(--text-2)'}}>
      <div style={{fontSize:48, marginBottom:16}}>🌐</div>
      <h3 style={{fontSize:18, fontWeight:700, color:'var(--text-1)', marginBottom:8}}>Aucune visite pour l'instant</h3>
      <p style={{fontSize:14, marginBottom:24}}>Créez votre première visite virtuelle 360° en quelques clics.</p>
      <button onClick={onNavigate} style={{background:'#1d4ed8', color:'#fff', border:'none', borderRadius:8, padding:'10px 24px', fontSize:14, fontWeight:700, cursor:'pointer'}}>
        + Créer ma première visite
      </button>
    </div>
  )
}

function ProjectCard({ project, onOpen, onShare, onEdit, onAnalytics, isPRO }) {
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef(null)
  const isPublished = project.published === true

  // Fermer le menu si clic extérieur
  useEffect(() => {
    if (!menuOpen) return
    const handler = (e) => { if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false) }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [menuOpen])

  return (
    <article className={styles.card}>
      <div className={styles.thumbnail} onClick={onOpen}>
        {project.scenes?.[0]?.imageUrl ? (
          <img src={project.scenes[0].imageUrl} alt={project.name} className={styles.thumbImg} />
        ) : (
          <div className={styles.thumbnailInner}>
            <span className={styles.thumbnailIcon}>⬡</span>
            <span className={styles.thumbnailLabel}>360°</span>
          </div>
        )}
        <div className={styles.thumbOverlay}><span className={styles.thumbPlay}>✏ Modifier</span></div>
      </div>

      <div className={styles.cardBody}>
        <div className={styles.cardTop}>
          <h3 className={styles.cardTitle}>{project.name || 'Sans titre'}</h3>
          <div className={styles.menuWrap} ref={menuRef}>
            <button className={styles.menuBtn} onClick={e => { e.stopPropagation(); setMenuOpen(v => !v) }}>⋯</button>
            {menuOpen && (
              <div className={styles.menu}>
                <button className={styles.menuItem} onClick={() => { setMenuOpen(false); onOpen() }}>
                  ✏ Modifier
                </button>
                <button className={styles.menuItem} onClick={() => { setMenuOpen(false); onEdit() }}>
                  ✏ Modifier
                </button>
                <button className={styles.menuItem} onClick={() => { setMenuOpen(false); onAnalytics() }}>
                  {!isPRO && '⭐ '}                  📊 Statistiques
                </button>
                <button className={`${styles.menuItem} ${project.shareEnabled ? styles.menuItemActive : ''}`}
                  onClick={() => { setMenuOpen(false); onShare() }}>
                  🔗 {project.shareEnabled ? 'Gérer le partage' : 'Partager'}
                </button>
                <div className={styles.menuDivider} />
                <button className={`${styles.menuItem} ${styles.menuItemDanger}`}
                  onClick={() => { setMenuOpen(false); onEdit() }}>
                  🗑 Supprimer
                </button>
              </div>
            )}
          </div>
        </div>

        {project.location && <p className={styles.location}>{project.location}</p>}
        {project.description && <p className={styles.description}>{project.description}</p>}

        <div className={styles.cardMeta}>
          <span className={styles.statusPill} style={{ '--sc': isPublished ? 'var(--success)' : 'var(--text-3)' }}>
            <span className={styles.statusDotSm} style={{ background: isPublished ? 'var(--success)' : 'var(--text-3)' }} />
            {isPublished ? 'Publié' : 'Non publié'}
          </span>
          <span>{project.scenes?.length ?? 0} scène{(project.scenes?.length ?? 0) !== 1 ? 's' : ''}</span>
          {project.updatedAt?.toDate && (
            <span>{project.updatedAt.toDate().toLocaleDateString('fr-FR', { day:'numeric', month:'short' })}</span>
          )}
        </div>
      </div>

      <div className={styles.cardActions}>
        <button className={styles.btnPrimary} onClick={onOpen}>✏ Modifier</button>
        <button className={`${styles.btnShare} ${project.shareEnabled ? styles.btnShareActive : ''}`} onClick={onShare}>
          🔗 {project.shareEnabled ? 'Partagé' : 'Partager'}
        </button>
        <button className={styles.btnEdit} onClick={onEdit} title="Modifier">✏</button>
        <button className={styles.btnEdit} onClick={onAnalytics} title="Statistiques" style={{position:'relative'}}>
          📊
          {!isPRO && <span style={{position:'absolute',top:-4,right:-4,background:'#f59e0b',color:'#fff',fontSize:8,fontWeight:800,borderRadius:20,padding:'1px 3px',lineHeight:1.2}}>PRO</span>}
        </button>
      </div>
    </article>
  )
}

// ── Modal Analytics ───────────────────────────────────────────
function AnalyticsModal({ project, onClose }) {
  return (
    <div className={styles.modalOverlay} onClick={e => e.target === e.currentTarget && onClose()}>
      <div className={styles.modal} style={{ maxWidth: 800, width: '95vw' }}>
        <div className={styles.modalHeader}>
          <h3 className={styles.modalTitle}>📊 Statistiques — {project.name}</h3>
          <button className={styles.modalClose} onClick={onClose}>✕</button>
        </div>
        <div className={styles.modalBody} style={{ padding: '20px' }}>
          <ProjectAnalytics project={project} />
        </div>
      </div>
    </div>
  )
}
