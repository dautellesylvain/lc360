import { useEffect, useRef, useState, useCallback } from 'react'
import { useParams } from 'react-router-dom'
import { getProjectByToken } from '@services/firebase'
import styles from './PublicViewer.module.css'

let ViewerClass        = null
let MarkersPlugin      = null
let GyroscopePlugin    = null
let AutorotatePlugin   = null

async function loadPSV() {
  if (ViewerClass) return
  const [core, markers, gyro, autorot] = await Promise.all([
    import('@photo-sphere-viewer/core'),
    import('@photo-sphere-viewer/markers-plugin'),
    import('@photo-sphere-viewer/gyroscope-plugin'),
    import('@photo-sphere-viewer/autorotate-plugin'),
  ])
  await import('@photo-sphere-viewer/core/index.css')
  await import('@photo-sphere-viewer/markers-plugin/index.css')
  ViewerClass      = core.Viewer
  MarkersPlugin    = markers.MarkersPlugin
  GyroscopePlugin  = gyro.GyroscopePlugin
  AutorotatePlugin = autorot.AutorotatePlugin
}

const ICONS = [
  { id: 'arrow-down',  html: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><polyline points="19 12 12 19 5 12"/></svg>' },
  { id: 'arrow-right', html: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>' },
  { id: 'chevron',     html: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>' },
  { id: 'door',        html: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 21h18M5 21V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16"/><circle cx="14.5" cy="12" r="0.5" fill="currentColor"/></svg>' },
  { id: 'eye',         html: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>' },
  { id: 'star',        html: '<svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor" stroke="none"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>' },
  { id: 'circle-plus', html: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/></svg>' },
  { id: 'info',        html: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>' },
  { id: 'map-pin',     html: '<svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor" stroke="none"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/></svg>' },
  { id: 'home',        html: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>' },
  { id: 'stair',       html: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="4 20 4 16 8 16 8 12 12 12 12 8 16 8 16 4 20 4"/><line x1="4" y1="20" x2="20" y2="20"/><line x1="20" y1="4" x2="20" y2="20"/></svg>' },
  { id: 'camera',      html: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>' },
]

function buildMarkers(scene, allScenes) {
  return (scene.hotspots || []).map(h => {
    const target  = allScenes?.find(s => s.id === h.targetSceneId)
    const isNav   = h.type === 'navigation' && target
    const color   = h.color   || '#3d7bff'
    const opacity = h.opacity ?? 1
    const size    = h.size    ?? 1
    const style   = h.style   || 'floating'

    const iconDef    = ICONS.find(i => i.id === (h.icon || 'arrow-down'))
    const iconHtml   = iconDef?.html || '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><polyline points="19 12 12 19 5 12"/></svg>'
    const px         = Math.round(22 * size)
    const iconScaled = iconHtml.replace(/width="22"/g, `width="${px}"`).replace(/height="22"/g, `height="${px}"`)
    const vars       = `--hs-color:${color};--hs-opacity:${opacity};--hs-size:${size}`

    let html
    if (style === 'floor') {
      html = `<div class="psv-marker-floor" style="${vars}"><div class="psv-floor-label">${h.label}</div><div class="psv-floor-icon">${iconScaled}</div><div class="psv-floor-ring"></div></div>`
    } else if (style === 'pin') {
      html = `<div class="psv-marker-pin" style="${vars}"><div class="psv-pin-head">${iconScaled}</div><div class="psv-pin-stem"></div><div class="psv-pin-dot"></div><div class="psv-marker-text">${h.label}</div></div>`
    } else if (style === 'bubble') {
      html = `<div class="psv-marker-bubble" style="${vars}"><span class="psv-bubble-icon">${iconScaled}</span><span class="psv-bubble-text">${h.label}</span></div>`
    } else {
      html = `<div class="psv-marker-nav" style="${vars}"><div class="psv-marker-icon">${iconScaled}</div><div class="psv-marker-text">${h.label}</div></div>`
    }

    return {
      id:       h.id,
      position: { yaw: h.yaw, pitch: h.pitch },
      data:     { targetSceneId: h.targetSceneId, arrivalYaw: h.arrivalYaw ?? 0, arrivalPitch: h.arrivalPitch ?? 0 },
      html,
      tooltip:  false,
    }
  })
}

export default function PublicViewer() {
  const { token } = useParams()
  const [project,     setProject]     = useState(null)
  const [loading,     setLoading]     = useState(true)
  const [error,       setError]       = useState(null)
  const [activeScene, setActiveScene] = useState(0)
  const [psvReady,    setPsvReady]    = useState(false)
  const [showInfo,    setShowInfo]    = useState(false)
  const [gyroActive,  setGyroActive]  = useState(false)
  const [gyroAvail,   setGyroAvail]   = useState(false)
  const [splash,      setSplash]      = useState(true)
  const [splashReady, setSplashReady] = useState(false)
  const [isIOS,       setIsIOS]       = useState(false)
  const [showHint,    setShowHint]    = useState(false)  // hint de mouvement

  const containerRef   = useRef(null)
  const containerBRef  = useRef(null)
  const viewerRef      = useRef(null)
  const viewerBRef     = useRef(null)
  const markersRef     = useRef(null)
  const currentPosRef  = useRef({ yaw: 0, pitch: 0 })
  const activeSceneRef = useRef(0)
  const projectRef     = useRef(null)
  const fadingRef      = useRef(false)
  const gyroActiveRef  = useRef(false)
  const autorotTimer   = useRef(null)
  const inactivityRef  = useRef(null)
  const startAutorotRef = useRef(null)  // ref stable vers startAutorot   // suit gyroActive pour accès dans les closures

  useEffect(() => { activeSceneRef.current = activeScene }, [activeScene])
  useEffect(() => { projectRef.current     = project },     [project])
  useEffect(() => { gyroActiveRef.current  = gyroActive },  [gyroActive])

  // Charger le projet via token
  useEffect(() => {
    if (!token) return
    getProjectByToken(token).then(data => {
      if (!data) { setError('Visite introuvable ou lien expiré.'); setLoading(false); return }
      setProject(data)
      setLoading(false)
    }).catch(() => { setError('Erreur de chargement.'); setLoading(false) })
  }, [token])

  // Fonction attachListeners — réutilisée sur chaque viewer
  const attachListeners = useCallback((viewer, markers) => {
    // Pause autorotation sur interaction, reprise après 3s
    viewer.addEventListener('user-interact', () => {
      setShowHint(false)
      try { viewer.getPlugin(AutorotatePlugin)?.stop() } catch(e) {}
      clearTimeout(inactivityRef.current)
      inactivityRef.current = setTimeout(() => {
        startAutorotRef.current?.()
      }, 3000)
    })
    markers.addEventListener('select-marker', (e) => {
      const marker = e.marker
      const proj   = projectRef.current
      const scIdx  = activeSceneRef.current
      if (!proj || !marker.data?.targetSceneId) return
      const targetIdx = proj.scenes.findIndex(s => s.id === marker.data.targetSceneId)
      if (targetIdx < 0 || targetIdx === scIdx) return
      currentPosRef.current = { yaw: marker.data.arrivalYaw ?? 0, pitch: marker.data.arrivalPitch ?? 0 }
      setActiveScene(targetIdx)
    })
    viewer.addEventListener('position-updated', (e) => {
      currentPosRef.current = { yaw: e.position.yaw, pitch: e.position.pitch }
    })
  }, [])

  // Réactiver le gyroscope après un pinch-to-zoom
  useEffect(() => {
    const handleTouchEnd = (e) => {
      if (!gyroActiveRef.current) return
      // Si c'était un geste multi-doigts (zoom), réactiver le gyro
      if (e.touches.length === 0) {
        setTimeout(() => {
          const viewer = viewerRef.current
          if (!viewer || !gyroActiveRef.current) return
          try {
            const gyroPlugin = viewer.getPlugin(GyroscopePlugin)
            if (gyroPlugin) {
              gyroPlugin.stop()
              gyroPlugin.start()
            }
          } catch(e) {}
        }, 150)
      }
    }
    window.addEventListener('touchend', handleTouchEnd, { passive: true })
    return () => window.removeEventListener('touchend', handleTouchEnd)
  }, [])

  // Viewer init + transitions
  useEffect(() => {
    if (!project || loading || !containerRef.current) return
    if (!project.scenes || project.scenes.length === 0) return
    let destroyed = false

    const run = async () => {
      await loadPSV()
      if (destroyed) return

      const scene = project.scenes[activeScene]
      if (!scene?.imageUrl) return

      // ── Transition crossfade ──────────────────────────────────
      if (viewerRef.current && markersRef.current && containerBRef.current) {
        if (fadingRef.current) return
        fadingRef.current = true

        const targetYaw   = currentPosRef.current.yaw
        const targetPitch = currentPosRef.current.pitch
        const fadeMs      = 600
        const cA = containerRef.current
        const cB = containerBRef.current

        if (viewerBRef.current) { viewerBRef.current.destroy(); viewerBRef.current = null }

        const viewerB = new ViewerClass({
          container:        cB,
          panorama:         scene.imageUrl,
          navbar:           false,
          defaultZoomLvl:   scene.zoomDefault ?? 50,
          minFov:           scene.zoomMin     != null ? (180 - scene.zoomMin)  : 10,
          maxFov:           scene.zoomMax     != null ? (180 - scene.zoomMax)  : 90,
          defaultYaw:       targetYaw,
          defaultPitch:     targetPitch,
          sphereCorrection: {
            pan:  scene.correctionPan  ?? 0,
            tilt: scene.correctionTilt ?? 0,
            roll: scene.correctionRoll ?? 0,
          },
          plugins: [
            [MarkersPlugin,    { markers: [] }],
            [GyroscopePlugin,  { touchmoveFactor: 1, roll: false }],
            [AutorotatePlugin, { autorotateSpeed: 0 }],
          ],
        })
        viewerBRef.current = viewerB

        await new Promise(resolve => {
          viewerB.addEventListener('ready', resolve, { once: true })
          setTimeout(resolve, 5000)
        })
        if (destroyed) return

        const markersB = viewerB.getPlugin(MarkersPlugin)
        attachListeners(viewerB, markersB)
        buildMarkers(scene, project.scenes).forEach(m => {
          try { markersB.addMarker(m) } catch(e) {}
        })

        cA.style.transition = `opacity ${fadeMs}ms ease`
        cA.style.opacity    = '0'
        await new Promise(r => setTimeout(r, fadeMs))
        if (destroyed) return

        cA.style.transition = 'none'
        cA.style.opacity    = '1'

        viewerRef.current.destroy()
        viewerRef.current  = viewerB
        viewerBRef.current = null
        markersRef.current = markersB

        containerRef.current  = cB
        containerBRef.current = cA
        cB.style.zIndex = '2'
        cA.style.zIndex = '1'

        fadingRef.current = false
        setPsvReady(true)

        // Réactiver le gyroscope
        if (gyroActiveRef.current) {
          try {
            const gyroPlugin = viewerRef.current.getPlugin(GyroscopePlugin)
            if (gyroPlugin) gyroPlugin.start()
          } catch(e) {}
        }
        // Démarrer autorotation de la nouvelle scène
        startAutorotRef.current?.()
        return
      }

      // ── Premier chargement ────────────────────────────────────
      if (viewerRef.current) { viewerRef.current.destroy(); viewerRef.current = null }

      const viewer = new ViewerClass({
        container:        containerRef.current,
        panorama:         scene.imageUrl,
        navbar:           ['gyroscope', 'zoom', 'fullscreen'],
        defaultZoomLvl:   scene.zoomDefault ?? 50,
        minFov:           scene.zoomMin     != null ? (180 - scene.zoomMin)  : 10,
        maxFov:           scene.zoomMax     != null ? (180 - scene.zoomMax)  : 90,
        defaultYaw:       currentPosRef.current.yaw,
        defaultPitch:     currentPosRef.current.pitch,
        sphereCorrection: {
          pan:  scene.correctionPan  ?? 0,
          tilt: scene.correctionTilt ?? 0,
          roll: scene.correctionRoll ?? 0,
        },
        plugins: [
          [MarkersPlugin,    { markers: [] }],
          [GyroscopePlugin,  { touchmoveFactor: 1, roll: false }],
          [AutorotatePlugin, { autorotateSpeed: 0 }],
        ],
      })

      viewerRef.current  = viewer
      markersRef.current = viewer.getPlugin(MarkersPlugin)
      attachListeners(viewer, markersRef.current)

      viewer.addEventListener('ready', () => {
        if (destroyed) return
        const sc = projectRef.current?.scenes?.[activeSceneRef.current]
        if (sc) buildMarkers(sc, projectRef.current.scenes).forEach(m => {
          try { markersRef.current?.addMarker(m) } catch(e) {}
        })
        setPsvReady(true)

        const ua       = navigator.userAgent
        const isMobile = /Android|iPhone|iPad|iPod/i.test(ua)

        // Gyroscope disponible sur mobile
        if (window.DeviceOrientationEvent && isMobile) setGyroAvail(true)

        if (isMobile) {
          // Sur mobile : afficher bouton "Toucher pour commencer"
          setSplashReady(true)
        } else {
          // Desktop : disparition automatique après 3.8s
          setTimeout(() => {
            setSplash(false)
            setShowHint(true)
            setTimeout(() => setShowHint(false), 4000)
            // ✅ Utiliser la ref pour éviter la stale closure du useEffect
            startAutorotRef.current?.()
          }, 3800)
        }
      })
    }

    run()
    return () => { destroyed = true }
  }, [project, loading, activeScene, attachListeners])

  useEffect(() => {
    return () => {
      if (viewerRef.current)  { viewerRef.current.destroy();  viewerRef.current  = null }
      if (viewerBRef.current) { viewerBRef.current.destroy(); viewerBRef.current = null }
    }
  }, [])

  // ── Autorotation ─────────────────────────────────────────────
  // Défini comme ref pour être accessible sans stale closure
  startAutorotRef.current = () => {
    const proj  = projectRef.current
    const scIdx = activeSceneRef.current
    const scene = proj?.scenes?.[scIdx]
    if (!scene?.autorotate || !viewerRef.current) return
    const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent)
    if (isMobile && gyroActiveRef.current) return
    // Délai pour laisser le panorama se stabiliser après chargement
    setTimeout(() => {
      if (!viewerRef.current) return
      try {
        const degPerSec = (scene.autorotSpeed ?? 1) * (scene.autorotDir ?? 1)
        const radPerSec = degPerSec * Math.PI / 180
        const ap = viewerRef.current.getPlugin(AutorotatePlugin)
        if (!ap) return
        ap.setOptions({ autorotateSpeed: radPerSec })
        // Configurer l'angle de départ avant de lancer
        const pos = viewerRef.current.getPosition()
        ap.setOptions({ autorotatePitch: pos.pitch })
        ap.start()
      } catch(e) { console.warn('autorotate error', e) }
    }, 800)
  }
  const startAutorot = () => startAutorotRef.current?.()

  const stopAutorotTemp = () => {
    try { viewerRef.current?.getPlugin(AutorotatePlugin)?.stop() } catch(e) {}
    clearTimeout(inactivityRef.current)
    inactivityRef.current = setTimeout(() => { startAutorot() }, 3000)
  }

  const handleSplashTap = async () => {
    if (typeof DeviceOrientationEvent?.requestPermission === 'function') {
      try {
        const perm = await DeviceOrientationEvent.requestPermission()
        if (perm === 'granted') {
          setGyroAvail(true)
          const gyro = viewerRef.current?.getPlugin(GyroscopePlugin)
          if (gyro) {
          gyro.start(); setGyroActive(true); gyroActiveRef.current = true
          // Stopper l'autorotation quand le gyroscope est activé
          try { viewerRef.current?.getPlugin(AutorotatePlugin)?.stop() } catch(e) {}
        }
        }
      } catch(e) {}
    } else {
      setGyroAvail(true)
      const gyro = viewerRef.current?.getPlugin(GyroscopePlugin)
      if (gyro) {
        gyro.start(); setGyroActive(true); gyroActiveRef.current = true
        try { viewerRef.current?.getPlugin(AutorotatePlugin)?.stop() } catch(e) {}
      }
    }
    setSplash(false)
    // Afficher hint de mouvement après le splash
    setShowHint(true)
    setTimeout(() => setShowHint(false), 4000)
    // Démarrer autorotation si configurée
    startAutorot()
  }

  const toggleGyro = async () => {
    const viewer = viewerRef.current
    if (!viewer) return
    try {
      const gyroPlugin = viewer.getPlugin(GyroscopePlugin)
      if (!gyroPlugin) return

      if (!gyroActive) {
        if (typeof DeviceOrientationEvent?.requestPermission === 'function') {
          const perm = await DeviceOrientationEvent.requestPermission()
          if (perm !== 'granted') return
        }
        gyroPlugin.start()
        setGyroActive(true)
        gyroActiveRef.current = true
        // Stopper autorotation quand gyroscope activé
        try { viewerRef.current?.getPlugin(AutorotatePlugin)?.stop() } catch(e) {}
      } else {
        gyroPlugin.stop()
        setGyroActive(false)
        gyroActiveRef.current = false
        // Reprendre autorotation quand gyroscope désactivé
        setTimeout(() => startAutorot(), 500)
      }
    } catch(e) {
      console.error('Gyro error:', e)
    }
  }

  if (loading) return (
    <div className={styles.loading}>
      <span className={styles.spinner} />
      <span>Chargement de la visite…</span>
    </div>
  )

  if (error) return (
    <div className={styles.errorPage}>
      <div className={styles.errorCard}>
        <h1 className={styles.errorTitle}>LC<span>360</span></h1>
        <p className={styles.errorMsg}>{error}</p>
      </div>
    </div>
  )

  const scenes  = project?.scenes || []
  const current = scenes[activeScene]

  const logoSize = project?.logoSize ?? 40
  const logoUrl  = project?.logoUrl  ?? null

  return (
    <div className={styles.page}>

      {/* ── Splash screen ── */}
      {splash && (
        <div
          className={`${styles.splash} ${splashReady ? styles.splashReady : ''}`}
          onClick={splashReady ? handleSplashTap : undefined}
          style={{ cursor: splashReady ? 'pointer' : 'default' }}
        >
          <div className={styles.splashContent}>
            {project?.splashUrl
              ? <img src={project.splashUrl} alt="splash" className={styles.splashImage} />
              : logoUrl
                ? <img src={logoUrl} alt="logo" className={styles.splashLogo} style={{ height: Math.max(logoSize * 1.5, 60) }} />
                : <div className={styles.splashDefaultLogo}><span>LC</span>360</div>
            }
            <div className={styles.splashName}>{project?.name}</div>
            {!splashReady && (
              <div className={styles.splashBar}><div className={styles.splashBarFill} /></div>
            )}
            {splashReady && (
              <div className={styles.splashTapBtn}>
                <span>Toucher pour commencer</span>
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Viewer ── */}
      <div className={styles.psvWrapper}>
        <div ref={containerBRef} className={styles.psvB} />
        <div ref={containerRef}  className={styles.psvA}>
          {!psvReady && (
            <div className={styles.psvLoader}><span className={styles.spinner} /></div>
          )}
        </div>
      </div>

      {/* ── Header haut gauche ── */}
      <div className={styles.topLeft}>
        {logoUrl
          ? <img src={logoUrl} alt="logo" className={styles.customLogo} style={{ height: logoSize }} />
          : <span className={styles.logo}><span>LC</span>360</span>
        }
        <span className={styles.projectNameTop}>{project?.name}</span>
      </div>

      {/* ── Hint mouvement ── */}
      {showHint && (
        <div className={styles.moveHint} onClick={() => setShowHint(false)}>
          <div className={styles.moveHintInner}>
            <svg className={styles.moveHintIcon} viewBox="0 0 80 40" fill="none">
              {/* Flèche gauche */}
              <path d="M28 20 L8 20 M8 20 L16 12 M8 20 L16 28" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
              {/* Téléphone/doigt */}
              <rect x="32" y="8" width="16" height="24" rx="3" stroke="white" strokeWidth="2" fill="none"/>
              <circle cx="40" cy="28" r="1.5" fill="white"/>
              {/* Flèche droite */}
              <path d="M52 20 L72 20 M72 20 L64 12 M72 20 L64 28" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            <span>Faites glisser pour explorer</span>
          </div>
        </div>
      )}

      {/* ── Outils navigation haut droite ── */}
      <div className={styles.topRight}>
        {/* Zoom + */}
        <button className={styles.navTool} onClick={() => viewerRef.current?.zoom(viewerRef.current.getZoomLevel() + 10)} title="Zoom +">
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/><line x1="11" y1="8" x2="11" y2="14"/><line x1="8" y1="11" x2="14" y2="11"/></svg>
        </button>
        {/* Zoom - */}
        <button className={styles.navTool} onClick={() => viewerRef.current?.zoom(viewerRef.current.getZoomLevel() - 10)} title="Zoom -">
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/><line x1="8" y1="11" x2="14" y2="11"/></svg>
        </button>
        {/* Plein écran */}
        <button className={styles.navTool} onClick={() => {
          const el = document.documentElement
          if (!document.fullscreenElement) el.requestFullscreen?.()
          else document.exitFullscreen?.()
        }} title="Plein écran">
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"/></svg>
        </button>
        {/* Gyroscope */}
        {gyroAvail && (
          <button className={`${styles.navTool} ${gyroActive ? styles.navToolActive : ''}`} onClick={toggleGyro} title="Gyroscope">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="3"/><path d="M12 1v4M12 19v4M4.22 4.22l2.83 2.83M16.95 16.95l2.83 2.83M1 12h4M19 12h4M4.22 19.78l2.83-2.83M16.95 7.05l2.83-2.83"/></svg>
          </button>
        )}
        {/* Info */}
        <button className={`${styles.navTool} ${showInfo ? styles.navToolActive : ''}`} onClick={() => setShowInfo(v => !v)} title="Informations">
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
        </button>
      </div>

      {/* ── Bandeau scènes — apparaît au survol du bas ── */}
      <div className={styles.sceneStrip}>
        <div className={styles.sceneStripInner}>
          {scenes.map((s, i) => (
            <button
              key={s.id || i}
              className={`${styles.sceneThumbBtn} ${i === activeScene ? styles.sceneThumbBtnActive : ''}`}
              onClick={() => {
                if (i === activeScene) return
                currentPosRef.current = { yaw: 0, pitch: 0 }
                setActiveScene(i)
              }}
            >
              <div className={styles.sceneThumbImg}>
                {s.imageUrl
                  ? <img src={s.imageUrl} alt={s.name} />
                  : <span>⬡</span>
                }
                {i === activeScene && <div className={styles.sceneThumbActive} />}
              </div>
              <span className={styles.sceneThumbName}>{s.name || `Scène ${i + 1}`}</span>
            </button>
          ))}
        </div>
      </div>

      {/* ── Panel info ── */}
      {showInfo && (
        <div className={styles.infoPanel}>
          <button className={styles.infoPanelClose} onClick={() => setShowInfo(false)}>✕</button>
          {logoUrl && <img src={logoUrl} alt="logo" className={styles.infoPanelLogo} style={{ height: Math.min(logoSize * 1.2, 60) }} />}
          <h2>{project?.name}</h2>
          {project?.location && <p>📍 {project.location}</p>}
          {project?.description && <p>{project.description}</p>}
          <p className={styles.infoScenes}>{scenes.length} scène{scenes.length !== 1 ? 's' : ''}</p>
        </div>
      )}
    </div>
  )
}
