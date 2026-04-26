import { useEffect, useState } from 'react'
import { getProjectVisits } from '@services/firebase'
import styles from './ProjectAnalytics.module.css'

export default function ProjectAnalytics({ project }) {
  const [visits,  setVisits]  = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!project?.id) return
    getProjectVisits(project.id).then(snap => {
      setVisits(snap.docs.map(d => ({ id: d.id, ...d.data() })))
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [project?.id])

  if (loading) return <div className={styles.loading}><span className={styles.spinner} /></div>
  if (!visits.length) return (
    <div className={styles.empty}>
      <div className={styles.emptyIcon}>📊</div>
      <p>Aucune visite enregistrée pour le moment.</p>
      <p className={styles.emptyHint}>Les statistiques apparaîtront dès que votre visite sera consultée.</p>
    </div>
  )

  // ── Calculs ──────────────────────────────────────────────────
  const totalVisits    = visits.length
  const uniqueVisitors = new Set(visits.map(v => v.visitorId)).size
  const durations      = visits.filter(v => v.duration > 0).map(v => v.duration)
  const avgDuration    = durations.length
    ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length)
    : 0
  const mobileCount    = visits.filter(v => v.device === 'mobile').length
  const mobilePercent  = Math.round((mobileCount / totalVisits) * 100)

  // Hotspots les plus cliqués
  const hotspotMap = {}
  visits.forEach(v => (v.hotspotsClicked || []).forEach(h => {
    hotspotMap[h.id] = { label: h.label, count: (hotspotMap[h.id]?.count || 0) + (h.count || 1) }
  }))
  const topHotspots = Object.entries(hotspotMap)
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, 5)

  // Scènes les plus visitées
  const sceneMap = {}
  visits.forEach(v => (v.scenesVisited || []).forEach(s => {
    sceneMap[s.id] = { name: s.name, count: (sceneMap[s.id]?.count || 0) + 1 }
  }))
  const topScenes = Object.entries(sceneMap)
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, 5)

  const fmt = (sec) => {
    if (sec < 60) return `${sec}s`
    return `${Math.floor(sec / 60)}m${sec % 60 > 0 ? ` ${sec % 60}s` : ''}`
  }

  return (
    <div className={styles.root}>

      {/* ── KPIs ── */}
      <div className={styles.kpis}>
        <div className={styles.kpi}>
          <span className={styles.kpiValue}>{totalVisits}</span>
          <span className={styles.kpiLabel}>Visites totales</span>
        </div>
        <div className={styles.kpi}>
          <span className={styles.kpiValue}>{uniqueVisitors}</span>
          <span className={styles.kpiLabel}>Visiteurs uniques</span>
        </div>
        <div className={styles.kpi}>
          <span className={styles.kpiValue}>{fmt(avgDuration)}</span>
          <span className={styles.kpiLabel}>Durée moyenne</span>
        </div>
        <div className={styles.kpi}>
          <span className={styles.kpiValue}>{mobilePercent}%</span>
          <span className={styles.kpiLabel}>Mobile</span>
        </div>
      </div>

      <div className={styles.grid}>

        {/* ── Hotspots ── */}
        <div className={styles.card}>
          <h3 className={styles.cardTitle}>🎯 Hotspots les plus cliqués</h3>
          {topHotspots.length === 0
            ? <p className={styles.noData}>Aucun hotspot cliqué</p>
            : <div className={styles.barList}>
                {topHotspots.map(([id, { label, count }]) => {
                  const max = topHotspots[0][1].count
                  return (
                    <div key={id} className={styles.barItem}>
                      <span className={styles.barLabel}>{label || id}</span>
                      <div className={styles.barTrack}>
                        <div className={styles.barFill} style={{ width: `${(count / max) * 100}%` }} />
                      </div>
                      <span className={styles.barCount}>{count}</span>
                    </div>
                  )
                })}
              </div>
          }
        </div>

        {/* ── Scènes ── */}
        <div className={styles.card}>
          <h3 className={styles.cardTitle}>🔭 Scènes les plus visitées</h3>
          {topScenes.length === 0
            ? <p className={styles.noData}>Aucune donnée</p>
            : <div className={styles.barList}>
                {topScenes.map(([id, { name, count }]) => {
                  const max = topScenes[0][1].count
                  return (
                    <div key={id} className={styles.barItem}>
                      <span className={styles.barLabel}>{name || id}</span>
                      <div className={styles.barTrack}>
                        <div className={styles.barFill} style={{ width: `${(count / max) * 100}%` }} />
                      </div>
                      <span className={styles.barCount}>{count}</span>
                    </div>
                  )
                })}
              </div>
          }
        </div>

        {/* ── Dernières visites ── */}
        <div className={`${styles.card} ${styles.cardFull}`}>
          <h3 className={styles.cardTitle}>🕐 Dernières visites</h3>
          <div className={styles.visitList}>
            <div className={styles.visitHeader}>
              <span>Date</span>
              <span>Durée</span>
              <span>Appareil</span>
              <span>Scènes</span>
              <span>Hotspots</span>
            </div>
            {visits.slice(0, 10).map(v => {
              const date = v.startedAt?.toDate?.()
              return (
                <div key={v.id} className={styles.visitRow}>
                  <span>{date ? date.toLocaleDateString('fr-FR', { day:'2-digit', month:'short', hour:'2-digit', minute:'2-digit' }) : '—'}</span>
                  <span>{v.duration > 0 ? fmt(v.duration) : '—'}</span>
                  <span>{v.device === 'mobile' ? '📱' : '🖥️'} {v.device || '—'}</span>
                  <span>{(v.scenesVisited || []).length}</span>
                  <span>{(v.hotspotsClicked || []).reduce((a, h) => a + (h.count || 1), 0)}</span>
                </div>
              )
            })}
          </div>
        </div>

      </div>
    </div>
  )
}
