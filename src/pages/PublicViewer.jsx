import { useEffect, useRef, useState, useCallback } from 'react'
import { useParams } from 'react-router-dom'
import { getProjectByToken, trackVisitStart, trackVisitEnd, trackHotspotClick, trackSceneVisit, checkVisitorMilestones } from '@services/firebase'
import styles from './PublicViewer.module.css'
import '@styles/psv-markers.css'

let ViewerClass      = null
let MarkersPlugin    = null
let GyroscopePlugin  = null
let AutorotatePlugin = null
let StereoPlugin     = null

async function loadPSV() {
  if (ViewerClass) return
  const [core, markers, gyro, autorot, stereo] = await Promise.all([
    import('@photo-sphere-viewer/core'),
    import('@photo-sphere-viewer/markers-plugin'),
    import('@photo-sphere-viewer/gyroscope-plugin'),
    import('@photo-sphere-viewer/autorotate-plugin'),
    import('@photo-sphere-viewer/stereo-plugin'),
  ])
  await import('@photo-sphere-viewer/core/index.css')
  await import('@photo-sphere-viewer/markers-plugin/index.css')
  ViewerClass      = core.Viewer
  MarkersPlugin    = markers.MarkersPlugin
  GyroscopePlugin  = gyro.GyroscopePlugin
  AutorotatePlugin = autorot.AutorotatePlugin
  StereoPlugin     = stereo.StereoPlugin
}






// ── Distance angulaire entre 2 points sphériques (en radians) ─
function angularDistance(yaw1, pitch1, yaw2, pitch2) {
  // Formule haversine adaptée aux coordonnées sphériques PSV
  const dYaw   = yaw2   - yaw1
  const dPitch = pitch2 - pitch1
  const a = Math.sin(dPitch/2)**2 +
            Math.cos(pitch1) * Math.cos(pitch2) * Math.sin(dYaw/2)**2
  return 2 * Math.asin(Math.sqrt(a))
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
  { id: 'video',       html: '<svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor" stroke="none"><polygon points="6 3 20 12 6 21 6 3"/></svg>' },
  { id: 'gallery',     html: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="9" y1="21" x2="9" y2="9"/></svg>' },
  { id: 'audio',       html: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/></svg>' },
]


// Applique les filtres CSS d'une scène sur le container PSV
function ensureSharpFilter(id, amount) {
  let el = document.getElementById(id)
  if (!el) {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
    svg.setAttribute('id', `svg-${id}`)
    svg.style.cssText = 'position:absolute;width:0;height:0;overflow:hidden'
    svg.innerHTML = `<defs><filter id="${id}"><feConvolveMatrix order="3" kernelMatrix="0 0 0 0 0 0 0 0 0" bias="0" preserveAlpha="true"/></filter></defs>`
    document.body.appendChild(svg)
    el = document.getElementById(id)
  }
  if (!el) return
  const a = Math.min(Math.max(amount, 0), 1)
  const c = -a
  const m = 1 + 4 * a
  el.querySelector('feConvolveMatrix').setAttribute('kernelMatrix', `0 ${c} 0 ${c} ${m} ${c} 0 ${c} 0`)
  return id
}

function ensureTonesFilter(id, highlights, shadows) {
  const svgId = `svg-${id}`
  let svgEl = document.getElementById(svgId)
  if (!svgEl) {
    svgEl = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
    svgEl.setAttribute('id', svgId)
    svgEl.style.cssText = 'position:absolute;width:0;height:0;overflow:hidden'
    svgEl.innerHTML = `<defs><filter id="${id}" color-interpolation-filters="linearRGB">
      <feComponentTransfer>
        <feFuncR type="gamma" amplitude="1" exponent="1" offset="0"/>
        <feFuncG type="gamma" amplitude="1" exponent="1" offset="0"/>
        <feFuncB type="gamma" amplitude="1" exponent="1" offset="0"/>
      </feComponentTransfer>
    </filter></defs>`
    document.body.appendChild(svgEl)
  }
  // highlights: -100 à 0 → amplitude 0.5 à 1, exponent 1.5 à 1
  // shadows:     0 à 100 → offset 0 à 0.15
  const hl = highlights / 100  // -1 à 0
  const sh = shadows    / 100  //  0 à 1
  const amplitude = 1 + hl * 0.5        // 0.5 à 1
  const exponent  = 1 - hl * 0.6        // 1 à 1.6
  const offset    = sh * 0.15           // 0 à 0.15
  const filter = document.getElementById(id)
  if (!filter) return
  filter.querySelectorAll('feFuncR, feFuncG, feFuncB').forEach(f => {
    f.setAttribute('amplitude', amplitude.toFixed(3))
    f.setAttribute('exponent',  exponent.toFixed(3))
    f.setAttribute('offset',    offset.toFixed(3))
  })
  return id
}

function applySceneFilters(container, filters) {
  if (!container) return
  if (!filters) { container.style.filter = ''; return }
  const br = filters.brightness  ?? 100
  const co = filters.contrast    ?? 100
  const sa = filters.saturation  ?? 100
  const sh = filters.sharpness   ?? 0
  const wa = filters.warmth      ?? 0
  const hl = filters.highlights  ?? 0
  const sd = filters.shadows     ?? 0

  let sharpPart = ''
  if (sh > 0) {
    const filterId = `izi360-sharp-${Math.round(sh * 10)}`
    ensureSharpFilter(filterId, sh / 10)
    sharpPart = `url(#${filterId})`
  } else if (sh < 0) {
    sharpPart = `blur(${Math.abs(sh) * 0.3}px)`
  }

  let tonesPart = ''
  if (hl !== 0 || sd !== 0) {
    const tonesId = `izi360-tones`
    ensureTonesFilter(tonesId, hl, sd)
    tonesPart = `url(#${tonesId})`
  }

  const warm = wa > 0
    ? `sepia(${wa * 0.3}%) saturate(${100 + wa * 0.5}%)`
    : wa < 0 ? `hue-rotate(${Math.abs(wa) * 0.8}deg) saturate(${100 - Math.abs(wa) * 0.3}%)` : ''

  container.style.filter = `brightness(${br}%) contrast(${co}%) saturate(${sa}%) ${warm} ${sharpPart} ${tonesPart}`.trim()
}


function buildMarkers(scene, allScenes) {
  return (scene.hotspots || []).map(h => {
    const target  = allScenes?.find(s => s.id === h.targetSceneId)
    const isNav   = h.type === 'navigation' && target
    // Label dynamique — suit le nom de la scène cible pour les hotspots navigation
    const label   = isNav ? target.name : (h.label || '')
    const color   = h.color   || '#3d7bff'
    const opacity = h.opacity ?? 1
    const size    = h.size    ?? 1
    const style   = h.style   || 'floating'

    const iconDef    = ICONS.find(i => i.id === (h.icon || 'arrow-down'))
    const iconHtml   = iconDef?.html || '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><polyline points="19 12 12 19 5 12"/></svg>'
    const px         = Math.round(22 * size)
    const iconScaled = iconHtml.replace(/width="22"/g, `width="${px}"`).replace(/height="22"/g, `height="${px}"`)
    const vars       = `--hs-color:${color};--hs-opacity:${opacity};--hs-size:${size};--hs-ring-size:${h.ringSize ?? size}`

    let html
    const noLabel = h.showLabel === false ? 'no-label' : ''

    if (style === 'floor-paisible') {
      const ring = Math.round(36 * size)
      const dot  = Math.round(14 * size)
      const dotH = Math.round(dot * 0.45)
      html = `<div class="psv-marker-floor-paisible ${noLabel}" style="${vars}">
        <div class="psv-floor-paisible-wrap" style="width:${ring*3}px;height:${ring*3}px">
          <div class="psv-floor-paisible-ring" style="width:${ring}px;height:${ring}px"></div>
          <div class="psv-floor-paisible-dot" style="width:${dot}px;height:${dotH}px"></div>
        </div>
        <div class="psv-floor-paisible-label">${label}</div>
      </div>`
    } else if (style === 'floor-ellipse') {
      const W = Math.round(54 * size), H = Math.round(W * 0.3)
      html = `<div class="psv-marker-floor-ellipse ${noLabel}" style="${vars}">
        <div class="psv-floor-ellipse-label">${label}</div>
        <div class="psv-floor-ellipse-ring" style="width:${W}px;height:${H}px"></div>
      </div>`
    } else if (style === 'floor-ring-static') {
      const W = Math.round(54 * size), H = Math.round(W * 0.3)
      html = `<div class="psv-marker-floor-ring-static ${noLabel}" style="${vars}">
        <div class="psv-floor-ring-static-label">${label}</div>
        <div class="psv-floor-ring-static-dash" style="width:${W}px;height:${W}px"></div>
      </div>`
    } else if (style === 'floor-dot') {
      const W = Math.round(64 * size), H = Math.round(W * 0.26)
      const dW = Math.round(W * 0.42), dH = Math.round(dW * 0.32)
      html = `<div class="psv-marker-floor-dot" style="${vars}">
        <div class="psv-floor-dot-label">${label}</div>
        <div class="psv-floor-dot-wrap" style="width:${W*3.2}px;height:${H*4.5}px">
          <div class="psv-floor-dot-p2" style="width:${W}px;height:${H}px"></div>
          <div class="psv-floor-dot-p1" style="width:${W}px;height:${H}px"></div>
          <div class="psv-floor-dot-center" style="width:${dW}px;height:${dH}px"></div>
        </div>
      </div>`
    } else if (style === 'floor-sonar') {
      const W = Math.round(60 * size), H = Math.round(W * 0.28)
      const dW = Math.round(W * 0.32), dH = Math.round(H * 0.55)
      html = `<div class="psv-marker-floor-sonar" style="${vars}">
        <div class="psv-floor-sonar-label">${label}</div>
        <div class="psv-floor-sonar-wrap" style="width:${W*3.5}px;height:${H*4.5}px">
          <div class="psv-floor-sonar-w1" style="width:${W}px;height:${H}px"></div>
          <div class="psv-floor-sonar-w2" style="width:${W}px;height:${H}px"></div>
          <div class="psv-floor-sonar-w3" style="width:${W}px;height:${H}px"></div>
          <div class="psv-floor-sonar-center" style="width:${dW}px;height:${dH}px"></div>
        </div>
      </div>`
    } else if (style === 'floor') {
      html = `<div class="psv-marker-floor" style="${vars}"><div class="psv-floor-label">${label}</div><div class="psv-floor-icon">${iconScaled}</div><div class="psv-floor-ring"></div></div>`
    } else if (style === 'pin') {
      html = `<div class="psv-marker-pin" style="${vars}"><div class="psv-pin-head">${iconScaled}</div><div class="psv-pin-stem"></div><div class="psv-pin-dot"></div><div class="psv-marker-text">${label}</div></div>`
    } else if (style === 'bubble') {
      html = `<div class="psv-marker-bubble" style="${vars}"><span class="psv-bubble-icon">${iconScaled}</span><span class="psv-bubble-text">${label}</span></div>`
    } else {
      html = `<div class="psv-marker-nav" style="${vars}"><div class="psv-marker-icon">${iconScaled}</div><div class="psv-marker-text">${label}</div></div>`
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


// ── ContactModal ──────────────────────────────────────────────
function ContactModal({ project, onClose }) {
  const [tab,     setTab]     = useState(project.contactFormEnabled && project.contactEmail ? 'form' : 'direct')
  const [name,    setName]    = useState('')
  const [email,   setEmail]   = useState('')
  const [phone,   setPhone]   = useState('')
  const [message, setMessage] = useState('')
  const [sending, setSending] = useState(false)
  const [sent,    setSent]    = useState(false)
  const [error,   setError]   = useState(null)

  const handleSend = async () => {
    if (!name.trim() || !email.trim() || !message.trim()) return
    setSending(true)
    setError(null)
    try {
      const res = await fetch(`https://formsubmit.co/ajax/${project.contactEmail}`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify({
          name,
          email,
          phone: phone || 'Non renseigné',
          message,
          _subject: `Demande de contact — ${project.name || 'Visite LC360'}`,
          _captcha: 'false',
        }),
      })
      if (!res.ok) throw new Error('Erreur réseau')
      setSent(true)
    } catch(e) {
      setError("Erreur lors de l'envoi. Veuillez réessayer.")
    }
    setSending(false)
  }

  return (
    <div className={styles.contactOverlay} onClick={e => e.target === e.currentTarget && onClose()}>
      <div className={styles.contactModal}>
        <div className={styles.contactHeader}>
          <h3 className={styles.contactTitle}>Nous contacter</h3>
          <button className={styles.contactClose} onClick={onClose}>✕</button>
        </div>

        {project.contactFormEnabled && (
          <div className={styles.contactTabs}>
            <button className={`${styles.contactTab} ${tab === 'form' ? styles.contactTabActive : ''}`} onClick={() => setTab('form')}>
              ✉ Formulaire
            </button>
            <button className={`${styles.contactTab} ${tab === 'direct' ? styles.contactTabActive : ''}`} onClick={() => setTab('direct')}>
              📞 Contact direct
            </button>
          </div>
        )}

        {tab === 'direct' && (
          <div className={styles.contactDirect}>
            {project.contactEmail && (
              <a href={`mailto:${project.contactEmail}`} className={styles.contactLink}>
                <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="2" y="4" width="20" height="16" rx="2"/><polyline points="2,4 12,13 22,4"/></svg>
                {project.contactEmail}
              </a>
            )}
            {project.contactPhone && (
              <a href={`tel:${project.contactPhone}`} className={styles.contactLink}>
                <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 13.1 19.79 19.79 0 0 1 1.63 4.5 2 2 0 0 1 3.6 2.32h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 9.91a16 16 0 0 0 6.18 6.18l.96-.96a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
                {project.contactPhone}
              </a>
            )}
          </div>
        )}

        {tab === 'form' && !sent && (
          <div className={styles.contactForm}>
            <input type="text" placeholder="Votre nom" value={name} onChange={e => setName(e.target.value)} className={styles.contactInput} />
            <input type="email" placeholder="Votre email" value={email} onChange={e => setEmail(e.target.value)} className={styles.contactInput} />
            <input type="tel" placeholder="Votre téléphone (optionnel)" value={phone} onChange={e => setPhone(e.target.value)} className={styles.contactInput} />
            <textarea placeholder="Votre message…" value={message} onChange={e => setMessage(e.target.value)} className={styles.contactTextarea} rows={4} />
            {error && <p className={styles.contactError}>{error}</p>}
            <button className={styles.contactSend} onClick={handleSend} disabled={sending || !name || !email || !message}>
              {sending ? 'Envoi…' : '✉ Envoyer'}
            </button>
          </div>
        )}

        {tab === 'form' && sent && (
          <div className={styles.contactSent}>
            <div className={styles.contactSentIcon}>✓</div>
            <p>Message envoyé avec succès !</p>
            <p className={styles.contactSentHint}>Nous vous répondrons dans les plus brefs délais.</p>
          </div>
        )}
      </div>
    </div>
  )
}

export default function PublicViewer() {

  const { token } = useParams()
  const [project,     setProject]     = useState(null)
  const [loading,     setLoading]     = useState(true)
  const [error,       setError]       = useState(null)
  const [activeScene,   setActiveScene]   = useState(0)
  const [floorplanOpen, setFloorplanOpen] = useState(false)
  const [currentYaw,    setCurrentYaw]    = useState(0)
  const currentSceneId  = project?.scenes?.[activeScene]?.id
  const floorplan       = project?.floorplan || null
  const [psvReady,    setPsvReady]    = useState(false)
  const [showInfo,    setShowInfo]    = useState(false)
  const [gyroActive,  setGyroActive]  = useState(false)
  const [gyroAvail,   setGyroAvail]   = useState(false)
  const [splash,      setSplash]      = useState(true)
  const [splashReady, setSplashReady] = useState(false)
  const [isIOS,       setIsIOS]       = useState(false)
  const [showHint,    setShowHint]    = useState(false)
  const [infoPopup,   setInfoPopup]   = useState(null)  // hotspot info affiché (clic)
  const [hoverPopup,    setHoverPopup]    = useState(null)
  const [stripVisible,  setStripVisible]  = useState(true)
  const [showContact,   setShowContact]   = useState(false)
  const [shareCopied,   setShareCopied]   = useState(false)
  const [videoPopup,    setVideoPopup]    = useState(null)
  const [galleryPopup,  setGalleryPopup]  = useState(null)
  const [audioPopup,    setAudioPopup]    = useState(null)
  const [galleryIdx,    setGalleryIdx]    = useState(0)
  const [showVolume,    setShowVolume]    = useState(false)
  const [volume,        setVolume]        = useState(0.4)
  const [accessGranted, setAccessGranted] = useState(false)
  const [accessInput,   setAccessInput]   = useState('')
  const [accessError,   setAccessError]   = useState(false)

  const containerRef   = useRef(null)
  const containerBRef  = useRef(null)
  const viewerRef      = useRef(null)
  const viewerBRef     = useRef(null)
  const markersRef     = useRef(null)
  const currentPosRef  = useRef({ yaw: 0, pitch: 0 })
  const activeSceneRef = useRef(0)
  const projectRef     = useRef(null)
  const fadingRef      = useRef(false)
  const autorotTimer    = useRef(null)
  const inactivityRef   = useRef(null)
  const visitIdRef      = useRef(null)
  const audioRef         = useRef(null)
  const visitStartRef   = useRef(null)
  const startAutorotRef = useRef(null)
  const gyroActiveRef   = useRef(false)

  useEffect(() => { activeSceneRef.current = activeScene }, [activeScene])
  useEffect(() => { projectRef.current     = project },     [project])

  // Musique d'ambiance — créée une seule fois, persiste toute la visite
  // Sur desktop (pas de tap), on tente le play quand accessGranted devient true
  useEffect(() => {
    if (!project?.ambientMusicUrl || !accessGranted) return
    if (audioRef.current) return // déjà créée, ne pas recréer
    const audio = new Audio(project.ambientMusicUrl)
    audio.loop   = project.ambientMusicLoop !== false
    audio.volume = 0.4
    audioRef.current = audio
    audio.play().catch(() => {}) // peut échouer sur desktop sans interaction
  }, [project?.ambientMusicUrl, accessGranted])

  useEffect(() => {
    return () => {
      if (audioRef.current) { audioRef.current.pause(); audioRef.current.src = ''; audioRef.current = null }
    }
  }, [])

  // Titre dynamique + balises OG
  useEffect(() => {
    if (!project?.name) return
    document.title = `${project.name} — Visite virtuelle 360°`

    // Mettre à jour ou créer les balises OG
    const setMeta = (property, content, isName = false) => {
      const attr = isName ? 'name' : 'property'
      let el = document.querySelector(`meta[${attr}="${property}"]`)
      if (!el) { el = document.createElement('meta'); el.setAttribute(attr, property); document.head.appendChild(el) }
      el.setAttribute('content', content)
    }

    const imageUrl   = project.scenes?.[0]?.imageUrl || ''
    const description = project.description || `Découvrez cette visite virtuelle 360° interactive`
    const ogUrl = `https://izi360-backend-694882487700.europe-west1.run.app/og/${token}`

    setMeta('og:title',       `${project.name} — Visite virtuelle 360°`)
    setMeta('og:description', description)
    setMeta('og:image',       imageUrl)
    setMeta('og:url',         ogUrl)
    setMeta('og:type',        'website')
    setMeta('og:site_name',   'IZI360')
    setMeta('twitter:card',        'summary_large_image', true)
    setMeta('twitter:title',       `${project.name} — Visite virtuelle 360°`, true)
    setMeta('twitter:description', description, true)
    setMeta('twitter:image',       imageUrl, true)

    return () => { document.title = 'LC360' }
  }, [project?.name, token])
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
    viewer.addEventListener('position-updated', (e) => {
      setCurrentYaw(e.position?.yaw ?? 0)
    })

    markers.addEventListener('select-marker', (e) => {
      const marker = e.marker
      const proj   = projectRef.current
      const scIdx  = activeSceneRef.current
      if (!proj) return

      // Récupérer le hotspot complet depuis les données du projet
      const scene   = proj.scenes[scIdx]
      const hotspot = (scene?.hotspots || []).find(h => h.id === marker.id)

      // Tracker le clic hotspot
      if (visitIdRef.current && proj.id && hotspot) {
        trackHotspotClick(proj.id, visitIdRef.current, hotspot.id, hotspot.label || hotspot.id).catch(() => {})
      }

      if (hotspot?.type === 'info') {
        setInfoPopup(hotspot)
        return
      }
      if ((hotspot?.type === 'url') && hotspot.urlHref) {
        window.open(hotspot.urlHref, '_blank', 'noopener')
        return
      }
      if (hotspot?.type === 'video' && hotspot.videoUrl) {
        setVideoPopup(hotspot)
        return
      }
      if (hotspot?.type === 'gallery' && hotspot.galleryImages?.length) {
        setGalleryIdx(0)
        setGalleryPopup(hotspot)
        return
      }
      if (hotspot?.type === 'audio' && hotspot.audioUrl) {
        setAudioPopup(hotspot)
        return
      }

      if (!marker.data?.targetSceneId) return
      const targetIdx = proj.scenes.findIndex(s => s.id === marker.data.targetSceneId)
      if (targetIdx < 0 || targetIdx === scIdx) return
      currentPosRef.current = { yaw: marker.data.arrivalYaw ?? 0, pitch: marker.data.arrivalPitch ?? 0 }
      setActiveScene(targetIdx)
    })
    viewer.addEventListener('position-updated', (e) => {
      currentPosRef.current = { yaw: e.position.yaw, pitch: e.position.pitch }
    })

    // Hover sur hotspot info → preview du contenu
    markers.addEventListener('enter-marker', (e) => {
      const proj    = projectRef.current
      const scIdx   = activeSceneRef.current
      const scene   = proj?.scenes?.[scIdx]
      const hotspot = (scene?.hotspots || []).find(h => h.id === e.marker.id)
      if (hotspot?.type === 'info' && (hotspot.infoContent || hotspot.infoImageUrl)) {
        setHoverPopup(hotspot)
      }
    })
    markers.addEventListener('leave-marker', () => {
      setHoverPopup(null)
    })

    // ── Click anywhere — naviguer vers le hotspot le plus proche ──
    viewer.addEventListener('click', (e) => {
      const proj  = projectRef.current
      const scIdx = activeSceneRef.current
      if (!proj) return

      const scene    = proj.scenes[scIdx]
      const hotspots = (scene?.hotspots || []).filter(h =>
        h.type === 'navigation' && h.targetSceneId
      )
      if (hotspots.length === 0) return

      const clickYaw   = e.data.yaw
      const clickPitch = e.data.pitch

      // Trouver le hotspot le plus proche du clic
      let closest     = null
      let minDist     = Infinity
      const THRESHOLD = 35 * Math.PI / 180  // 35° en radians

      for (const h of hotspots) {
        const dist = angularDistance(clickYaw, clickPitch, h.yaw, h.pitch)
        if (dist < minDist) {
          minDist  = dist
          closest  = h
        }
      }

      // Naviguer si dans le rayon de 35°
      if (closest && minDist <= THRESHOLD) {
        const targetIdx = proj.scenes.findIndex(s => s.id === closest.targetSceneId)
        if (targetIdx < 0 || targetIdx === scIdx) return
        currentPosRef.current = {
          yaw:   closest.arrivalYaw   ?? 0,
          pitch: closest.arrivalPitch ?? 0,
        }
        setActiveScene(targetIdx)
      }
    })
  }, [])

  // Réactiver le gyroscope après un pinch-to-zoom
  useEffect(() => {
    const handleTouchEnd = (e) => {
      if (!gyroActiveRef.current) return
      if (e.touches.length === 0) {
        setTimeout(() => {
          if (!viewerRef.current || !gyroActiveRef.current) return
          try {
            const gp = viewerRef.current.getPlugin(GyroscopePlugin)
            if (gp) gp.start()
          } catch(e) {}
        }, 150)
      }
    }
    window.addEventListener('touchend', handleTouchEnd, { passive: true })
    return () => window.removeEventListener('touchend', handleTouchEnd)
  }, [])

  // Afficher/masquer le bandeau selon la zone touchée
  useEffect(() => {
    const BOTTOM_ZONE = 60  // px depuis le bas pour déclencher l'affichage

    const onTouch = (e) => {
      const y = e.touches?.[0]?.clientY ?? e.clientY
      const fromBottom = window.innerHeight - y
      if (fromBottom <= BOTTOM_ZONE) {
        setStripVisible(true)
      } else {
        setStripVisible(false)
      }
    }

    window.addEventListener('touchstart', onTouch, { passive: true })
    window.addEventListener('mousedown',  onTouch, { passive: true })
    return () => {
      window.removeEventListener('touchstart', onTouch)
      window.removeEventListener('mousedown',  onTouch)
    }
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

        const wasGyroActive = gyroActiveRef.current
        const targetYaw     = currentPosRef.current.yaw
        const targetPitch   = currentPosRef.current.pitch
        const fadeMs        = 600
        const cA = containerRef.current
        const cB = containerBRef.current

        if (viewerBRef.current) { viewerBRef.current.destroy(); viewerBRef.current = null }

        // Stopper le gyroscope proprement avant de détruire l'ancien viewer
        try {
          const oldGp = viewerRef.current.getPlugin(GyroscopePlugin)
          if (oldGp) oldGp.stop()
        } catch(e) {}

        const viewerB = new ViewerClass({
          container:        cB,
          panorama:         scene.imageUrl,
          navbar:           false,
          defaultZoomLvl:   scene.zoomDefault ?? 50,
          minFov:           scene.zoomMin     != null ? (180 - scene.zoomMin)  : 10,
          maxFov:           scene.zoomMax     != null ? (180 - scene.zoomMax)  : 90,
          defaultYaw:       targetYaw,
          defaultPitch:     targetPitch,
          moveInertia:      true,
          moveSpeed:        2,
              sphereCorrection: {
            pan:  scene.correctionPan  ?? 0,
            tilt: scene.correctionTilt ?? 0,
            roll: scene.correctionRoll ?? 0,
          },
          plugins: [
            [MarkersPlugin,    { markers: [] }],
            [GyroscopePlugin,  { roll: false, moveMode: 'fast' }],
            [AutorotatePlugin, { autorotateSpeed: 0 }],
            ...(projectRef.current?.vrEnabled ? [[StereoPlugin, {}]] : []),
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

        // Appliquer les filtres de la nouvelle scène
        applySceneFilters(cB, scene.filters)

        fadingRef.current = false
        setPsvReady(true)

        // Appliquer les paramètres touch selon l'état du gyroscope
        if (!wasGyroActive) {
          try {
            viewerRef.current.setOption('moveInertia', true)
            viewerRef.current.setOption('touchmoveFactor', 10)
          } catch(e) {}
        }

        // Relancer le gyroscope sur le nouveau viewer si actif
        if (wasGyroActive) {
          try {
            const gp = viewerRef.current.getPlugin(GyroscopePlugin)
            if (gp) gp.start()
            setGyroActive(true)
            gyroActiveRef.current = true
          } catch(e) {}
        } else {
          startAutorotRef.current?.()
        }
        return
      }

      // ── Premier chargement ────────────────────────────────────
      if (viewerRef.current) { viewerRef.current.destroy(); viewerRef.current = null }

      const viewer = new ViewerClass({
        container:        containerRef.current,
        panorama:         scene.imageUrl,
        navbar:           false,
        defaultZoomLvl:   scene.zoomDefault ?? 50,
        minFov:           scene.zoomMin     != null ? (180 - scene.zoomMin)  : 10,
        maxFov:           scene.zoomMax     != null ? (180 - scene.zoomMax)  : 90,
        defaultYaw:       currentPosRef.current.yaw,
        defaultPitch:     currentPosRef.current.pitch,
        moveInertia:      true,
        moveSpeed:        2,
        sphereCorrection: {
          pan:  scene.correctionPan  ?? 0,
          tilt: scene.correctionTilt ?? 0,
          roll: scene.correctionRoll ?? 0,
        },
        plugins: [
          [MarkersPlugin,    { markers: [] }],
          [GyroscopePlugin,  { roll: false, moveMode: 'fast' }],
          [AutorotatePlugin, { autorotateSpeed: 0 }],
          ...(projectRef.current?.vrEnabled ? [[StereoPlugin, {}]] : []),
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
        // Appliquer les filtres de la scène initiale
        applySceneFilters(containerRef.current, sc?.filters)
        setPsvReady(true)

        const ua       = navigator.userAgent
        const isMobile = /Android|iPhone|iPad|iPod/i.test(ua)

        // Appliquer touchmoveFactor après init (option non supportée dans le constructeur PSV5)
        try { viewerRef.current?.setOption('touchmoveFactor', 10) } catch(e) {}

        // Gyroscope disponible sur mobile
        if (window.DeviceOrientationEvent && isMobile) setGyroAvail(true)

        // Même comportement sur tous les appareils — bouton "Commencer"
        setSplashReady(true)
      })
    }

    run()
    return () => { destroyed = true }
  }, [project, loading, activeScene, attachListeners])

  useEffect(() => {
    const handleUnload = () => {
      if (visitIdRef.current && visitStartRef.current && projectRef.current?.id) {
        const duration = Math.round((Date.now() - visitStartRef.current) / 1000)
        trackVisitEnd(projectRef.current.id, visitIdRef.current, { duration }).catch(() => {})
      }
    }
    window.addEventListener('beforeunload', handleUnload)
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) handleUnload()
    })
    return () => {
      window.removeEventListener('beforeunload', handleUnload)
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
    // ✅ Lire gyroOnStart depuis le projet — false = pas de gyroscope auto
    const gyroEnabled = projectRef.current?.gyroOnStart === true

    if (gyroEnabled) {
      const activateGyro = async () => {
        if (!viewerRef.current) return
        setGyroAvail(true)
        // Stopper l'autorotation avant de démarrer le gyroscope
        try { viewerRef.current?.getPlugin(AutorotatePlugin)?.stop() } catch(e) {}
        clearTimeout(inactivityRef.current)
        try {
          const gp = viewerRef.current.getPlugin(GyroscopePlugin)
          if (gp) gp.start()
        } catch(e) {}
        setGyroActive(true)
        gyroActiveRef.current = true
      }

      if (typeof DeviceOrientationEvent?.requestPermission === 'function') {
        try {
          const perm = await DeviceOrientationEvent.requestPermission()
          if (perm === 'granted') activateGyro()
        } catch(e) {}
      } else {
        // Android : activer directement
        activateGyro()
      }
    }

    setSplash(false)
    // Démarrer la musique d'ambiance — doit être dans un événement utilisateur
    const proj = projectRef.current
    if (proj?.ambientMusicUrl && !audioRef.current) {
      const audio = new Audio(proj.ambientMusicUrl)
      audio.loop   = proj.ambientMusicLoop !== false
      audio.volume = 0.4
      audioRef.current = audio
      audio.play().catch(() => {})
    }
    // Ouvrir le plan si showOnStart
    if (proj?.floorplan?.showOnStart) {
      setFloorplanOpen(true)
    }
    // Si le projet a un code d'accès → afficher le popup avant la visite
    const code = projectRef.current?.accessCode
    if (code) {
      // La visite reste floutée jusqu'à la saisie du bon code
    } else {
      setAccessGranted(true)
      setShowHint(true)
      setTimeout(() => setShowHint(false), 4000)
      startAutorotRef.current?.()
    }
  }

  // ── Démarrer le tracking quand la visite est accessible ────
  useEffect(() => {
    if (!accessGranted || !projectRef.current?.id) return
    if (visitIdRef.current) return  // déjà démarré
    trackVisitStart(projectRef.current.id).then(({ visitId }) => {
      // Vérifier les milestones visiteurs
      if (projectRef.current?.ownerId) {
        checkVisitorMilestones(projectRef.current.id, projectRef.current.ownerId).catch(() => {})
      }
      visitIdRef.current   = visitId
      visitStartRef.current = Date.now()
      const scene = projectRef.current?.scenes?.[activeSceneRef.current]
      if (scene) trackSceneVisit(projectRef.current.id, visitId, scene.id, scene.name).catch(e => console.error('[Analytics] trackSceneVisit error:', e))
    }).catch(e => console.error('[Analytics] trackVisitStart error:', e))
  }, [accessGranted])

  const handleAccessSubmit = () => {
    const code = projectRef.current?.accessCode
    if (!code) { setAccessGranted(true); return }
    if (accessInput.toUpperCase().trim() === code.toUpperCase().trim()) {
      setAccessGranted(true)
      setAccessError(false)
      setShowHint(true)
      setTimeout(() => setShowHint(false), 4000)
      startAutorotRef.current?.()
    } else {
      setAccessError(true)
      setAccessInput('')
    }
  }

  const handleVolumeChange = (v) => {
    setVolume(v)
    if (audioRef.current) audioRef.current.volume = v
  }

  const handleShare = async () => {
    const url = window.location.href
    const title = project?.name || 'Visite virtuelle 360°'
    if (navigator.share) {
      try {
        await navigator.share({ title, url })
        return
      } catch(e) {}
    }
    // Fallback : copier le lien
    await navigator.clipboard.writeText(url)
    setShareCopied(true)
    setTimeout(() => setShareCopied(false), 2000)
  }

  const toggleGyro = async () => {
    const viewer = viewerRef.current
    if (!viewer) return
    try {
      const gp = viewer.getPlugin(GyroscopePlugin)
      if (!gp) return
      if (!gyroActiveRef.current) {
        if (typeof DeviceOrientationEvent?.requestPermission === 'function') {
          const perm = await DeviceOrientationEvent.requestPermission()
          if (perm !== 'granted') return
        }
        gp.start()
        // Gyroscope ON → pas d'inertie, touch normal
        viewer.setOption('moveInertia', false)
        viewer.setOption('touchmoveFactor', 1)
        setGyroAvail(true)
        setGyroActive(true)
        gyroActiveRef.current = true
        try { viewer.getPlugin(AutorotatePlugin)?.stop() } catch(e) {}
      } else {
        gp.stop()
        // Gyroscope OFF → inertie élan prononcé + touch ample
        viewer.setOption('moveInertia', true)
        viewer.setOption('touchmoveFactor', 10)
        setGyroActive(false)
        gyroActiveRef.current = false
        setTimeout(() => startAutorot(), 500)
      }
    } catch(e) { console.error('Gyro error:', e) }
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

  const logoSize      = project?.logoSize ?? 40
  const isPRO         = project?.ownerPlan === 'pro'
  const logoUrl       = isPRO ? (project?.logoUrl ?? null) : null
  const showWatermark = !isPRO

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
                : showWatermark ? <div className={styles.splashDefaultLogo}><span>LC</span>360</div> : null}
                {showWatermark && logoUrl && <div className={styles.splashDefaultLogo} style={{opacity:0.7}}><span>LC</span>360</div>
            }
            <div className={styles.splashName}>{project?.name}</div>
            {!splashReady && (
              <div className={styles.splashBar}><div className={styles.splashBarFill} /></div>
            )}
            {splashReady && (
              <div className={styles.splashTapBtn}>
                <span>Cliquer pour commencer</span>
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Viewer ── */}
      <div className={styles.psvWrapper} style={{
        filter: (!accessGranted && !splash && projectRef.current?.accessCode) ? 'blur(20px)' : 'none',
        transition: 'filter .6s ease'
      }}>
        <div ref={containerBRef} className={styles.psvB} />
        <div ref={containerRef}  className={styles.psvA}>
          {!psvReady && (
            <div className={styles.psvLoader}><span className={styles.spinner} /></div>
          )}
        </div>
      </div>

      {/* ── Header haut gauche ── */}
      <div className={styles.topLeft}>
        {logoUrl && isPRO && <img src={logoUrl} alt="logo" className={styles.customLogo} style={{ height: logoSize }} />}
        {showWatermark && <span className={styles.logo}><span>LC</span>360</span>
        }
        <span className={styles.projectNameTop}>{project?.name}</span>
      </div>

      {/* ── Code d'accès — visite floutée + popup ── */}
      {!splash && !accessGranted && projectRef.current?.accessCode && (
        <div className={styles.accessOverlay}>
          <div className={styles.accessCard}>
            <div className={styles.accessIcon}>🔒</div>
            <h2 className={styles.accessTitle}>Visite protégée</h2>
            <p className={styles.accessDesc}>Saisissez le code d'accès pour continuer</p>
            <input
              type="text"
              value={accessInput}
              onChange={e => { setAccessInput(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8)); setAccessError(false) }}
              onKeyDown={e => e.key === 'Enter' && handleAccessSubmit()}
              className={`${styles.accessInput} ${accessError ? styles.accessInputError : ''}`}
              placeholder="CODE"
              maxLength={8}
              autoFocus
            />
            {accessError && <p className={styles.accessError}>Code incorrect, réessayez.</p>}
            <button className={styles.accessBtn} onClick={handleAccessSubmit}>
              Accéder à la visite →
            </button>
          </div>
        </div>
      )}

      {/* ── Hover preview hotspot info ── */}
      {hoverPopup && !infoPopup && (
        <div className={styles.hoverPreview} onClick={() => { setInfoPopup(hoverPopup); setHoverPopup(null) }}>
          {hoverPopup.infoImageUrl && (
            <img src={hoverPopup.infoImageUrl} alt={hoverPopup.label} className={styles.hoverPreviewImg} />
          )}
          <div className={styles.hoverPreviewBody}>
            <p className={styles.hoverPreviewTitle}>{hoverPopup.label}</p>
            {hoverPopup.infoContent && (
              <p className={styles.hoverPreviewText}>
                {hoverPopup.infoContent.length > 80
                  ? hoverPopup.infoContent.slice(0, 80) + '…'
                  : hoverPopup.infoContent}
              </p>
            )}
            <span className={styles.hoverPreviewHint}>Cliquer pour plus d'infos</span>
          </div>
        </div>
      )}

      {/* ── Popup info hotspot ── */}
      {infoPopup && (
        <div className={styles.infoPopupOverlay} onClick={() => setInfoPopup(null)}>
          <div className={styles.infoPopupCard} onClick={e => e.stopPropagation()}>
            <button className={styles.infoPopupClose} onClick={() => setInfoPopup(null)}>✕</button>

            {infoPopup.infoImageUrl && (
              <img src={infoPopup.infoImageUrl} alt={infoPopup.label} className={styles.infoPopupImg} />
            )}

            <div className={styles.infoPopupBody}>
              <h3 className={styles.infoPopupTitle}>{infoPopup.label}</h3>

              {infoPopup.infoContent && (
                <p className={styles.infoPopupText}>{infoPopup.infoContent}</p>
              )}

              {infoPopup.infoLink && (
                <a href={infoPopup.infoLink} target="_blank" rel="noopener noreferrer" className={styles.infoPopupLink}>
                  <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
                  En savoir plus
                </a>
              )}
            </div>
          </div>
        </div>
      )}

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
        {/* Partager */}
        {project?.shareEnabled && (
          <button className={`${styles.navTool} ${shareCopied ? styles.navToolActive : ''}`} onClick={handleShare} title="Partager la visite">
            {shareCopied
              ? <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>
              : <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>
            }
          </button>
        )}
        {/* Volume musique */}
        {audioRef.current && (
          <div className={styles.volumeWrap}>
            <button className={`${styles.navTool} ${showVolume ? styles.navToolActive : ''}`}
              onClick={() => setShowVolume(v => !v)} title="Volume musique">
              {volume === 0
                ? <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><line x1="23" y1="9" x2="17" y2="15"/><line x1="17" y1="9" x2="23" y2="15"/></svg>
                : <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/></svg>
              }
            </button>
            {showVolume && (
              <div className={styles.volumePanel}>
                <input type="range" min="0" max="1" step="0.05"
                  value={volume}
                  onChange={e => handleVolumeChange(parseFloat(e.target.value))}
                  className={styles.volumeSlider}
                  style={{writingMode:'vertical-lr', direction:'rtl', height:80}}
                />
              </div>
            )}
          </div>
        )}
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
        {/* VR Cardboard */}
        {project?.vrEnabled && (
          <button className={styles.navTool} onClick={() => {
            try { viewerRef.current?.getPlugin(StereoPlugin)?.toggle() } catch(e) {}
          }} title="Mode VR Cardboard">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <rect x="2" y="7" width="20" height="12" rx="3"/>
              <circle cx="8.5" cy="13" r="2.5"/>
              <circle cx="15.5" cy="13" r="2.5"/>
              <line x1="11" y1="13" x2="13" y2="13"/>
              <path d="M2 10 L2 7" strokeWidth="0"/>
            </svg>
          </button>
        )}
        {/* Gyroscope */}
        {gyroAvail && (
          <button className={`${styles.navTool} ${gyroActive ? styles.navToolActive : ''}`} onClick={toggleGyro} title="Gyroscope">
<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              {/* Téléphone */}
              <rect x="8" y="4" width="8" height="14" rx="1.5" fill="currentColor" fillOpacity="0.15" stroke="currentColor"/>
              <line x1="10" y1="16.5" x2="14" y2="16.5" strokeWidth="1.5"/>
              {/* Orbite horizontale */}
              <path d="M4 12 C4 9.5 7.5 7.5 12 7.5 C16.5 7.5 20 9.5 20 12 C20 14.5 16.5 16.5 12 16.5" strokeDasharray="2 1"/>
              <polyline points="3.5 10.5 4 12 5.5 11.5"/>
              {/* Orbite verticale */}
              <path d="M12 3 C14.5 3 16.5 6.5 16.5 12 C16.5 17.5 14.5 21 12 21 C9.5 21 7.5 17.5 7.5 12" strokeDasharray="2 1"/>
              <polyline points="13.5 2.5 12 3 12.5 4.5"/>
            </svg>
          </button>
        )}
        {/* Info */}
        <button className={`${styles.navTool} ${showInfo ? styles.navToolActive : ''}`} onClick={() => setShowInfo(v => !v)} title="Informations">
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
        </button>

      </div>

      {/* ── Bouton contact ── */}
      {(project?.contactEmail || project?.contactPhone) && accessGranted && (
        <div className={styles.contactBtn} onClick={() => setShowContact(true)}>
          {project.contactEmail && (
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="2" y="4" width="20" height="16" rx="2"/><polyline points="2,4 12,13 22,4"/></svg>
          )}
          {project.contactPhone && (
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 13.1 19.79 19.79 0 0 1 1.63 4.5 2 2 0 0 1 3.6 2.32h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 9.91a16 16 0 0 0 6.18 6.18l.96-.96a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
          )}
          <span>Contact</span>
        </div>
      )}

      {/* ── Modal Vidéo ── */}
      {videoPopup && (
        <div className={styles.contactOverlay} onClick={e => e.target === e.currentTarget && setVideoPopup(null)}>
          <div className={styles.contactModal} style={{maxWidth:640}}>
            <div className={styles.contactHeader}>
              <h3 className={styles.contactTitle}>{videoPopup.label}</h3>
              <button className={styles.contactClose} onClick={() => setVideoPopup(null)}>✕</button>
            </div>
            <div style={{padding:'0 0 16px'}}>
              <iframe
                src={videoPopup.videoUrl.includes('youtube.com/watch') ? videoPopup.videoUrl.replace('watch?v=','embed/').split('&')[0] :
                     videoPopup.videoUrl.includes('youtu.be/') ? 'https://www.youtube.com/embed/' + videoPopup.videoUrl.split('youtu.be/')[1].split('?')[0] :
                     videoPopup.videoUrl.includes('vimeo.com/') ? 'https://player.vimeo.com/video/' + videoPopup.videoUrl.split('vimeo.com/')[1].split('?')[0] :
                     videoPopup.videoUrl}
                width="100%" height="340" frameBorder="0" allowFullScreen allow="autoplay"
                style={{display:'block',borderRadius:'0 0 20px 20px'}}
              />
            </div>
          </div>
        </div>
      )}

      {/* ── Modal Galerie ── */}
      {galleryPopup && galleryPopup.galleryImages?.length > 0 && (
        <div className={styles.contactOverlay} onClick={e => e.target === e.currentTarget && setGalleryPopup(null)}>
          <div className={styles.galleryModal}>
            <button className={styles.contactClose} style={{position:'absolute',top:12,right:12,zIndex:2}} onClick={() => setGalleryPopup(null)}>✕</button>
            <img src={galleryPopup.galleryImages[galleryIdx]?.url} alt="" className={styles.galleryModalImg} />
            {galleryPopup.galleryImages.length > 1 && (
              <>
                <button className={styles.galleryPrev} onClick={() => setGalleryIdx(i => (i - 1 + galleryPopup.galleryImages.length) % galleryPopup.galleryImages.length)}>‹</button>
                <button className={styles.galleryNext} onClick={() => setGalleryIdx(i => (i + 1) % galleryPopup.galleryImages.length)}>›</button>
                <div className={styles.galleryDots}>
                  {galleryPopup.galleryImages.map((_, i) => (
                    <button key={i} className={`${styles.galleryDot} ${i === galleryIdx ? styles.galleryDotActive : ''}`} onClick={() => setGalleryIdx(i)} />
                  ))}
                </div>
              </>
            )}
            <div className={styles.galleryCounter}>{galleryIdx + 1} / {galleryPopup.galleryImages.length}</div>
          </div>
        </div>
      )}

      {/* ── Modal Audio ── */}
      {audioPopup && (
        <div className={styles.contactOverlay} onClick={e => e.target === e.currentTarget && setAudioPopup(null)}>
          <div className={styles.contactModal}>
            <div className={styles.contactHeader}>
              <h3 className={styles.contactTitle}>🔊 {audioPopup.label || audioPopup.audioLabel || 'Audio'}</h3>
              <button className={styles.contactClose} onClick={() => setAudioPopup(null)}>✕</button>
            </div>
            <div style={{padding:'16px 20px 24px'}}>
              <audio controls autoPlay src={audioPopup.audioUrl} style={{width:'100%',borderRadius:8}} />
            </div>
          </div>
        </div>
      )}

      {/* ── Modal contact ── */}
      {showContact && project && (
        <ContactModal
          project={project}
          onClose={() => setShowContact(false)}
        />
      )}

      {/* ── Bandeau scènes — apparaît au survol du bas ── */}
      <div className={`${styles.sceneStrip} ${stripVisible ? styles.sceneStripVisible : styles.sceneStripHidden}`}>
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

      {/* Plan overlay */}
      {floorplan?.url && (
        <>
          <button
            onClick={() => setFloorplanOpen(o => !o)}
            style={{
              position:'fixed', bottom:16, left:16, zIndex:1000,
              background: floorplanOpen ? '#1d4ed8' : 'rgba(0,0,0,.7)',
              color:'#fff', border:'1px solid rgba(255,255,255,.2)',
              borderRadius:10, padding:'8px 14px', fontSize:13,
              fontWeight:700, cursor:'pointer', backdropFilter:'blur(8px)',
              display:'flex', alignItems:'center', gap:6,
            }}
          >
            🗺 {floorplanOpen ? 'Fermer' : 'Plan'}
          </button>

          {floorplanOpen && (
            <div style={{
              position:'fixed', bottom:60, left:16, zIndex:999,
              width:280, height:280, borderRadius:12,
              overflow:'hidden', border:'2px solid rgba(255,255,255,.15)',
              boxShadow:'0 8px 32px rgba(0,0,0,.6)',
              background:'#0f1117',
            }}>
              <div style={{position:'relative', width:'100%', height:'100%'}}>
                <img
                  src={floorplan.url}
                  style={{width:'100%', height:'100%', objectFit:'cover', display:'block'}}
                  alt="Plan"
                />
                {(floorplan.hotspots || []).map(hp => (
                  <button
                    key={hp.marker_id}
                    onClick={() => {
                      const targetIdx = project.scenes?.findIndex(s => s.id === hp.scene_id)
                      if (targetIdx >= 0) { setActiveScene(targetIdx) }
                    }}
                    title={hp.name}
                    style={{
                      position:'absolute',
                      left:`${hp.x * 100}%`,
                      top:`${hp.y * 100}%`,
                      transform:'translate(-50%,-50%)',
                      width: currentSceneId === hp.scene_id ? 18 : 12,
                      height: currentSceneId === hp.scene_id ? 18 : 12,
                      borderRadius:'50%',
                      background: currentSceneId === hp.scene_id ? '#ffffff' : (floorplan?.dotColor || 'rgba(152,0,255,0.9)'),
                      border: currentSceneId === hp.scene_id ? `3px solid ${floorplan?.dotColor || 'rgb(152,0,255)'}` : '2px solid rgba(255,255,255,.8)',
                      cursor:'pointer', padding:0, transition:'all .2s',
                      boxShadow: currentSceneId === hp.scene_id ? '0 0 12px rgba(152,0,255,.8)' : '0 2px 6px rgba(0,0,0,.5)',
                    }}
                  >
                    {currentSceneId === hp.scene_id && (
                      <svg
                        width="48" height="48"
                        viewBox="-24 -24 48 48"
                        style={{
                          position: 'absolute',
                          top: '50%', left: '50%',
                          transform: `translate(-50%, -50%) rotate(${currentYaw}rad)`,
                          pointerEvents: 'none',
                          overflow: 'visible',
                        }}
                      >
                        <path
                          d={`M 0 0 L ${12 * Math.sin(-Math.PI/4)} ${-12 * Math.cos(-Math.PI/4)} A 12 12 0 0 1 ${12 * Math.sin(Math.PI/4)} ${-12 * Math.cos(Math.PI/4)} Z`}
                          fill={floorplan?.dotColor || 'rgb(152,0,255)'}
                          opacity="0.5"
                        />
                      </svg>
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
