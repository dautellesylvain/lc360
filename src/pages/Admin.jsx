import { useEffect, useState } from 'react'
import { useAtomValue } from 'jotai'
import { authUserAtom } from '@store/auth'
import { db } from '@services/firebase'
import { collection, getDocs, query, where, doc, getDoc, setDoc } from 'firebase/firestore'
import { Link, useNavigate } from 'react-router-dom'
import styles from './Admin.module.css'

const ADMIN_UID = 'c3wT2I44DyRd6pb59hQ3c6QhOdR2'

export default function Admin() {
  const user     = useAtomValue(authUserAtom)
  const navigate = useNavigate()
  const [users,    setUsers]    = useState([])
  const [loading,   setLoading]   = useState(true)
  const [limits,    setLimits]    = useState({ scenes_free: 8, projects_free: 3, exports_free: 5 })
  const [savingLimits, setSavingLimits] = useState(false)
  const [limitsSaved,  setLimitsSaved]  = useState(false)
  const [search,   setSearch]   = useState('')
  const [filter,   setFilter]   = useState('all') // all | free | pro

  useEffect(() => {
    if (!user) return
    if (user.uid !== ADMIN_UID) { navigate('/dashboard'); return }
    loadData()
    loadLimits()
  }, [user])

  const loadLimits = async () => {
    try {
      const snap = await getDoc(doc(db, 'config', 'limits'))
      if (snap.exists()) setLimits(snap.data())
    } catch(e) {}
  }

  const saveLimits = async () => {
    setSavingLimits(true)
    try {
      await setDoc(doc(db, 'config', 'limits'), limits)
      setLimitsSaved(true)
      setTimeout(() => setLimitsSaved(false), 2000)
    } catch(e) {}
    setSavingLimits(false)
  }

  const loadData = async () => {
    setLoading(true)
    try {
      // Charger tous les utilisateurs
      const usersSnap    = await getDocs(collection(db, 'users'))
      const projectsSnap = await getDocs(collection(db, 'projects'))

      const projects = projectsSnap.docs.map(d => ({ id: d.id, ...d.data() }))

      const usersData = await Promise.all(usersSnap.docs.map(async (d) => {
        const u = { id: d.id, ...d.data() }

        // Compter les projets de cet utilisateur
        const userProjects = projects.filter(p => p.ownerId === u.uid || p.ownerId === u.id)
        const projectCount = userProjects.length

        // Compter les visites totales
        let totalVisits = 0
        for (const proj of userProjects) {
          try {
            const visitsSnap = await getDocs(collection(db, 'analytics', proj.id, 'visits'))
            totalVisits += visitsSnap.size
          } catch(e) {}
        }

        return {
          uid:          u.uid || u.id,
          name:         u.displayName || '—',
          email:        u.email || '—',
          plan:         u.plan || 'free',
          projectCount,
          totalVisits,
          createdAt:    u.createdAt?.toDate?.()?.toLocaleDateString('fr-FR') || '—',
          planUpdatedAt: u.planUpdatedAt?.toDate?.()?.toLocaleDateString('fr-FR') || '—',
          sketchupKey:  u.sketchupKey ? '✓' : '—',
          locale:       u.locale || '—',
          lastLoginAt:  u.lastLoginAt?.toDate?.()?.toLocaleDateString('fr-FR') || '—',
          exportsThisMonth: (() => {
            const key = new Date().toISOString().slice(0, 7)
            return u.exports?.[key] || 0
          })(),
        }
      }))

      // Trier par date d'inscription décroissante
      usersData.sort((a, b) => {
        if (a.createdAt === '—') return 1
        if (b.createdAt === '—') return -1
        return 0
      })

      setUsers(usersData)
    } catch(e) {
      console.error(e)
    }
    setLoading(false)
  }

  const exportCSV = () => {
    const headers = ['Nom', 'Email', 'Plan', 'Projets', 'Visites', 'Exports ce mois', 'Langue', 'Dernière connexion', 'Inscription', 'Passage PRO', 'Extension SketchUp']
    const rows = filtered.map(u => [
      u.name, u.email, u.plan, u.projectCount, u.totalVisits, u.exportsThisMonth,
      u.locale, u.lastLoginAt, u.createdAt, u.planUpdatedAt, u.sketchupKey
    ])
    const csv = [headers, ...rows].map(r => r.map(v => `"${v}"`).join(',')).join('\n')
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    a.href     = url
    a.download = `utilisateurs_${new Date().toISOString().slice(0,10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  // Langues présentes dynamiquement
  const languages = ['all', 'free', 'pro', ...new Set(
    users
      .map(u => u.locale?.slice(0, 2))
      .filter(Boolean)
      .sort()
  )]

  const langLabel = (f) => {
    if (f === 'all')  return 'Tous'
    if (f === 'free') return 'Gratuit'
    if (f === 'pro')  return '⭐ PRO'
    const flags = { fr:'🇫🇷', en:'🇬🇧', es:'🇪🇸', de:'🇩🇪', it:'🇮🇹', pt:'🇵🇹', nl:'🇳🇱', ar:'🇸🇦', zh:'🇨🇳', ja:'🇯🇵', ru:'🇷🇺' }
    return `${flags[f] || '🌐'} ${f.toUpperCase()}`
  }

  const filtered = users
    .filter(u => filter === 'all' || u.plan === filter || u.locale?.startsWith(filter))
    .filter(u =>
      search === '' ||
      u.name.toLowerCase().includes(search.toLowerCase()) ||
      u.email.toLowerCase().includes(search.toLowerCase())
    )

  const stats = {
    total: users.length,
    pro:   users.filter(u => u.plan === 'pro').length,
    free:  users.filter(u => u.plan === 'free').length,
    totalProjects: users.reduce((a, u) => a + u.projectCount, 0),
    totalVisits:   users.reduce((a, u) => a + u.totalVisits, 0),
  }

  if (!user || user.uid !== ADMIN_UID) return null

  return (
    <div className={styles.page}>
      <div className={styles.container}>

        <div className={styles.header}>
          <div>
            <Link to="/dashboard" className={styles.backLink}>← Dashboard</Link>
            <h1 className={styles.title}>Administration</h1>
          </div>
          <button className={styles.exportBtn} onClick={exportCSV} disabled={loading}>
            ⬇ Export CSV
          </button>
        </div>

        {/* Panneau configuration limites */}
        <div style={{background:'var(--surface)', border:'1px solid var(--border)', borderRadius:'var(--radius)', padding:20, display:'flex', flexDirection:'column', gap:16}}>
          <h2 style={{fontSize:15, fontWeight:700, margin:0}}>⚙️ Limites du plan gratuit</h2>
          <div style={{display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:16}}>
            {[
              { key:'scenes_free',   label:'Scènes par visite',    icon:'🖼️' },
              { key:'projects_free', label:'Visites simultanées',  icon:'🏠' },
              { key:'exports_free',  label:'Exports SketchUp/mois', icon:'📤' },
            ].map(({ key, label, icon }) => (
              <div key={key} style={{display:'flex', flexDirection:'column', gap:6}}>
                <label style={{fontSize:12, color:'var(--text-2)', fontWeight:600}}>{icon} {label}</label>
                <input
                  type="number" min="1" max="100"
                  value={limits[key]}
                  onChange={e => setLimits(l => ({ ...l, [key]: parseInt(e.target.value) || 1 }))}
                  style={{background:'var(--bg)', border:'1px solid var(--border)', borderRadius:8, padding:'8px 12px', fontSize:16, fontWeight:700, color:'var(--text-1)', width:'100%'}}
                />
              </div>
            ))}
          </div>
          <button
            onClick={saveLimits}
            disabled={savingLimits}
            style={{background: limitsSaved ? '#22c55e' : '#1d4ed8', color:'#fff', border:'none', borderRadius:8, padding:'10px 20px', fontSize:13, fontWeight:700, cursor:'pointer', width:'fit-content'}}
          >
            {limitsSaved ? '✓ Sauvegardé !' : savingLimits ? 'Sauvegarde…' : 'Sauvegarder les limites'}
          </button>
        </div>

        {/* Stats globales */}
        <div className={styles.statsGrid}>
          {[
            { label: 'Utilisateurs total', value: stats.total },
            { label: 'Plan PRO', value: stats.pro, accent: true },
            { label: 'Plan Gratuit', value: stats.free },
            { label: 'Projets créés', value: stats.totalProjects },
            { label: 'Visites trackées', value: stats.totalVisits },
          ].map(s => (
            <div key={s.label} className={`${styles.statCard} ${s.accent ? styles.statCardPro : ''}`}>
              <span className={styles.statValue}>{loading ? '…' : s.value}</span>
              <span className={styles.statLabel}>{s.label}</span>
            </div>
          ))}
        </div>

        {/* Filtres */}
        <div className={styles.filters}>
          <input
            type="text"
            placeholder="Rechercher par nom ou email…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className={styles.searchInput}
          />
          <div className={styles.filterBtns}>
            {languages.map(f => (
              <button
                key={f}
                className={`${styles.filterBtn} ${filter === f ? styles.filterBtnActive : ''}`}
                onClick={() => setFilter(f)}
              >
                {langLabel(f)}
              </button>
            ))}
          </div>
        </div>

        {/* Tableau */}
        {loading ? (
          <div className={styles.loading}>Chargement des données…</div>
        ) : (
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Utilisateur</th>
                  <th>Plan</th>
                  <th>Projets</th>
                  <th>Visites</th>
                  <th>Exports/mois</th>
                  <th>Langue</th>
                  <th>Dernière connexion</th>
                  <th>Extension</th>
                  <th>Inscription</th>
                  <th>Passage PRO</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(u => (
                  <tr key={u.uid}>
                    <td>
                      <div className={styles.userCell}>
                        <span className={styles.userName}>{u.name}</span>
                        <span className={styles.userEmail}>{u.email}</span>
                      </div>
                    </td>
                    <td>
                      <span className={`${styles.planBadge} ${u.plan === 'pro' ? styles.planPro : styles.planFree}`}>
                        {u.plan === 'pro' ? '⭐ PRO' : 'Gratuit'}
                      </span>
                    </td>
                    <td className={styles.numCell}>{u.projectCount}</td>
                    <td className={styles.numCell}>{u.totalVisits}</td>
                    <td className={styles.numCell}>{u.exportsThisMonth}</td>
                    <td className={styles.dateCell}>{u.locale}</td>
                    <td className={styles.dateCell}>{u.lastLoginAt}</td>
                    <td className={styles.numCell}>{u.sketchupKey}</td>
                    <td className={styles.dateCell}>{u.createdAt}</td>
                    <td className={styles.dateCell}>{u.planUpdatedAt}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {filtered.length === 0 && (
              <p className={styles.empty}>Aucun utilisateur trouvé</p>
            )}
          </div>
        )}

      </div>
    </div>
  )
}
