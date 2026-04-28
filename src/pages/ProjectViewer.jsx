import { useEffect, useRef, useState, useCallback, useMemo } from 'react'
import { useViewerTour } from '@hooks/useOnboardingTour'
import { useAtomValue } from 'jotai'
import { authUserAtom, onboardingDoneAtom, userIsPROAtom } from '@store/auth'
import { useParams, Link } from 'react-router-dom'
import { db, updateProject, subscribeToProjects } from '@services/firebase'
import { uploadImage } from '@services/cloudinary'
import { doc, onSnapshot } from 'firebase/firestore'
import styles from './ProjectViewer.module.css'
import EditProjectModal from './EditProjectModal'
import ElfsightChat from '@components/ElfsightChat'
import NodeEditor   from '@components/NodeEditor'
import '@styles/psv-markers.css'

let ViewerClass   = null
let MarkersPlugin = null

async function loadPSV() {
  if (ViewerClass) return
  const [core, markers] = await Promise.all([
    import('@photo-sphere-viewer/core'),
    import('@photo-sphere-viewer/markers-plugin'),
  ])
  await import('@photo-sphere-viewer/core/index.css')
  await import('@photo-sphere-viewer/markers-plugin/index.css')
  ViewerClass   = core.Viewer
  MarkersPlugin = markers.MarkersPlugin
}

const toDeg = (r) => parseFloat((r * 180 / Math.PI).toFixed(1))
// ── Icônes disponibles pour les hotspots ─────────────────────
export const HOTSPOT_ICONS = [
  { id: 'arrow-down',   label: 'Flèche bas',    html: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><polyline points="19 12 12 19 5 12"/></svg>' },
  { id: 'arrow-right',  label: 'Flèche droite', html: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>' },
  { id: 'chevron',      label: 'Chevron',       html: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>' },
  { id: 'door',         label: 'Porte',         html: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 21h18M5 21V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16"/><circle cx="14.5" cy="12" r="0.5" fill="currentColor"/></svg>' },
  { id: 'eye',          label: 'Œil',           html: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>' },
  { id: 'star',         label: 'Étoile',        html: '<svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor" stroke="none"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>' },
  { id: 'circle-plus',  label: 'Plus',          html: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/></svg>' },
  { id: 'info',         label: 'Info',          html: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>' },
  { id: 'map-pin',      label: 'Pin',           html: '<svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor" stroke="none"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/></svg>' },
  { id: 'home',         label: 'Maison',        html: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>' },
  { id: 'stair',        label: 'Escalier',      html: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="4 20 4 16 8 16 8 12 12 12 12 8 16 8 16 4 20 4"/><line x1="4" y1="20" x2="20" y2="20"/><line x1="20" y1="4" x2="20" y2="20"/></svg>' },
  { id: 'camera',       label: 'Caméra',        html: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>' },
  { id: 'video',         label: 'Vidéo',         html: '<svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor" stroke="none"><polygon points="6 3 20 12 6 21 6 3"/></svg>' },
  { id: 'gallery',       label: 'Galerie',       html: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="9" y1="21" x2="9" y2="9"/></svg>' },
  { id: 'audio',         label: 'Audio',         html: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/></svg>' },
]

// Styles de présentation du hotspot

// Applique les filtres CSS d'une scène sur le container PSV
// Injecte un filtre SVG de netteté dans le DOM si nécessaire
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


export const HOTSPOT_STYLES = [
  { id: 'floating',         label: 'Flottant',      desc: 'Icône + label flottant' },
  { id: 'floor',            label: 'Au sol',        desc: 'Cercle aplati animé au sol' },
  { id: 'floor-dot',        label: 'Pulse ellipse', desc: 'Double ellipse pulsante au sol' },
  { id: 'floor-sonar',      label: 'Sonar',         desc: 'Triple onde concentrique au sol' },
  { id: 'floor-paisible',   label: 'Paisible',      desc: 'Anneau pulse en perspective 3D' },
  { id: 'floor-ellipse',    label: 'Ellipse',       desc: 'Contour elliptique statique' },
  { id: 'floor-ring-static',label: 'Anneau',        desc: 'Anneau pointillé statique' },
  { id: 'pin',              label: 'Pin',           desc: 'Épingle avec tige' },
  { id: 'bubble',           label: 'Bulle',         desc: 'Badge arrondi compact' },
]

const toRad = (d) => d * Math.PI / 180

export default function ProjectViewer() {
  const authUser       = useAtomValue(authUserAtom)
  const onboardingDone = useAtomValue(onboardingDoneAtom)
  const isPRO          = useAtomValue(userIsPROAtom)
  const { startTour }  = useViewerTour(authUser?.uid, onboardingDone)
  const { id } = useParams()
  const user   = useAtomValue(authUserAtom)

  const [project,      setProject]      = useState(null)
  const [allProjects,  setAllProjects]  = useState([])
  const [loading,      setLoading]      = useState(true)
  const [error,        setError]        = useState(null)
  const [activeScene,  setActiveScene]  = useState(0)
  // ✅ FIX: stocker yaw ET pitch d'arrivée
  // arrivalPos remplacé par currentPosRef (ref stable, pas de re-render)
  const [psvReady,     setPsvReady]     = useState(false)
  const [showScenes,   setShowScenes]   = useState(true)
  const [uploadModal,  setUploadModal]  = useState(false)
  const [editMode,     setEditMode]     = useState(false)
  const [hotspotModal,      setHotspotModal]      = useState(null)
  const [sceneSettingsOpen,    setSceneSettingsOpen]    = useState(false)
  const [showProjectSettings, setShowProjectSettings] = useState(false)
  const [replaceSceneIdx,   setReplaceSceneIdx]   = useState(null)
  const [confirmDelScene,   setConfirmDelScene]   = useState(null)
  const [editingSceneIdx,   setEditingSceneIdx]   = useState(null)
  const [editingSceneName,  setEditingSceneName]  = useState('')
  const [infoHoverPopup,  setInfoHoverPopup]  = useState(null)
  const [infoFullPopup,   setInfoFullPopup]   = useState(null)
  const [videoPopup,      setVideoPopup]      = useState(null)
  const [galleryPopup,    setGalleryPopup]    = useState(null)
  const [galleryIdx,      setGalleryIdx]      = useState(0)
  const [audioPopup,      setAudioPopup]      = useState(null)

  const containerRef = useRef(null)
  const viewerRef    = useRef(null)
  const markersRef   = useRef(null)
  const editModeRef    = useRef(false)
  const projectRef     = useRef(null)
  const activeSceneRef = useRef(0)
  const currentPosRef  = useRef({ yaw: 0, pitch: 0 })
  const [debugPos,       setDebugPos]       = useState({ yaw: 0, pitch: 0 })
  const [floorplanOpen,  setFloorplanOpen]  = useState(false)
  const currentSceneId   = project?.scenes?.[activeScene]?.id
  const [floorplanEditor, setFloorplanEditor] = useState(false)
  const [nodalView,      setNodalView]      = useState(false)
  const [draggingHp,      setDraggingHp]      = useState(null)
  const [dragSceneIdx,    setDragSceneIdx]    = useState(null)
  const [dragOverIdx,     setDragOverIdx]     = useState(null)
  const floorplan      = project?.floorplan || null
  const containerBRef  = useRef(null)   // second container pour le cross-fade
  const viewerBRef     = useRef(null)   // second viewer PSV (scène entrante)
  const fadingRef      = useRef(false)  // évite les transitions simultanées
  const dragRef        = useRef(false)                  // ← drag hotspot en cours

  useEffect(() => { editModeRef.current = editMode },   [editMode])
  useEffect(() => { projectRef.current  = project },    [project])
  useEffect(() => { activeSceneRef.current = activeScene }, [activeScene])

  const prevSceneCountRef = useRef(null)
  useEffect(() => {
    const count = project?.scenes?.length
    if (count === undefined) return
    if (prevSceneCountRef.current !== null && count > prevSceneCountRef.current) {
      // Nouvelle scène ajoutée — naviguer vers elle
      setActiveScene(count - 1)
    }
    prevSceneCountRef.current = count
  }, [project?.scenes?.length])
  const prevSceneUrlRef = useRef(null)
  useEffect(() => {
    const currentUrl = project?.scenes?.[activeScene]?.imageUrl
    if (currentUrl && prevSceneUrlRef.current && currentUrl !== prevSceneUrlRef.current) {
      // L'image a changé — forcer le rechargement en simulant un changement de scène
      setActiveScene(s => s === 0 ? 0 : s) // trigger re-render
      if (viewerRef.current) {
        viewerRef.current.setPanorama(currentUrl).catch(() => {})
      }
    }
    prevSceneUrlRef.current = currentUrl
  }, [project?.scenes?.[activeScene]?.imageUrl])

  useEffect(() => {
    if (!id || !user?.uid) return
    const unsub = onSnapshot(doc(db, 'projects', id), (snap) => {
      if (!snap.exists()) { setError('Projet introuvable.'); setLoading(false); return }
      const data = { id: snap.id, ...snap.data() }
      if (data.ownerId !== user.uid) { setError('Accès non autorisé.'); setLoading(false); return }
      setProject(data)
      setLoading(false)
    }, (err) => { setError(err.message); setLoading(false) })
    return unsub
  }, [id, user?.uid])

  // Charger tous les projets pour la médiathèque
  useEffect(() => {
    if (!user?.uid) return
    const unsub = subscribeToProjects(user.uid, snap => {
      setAllProjects(snap.docs.map(d => ({ id: d.id, ...d.data() })))
    })
    return unsub
  }, [user?.uid])

  // ── Précharger les images des scènes voisines ──────────────
  const preloadNeighbors = useCallback((sceneIdx) => {
    const proj = projectRef.current
    if (!proj) return
    const scenes = proj.scenes
    const scene  = scenes[sceneIdx]
    if (!scene) return
    const neighbors = new Set(
      (scene.hotspots || []).filter(h => h.targetSceneId).map(h => h.targetSceneId)
    )
    if (sceneIdx > 0)                 neighbors.add(scenes[sceneIdx - 1]?.id)
    if (sceneIdx < scenes.length - 1) neighbors.add(scenes[sceneIdx + 1]?.id)
    neighbors.forEach(nid => {
      const ns = scenes.find(s => s.id === nid)
      if (ns?.imageUrl) { const img = new Image(); img.src = ns.imageUrl }
    })
  }, [])

  // ── Viewer : création unique + setPanorama pour les transitions ──
  useEffect(() => {
    const proj = projectRef.current
    if (!proj || loading || !containerRef.current) return
    if (!proj.scenes || proj.scenes.length === 0) return

    let destroyed = false

    const run = async () => {
      await loadPSV()
      if (destroyed) return

      const scene = proj.scenes[activeScene]
      if (!scene?.imageUrl) return

      // ── Cross-fade : B charge, devient le viewer principal, A détruit ──
      if (viewerRef.current && markersRef.current && containerBRef.current) {
        if (fadingRef.current) return
        fadingRef.current = true

        const targetYaw   = currentPosRef.current.yaw
        const targetPitch = currentPosRef.current.pitch
        const fadeMs      = 600
        const cA = containerRef.current
        const cB = containerBRef.current

        // 1. Viewer B charge la nouvelle scène (z:1, caché sous A)
        if (viewerBRef.current) { viewerBRef.current.destroy(); viewerBRef.current = null }

        const viewerB = new ViewerClass({
          container:      cB,
          panorama:       scene.imageUrl,
          navbar:         ['zoom', 'fullscreen'],
          defaultZoomLvl: 50,
          defaultYaw:     targetYaw,
          defaultPitch:   targetPitch,
          plugins:        [[MarkersPlugin, { markers: [] }]],
        })
        viewerBRef.current = viewerB

        // 2. Attendre que B soit complètement prêt — image affichée dans le canvas
        await new Promise(resolve => {
          viewerB.addEventListener('ready', resolve, { once: true })
          setTimeout(resolve, 5000)
        })
        if (destroyed) return

        // 3. Attacher TOUS les listeners sur viewerB — il devient le nouveau viewer principal
        const markersB = viewerB.getPlugin(MarkersPlugin)

        markersB.addEventListener('select-marker', (e) => {
          const marker = e.marker
          const proj   = projectRef.current
          const scIdx  = activeSceneRef.current
          if (!proj) return
          if (editModeRef.current) {
            if (dragRef.current) return
            const hs = (proj.scenes[scIdx]?.hotspots || []).find(h => h.id === marker.id)
            if (hs) setHotspotModal({ ...hs, editing: true })
            return
          }
          if (marker.data?.targetSceneId) {
            const targetIdx = proj.scenes.findIndex(s => s.id === marker.data.targetSceneId)
            if (targetIdx < 0 || targetIdx === scIdx) return
            setEditMode(false)
            currentPosRef.current = {
              yaw:   marker.data.arrivalYaw   ?? 0,
              pitch: marker.data.arrivalPitch ?? 0,
            }
            setActiveScene(targetIdx)
          }
        })

        markersB.addEventListener('enter-marker', (e) => {
          if (!editModeRef.current) return
          const el = document.getElementById(`psv-marker-${e.marker.id}`)
          if (el) el.style.cursor = 'grab'
        })
        markersB.addEventListener('leave-marker', (e) => {
          const el = document.getElementById(`psv-marker-${e.marker.id}`)
          if (el) el.style.cursor = ''
        })

        viewerB.addEventListener('click', (e) => {
          if (!editModeRef.current) return
          if (e.data?.originalEvent?.target?.closest('[id^="psv-marker-"]')) return
          setHotspotModal({ yaw: e.data.yaw, pitch: e.data.pitch })
        })

        viewerB.addEventListener('position-updated', (e) => {
          currentPosRef.current = { yaw: e.position.yaw, pitch: e.position.pitch }
          setDebugPos({ yaw: e.position.yaw, pitch: e.position.pitch })
        })

        const cBEl = cB
        const onMouseDownB = (ev) => {
          if (!editModeRef.current) return
          const markerEl = ev.target.closest('[id^="psv-marker-"]')
          if (!markerEl) return
          const markerId = markerEl.id.replace('psv-marker-', '')
          if (!markerId) return
          ev.stopPropagation()
          let dId = markerId, dMoved = false
          markerEl.style.cursor = 'grabbing'
          const onMM = (ev2) => {
            if (!dId) return
            dMoved = true
            const rect = cBEl.getBoundingClientRect()
            const pos  = viewerB.dataHelper?.viewerCoordsToSphericalCoords({ x: ev2.clientX - rect.left, y: ev2.clientY - rect.top })
            if (!pos) return
            try { markersB.updateMarker({ id: dId, position: { yaw: pos.yaw, pitch: pos.pitch } }) } catch(e) {}
          }
          const onMU = async (ev3) => {
            document.removeEventListener('mousemove', onMM)
            document.removeEventListener('mouseup', onMU)
            markerEl.style.cursor = 'grab'
            if (!dMoved || !dId) {
              const id2 = dId; dId = null
              const proj2 = projectRef.current; const si2 = activeSceneRef.current
              const hs2 = proj2?.scenes?.[si2]?.hotspots?.find(h => h.id === id2)
              if (hs2) {
                if (hs2.type === 'info')    { setInfoFullPopup(hs2); return }
                if (hs2.type === 'video')   { setVideoPopup(hs2); return }
                if (hs2.type === 'gallery') { setGalleryIdx(0); setGalleryPopup(hs2); return }
                if (hs2.type === 'audio')   { setAudioPopup(hs2); return }
                if (hs2.type === 'url' && hs2.urlHref) { window.open(hs2.urlHref, '_blank', 'noopener'); return }
                setHotspotModal({ ...hs2, editing: true })
              }
              return
            }
            const rect = cBEl.getBoundingClientRect()
            const pos  = viewerB.dataHelper?.viewerCoordsToSphericalCoords({ x: ev3.clientX - rect.left, y: ev3.clientY - rect.top })
            const id = dId; dId = null
            if (!pos) return
            const p = projectRef.current; const si = activeSceneRef.current
            if (!p) return
            await updateProject(p.id, { scenes: p.scenes.map((s, i) => i !== si ? s : { ...s, hotspots: (s.hotspots||[]).map(h => h.id === id ? {...h, yaw: pos.yaw, pitch: pos.pitch} : h) }) })
          }
          document.addEventListener('mousemove', onMM)
          document.addEventListener('mouseup', onMU)
        }
        cBEl.addEventListener('mousedown', onMouseDownB, { capture: true })
        buildMarkers(scene, proj.scenes).forEach(m => {
          try { markersB.addMarker(m) } catch(e) {}
        })

        // 4. Cross-fade : A disparaît (opacity 1→0), B visible dessous
        cA.style.transition = `opacity ${fadeMs}ms ease`
        cA.style.opacity    = '0'
        await new Promise(r => setTimeout(r, fadeMs))
        if (destroyed) return

        // 5. Swap : B devient le viewer principal, A détruit
        //    Reset opacity de cA AVANT de détruire pour éviter flash
        cA.style.transition = 'none'
        cA.style.opacity    = '1'

        viewerRef.current.destroy()
        viewerRef.current  = viewerB
        viewerBRef.current = null
        markersRef.current = markersB

        // Swap les refs des containers pour la prochaine transition
        containerRef.current  = cB
        containerBRef.current = cA

        // cB (nouveau A) reste au z:2, cA (nouveau B) passe z:1
        cB.style.zIndex = '2'
        cA.style.zIndex = '1'

        fadingRef.current = false
        setPsvReady(true)
        preloadNeighbors(activeScene)
        return
      }

      // ── Premier chargement : créer le viewer ────────────────
      if (viewerRef.current) { viewerRef.current.destroy(); viewerRef.current = null }

      const viewer = new ViewerClass({
        container:      containerRef.current,
        panorama:       scene.imageUrl,
        caption:        scene.name || `Scène ${activeScene + 1}`,
        navbar:         ['zoom', 'fullscreen'],
        defaultZoomLvl: 50,
        defaultYaw:     currentPosRef.current.yaw,
        defaultPitch:   currentPosRef.current.pitch,
        plugins: [[MarkersPlugin, { markers: [] }]],
      })

      viewerRef.current  = viewer
      markersRef.current = viewer.getPlugin(MarkersPlugin)

      // ── Listeners — attachés une fois, lisent les refs ──────
      viewer.addEventListener('click', (e) => {
        if (!editModeRef.current) return
        // Ignorer si clic sur un marker existant — géré par select-marker
        if (e.data?.originalEvent?.target?.closest('[id^="psv-marker-"]')) return
        setHotspotModal({ yaw: e.data.yaw, pitch: e.data.pitch })
      })

      markersRef.current.addEventListener('select-marker', (e) => {
        const marker = e.marker
        const proj   = projectRef.current
        const scIdx  = activeSceneRef.current
        if (!proj) return

        if (editModeRef.current) {
          if (dragRef.current) return
          const hs = (proj.scenes[scIdx]?.hotspots || []).find(h => h.id === marker.id)
          if (!hs) return
          // Hotspots contenu — afficher le contenu même en mode édition
          if (hs.type === 'info')    { setInfoFullPopup(hs); return }
          if (hs.type === 'video')   { setVideoPopup(hs); return }
          if (hs.type === 'gallery') { setGalleryIdx(0); setGalleryPopup(hs); return }
          if (hs.type === 'audio')   { setAudioPopup(hs); return }
          if (hs.type === 'url' && hs.urlHref) { window.open(hs.urlHref, '_blank', 'noopener'); return }
          // Navigation et autres → modal d'édition
          setHotspotModal({ ...hs, editing: true })
          return
        }

        // Mode visualisation — info → popup, url → ouvrir lien
        const hs = (proj.scenes[scIdx]?.hotspots || []).find(h => h.id === marker.id)
        if (hs?.type === 'info') {
          setInfoFullPopup(hs)
          return
        }
        if ((hs?.type === 'url') && hs.urlHref) {
          window.open(hs.urlHref, '_blank', 'noopener')
          return
        }
        if (hs?.type === 'video' && hs.videoUrl) {
          setVideoPopup(hs)
          return
        }
        if (hs?.type === 'gallery' && hs.galleryImages?.length) {
          setGalleryIdx(0)
          setGalleryPopup(hs)
          return
        }
        if (hs?.type === 'audio' && hs.audioUrl) {
          setAudioPopup(hs)
          return
        }

        if (marker.data?.targetSceneId) {
          const targetIdx = proj.scenes.findIndex(s => s.id === marker.data.targetSceneId)
          if (targetIdx < 0 || targetIdx === scIdx) return
          setEditMode(false)
          currentPosRef.current = {
            yaw:   marker.data.arrivalYaw   ?? 0,
            pitch: marker.data.arrivalPitch ?? 0,
          }
          setActiveScene(targetIdx)
        }
      })

      markersRef.current.addEventListener('enter-marker', (e) => {
        if (editModeRef.current) {
          const el = document.getElementById(`psv-marker-${e.marker.id}`)
          if (el) el.style.cursor = 'grab'
        } else {
          // Preview info hotspot au survol (mode visualisation)
          const proj    = projectRef.current
          const scIdx   = activeSceneRef.current
          const scene   = proj?.scenes?.[scIdx]
          const hotspot = (scene?.hotspots || []).find(h => h.id === e.marker.id)
          if (hotspot?.type === 'info' && (hotspot.infoContent || hotspot.infoImageUrl)) {
            setInfoHoverPopup(hotspot)
          }
        }
      })
      markersRef.current.addEventListener('leave-marker', (e) => {
        if (editModeRef.current) {
          const el = document.getElementById(`psv-marker-${e.marker.id}`)
          if (el) el.style.cursor = ''
        } else {
          setInfoHoverPopup(null)
        }
      })

      // ── Drag hotspot (mode édition uniquement) ─────────────
      let dragMarkerId = null
      let dragMoved    = false
      const container  = containerRef.current

      const onMouseDown = (ev) => {
        if (!editModeRef.current) return
        const markerEl = ev.target.closest('[id^="psv-marker-"]')
        if (!markerEl) return
        const markerId = markerEl.id.replace('psv-marker-', '')
        if (!markerId) return
        ev.stopPropagation()
        dragMarkerId = markerId
        dragMoved    = false
        markerEl.style.cursor = 'grabbing'

        const onMouseMove = (ev2) => {
          if (!dragMarkerId) return
          dragMoved = true
          dragRef.current = true
          const rect = container.getBoundingClientRect()
          const pos  = viewer.dataHelper?.viewerCoordsToSphericalCoords({
            x: ev2.clientX - rect.left,
            y: ev2.clientY - rect.top,
          })
          if (!pos) return
          try {
            markersRef.current.updateMarker({ id: dragMarkerId, position: { yaw: pos.yaw, pitch: pos.pitch } })
          } catch(e) {}
        }

        const onMouseUp = async (ev3) => {
          document.removeEventListener('mousemove', onMouseMove)
          document.removeEventListener('mouseup',   onMouseUp)
          markerEl.style.cursor = 'grab'

          if (!dragMoved || !dragMarkerId) {
            const id = dragMarkerId
            dragMarkerId    = null
            dragRef.current = false
            // Clic simple — déclencher manuellement l'action du hotspot
            const proj2 = projectRef.current
            const si2   = activeSceneRef.current
            const hs2   = proj2?.scenes?.[si2]?.hotspots?.find(h => h.id === id)
            if (hs2) {
              if (hs2.type === 'info')    { setInfoFullPopup(hs2); return }
              if (hs2.type === 'video')   { setVideoPopup(hs2); return }
              if (hs2.type === 'gallery') { setGalleryIdx(0); setGalleryPopup(hs2); return }
              if (hs2.type === 'audio')   { setAudioPopup(hs2); return }
              if (hs2.type === 'url' && hs2.urlHref) { window.open(hs2.urlHref, '_blank', 'noopener'); return }
              setHotspotModal({ ...hs2, editing: true })
            }
            return
          }

          const rect = container.getBoundingClientRect()
          const pos  = viewer.dataHelper?.viewerCoordsToSphericalCoords({
            x: ev3.clientX - rect.left,
            y: ev3.clientY - rect.top,
          })
          const id = dragMarkerId
          dragMarkerId    = null
          dragMoved       = false
          dragRef.current = false
          if (!pos) return

          const p  = projectRef.current
          const si = activeSceneRef.current
          if (!p) return

          await updateProject(p.id, {
            scenes: p.scenes.map((s, i) =>
              i !== si ? s : {
                ...s,
                hotspots: (s.hotspots || []).map(h =>
                  h.id === id ? { ...h, yaw: pos.yaw, pitch: pos.pitch } : h
                ),
              }
            ),
          })
        }

        document.addEventListener('mousemove', onMouseMove)
        document.addEventListener('mouseup',   onMouseUp)
      }

      container.addEventListener('mousedown', onMouseDown, { capture: true })

      viewer.addEventListener('position-updated', (e) => {
        currentPosRef.current = { yaw: e.position.yaw, pitch: e.position.pitch }
      })

      viewer.addEventListener('ready', () => {
        if (destroyed) return
        // Charger les markers de la scène initiale
        const sc = projectRef.current?.scenes?.[activeSceneRef.current]
        if (sc) buildMarkers(sc, projectRef.current.scenes).forEach(m => {
          try { markersRef.current?.addMarker(m) } catch(e) {}
        })
        setPsvReady(true)
        preloadNeighbors(activeSceneRef.current)
      })
    }

    run()
    return () => { destroyed = true }
  }, [activeScene, loading, (!viewerRef.current && (project?.scenes?.length ?? 0) > 0) ? project.scenes.length : 0])  // déclenche uniquement si viewer vide et première scène ajoutée

  useEffect(() => {
    return () => {
      if (viewerRef.current)  { viewerRef.current.destroy();  viewerRef.current  = null }
      if (viewerBRef.current) { viewerBRef.current.destroy(); viewerBRef.current = null }
    }
  }, [])

  // Rafraîchir les markers quand project change (sauvegarde hotspot) ou quand on sort du mode édition
  useEffect(() => {
    if (!markersRef.current || !project || !psvReady) return
    const scene = project.scenes?.[activeSceneRef.current]
    if (!scene) return
    markersRef.current.clearMarkers()
    buildMarkers(scene, project.scenes).forEach(m => {
      try { markersRef.current.addMarker(m) } catch(e) {}
    })
  }, [project, editMode, psvReady])

  // Médiathèque pour la vue nodale — images de tous les projets + Cloudinary
  const [nodeSketchupImgs, setNodeSketchupImgs] = useState([])

  useEffect(() => {
    if (!authUser?.uid) return
    import('firebase/firestore').then(({ doc: fsDoc, getDoc }) => {
      getDoc(fsDoc(db, 'users', authUser.uid)).then(snap => {
        const key = snap.data()?.sketchupKey
        if (!key) return
        fetch('https://izi360-backend-694882487700.europe-west1.run.app/api/media-library', {
          headers: { 'Authorization': `Bearer ${key}` }
        })
        .then(r => r.json())
        .then(data => {
          if (data.status === 'success') {
            setNodeSketchupImgs(data.images.map(img => ({
              url:         img.url,
              sceneName:   img.public_id.split('/').pop() || 'Image',
              projectName: img.folder || 'Cloudinary',
            })))
          }
        })
        .catch(() => {})
      })
    })
  }, [authUser?.uid])

  const nodeGallery = useMemo(() => {
    const seen = new Set()
    const imgs = []
    const sorted = [...(allProjects || [])].sort((a, b) =>
      (b.updatedAt?.toMillis?.() ?? 0) - (a.updatedAt?.toMillis?.() ?? 0)
    )
    for (const proj of sorted) {
      for (const s of (proj.scenes || [])) {
        if (!s.imageUrl || seen.has(s.imageUrl)) continue
        seen.add(s.imageUrl)
        imgs.push({ url: s.imageUrl, sceneName: s.name || 'Sans nom', projectName: proj.name || 'Projet' })
      }
    }
    for (const img of nodeSketchupImgs) {
      if (!img.url || seen.has(img.url)) continue
      seen.add(img.url)
      imgs.push(img)
    }
    return imgs
  }, [allProjects, nodeSketchupImgs])

  const reorderScenes = async (fromIdx, toIdx) => {
    if (fromIdx === null || fromIdx === undefined || fromIdx === toIdx) return
    const newScenes = [...scenes]
    const [moved]   = newScenes.splice(fromIdx, 1)
    newScenes.splice(toIdx, 0, moved)
    await updateProject(project.id, { scenes: newScenes })
    setActiveScene(toIdx)
  }

  const switchScene = useCallback((idx, yaw = 0, pitch = 0) => {
    if (idx === activeScene) return
    setEditMode(false)
    currentPosRef.current = { yaw, pitch }  // angle d'arrivée dans la nouvelle scène
    setActiveScene(idx)                      // déclenche le useEffect → setPanorama
  }, [activeScene])

  const saveHotspot = async (data) => {
    const { yaw, pitch, label, type, icon, style, size, targetSceneId, arrivalYaw, arrivalPitch, color, opacity, infoContent, infoImageUrl, infoLink, urlHref, urlLabel, videoUrl, galleryImages, audioUrl, audioLabel, id: existingId } = data
    const hotspot = {
      id:            existingId || `hs_${Date.now()}`,
      yaw, pitch,
      label:         label || 'Hotspot',
      type:          type  || 'navigation',
      icon:          icon  || 'arrow-down',
      style:         style || 'floating',
      size:          size  ?? 1,
      targetSceneId: targetSceneId || null,
      arrivalYaw:    arrivalYaw    ?? 0,
      arrivalPitch:  arrivalPitch  ?? 0,
      color:         color         || '#3d7bff',
      opacity:       opacity       ?? 1,
      infoContent:   infoContent   || '',
      infoImageUrl:  infoImageUrl  || null,
      infoLink:      infoLink      || '',
      urlHref:       urlHref       || '',
      urlLabel:      urlLabel      || '',
      videoUrl:      videoUrl      || '',
      galleryImages: galleryImages || [],
      audioUrl:      audioUrl      || '',
      audioLabel:    audioLabel    || '',
    }
    const updatedScenes = project.scenes.map((s, i) => {
      if (i !== activeScene) return s
      const hotspots = existingId
        ? (s.hotspots || []).map(h => h.id === existingId ? hotspot : h)
        : [...(s.hotspots || []), hotspot]
      return { ...s, hotspots }
    })
    await updateProject(project.id, { scenes: updatedScenes })
    setHotspotModal(null)
  }

  // Drag & drop d'une scène depuis la sidebar vers le panorama pour créer un hotspot
  const handleDropOnViewer = async (e) => {
    e.preventDefault()
    e.stopPropagation()
    
    console.log('[DROP] Event triggered', e)
    
    const sceneId = e.dataTransfer.getData('sceneId')
    const sceneIndex = parseInt(e.dataTransfer.getData('sceneIndex'))
    
    console.log('[DROP] SceneId:', sceneId, 'SceneIndex:', sceneIndex)
    
    if (!sceneId || isNaN(sceneIndex)) {
      console.log('[DROP] Invalid data, aborting')
      return
    }
    if (sceneIndex === activeScene) {
      console.log('[DROP] Cannot create hotspot to self')
      return
    }
    
    const viewer = viewerRef.current
    if (!viewer) {
      console.log('[DROP] No viewer instance')
      return
    }
    
    console.log('[DROP] Creating hotspot...')
    
    // Récupérer les coordonnées du drop dans le panorama
    const rect = containerRef.current.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top
    
    console.log('[DROP] Screen coords:', x, y)
    
    // Convertir position écran -> coordonnées sphériques
    const coords = viewer.dataHelper?.viewerCoordsToSphericalCoords({ x, y })
    
    if (!coords) {
      console.log('[DROP] Failed to convert coords')
      return
    }
    
    console.log('[DROP] Spherical coords:', coords)
    
    const targetScene = project.scenes[sceneIndex]
    
    // Créer le hotspot automatiquement
    const hotspot = {
      id:            `hs_${Date.now()}`,
      yaw:           coords.yaw,
      pitch:         coords.pitch,
      label:         targetScene.name || `Scène ${sceneIndex + 1}`,
      type:          'navigation',
      icon:          'arrow-down',
      style:         'floating',
      size:          1,
      targetSceneId: sceneId,
      arrivalYaw:    0,
      arrivalPitch:  0,
      color:         '#3d7bff',
      opacity:       1,
    }
    
    console.log('[DROP] Hotspot created:', hotspot)
    
    const updatedScenes = project.scenes.map((s, i) => {
      if (i !== activeScene) return s
      return { ...s, hotspots: [...(s.hotspots || []), hotspot] }
    })
    
    console.log('[DROP] Updating project...')
    await updateProject(project.id, { scenes: updatedScenes })
    console.log('[DROP] Done!')
    
    // Feedback visuel
    setDragSceneIdx(null)
    setDragOverIdx(null)
  }

  const deleteScene = async (idx) => {
    const newScenes = project.scenes.filter((_, i) => i !== idx)
    await updateProject(project.id, { scenes: newScenes })
    setConfirmDelScene(null)
    if (activeScene >= newScenes.length) setActiveScene(Math.max(0, newScenes.length - 1))
  }

  const renameScene = async (idx, name) => {
    if (!name.trim()) { setEditingSceneIdx(null); return }
    const updatedScenes = project.scenes.map((s, i) =>
      i === idx ? { ...s, name: name.trim() } : s
    )
    await updateProject(project.id, { scenes: updatedScenes })
    setEditingSceneIdx(null)
  }

  const deleteHotspot = async (hotspotId) => {
    const updatedScenes = project.scenes.map((s, i) =>
      i === activeScene
        ? { ...s, hotspots: (s.hotspots || []).filter(h => h.id !== hotspotId) }
        : s
    )
    await updateProject(project.id, { scenes: updatedScenes })
  }

  if (loading) return <ViewerSkeleton />
  if (error)   return (
    <div className={styles.errorState}>
      <span>⚠</span><p>{error}</p>
      <Link to="/dashboard" className={styles.backBtn}>← Retour</Link>
    </div>
  )

  const scenes    = project?.scenes || []
  const hasScenes = scenes.length > 0
  const current   = scenes[activeScene]

  return (
    <div className={styles.layout}>
      <aside className={`${styles.sidebar} ${showScenes ? '' : styles.sidebarClosed}`}>
        <div className={styles.sidebarHeader}>
          <div>
            <h2 className={styles.projectName}>{project.name}</h2>
            <p className={styles.sceneCount}>{scenes.length} scène{scenes.length !== 1 ? 's' : ''}</p>
          </div>
          <button className={styles.toggleBtn} onClick={() => setShowScenes(v => !v)}>
            {showScenes ? '‹' : '›'}
          </button>
        </div>

        <div data-tour="scene-list" className={styles.sceneList}>
          {scenes.map((scene, i) => (
            <div
              key={scene.id || i}
              className={`${styles.sceneItemWrap} ${i === activeScene ? styles.sceneItemActive : ''} ${dragOverIdx === i ? styles.sceneItemDragOver : ''}`}
              onDragOver={e => { e.preventDefault(); setDragOverIdx(i) }}
              onDragLeave={() => setDragOverIdx(null)}
              onDrop={e => { e.preventDefault(); reorderScenes(dragSceneIdx, i); setDragSceneIdx(null); setDragOverIdx(null) }}
              style={{ opacity: dragSceneIdx === i ? 0.4 : 1 }}
            >
              <div
                draggable
                onDragStart={e => { 
                  e.stopPropagation()
                  setDragSceneIdx(i)
                  // Stocker l'ID de la scène pour le drop vers panorama
                  e.dataTransfer.setData('sceneId', scene.id)
                  e.dataTransfer.setData('sceneIndex', i.toString())
                }}
                onDragEnd={() => { setDragSceneIdx(null); setDragOverIdx(null) }}
                style={{ cursor:'grab', padding:'0 6px', color:'var(--text-2)', fontSize:16, display:'flex', alignItems:'center', flexShrink:0 }}
                title="Glisser pour réordonner ou vers le panorama pour créer un hotspot"
              >⠿</div>
              <button className={styles.sceneItemBtn} onClick={() => { if (editingSceneIdx !== i) switchScene(i) }}>
                <div className={styles.sceneThumb}>
                  {scene.imageUrl
                    ? <img src={scene.imageUrl} alt={scene.name} className={styles.sceneThumbImg} />
                    : <span className={styles.sceneThumbPlaceholder}>⬡</span>}
                </div>
                <div className={styles.sceneInfo}>
                  {editingSceneIdx === i ? (
                    <input
                      type="text"
                      value={editingSceneName}
                      onChange={e => setEditingSceneName(e.target.value)}
                      onKeyDown={e => {
                        e.stopPropagation()
                        if (e.key === 'Enter')  renameScene(i, editingSceneName)
                        if (e.key === 'Escape') setEditingSceneIdx(null)
                      }}
                      onBlur={() => renameScene(i, editingSceneName)}
                      onClick={e => e.stopPropagation()}
                      className={styles.sceneNameInput}
                      autoFocus
                    />
                  ) : (
                    <span className={styles.sceneName}>{scene.name || `Scène ${i + 1}`}</span>
                  )}
                  <span className={styles.sceneHotspots}>{(scene.hotspots || []).length} hotspot{(scene.hotspots || []).length !== 1 ? 's' : ''}</span>
                </div>
              </button>
              <div className={styles.sceneItemActions}>
                <button className={styles.sceneActionBtn} title="Renommer"
                  onClick={e => { e.stopPropagation(); setEditingSceneIdx(i); setEditingSceneName(scene.name || '') }}>✏</button>
                {i === activeScene && <>
                  <button className={styles.sceneActionBtn} title="Réglages"
                    onClick={e => { e.stopPropagation(); setSceneSettingsOpen(true) }}>⚙</button>
                  <button className={styles.sceneActionBtn} title="Remplacer l'image"
                    onClick={e => { e.stopPropagation(); setReplaceSceneIdx(i) }}>🔄</button>
                </>}
                {confirmDelScene === i ? (
                  <>
                    <button className={styles.sceneActionBtnDanger} title="Confirmer"
                      onClick={e => { e.stopPropagation(); deleteScene(i) }}>✓</button>
                    <button className={styles.sceneActionBtn} title="Annuler"
                      onClick={e => { e.stopPropagation(); setConfirmDelScene(null) }}>✕</button>
                  </>
                ) : (
                  <button
                    className={`${styles.sceneActionBtn} ${scenes.length <= 1 ? styles.sceneActionBtnDisabled : ''}`}
                    title={scenes.length <= 1 ? 'Impossible : seule scène' : 'Supprimer'}
                    onClick={e => { e.stopPropagation(); if (scenes.length > 1) setConfirmDelScene(i) }}>🗑</button>
                )}
              </div>
              {i === activeScene && <span className={styles.sceneActiveIndicator} />}
            </div>
          ))}
        </div>

        {current && (current.hotspots || []).length > 0 && (
          <div className={styles.hotspotList}>
            <p className={styles.hotspotListTitle}>Hotspots</p>
            {(current.hotspots || []).map(h => (
              <div key={h.id} className={styles.hotspotItem}>
                <span className={styles.hotspotDot} style={{ background: h.color || 'var(--accent)', opacity: h.opacity ?? 1 }} />
                <span className={styles.hotspotIcon}>{h.type === 'navigation' ? '→' : h.type === 'info' ? 'ℹ' : h.type === 'video' ? '▶' : h.type === 'gallery' ? '🖼' : h.type === 'audio' ? '🔊' : 'ℹ'}</span>
                <span className={styles.hotspotLabel} title={h.label}>{h.label}</span>
                <div className={styles.hotspotActions}>
                  {['info','video','gallery','audio','url'].includes(h.type) && (
                    <button className={styles.hotspotEdit}
                      title="Prévisualiser"
                      onClick={() => {
                        if (h.type === 'info')    setInfoFullPopup(h)
                        if (h.type === 'video')   setVideoPopup(h)
                        if (h.type === 'gallery') { setGalleryIdx(0); setGalleryPopup(h) }
                        if (h.type === 'audio')   setAudioPopup(h)
                        if (h.type === 'url' && h.urlHref) window.open(h.urlHref, '_blank', 'noopener')
                      }}>👁</button>
                  )}
                  <button className={styles.hotspotEdit} onClick={() => setHotspotModal({ ...h, editing: true })} title="Modifier">✏</button>
                  <button className={styles.hotspotDelete}
                    onClick={() => setHotspotModal({ ...h, editing: true, confirmDelete: true })}
                    title="Supprimer">✕</button>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className={styles.sidebarFooter}>
          {floorplan && (
            <button
              onClick={() => setFloorplanEditor(true)}
              style={{width:'100%', padding:'8px', borderRadius:8, border:'1px solid rgba(152,0,255,.4)', background:'rgba(152,0,255,.1)', color:'#c084fc', fontSize:13, fontWeight:700, cursor:'pointer', marginBottom:8}}
            >
              🗺 Modifier le plan
            </button>
          )}
          <button data-tour="add-scene" className={styles.addSceneBtn} onClick={() => setUploadModal(true)}>+ Ajouter une scène</button>
          <Link to="/dashboard" className={styles.backLink}>← Dashboard</Link>
        </div>
      </aside>

      <div data-tour="viewer" className={styles.viewerWrap}>
        {hasScenes && current && (
          <div className={styles.viewerBar}>
            <span className={styles.viewerSceneName}>{current.name || `Scène ${activeScene + 1}`}</span>
            <button
              onClick={() => setNodalView(v => !v)}
              style={{
                background: nodalView ? '#1d4ed8' : 'rgba(255,255,255,.08)',
                color: '#fff', border: '1px solid rgba(255,255,255,.15)',
                borderRadius: 8, padding: '5px 12px', fontSize: 12,
                fontWeight: 700, cursor: 'pointer', display: 'flex',
                alignItems: 'center', gap: 6,
              }}
              title="Vue nodale"
            >
              {nodalView ? '🔲 Vue 360°' : '⬡ Vue Nodale'}
            </button>
            <div className={styles.viewerNav}>
              <button className={styles.navBtn} onClick={() => switchScene(Math.max(0, activeScene - 1))} disabled={activeScene === 0}>‹</button>
              <span className={styles.navCount}>{activeScene + 1} / {scenes.length}</span>
              <button className={styles.navBtn} onClick={() => switchScene(Math.min(scenes.length - 1, activeScene + 1))} disabled={activeScene === scenes.length - 1}>›</button>
            </div>
            <button className={`${styles.editBtn} ${editMode ? styles.editBtnActive : ''}`} onClick={() => setEditMode(v => !v)}>
              {editMode ? '✓ Fin édition' : '✏ Éditer hotspots'}
            </button>
            <button className={styles.editBtn} onClick={() => setShowProjectSettings(true)} title="Paramètres du projet" style={{background:'#1d4ed8'}}>⚙ Paramètres</button>
          </div>
        )}
        {editMode && (
          <div className={styles.editBanner}>
            Cliquez sur le panorama pour ajouter · Glissez un hotspot pour le déplacer · Cliquez dessus pour modifier
          </div>
        )}
        <div className={styles.psvWrapper}>
          {/* Container B — scène entrante, en dessous */}
          <div ref={containerBRef} className={styles.psvContainerB} />
          {/* Container A — scène actuelle, au dessus */}
          <div 
            ref={containerRef} 
            className={styles.psvContainerA}
            onDragOver={e => { e.preventDefault(); e.stopPropagation() }}
            onDrop={handleDropOnViewer}
          >
            {!psvReady && hasScenes && (
              <div className={styles.psvLoader}><span className={styles.psvSpinner} /><span>Chargement…</span></div>
            )}
          </div>
          {!hasScenes && (
            <div className={styles.noScenes}>
              <div className={styles.noScenesIcon}>⬡</div>
              <h3>Aucune scène 360°</h3>
              <p>Ajoutez une image équirectangulaire pour commencer</p>
              <button className={styles.addSceneBtnLarge} onClick={() => setUploadModal(true)}>+ Ajouter la première scène</button>
            </div>
          )}
        </div>
      </div>

      {uploadModal && project && <UploadModal project={project} allProjects={allProjects} isPRO={isPRO} onClose={() => setUploadModal(false)} />}
      {sceneSettingsOpen && current && (
        <SceneSettingsModal
          scene={current}
          viewer={viewerRef.current}
          onSave={async (settings) => {
            const proj = projectRef.current
            const updatedScenes = proj.scenes.map((s, i) =>
              i === activeScene ? { ...s, ...settings } : s
            )
            await updateProject(proj.id, { scenes: updatedScenes })
            setSceneSettingsOpen(false)
          }}
          onSaveAll={async (settings) => {
            const proj = projectRef.current
            const updatedScenes = proj.scenes.map(s => ({ ...s, ...settings }))
            await updateProject(proj.id, { scenes: updatedScenes })
            setSceneSettingsOpen(false)
          }}
          onClose={() => setSceneSettingsOpen(false)}
        />
      )}

      {/* Vue nodale — panneau latéral droit */}
      {nodalView && (
        <div style={{
          position: 'fixed',
          top: 48, right: 0,
          width: '42%', height: 'calc(100vh - 48px)',
          zIndex: 50,
          borderLeft: '2px solid rgba(29,78,216,.4)',
          display: 'flex', flexDirection: 'column',
        }}>
          {/* Header du panneau */}
          <div style={{
            background: '#0f1117', borderBottom: '1px solid rgba(255,255,255,.08)',
            padding: '8px 14px', display: 'flex', alignItems: 'center',
            justifyContent: 'space-between', flexShrink: 0,
          }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: '#aec6ff' }}>⬡ Vue Nodale</span>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <span style={{ fontSize: 11, color: '#6b7280' }}>Glissez les nœuds • Cliquez pour naviguer • Clic arête pour supprimer</span>
              <button
                onClick={() => setNodalView(false)}
                style={{
                  background: 'rgba(239,68,68,.15)', color: '#ef4444',
                  border: '1px solid rgba(239,68,68,.3)',
                  borderRadius: 6, padding: '4px 10px',
                  fontSize: 12, fontWeight: 700, cursor: 'pointer',
                }}
              >✕ Fermer</button>
            </div>
          </div>
          {/* Canvas nodal */}
          <div style={{ flex: 1 }}>
            <NodeEditor
              project={project}
              activeSceneIdx={activeScene}
              onSelectScene={idx => { switchScene(idx) }}
              onConnect={async (params) => {
                const fromId = params.source
                const toId   = params.target
                if (!fromId || !toId || fromId === toId) return
                // Utiliser projectRef pour avoir l'état le plus récent
                const proj = projectRef.current
                if (!proj) return
                const fromScene = proj.scenes.find(s => s.id === fromId)
                const toScene   = proj.scenes.find(s => s.id === toId)
                if (!fromScene || !toScene) return
                const alreadyExists = (fromScene.hotspots||[]).some(h => h.targetSceneId === toId)
                if (alreadyExists) return
                const t = Date.now()
                const hsAB = {
                  id: `hs_nodal_${fromId}_${toId}_${t}`,
                  type: 'navigation', targetSceneId: toId,
                  yaw: 0, pitch: -0.096,
                  arrivalYaw: Math.PI, arrivalPitch: 0,
                  label: toScene.name || 'Aller',
                  icon: 'arrow', style: 'floor', size: 2, color: '#ffffff',
                }
                const hsBA = {
                  id: `hs_nodal_${toId}_${fromId}_${t + 1}`,
                  type: 'navigation', targetSceneId: fromId,
                  yaw: Math.PI, pitch: -0.096,
                  arrivalYaw: 0, arrivalPitch: 0,
                  label: fromScene.name || 'Retour',
                  icon: 'arrow', style: 'floor', size: 2, color: '#ffffff',
                }
                const newScenes = proj.scenes.map(s => {
                  if (s.id === fromId) return { ...s, hotspots: [...(s.hotspots||[]), hsAB] }
                  if (s.id === toId)   return { ...s, hotspots: [...(s.hotspots||[]), hsBA] }
                  return s
                })
                await updateProject(proj.id, { scenes: newScenes })
              }}
              gallery={nodeGallery}
              onSaveFloorplan={async (floorplanData) => {
                await updateProject(projectRef.current.id, {
                  floorplan: {
                    ...floorplanData,
                    showOnStart: projectRef.current?.floorplan?.showOnStart || false,
                    dotColor:    projectRef.current?.floorplan?.dotColor    || '#9800ff',
                  }
                })
              }}
              onSavePosition={async (sceneId, position) => {
                const newScenes = projectRef.current.scenes.map(s =>
                  s.id === sceneId ? { ...s, nodePosition: position } : s
                )
                await updateProject(projectRef.current.id, { scenes: newScenes })
              }}
              onDeleteEdge={async (edge) => {
                const newScenes = projectRef.current.scenes.map(s => {
                  if (s.id === edge.source) return { ...s, hotspots: (s.hotspots||[]).filter(h => h.targetSceneId !== edge.target) }
                  if (s.id === edge.target) return { ...s, hotspots: (s.hotspots||[]).filter(h => h.targetSceneId !== edge.source) }
                  return s
                })
                await updateProject(projectRef.current.id, { scenes: newScenes })
              }}
            />
          </div>
        </div>
      )}

      <ElfsightChat />

      {/* Éditeur du plan */}
      {floorplanEditor && floorplan && (
        <div style={{position:'fixed',inset:0,zIndex:2000,background:'rgba(0,0,0,.85)',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',gap:16}}>
          <div style={{display:'flex',alignItems:'center',gap:16,color:'#fff',fontSize:15,fontWeight:700}}>
            <span>🗺 Plan — déplacez les points pour ajuster leur position</span>
            <label style={{display:'flex',alignItems:'center',gap:8,fontSize:13,fontWeight:600,cursor:'pointer'}}>
              <input type="checkbox"
                checked={floorplan?.showOnStart || false}
                onChange={e => updateProject(project.id, { floorplan: {...floorplan, showOnStart: e.target.checked} })}
              />
              Afficher au démarrage
            </label>
            <label style={{display:'flex',alignItems:'center',gap:8,fontSize:13,fontWeight:600}}>
              Couleur points :
              <input type="color"
                value={floorplan?.dotColor || '#9800ff'}
                onChange={e => updateProject(project.id, { floorplan: {...floorplan, dotColor: e.target.value} })}
                style={{width:32,height:24,border:'none',cursor:'pointer',borderRadius:4}}
              />
            </label>
            <button onClick={() => setFloorplanEditor(false)} style={{background:'#ef4444',color:'#fff',border:'none',borderRadius:8,padding:'6px 16px',cursor:'pointer',fontWeight:700}}>✕ Fermer</button>
          </div>
          <div
            style={{position:'relative',width:500,height:500,borderRadius:12,overflow:'hidden',border:'2px solid rgba(255,255,255,.2)',userSelect:'none'}}
            onMouseMove={e => {
              if (!draggingHp) return
              const rect = e.currentTarget.getBoundingClientRect()
              const x = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width))
              const y = Math.max(0, Math.min(1, (e.clientY - rect.top)  / rect.height))
              const newHotspots = floorplan.hotspots.map(hp =>
                hp.marker_id === draggingHp ? {...hp, x: parseFloat(x.toFixed(4)), y: parseFloat(y.toFixed(4))} : hp
              )
              updateProject(project.id, { floorplan: {...floorplan, hotspots: newHotspots} })
            }}
            onMouseUp={() => setDraggingHp(null)}
            onMouseLeave={() => setDraggingHp(null)}
          >
            <img src={floorplan.url} style={{width:'100%',height:'100%',objectFit:'cover',display:'block',pointerEvents:'none'}} alt="Plan" />
            {(floorplan.hotspots || []).map(hp => (
              <div
                key={hp.marker_id}
                onMouseDown={e => { e.preventDefault(); setDraggingHp(hp.marker_id) }}
                style={{
                  position:'absolute',
                  left:`${hp.x * 100}%`,
                  top:`${hp.y * 100}%`,
                  transform:'translate(-50%,-50%)',
                  width: currentSceneId === hp.scene_id ? 20 : 14,
                  height: currentSceneId === hp.scene_id ? 20 : 14,
                  borderRadius:'50%',
                  background: draggingHp === hp.marker_id ? '#f59e0b' : currentSceneId === hp.scene_id ? '#ffffff' : 'rgba(152,0,255,0.9)',
                  border: '2px solid rgba(255,255,255,.8)',
                  cursor:'grab',
                  display:'flex',alignItems:'center',justifyContent:'center',
                  boxShadow:'0 2px 8px rgba(0,0,0,.6)',
                }}
                title={hp.name}
              >
                <span style={{position:'absolute',top:-18,left:'50%',transform:'translateX(-50%)',fontSize:10,color:'#fff',whiteSpace:'nowrap',background:'rgba(0,0,0,.6)',padding:'1px 4px',borderRadius:4}}>{hp.name}</span>
              </div>
            ))}
          </div>
        </div>
      )}
      {/* Plan overlay */}
      {floorplan && (
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
            🗺 {floorplanOpen ? 'Fermer le plan' : 'Plan'}
          </button>

          {floorplanOpen && (
            <div style={{
              position:'fixed', bottom:60, left:16, zIndex:999,
              width:280, height:280, borderRadius:12,
              overflow:'hidden', border:'2px solid rgba(255,255,255,.15)',
              boxShadow:'0 8px 32px rgba(0,0,0,.6)',
              backdropFilter:'blur(8px)',
              background:'#0f1117',
            }}>
              <div style={{position:'relative', width:'100%', height:'100%'}}>
                <img
                  src={floorplan.url}
                  style={{width:'100%', height:'100%', objectFit:'cover', display:'block'}}
                  alt="Plan"
                />
                {/* Points cliquables sur le plan */}
                {(floorplan.hotspots || []).map(hp => (
                  <button
                    key={hp.marker_id}
                    onClick={() => {
                      const targetIdx = project.scenes?.findIndex(s => s.id === hp.scene_id)
                      if (targetIdx >= 0) {
                        setActiveScene(targetIdx)
                        setFloorplanOpen(false)
                      }
                    }}
                    title={hp.name}
                    style={{
                      position:    'absolute',
                      left:        `${hp.x * 100}%`,
                      top:         `${hp.y * 100}%`,
                      transform:   'translate(-50%, -50%)',
                      width:       currentSceneId === hp.scene_id ? 18 : 12,
                      height:      currentSceneId === hp.scene_id ? 18 : 12,
                      borderRadius:'50%',
                      background:  currentSceneId === hp.scene_id ? '#ffffff' : 'rgba(152,0,255,0.9)',
                      border:      currentSceneId === hp.scene_id ? '3px solid rgb(152,0,255)' : '2px solid rgba(255,255,255,.8)',
                      cursor:      'pointer',
                      padding:     0,
                      transition:  'all .2s',
                      boxShadow:   currentSceneId === hp.scene_id ? '0 0 12px rgba(152,0,255,.8)' : '0 2px 6px rgba(0,0,0,.5)',
                    }}
                  />
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {/* Debug position overlay — retirer après les tests */}
      <div style={{position:'fixed',bottom:8,left:8,background:'rgba(0,0,0,.7)',color:'#0f0',fontFamily:'monospace',fontSize:11,padding:'4px 8px',borderRadius:4,zIndex:9999,pointerEvents:'none'}}>
        yaw: {(debugPos.yaw * 180 / Math.PI).toFixed(1)}° | pitch: {(debugPos.pitch * 180 / Math.PI).toFixed(1)}°
      </div>
      {showProjectSettings && project && (
        <ProjectSettingsInline
          project={project}
          onClose={() => setShowProjectSettings(false)}
        />
      )}

      {replaceSceneIdx !== null && (
        <UploadModal
          project={project}
          allProjects={allProjects}
          replaceSceneIdx={replaceSceneIdx}
          isPRO={isPRO}
          onClose={() => setReplaceSceneIdx(null)}
        />
      )}

      {/* Popup info complète (clic en mode visualisation) */}
      {/* ── Modal Vidéo ── */}
      {videoPopup && (
        <div className={styles.infoPopupOverlay} onClick={() => setVideoPopup(null)}>
          <div className={styles.infoPopup} style={{maxWidth:640, padding:0, overflow:'hidden'}}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'12px 16px',borderBottom:'1px solid var(--border)'}}>
              <span style={{fontWeight:700,fontSize:15}}>{videoPopup.label}</span>
              <button className={styles.infoPopupClose} onClick={() => setVideoPopup(null)}>✕</button>
            </div>
            <iframe
              src={videoPopup.videoUrl.includes('youtube.com/watch') ? videoPopup.videoUrl.replace('watch?v=','embed/').split('&')[0] :
                   videoPopup.videoUrl.includes('youtu.be/') ? 'https://www.youtube.com/embed/' + videoPopup.videoUrl.split('youtu.be/')[1].split('?')[0] :
                   videoPopup.videoUrl.includes('vimeo.com/') ? 'https://player.vimeo.com/video/' + videoPopup.videoUrl.split('vimeo.com/')[1].split('?')[0] :
                   videoPopup.videoUrl}
              width="100%" height="340" frameBorder="0" allowFullScreen allow="autoplay"
              style={{display:'block'}}
            />
          </div>
        </div>
      )}

      {/* ── Modal Galerie ── */}
      {galleryPopup && galleryPopup.galleryImages?.length > 0 && (
        <div className={styles.infoPopupOverlay} onClick={() => setGalleryPopup(null)}>
          <div style={{position:'relative',width:'min(90vw,800px)',maxHeight:'85vh',background:'#000',borderRadius:16,overflow:'hidden',display:'flex',alignItems:'center',justifyContent:'center'}} onClick={e => e.stopPropagation()}>
            <button className={styles.infoPopupClose} style={{position:'absolute',top:12,right:12,zIndex:2,background:'rgba(0,0,0,.6)'}} onClick={() => setGalleryPopup(null)}>✕</button>
            <img src={galleryPopup.galleryImages[galleryIdx]?.url} alt="" style={{width:'100%',maxHeight:'85vh',objectFit:'contain',display:'block'}} />
            {galleryPopup.galleryImages.length > 1 && (<>
              <button onClick={() => setGalleryIdx(i => (i-1+galleryPopup.galleryImages.length)%galleryPopup.galleryImages.length)}
                style={{position:'absolute',left:12,top:'50%',transform:'translateY(-50%)',background:'rgba(0,0,0,.6)',border:'none',color:'#fff',fontSize:28,width:44,height:44,borderRadius:'50%',cursor:'pointer'}}>‹</button>
              <button onClick={() => setGalleryIdx(i => (i+1)%galleryPopup.galleryImages.length)}
                style={{position:'absolute',right:12,top:'50%',transform:'translateY(-50%)',background:'rgba(0,0,0,.6)',border:'none',color:'#fff',fontSize:28,width:44,height:44,borderRadius:'50%',cursor:'pointer'}}>›</button>
              <div style={{position:'absolute',bottom:14,left:'50%',transform:'translateX(-50%)',background:'rgba(0,0,0,.5)',color:'#fff',fontSize:12,padding:'3px 10px',borderRadius:99}}>
                {galleryIdx+1} / {galleryPopup.galleryImages.length}
              </div>
            </>)}
          </div>
        </div>
      )}

      {/* ── Modal Audio ── */}
      {audioPopup && (
        <div className={styles.infoPopupOverlay} onClick={() => setAudioPopup(null)}>
          <div className={styles.infoPopup} style={{maxWidth:400}} onClick={e => e.stopPropagation()}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:16}}>
              <span style={{fontWeight:700,fontSize:15}}>🔊 {audioPopup.label || audioPopup.audioLabel || 'Audio'}</span>
              <button className={styles.infoPopupClose} onClick={() => setAudioPopup(null)}>✕</button>
            </div>
            <audio controls autoPlay src={audioPopup.audioUrl} style={{width:'100%',borderRadius:8}} />
          </div>
        </div>
      )}

      {infoFullPopup && (
        <div className={styles.infoPopupOverlay} onClick={() => setInfoFullPopup(null)}>
          <div className={styles.infoPopupCard} onClick={e => e.stopPropagation()}>
            <button className={styles.infoPopupClose} onClick={() => setInfoFullPopup(null)}>✕</button>
            {infoFullPopup.infoImageUrl && (
              <img src={infoFullPopup.infoImageUrl} alt={infoFullPopup.label} className={styles.infoPopupImg} />
            )}
            <div className={styles.infoPopupBody}>
              <h3 className={styles.infoPopupTitle}>{infoFullPopup.label}</h3>
              {infoFullPopup.infoContent && (
                <p className={styles.infoPopupText}>{infoFullPopup.infoContent}</p>
              )}
              {infoFullPopup.infoLink && (
                <a href={infoFullPopup.infoLink} target="_blank" rel="noopener noreferrer" className={styles.infoPopupLink}>
                  <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
                  {infoFullPopup.urlLabel || 'En savoir plus'}
                </a>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Preview info hotspot au survol */}
      {infoHoverPopup && (
        <div className={styles.infoHoverPreview}>
          {infoHoverPopup.infoImageUrl && (
            <img src={infoHoverPopup.infoImageUrl} alt={infoHoverPopup.label} className={styles.infoHoverImg} />
          )}
          <div className={styles.infoHoverBody}>
            <p className={styles.infoHoverTitle}>{infoHoverPopup.label}</p>
            {infoHoverPopup.infoContent && (
              <p className={styles.infoHoverText}>
                {infoHoverPopup.infoContent.length > 100
                  ? infoHoverPopup.infoContent.slice(0, 100) + '…'
                  : infoHoverPopup.infoContent}
              </p>
            )}
          </div>
        </div>
      )}

      {hotspotModal && (
        <HotspotModal
          hotspot={hotspotModal}
          scenes={scenes}
          activeSceneIdx={activeScene}
          onSave={saveHotspot}
          onDelete={hotspotModal.editing ? () => { deleteHotspot(hotspotModal.id); setHotspotModal(null) } : null}
          onClose={() => setHotspotModal(null)}
          onApplyColorAll={async (color) => {
            const proj = projectRef.current
            if (!proj) return
            const updatedScenes = proj.scenes.map(s => ({
              ...s,
              hotspots: (s.hotspots || []).map(h => ({ ...h, color }))
            }))
            await updateProject(proj.id, { scenes: updatedScenes })
            setHotspotModal(null)
          }}
          onApplyStyleAll={async (settings) => {
            const proj = projectRef.current
            if (!proj) return
            const updatedScenes = proj.scenes.map(s => ({
              ...s,
              hotspots: (s.hotspots || []).map(h =>
                h.type === 'navigation'
                  ? { ...h, ...settings }
                  : h
              )
            }))
            await updateProject(proj.id, { scenes: updatedScenes })
            setHotspotModal(null)
          }}
        />
      )}
    </div>
  )
}

// ── buildMarkers — passe couleur + opacité dans le HTML ────────
function buildMarkers(scene, allScenes) {
  return (scene.hotspots || []).map(h => {
    const target   = allScenes?.find(s => s.id === h.targetSceneId)
    // Pour les hotspots navigation, le label suit le nom de la scène cible en temps réel
    const label    = h.type === 'navigation' && target ? target.name : (h.label || '')
    const color    = h.color    || '#3d7bff'
    const opacity  = h.opacity  ?? 1
    const size     = h.size     ?? 1
    const style    = h.style    || 'floating'
    const iconDef  = HOTSPOT_ICONS.find(i => i.id === (h.icon || 'arrow-down')) || HOTSPOT_ICONS[0]
    const iconHtml = iconDef.html
    const px       = Math.round(22 * size)
    const iconScaled = iconHtml.replace(/width="22"/g, `width="${px}"`).replace(/height="22"/g, `height="${px}"`)

    // Icône par type pour les hotspots non-navigation
    const typeIcon = {
      info:       '💬',
      video:      '▶',
      gallery:    '🖼',
      audio:      '🔊',
      url:        '🔗',
      navigation: null,
    }[h.type] || 'ℹ'

    const getHtml = () => {
      const vars = `--hs-color:${color};--hs-opacity:${opacity};--hs-size:${size};--hs-ring-size:${h.ringSize ?? 1}`

      // Hotspots non-navigation — bulle avec icône type
      if (h.type && h.type !== 'navigation') {
        return `<div class="psv-marker-bubble" style="${vars}">
          <span class="psv-bubble-icon" style="font-size:${px}px">${typeIcon}</span>
          <span class="psv-bubble-text">${label}</span>
        </div>`
      }

      const noLabel = h.showLabel === false ? 'no-label' : ''

      if (style === 'floor-paisible') {
        const ring = Math.round(36 * size)
        const dot  = Math.round(14 * size)
        const dotH = Math.round(dot * 0.45)
        return `<div class="psv-marker-floor-paisible ${noLabel}" style="${vars}">
          <div class="psv-floor-paisible-wrap" style="width:${ring*3}px;height:${ring*3}px">
            <div class="psv-floor-paisible-ring" style="width:${ring}px;height:${ring}px"></div>
            <div class="psv-floor-paisible-dot" style="width:${dot}px;height:${dotH}px"></div>
          </div>
          <div class="psv-floor-paisible-label">${label}</div>
        </div>`
      }

      if (style === 'floor-ellipse') {
        const W = Math.round(54 * size), H = Math.round(W * 0.3)
        return `<div class="psv-marker-floor-ellipse ${noLabel}" style="${vars}">
          <div class="psv-floor-ellipse-label">${label}</div>
          <div class="psv-floor-ellipse-ring" style="width:${W}px;height:${H}px"></div>
        </div>`
      }

      if (style === 'floor-ring-static') {
        const W = Math.round(54 * size), H = Math.round(W * 0.3)
        return `<div class="psv-marker-floor-ring-static ${noLabel}" style="${vars}">
          <div class="psv-floor-ring-static-label">${label}</div>
          <div class="psv-floor-ring-static-dash" style="width:${W}px;height:${W}px"></div>
        </div>`
      }

      if (style === 'floor-dot') {
        const W = Math.round(64 * size), H = Math.round(W * 0.26)
        const dW = Math.round(W * 0.42), dH = Math.round(dW * 0.32)
        return `<div class="psv-marker-floor-dot ${noLabel}" style="${vars}">
          <div class="psv-floor-dot-label">${label}</div>
          <div class="psv-floor-dot-wrap" style="width:${W*3.2}px;height:${H*4.5}px">
            <div class="psv-floor-dot-p2" style="width:${W}px;height:${H}px"></div>
            <div class="psv-floor-dot-p1" style="width:${W}px;height:${H}px"></div>
            <div class="psv-floor-dot-center" style="width:${dW}px;height:${dH}px"></div>
          </div>
        </div>`
      }

      if (style === 'floor-sonar') {
        const W = Math.round(60 * size), H = Math.round(W * 0.28)
        const dW = Math.round(W * 0.32), dH = Math.round(H * 0.55)
        return `<div class="psv-marker-floor-sonar ${noLabel}" style="${vars}">
          <div class="psv-floor-sonar-label">${label}</div>
          <div class="psv-floor-sonar-wrap" style="width:${W*3.5}px;height:${H*4.5}px">
            <div class="psv-floor-sonar-w1" style="width:${W}px;height:${H}px"></div>
            <div class="psv-floor-sonar-w2" style="width:${W}px;height:${H}px"></div>
            <div class="psv-floor-sonar-w3" style="width:${W}px;height:${H}px"></div>
            <div class="psv-floor-sonar-center" style="width:${dW}px;height:${dH}px"></div>
          </div>
        </div>`
      }

      if (style === 'floor') {
        return `<div class="psv-marker-floor" style="${vars}">
          <div class="psv-floor-label">${label}</div>
          <div class="psv-floor-icon">${iconScaled}</div>
          <div class="psv-floor-ring"></div>
        </div>`
      }

      if (style === 'pin') {
        return `<div class="psv-marker-pin" style="${vars}">
          <div class="psv-pin-head">${iconScaled}</div>
          <div class="psv-pin-stem"></div>
          <div class="psv-pin-dot"></div>
          <div class="psv-marker-text">${label}</div>
        </div>`
      }

      if (style === 'bubble') {
        return `<div class="psv-marker-bubble" style="${vars}">
          <span class="psv-bubble-icon">${iconScaled}</span>
          <span class="psv-bubble-text">${label}</span>
        </div>`
      }

      // default: floating
      return `<div class="psv-marker-nav" style="${vars}">
        <div class="psv-marker-icon">${iconScaled}</div>
        <div class="psv-marker-text">${label}</div>
      </div>`
    }

    return {
      id:       h.id,
      position: { yaw: h.yaw, pitch: h.pitch },
      data:     {
        targetSceneId: h.targetSceneId,
        arrivalYaw:    h.arrivalYaw   ?? 0,
        arrivalPitch:  h.arrivalPitch ?? 0,
      },
      html: getHtml(),
      tooltip: null,
    }
  })
}

// ── Mini viewer PSV pour l'aperçu d'arrivée ───────────────────
function ArrivalPreview({ imageUrl, onAngleChange }) {
  const containerRef = useRef(null)
  const viewerRef    = useRef(null)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    if (!containerRef.current || !imageUrl) return
    let destroyed = false

    const init = async () => {
      await loadPSV()
      if (destroyed) return
      if (viewerRef.current) { viewerRef.current.destroy(); viewerRef.current = null }

      const viewer = new ViewerClass({
        container:      containerRef.current,
        panorama:       imageUrl,
        navbar:         false,
        defaultZoomLvl: 50,
      })

      // ✅ FIX: écouter position-updated pour capturer yaw ET pitch
      viewer.addEventListener('position-updated', (e) => {
        onAngleChange({ yaw: e.position.yaw, pitch: e.position.pitch })
      })

      viewer.addEventListener('ready', () => { if (!destroyed) setReady(true) })
      viewerRef.current = viewer
    }

    init()
    return () => {
      destroyed = true
      if (viewerRef.current) { viewerRef.current.destroy(); viewerRef.current = null }
    }
  }, [imageUrl])

  return (
    <div className={styles.arrivalPreviewWrap}>
      <div ref={containerRef} className={styles.arrivalPreviewViewer} />
      {!ready && <div className={styles.arrivalPreviewLoader}><span className={styles.psvSpinner} /></div>}
      <div className={styles.arrivalPreviewHint}>
        Faites glisser pour orienter la vue d'arrivée
      </div>
    </div>
  )
}

// ── Modal Hotspot ──────────────────────────────────────────────
function HotspotModal({ hotspot, scenes, activeSceneIdx, onSave, onDelete, onClose, onApplyColorAll, onApplyStyleAll }) {
  const isEditing = !!hotspot.editing

  const [label,         setLabel]         = useState(hotspot.label         || '')
  const [type,          setType]          = useState(hotspot.type          || 'navigation')
  const [targetSceneId, setTargetSceneId] = useState(hotspot.targetSceneId || '')
  const [arrivalYaw,    setArrivalYaw]    = useState(hotspot.arrivalYaw    ?? 0)
  const [arrivalPitch,  setArrivalPitch]  = useState(hotspot.arrivalPitch  ?? 0)
  const [icon,          setIcon]          = useState(hotspot.icon          || (hotspot.type === 'video' ? 'video' : hotspot.type === 'gallery' ? 'gallery' : hotspot.type === 'audio' ? 'audio' : hotspot.type === 'info' ? 'info' : 'arrow-down'))
  const [hsStyle,       setHsStyle]       = useState(hotspot.style         || 'floating')
  const [showLabel,     setShowLabel]     = useState(hotspot.showLabel     !== false)
  const [size,          setSize]          = useState(hotspot.size          ?? 1)
  const [color,         setColor]         = useState(hotspot.color         || '#3d7bff')
  const [opacity,       setOpacity]       = useState(hotspot.opacity       ?? 1)
  const [infoContent,   setInfoContent]   = useState(hotspot.infoContent   || '')
  const [infoImageUrl,  setInfoImageUrl]  = useState(hotspot.infoImageUrl  || null)
  const [infoLink,      setInfoLink]      = useState(hotspot.infoLink      || '')
  const [urlHref,       setUrlHref]       = useState(hotspot.urlHref       || '')
  const [urlLabel,      setUrlLabel]      = useState(hotspot.urlLabel      || '')
  const [videoUrl,      setVideoUrl]      = useState(hotspot.videoUrl      || '')
  const [galleryImages, setGalleryImages] = useState(hotspot.galleryImages || [])
  const [audioUrl,      setAudioUrl]      = useState(hotspot.audioUrl      || '')
  const [audioLabel,    setAudioLabel]    = useState(hotspot.audioLabel    || '')
  const [uploadingAudio,setUploadingAudio]= useState(false)
  const [uploadingGal,  setUploadingGal]  = useState(false)
  const audioInputRef   = useRef(null)
  const galInputRef     = useRef(null)
  const [uploadingImg,  setUploadingImg]  = useState(false)
  const [saving,        setSaving]        = useState(false)
  const [confirm,       setConfirm]       = useState(false)
  const infoImgInputRef = useRef(null)

  const otherScenes = scenes.filter((_, i) => i !== activeSceneIdx)
  const targetScene = scenes.find(s => s.id === targetSceneId)
  const currentIcon = HOTSPOT_ICONS.find(i => i.id === icon) || HOTSPOT_ICONS[0]

  const handleAngleChange = useCallback(({ yaw, pitch }) => {
    setArrivalYaw(yaw)
    setArrivalPitch(pitch)
  }, [])

  const handleSave = async () => {
    if (!label.trim()) return
    setSaving(true)
    await onSave({
      yaw: hotspot.yaw, pitch: hotspot.pitch,
      label: label.trim(), type, icon,
      style: hsStyle, size, targetSceneId: targetSceneId || null,
      videoUrl, galleryImages, audioUrl, audioLabel,
      arrivalYaw, arrivalPitch, color, opacity,
      infoContent, infoImageUrl, infoLink,
      urlHref, urlLabel,
      showLabel,
      id: hotspot.id,
    })
    setSaving(false)
  }

  const hasRightPanel = type === 'navigation' && targetSceneId && targetScene?.imageUrl

  return (
    <div className={styles.modalOverlay} onClick={e => e.target === e.currentTarget && onClose()}>
      <div className={`${styles.modalNew} ${hasRightPanel ? styles.modalNewWide : ''}`}>

        {/* ── Header fixe ── */}
        <div className={styles.modalHeaderFixed}>
          <h3 className={styles.modalTitle}>{isEditing ? 'Modifier le hotspot' : 'Nouveau hotspot'}</h3>
          <button className={styles.modalClose} onClick={onClose}>✕</button>
        </div>

        {/* ── Corps scrollable ── */}
        <div className={styles.modalNewBody}>

          {/* Colonne gauche : paramètres */}
          <div className={styles.modalParams}>

            {/* Prévisualisation hotspot — TOUJOURS VISIBLE en haut */}
            <div className={styles.livePreview} style={{ '--hs-color': color, '--hs-opacity': opacity, '--hs-size': size }}>
              <div className={styles.livePreviewBg}>
                {hsStyle === 'floor' && (
                  <div className="psv-marker-floor" style={{'--hs-color': color, '--hs-opacity': opacity, '--hs-size': size}}>
                    <div className="psv-floor-label">{label || 'Hotspot'}</div>
                    <div className="psv-floor-icon" dangerouslySetInnerHTML={{ __html: currentIcon.html }} style={{ color }} />
                    <div className="psv-floor-ring"></div>
                  </div>
                )}
                {hsStyle === 'pin' && (
                  <div className="psv-marker-pin" style={{'--hs-color': color, '--hs-opacity': opacity, '--hs-size': size}}>
                    <div className="psv-pin-head" dangerouslySetInnerHTML={{ __html: currentIcon.html }} />
                    <div className="psv-pin-stem"></div>
                    <div className="psv-pin-dot"></div>
                    <div className="psv-marker-text">{label || 'Hotspot'}</div>
                  </div>
                )}
                {hsStyle === 'bubble' && (
                  <div className="psv-marker-bubble" style={{'--hs-color': color, '--hs-opacity': opacity, '--hs-size': size}}>
                    <span className="psv-bubble-icon" dangerouslySetInnerHTML={{ __html: currentIcon.html }} />
                    <span className="psv-bubble-text">{label || 'Hotspot'}</span>
                  </div>
                )}
                {(hsStyle === 'floating' || !hsStyle) && (
                  <div className="psv-marker-nav" style={{'--hs-color': color, '--hs-opacity': opacity, '--hs-size': size}}>
                    <div className="psv-marker-icon" dangerouslySetInnerHTML={{ __html: currentIcon.html }} style={{ color }} />
                    <div className="psv-marker-text">{label || 'Hotspot'}</div>
                  </div>
                )}
              </div>
            </div>

            {/* Type */}
            <div className={styles.typeGrid}>
              {[
                { value: 'navigation', icon: '→',  label: 'Navigation'  },
                { value: 'info',       icon: 'ℹ',  label: 'Info / Lien' },
                { value: 'video',      icon: '▶',  label: 'Vidéo'       },
                { value: 'gallery',    icon: '🖼',  label: 'Galerie'     },
                { value: 'audio',      icon: '🔊',  label: 'Audio'       },
              ].map(t => (
                <button key={t.value}
                  className={`${styles.typeBtn} ${type === t.value ? styles.typeBtnActive : ''}`}
                  onClick={() => {
                    setType(t.value)
                    if (t.value === 'video')   setIcon('video')
                    if (t.value === 'gallery') setIcon('gallery')
                    if (t.value === 'audio')   setIcon('audio')
                    if (t.value === 'info')    setIcon('info')
                    if (t.value === 'navigation') setIcon('arrow-down')
                  }}
                >
                  <span className={styles.typeIcon}>{t.icon}</span>
                  <span>{t.label}</span>
                </button>
              ))}
            </div>

            {/* Label */}
            <div className={styles.modalField}>
              <label className={styles.modalLabel}>Label</label>
              <input type="text" value={label} onChange={e => setLabel(e.target.value)}
                placeholder="Ex : Vers le salon…" className={styles.modalInput} autoFocus />
            </div>

            {/* Icône */}
            <div className={styles.modalField}>
              <label className={styles.modalLabel}>Icône</label>
              <div className={styles.iconGrid}>
                {HOTSPOT_ICONS.map(ic => (
                  <button key={ic.id}
                    className={`${styles.iconBtn} ${icon === ic.id ? styles.iconBtnActive : ''}`}
                    onClick={() => setIcon(ic.id)}
                    title={ic.label}
                    dangerouslySetInnerHTML={{ __html: ic.html }}
                    style={{ color: icon === ic.id ? color : 'var(--text-2)' }}
                  />
                ))}
              </div>
            </div>

            {/* Style */}
            <div className={styles.modalField}>
              <label className={styles.modalLabel}>Style</label>
              <div className={styles.styleCardGrid}>

                {/* Flottant */}
                <button className={`${styles.styleCard} ${hsStyle === 'floating' ? styles.styleCardActive : ''}`}
                  onClick={() => setHsStyle('floating')}>
                  <div className={styles.styleCardPreview}>
                    <div className="psv-marker-nav" style={{'--hs-color': color, '--hs-size': 0.8, '--hs-opacity': 1}}>
                      <div className="psv-marker-icon" dangerouslySetInnerHTML={{ __html: currentIcon.html }} />
                      <div className="psv-marker-text" style={{opacity:1,transform:'none',fontSize:9}}>Label</div>
                    </div>
                  </div>
                  <span className={styles.styleCardLabel}>Flottant</span>
                </button>

                {/* Sol */}
                <button className={`${styles.styleCard} ${hsStyle === 'floor' ? styles.styleCardActive : ''}`}
                  onClick={() => setHsStyle('floor')}>
                  <div className={styles.styleCardPreview}>
                    <div className="psv-marker-floor" style={{'--hs-color': color, '--hs-size': 0.7, '--hs-opacity': 1}}>
                      <div className="psv-floor-icon" dangerouslySetInnerHTML={{ __html: currentIcon.html }} />
                      <div className="psv-floor-ring"></div>
                    </div>
                  </div>
                  <span className={styles.styleCardLabel}>Au sol</span>
                </button>

                {/* Pin */}
                <button className={`${styles.styleCard} ${hsStyle === 'pin' ? styles.styleCardActive : ''}`}
                  onClick={() => setHsStyle('pin')}>
                  <div className={styles.styleCardPreview}>
                    <div className="psv-marker-pin" style={{'--hs-color': color, '--hs-size': 0.7, '--hs-opacity': 1}}>
                      <div className="psv-pin-head" dangerouslySetInnerHTML={{ __html: currentIcon.html }} />
                      <div className="psv-pin-stem"></div>
                      <div className="psv-pin-dot"></div>
                    </div>
                  </div>
                  <span className={styles.styleCardLabel}>Pin</span>
                </button>

                {/* Bulle */}
                <button className={`${styles.styleCard} ${hsStyle === 'bubble' ? styles.styleCardActive : ''}`}
                  onClick={() => setHsStyle('bubble')}>
                  <div className={styles.styleCardPreview}>
                    <div className="psv-marker-bubble" style={{'--hs-color': color, '--hs-size': 0.8, '--hs-opacity': 1}}>
                      <span className="psv-bubble-icon" dangerouslySetInnerHTML={{ __html: currentIcon.html }} />
                      <span className="psv-bubble-text" style={{fontSize:9}}>Label</span>
                    </div>
                  </div>
                  <span className={styles.styleCardLabel}>Bulle</span>
                </button>

                {/* Pulse ellipse */}
                <button className={`${styles.styleCard} ${hsStyle === 'floor-dot' ? styles.styleCardActive : ''}`}
                  onClick={() => setHsStyle('floor-dot')}>
                  <div className={styles.styleCardPreview}>
                    <div className="psv-marker-floor-dot" style={{'--hs-color': color, '--hs-size': 0.7, '--hs-opacity': 1}}>
                      <div className="psv-floor-dot-wrap" style={{width:48,height:14}}>
                        <div className="psv-floor-dot-p2" style={{width:38,height:11}}></div>
                        <div className="psv-floor-dot-p1" style={{width:38,height:11}}></div>
                        <div className="psv-floor-dot-center" style={{width:16,height:5}}></div>
                      </div>
                    </div>
                  </div>
                  <span className={styles.styleCardLabel}>Pulse ellipse</span>
                </button>

                {/* Sonar */}
                <button className={`${styles.styleCard} ${hsStyle === 'floor-sonar' ? styles.styleCardActive : ''}`}
                  onClick={() => setHsStyle('floor-sonar')}>
                  <div className={styles.styleCardPreview}>
                    <div className="psv-marker-floor-sonar" style={{'--hs-color': color, '--hs-size': 0.7, '--hs-opacity': 1}}>
                      <div className="psv-floor-sonar-wrap" style={{width:52,height:14}}>
                        <div className="psv-floor-sonar-w1" style={{width:38,height:11}}></div>
                        <div className="psv-floor-sonar-w2" style={{width:38,height:11}}></div>
                        <div className="psv-floor-sonar-w3" style={{width:38,height:11}}></div>
                        <div className="psv-floor-sonar-center" style={{width:12,height:6}}></div>
                      </div>
                    </div>
                  </div>
                  <span className={styles.styleCardLabel}>Sonar</span>
                </button>

                {/* Paisible */}
                <button className={`${styles.styleCard} ${hsStyle === 'floor-paisible' ? styles.styleCardActive : ''}`}
                  onClick={() => setHsStyle('floor-paisible')}>
                  <div className={styles.styleCardPreview}>
                    <div className="psv-marker-floor-paisible" style={{'--hs-color': color, '--hs-size': 0.7, '--hs-opacity': 1}}>
                      <div className="psv-floor-paisible-wrap" style={{width:48,height:48}}>
                        <div className="psv-floor-paisible-ring" style={{width:20,height:20}}></div>
                        <div className="psv-floor-paisible-dot" style={{width:8,height:4}}></div>
                      </div>
                    </div>
                  </div>
                  <span className={styles.styleCardLabel}>Paisible</span>
                </button>

                {/* Ellipse outline */}
                <button className={`${styles.styleCard} ${hsStyle === 'floor-ellipse' ? styles.styleCardActive : ''}`}
                  onClick={() => setHsStyle('floor-ellipse')}>
                  <div className={styles.styleCardPreview}>
                    <div className="psv-marker-floor-ellipse" style={{'--hs-color': color, '--hs-size': 0.7, '--hs-opacity': 1}}>
                      <div className="psv-floor-ellipse-ring" style={{width:40,height:12}}></div>
                    </div>
                  </div>
                  <span className={styles.styleCardLabel}>Ellipse</span>
                </button>

                {/* Anneau pointillé */}
                <button className={`${styles.styleCard} ${hsStyle === 'floor-ring-static' ? styles.styleCardActive : ''}`}
                  onClick={() => setHsStyle('floor-ring-static')}>
                  <div className={styles.styleCardPreview}>
                    <div className="psv-marker-floor-ring-static" style={{'--hs-color': color, '--hs-size': 0.7, '--hs-opacity': 1}}>
                      <div className="psv-floor-ring-static-dash" style={{width:44,height:44}}></div>
                    </div>
                  </div>
                  <span className={styles.styleCardLabel}>Anneau</span>
                </button>

              </div>
            </div>

            {/* Masquer le label */}
            <div className={styles.modalField} style={{display:'flex',alignItems:'center',gap:10}}>
              <input
                type="checkbox"
                id="showLabel"
                checked={showLabel !== false}
                onChange={e => setShowLabel(e.target.checked)}
                style={{width:16,height:16,cursor:'pointer'}}
              />
              <label htmlFor="showLabel" className={styles.modalLabel} style={{cursor:'pointer',margin:0}}>
                Afficher le label au survol
              </label>
            </div>
            <div className={styles.sliderGroup}>

              {/* Taille icône — toujours visible */}
              <div className={styles.modalField}>
                <label className={styles.modalLabel}>
                  Taille de l'icône — <strong>{Math.round(size * 100)}%</strong>
                </label>
                <input type="range" min="0.3" max="3" step="0.1"
                  value={size} onChange={e => setSize(parseFloat(e.target.value))}
                  className={styles.slider}
                />
                <div className={styles.sizePresets}>
                  {[{ label: 'XS', v: 0.5 }, { label: 'S', v: 0.75 }, { label: 'M', v: 1 }, { label: 'L', v: 1.5 }, { label: 'XL', v: 2 }, { label: 'XXL', v: 3 }].map(p => (
                    <button key={p.label}
                      className={`${styles.sizePresetBtn} ${Math.abs(size - p.v) < 0.05 ? styles.sizePresetBtnActive : ''}`}
                      onClick={() => setSize(p.v)}
                    >{p.label}</button>
                  ))}
                </div>
              </div>

              {/* Opacité */}
              <div className={styles.modalField}>
                <label className={styles.modalLabel}>Opacité — <strong>{Math.round(opacity * 100)}%</strong></label>
                <input type="range" min="0.1" max="1" step="0.05"
                  value={opacity} onChange={e => setOpacity(parseFloat(e.target.value))}
                  className={styles.slider}
                />
              </div>
            </div>

            {/* Couleur */}
            <div className={styles.modalField}>
              <label className={styles.modalLabel}>Couleur</label>
              <div className={styles.colorRow}>
                <input type="color" value={color} onChange={e => setColor(e.target.value)} className={styles.colorPicker} title="Couleur personnalisée" />
                <div className={styles.colorPresets}>
                  {['#3d7bff','#22c55e','#f59e0b','#ef4444','#a855f7','#ffffff','#ff6b6b','#ffd93d','#6bcb77','#4d96ff'].map(c => (
                    <button key={c}
                      className={`${styles.colorPreset} ${color === c ? styles.colorPresetActive : ''}`}
                      style={{ background: c }} onClick={() => setColor(c)}
                    />
                  ))}
                </div>
              </div>
              <div className={styles.colorCustomRow}>
                <span className={styles.colorSwatch} style={{ background: color }} />
                <input
                  type="text"
                  value={color}
                  onChange={e => {
                    const v = e.target.value
                    if (/^#[0-9a-fA-F]{0,6}$/.test(v)) setColor(v)
                  }}
                  className={styles.colorHexInput}
                  placeholder="#3d7bff"
                  maxLength={7}
                  spellCheck={false}
                />
                <span className={styles.colorHexLabel}>hex</span>
              </div>
            </div>

            {/* Appliquer couleur à tous */}
            <div className={styles.modalField}>
              <button
                className={styles.modalCancel}
                style={{ width: '100%', marginTop: 2 }}
                onClick={() => onApplyColorAll && onApplyColorAll(color)}
                title="Applique cette couleur à tous les hotspots de toutes les scènes"
              >
                🎨 Appliquer cette couleur à tous les hotspots
              </button>
            </div>

            {/* Appliquer tous les réglages navigation */}
            {type === 'navigation' && (
              <div className={styles.modalField}>
                <button
                  className={styles.modalCancel}
                  style={{ width: '100%', marginTop: 2, borderColor: 'rgba(152,0,255,.4)', color: '#c084fc' }}
                  onClick={() => onApplyStyleAll && onApplyStyleAll({
                    style:   hsStyle,
                    icon,
                    size,
                    color,
                    opacity,
                  })}
                  title="Applique style, icône, taille, couleur et opacité à tous les hotspots de navigation"
                >
                  ✦ Appliquer ces réglages à tous les hotspots de navigation
                </button>
              </div>
            )}

            {/* Scène cible */}
            {type === 'navigation' && otherScenes.length > 0 && (
              <div className={styles.modalField}>
                <label className={styles.modalLabel}>Scène de destination</label>
                <select value={targetSceneId} onChange={e => setTargetSceneId(e.target.value)} className={styles.modalInput}>
                  <option value="">— Choisir une scène —</option>
                  {otherScenes.map(s => <option key={s.id} value={s.id}>{s.name || s.id}</option>)}
                </select>
              </div>
            )}

            {type === 'navigation' && targetSceneId && (
              <div className={styles.arrivalAngleInfo}>
                <p className={styles.modalLabel}>Angle d'arrivée</p>
                <div className={styles.angleDisplay}>
                  <span>Yaw <strong>{toDeg(arrivalYaw)}°</strong></span>
                  <span>Pitch <strong>{toDeg(arrivalPitch)}°</strong></span>
                </div>
              </div>
            )}

            {/* ── Contenu Info-bulle ── */}
            {type === 'info' && (
              <div className={styles.infoContentSection}>
                <div className={styles.modalField}>
                  <label className={styles.modalLabel}>Texte</label>
                  <textarea
                    value={infoContent}
                    onChange={e => setInfoContent(e.target.value)}
                    className={`${styles.modalInput} ${styles.modalTextarea}`}
                    placeholder="Décrivez ce point d'intérêt…"
                    rows={4}
                  />
                </div>

                <div className={styles.modalField}>
                  <label className={styles.modalLabel}>Image (optionnel)</label>
                  {infoImageUrl ? (
                    <div className={styles.infoImgPreview}>
                      <img src={infoImageUrl} alt="info" className={styles.infoImgThumb} />
                      <button className={styles.infoImgRemove} onClick={() => setInfoImageUrl(null)}>✕ Supprimer</button>
                    </div>
                  ) : (
                    <button className={styles.infoImgUploadBtn}
                      onClick={() => infoImgInputRef.current?.click()}
                      disabled={uploadingImg}>
                      {uploadingImg ? 'Upload…' : '+ Ajouter une image'}
                    </button>
                  )}
                  <input ref={infoImgInputRef} type="file" accept="image/*" style={{ display:'none' }}
                    onChange={async (e) => {
                      const f = e.target.files?.[0]
                      if (!f) return
                      setUploadingImg(true)
                      try {
                        const { uploadImage } = await import('@services/cloudinary')
                        const { url } = await uploadImage(f, 'lc360/info-images', () => {})
                        setInfoImageUrl(url)
                      } catch(err) { console.error(err) }
                      setUploadingImg(false)
                    }}
                  />
                </div>

                <div className={styles.modalField}>
                  <label className={styles.modalLabel}>Lien hypertexte (optionnel)</label>
                  <input type="url" value={infoLink} onChange={e => setInfoLink(e.target.value)}
                    className={styles.modalInput} placeholder="https://…" />
                </div>
              </div>
            )}

            {/* ── Vidéo ── */}
            {type === 'video' && (
              <div className={styles.infoContentSection}>
                <div className={styles.modalField}>
                  <label className={styles.modalLabel}>URL YouTube ou Vimeo</label>
                  <input type="url" value={videoUrl} onChange={e => setVideoUrl(e.target.value)}
                    className={styles.modalInput} placeholder="https://youtube.com/watch?v=..." />
                  <span style={{fontSize:11,color:'var(--text-3)',marginTop:4,display:'block'}}>
                    Collez le lien YouTube, Vimeo ou tout autre lien vidéo direct (.mp4)
                  </span>
                </div>
                {videoUrl && (
                  <div className={styles.videoPreview}>
                    <iframe
                      src={videoUrl.includes('youtube.com/watch') ? videoUrl.replace('watch?v=','embed/').split('&')[0] :
                           videoUrl.includes('youtu.be/') ? 'https://www.youtube.com/embed/' + videoUrl.split('youtu.be/')[1].split('?')[0] :
                           videoUrl.includes('vimeo.com/') ? 'https://player.vimeo.com/video/' + videoUrl.split('vimeo.com/')[1].split('?')[0] :
                           videoUrl}
                      width="100%" height="180" frameBorder="0" allowFullScreen
                      style={{borderRadius:8}}
                    />
                  </div>
                )}
              </div>
            )}

            {/* ── Galerie ── */}
            {type === 'gallery' && (
              <div className={styles.infoContentSection}>
                <div className={styles.modalField}>
                  <label className={styles.modalLabel}>Images de la galerie ({galleryImages.length})</label>
                  <div className={styles.galleryThumbGrid}>
                    {galleryImages.map((img, i) => (
                      <div key={i} className={styles.galleryThumbWrap}>
                        <img src={img.url} alt={img.caption || ''} className={styles.galleryThumbImage} />
                        <button className={styles.galleryThumbRemove} onClick={() => setGalleryImages(g => g.filter((_,j) => j !== i))}>✕</button>
                      </div>
                    ))}
                    <button className={styles.infoImgUploadBtn} onClick={() => galInputRef.current?.click()} disabled={uploadingGal}
                      style={uploadingGal ? {opacity:.6, cursor:'not-allowed'} : {}}>
                      {uploadingGal ? '⏳ Upload en cours…' : '+ Ajouter des photos'}
                    </button>
                  </div>
                  <input ref={galInputRef} type="file" accept="image/*" multiple style={{display:'none'}}
                    onChange={async (e) => {
                      const files = Array.from(e.target.files || [])
                      if (!files.length) return
                      setUploadingGal(true)
                      try {
                        const { uploadImage } = await import('@services/cloudinary')
                        for (const f of files) {
                          const { url } = await uploadImage(f, 'lc360/gallery', () => {})
                          setGalleryImages(g => [...g, { url, caption: '' }])
                        }
                      } catch(err) { console.error(err) }
                      setUploadingGal(false)
                    }}
                  />
                </div>
              </div>
            )}

            {/* ── Audio ── */}
            {type === 'audio' && (
              <div className={styles.infoContentSection}>
                <div className={styles.modalField}>
                  <label className={styles.modalLabel}>Description audio (optionnel)</label>
                  <input type="text" value={audioLabel} onChange={e => setAudioLabel(e.target.value)}
                    className={styles.modalInput} placeholder="Ex : Bruit de la fontaine…" />
                </div>
                <div className={styles.modalField}>
                  <label className={styles.modalLabel}>Fichier audio (MP3, WAV)</label>
                  {audioUrl ? (
                    <div style={{display:'flex',flexDirection:'column',gap:8}}>
                      <audio controls src={audioUrl} style={{width:'100%',borderRadius:8}} />
                      <button className={styles.infoImgRemove} onClick={() => setAudioUrl('')}>✕ Supprimer</button>
                    </div>
                  ) : (
                    <button className={styles.infoImgUploadBtn} onClick={() => audioInputRef.current?.click()} disabled={uploadingAudio}
                      style={uploadingAudio ? {opacity:.6,cursor:'not-allowed'} : {}}>
                      {uploadingAudio ? '⏳ Upload en cours…' : '+ Importer un fichier MP3/WAV'}
                    </button>
                  )}
                  <input ref={audioInputRef} type="file" accept="audio/*" style={{display:'none'}}
                    onChange={async (e) => {
                      const f = e.target.files?.[0]
                      if (!f) return
                      setUploadingAudio(true)
                      try {
                        const { uploadAudio } = await import('@services/cloudinary')
                        const { url } = await uploadAudio(f, 'lc360/audio', () => {})
                        setAudioUrl(url)
                      } catch(err) { console.error(err) }
                      setUploadingAudio(false)
                    }}
                  />
                </div>
              </div>
            )}

            <div className={styles.modalCoords}>
              <span>Yaw: {toDeg(hotspot.yaw)}°</span>
              <span>Pitch: {toDeg(hotspot.pitch)}°</span>
            </div>
          </div>

          {/* Colonne droite — aperçu panorama destination */}
          {hasRightPanel && (
            <div className={styles.modalRight}>
              <p className={styles.arrivalPreviewTitle}>
                Aperçu d'arrivée — <strong>{targetScene.name}</strong>
              </p>
              <ArrivalPreview imageUrl={targetScene.imageUrl} onAngleChange={handleAngleChange} />
            </div>
          )}
        </div>

        {/* ── Footer fixe — TOUJOURS VISIBLE ── */}
        <div className={styles.modalFooterFixed}>
          {isEditing && onDelete && !confirm && (
            <button className={styles.modalDelete} onClick={() => setConfirm(true)}>🗑 Supprimer</button>
          )}
          {confirm && (
            <button className={styles.modalDeleteConfirm} onClick={onDelete}>Confirmer suppression</button>
          )}
          <button className={styles.modalCancel} onClick={onClose}>Annuler</button>
          <button className={styles.modalConfirm} onClick={handleSave} disabled={!label.trim() || saving}>
            {saving ? 'Sauvegarde…' : isEditing ? '✓ Enregistrer' : '✓ Ajouter'}
          </button>
        </div>

      </div>
    </div>
  )
}

// ── Modal Upload ───────────────────────────────────────────────
function UploadModal({ project, allProjects, onClose, replaceSceneIdx, isPRO }) {
  const [tab,           setTab]           = useState('upload')
  const [file,          setFile]          = useState(null)
  const [name,          setName]          = useState('')
  const [progress,      setProgress]      = useState(0)
  const [uploading,     setUploading]     = useState(false)
  const [error,         setError]         = useState(null)
  const [sketchupImgs,  setSketchupImgs]  = useState([])
  const inputRef = useRef(null)
  const authUser = useAtomValue(authUserAtom)

  // Charger toutes les images depuis le backend Cloud Run
  useEffect(() => {
    if (!authUser?.uid) return
    // Récupérer la clé d'activation depuis Firestore
    import('firebase/firestore').then(({ doc: fsDoc, getDoc }) => {
      getDoc(fsDoc(db, 'users', authUser.uid)).then(snap => {
        const key = snap.data()?.sketchupKey
        if (!key) return
        fetch('https://izi360-backend-694882487700.europe-west1.run.app/api/media-library', {
          headers: { 'Authorization': `Bearer ${key}` }
        })
        .then(r => r.json())
        .then(data => {
          if (data.status === 'success') {
            const imgs = data.images.map(img => ({
              url: img.url,
              sceneName: img.public_id.split('/').pop() || 'Image',
              projectName: img.folder || 'Cloudinary',
              source: img.folder?.includes('izi360') ? 'sketchup' : 'lc360',
            }))
            setSketchupImgs(imgs)
          }
        })
        .catch(() => {})
      })
    })
  }, [authUser?.uid])

  // Médiathèque — toutes les images (projets LC360 + SketchUp)
  const gallery = (() => {
    const seen = new Set()
    const imgs = []
    const sorted = [...(allProjects || [])].sort((a, b) => (b.updatedAt?.toMillis?.() ?? 0) - (a.updatedAt?.toMillis?.() ?? 0))
    for (const proj of sorted) {
      for (const s of (proj.scenes || [])) {
        if (!s.imageUrl || seen.has(s.imageUrl)) continue
        seen.add(s.imageUrl)
        imgs.push({ url: s.imageUrl, sceneName: s.name || 'Sans nom', projectName: proj.name || 'Projet' })
      }
    }
    // Ajouter les images SketchUp
    for (const img of sketchupImgs) {
      if (!img.url || seen.has(img.url)) continue
      seen.add(img.url)
      imgs.push(img)
    }
    return imgs
  })()

  const addScene = async (url, sceneName) => {
    if (replaceSceneIdx !== undefined && replaceSceneIdx !== null) {
      // Mode remplacement — pas de vérification de limite
      await updateProject(project.id, { scenes: project.scenes.map((s, i) => i === replaceSceneIdx ? { ...s, imageUrl: url } : s) })
    } else {
      // Vérifier la limite de scènes pour les free
      if (!isPRO) {
        try {
          const { getDoc, doc } = await import('firebase/firestore')
          const { db } = await import('@services/firebase')
          const limSnap = await getDoc(doc(db, 'config', 'limits'))
          const scenesLimit = limSnap.exists() ? (limSnap.data().scenes_free || 8) : 8
          const currentCount = project.scenes?.length || 0
          if (currentCount >= scenesLimit) {
            setError(`Limite atteinte — ${scenesLimit} scènes max en plan gratuit. Passez en PRO pour des scènes illimitées.`)
            return
          }
        } catch(e) {}
      }
      const newScene = { id: `scene_${Date.now()}`, name: sceneName.trim() || 'Nouvelle scène', imageUrl: url, hotspots: [], createdAt: new Date().toISOString() }
      await updateProject(project.id, { scenes: [...(project.scenes || []), newScene] })
    }
    onClose()
  }

  const handleFile = (e) => {
    const f = e.target.files?.[0]
    if (!f) return
    if (!f.type.startsWith('image/')) { setError('Format image uniquement'); return }
    if (f.size > 100 * 1024 * 1024)  { setError('Max 100 Mo'); return }
    setError(null); setFile(f)
    if (!name) setName(f.name.replace(/\.[^.]+$/, ''))
  }

  const handleUpload = async () => {
    if (!file || !name.trim()) return
    setUploading(true); setError(null)
    try {
      const { url } = await uploadImage(file, `lc360/projects/${project.id}`, setProgress)
      await addScene(url, name)
    } catch (err) {
      setError('Erreur : ' + err.message); setUploading(false)
    }
  }

  return (
    <div className={styles.modalOverlay} onClick={e => e.target === e.currentTarget && !uploading && onClose()}>
      <div className={styles.modal} style={{ maxWidth: 560, maxHeight: '85vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div className={styles.modalHeader}>
          <h3 className={styles.modalTitle}>{replaceSceneIdx !== undefined && replaceSceneIdx !== null ? '🔄 Remplacer le panorama' : 'Ajouter une scène 360°'}</h3>
          {!uploading && <button className={styles.modalClose} onClick={onClose}>✕</button>}
        </div>

        <div className={styles.replaceTabs}>
          <button className={`${styles.replaceTab} ${tab === 'upload' ? styles.replaceTabActive : ''}`} onClick={() => setTab('upload')}>⬆ Importer</button>
          <button className={`${styles.replaceTab} ${tab === 'gallery' ? styles.replaceTabActive : ''}`} onClick={() => setTab('gallery')}>🖼 Médiathèque {gallery.length > 0 ? `(${gallery.length})` : ''}</button>
        </div>

        {tab === 'upload' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div className={`${styles.dropZone} ${file ? styles.dropZoneHasFile : ''}`}
              onClick={() => !uploading && inputRef.current?.click()}
              onDragOver={e => e.preventDefault()}
              onDrop={e => { e.preventDefault(); handleFile({ target: { files: [e.dataTransfer.files[0]] } }) }}
            >
              <input ref={inputRef} type="file" accept="image/*" onChange={handleFile} style={{ display:'none' }} />
              {file ? (
                <div className={styles.filePreview}>
                  <span className={styles.fileIcon}>🖼</span>
                  <div><p className={styles.fileName}>{file.name}</p><p className={styles.fileSize}>{(file.size/1024/1024).toFixed(1)} Mo</p></div>
                </div>
              ) : (
                <><span className={styles.dropIcon}>⬆</span><p className={styles.dropText}>Cliquez ou glissez une image 360°</p><p className={styles.dropHint}>JPG, PNG, WebP — max 100 Mo</p></>
              )}
            </div>
            <div className={styles.modalField}>
              <label className={styles.modalLabel}>Nom de la scène</label>
              <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="Ex : Salon…" className={styles.modalInput} disabled={uploading} />
            </div>
            {error && <p className={styles.modalError}>{error}</p>}
            {uploading && (
              <div className={styles.progressWrap}>
                <div className={styles.progressBar}><div className={styles.progressFill} style={{ width:`${progress}%` }} /></div>
                <span className={styles.progressLabel}>{progress}%</span>
              </div>
            )}
          </div>
        )}

        {tab === 'gallery' && (
          <div style={{overflowY:'auto', flex:1}}>
            {gallery.length === 0 ? (
              <p className={styles.galleryEmpty}>Aucune image dans votre médiathèque.<br/>Importez d'abord une image depuis l'onglet "Importer".</p>
            ) : gallery.map((img, i) => (
              <div key={i} onClick={() => addScene(img.url, img.sceneName)}
                style={{position:'relative', cursor:'pointer', border:'1px solid var(--border)', borderRadius:8, overflow:'hidden', marginBottom:8}}>
                <img src={img.url} alt={img.sceneName} style={{width:'100%', height:'auto', display:'block'}} />
                {img.source === 'sketchup' && (
                  <span style={{position:'absolute',top:4,left:4,background:'#1d4ed8',color:'#fff',fontSize:9,fontWeight:800,padding:'2px 5px',borderRadius:4}}>SU</span>
                )}
                <div style={{padding:'4px 8px 6px', fontSize:12, color:'var(--text-2)'}}>
                  {img.sceneName} — {img.projectName}
                </div>
              </div>
            ))}
          </div>
        )}

        {tab === 'upload' && (
          <div className={styles.modalActions}>
            <button className={styles.modalCancel} onClick={onClose} disabled={uploading}>Annuler</button>
            <button className={styles.modalConfirm} onClick={handleUpload} disabled={!file || !name.trim() || uploading}>
              {uploading ? 'Upload…' : 'Ajouter'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

// ── SceneSettingsModal ────────────────────────────────────────
function SceneSettingsModal({ scene, viewer, onSave, onSaveAll, onClose }) {
  const [zoomDefault,    setZoomDefault]    = useState(scene.zoomDefault    ?? 80)
  const [zoomMin,        setZoomMin]        = useState(scene.zoomMin        ?? 70)
  const [zoomMax,        setZoomMax]        = useState(scene.zoomMax        ?? 90)
  const [correctionTilt, setCorrectionTilt] = useState(scene.correctionTilt ?? 0)
  const [correctionPan,  setCorrectionPan]  = useState(scene.correctionPan  ?? 0)
  const [correctionRoll, setCorrectionRoll] = useState(scene.correctionRoll ?? 0)
  const [autorotate,     setAutorotate]     = useState(scene.autorotate     ?? false)
  const [autorotSpeed,   setAutorotSpeed]   = useState(scene.autorotSpeed   ?? 1)
  const [autorotDir,     setAutorotDir]     = useState(scene.autorotDir     ?? 1)

  // Réglages image
  const [brightness,  setBrightness]  = useState(scene.filters?.brightness  ?? 100)
  const [contrast,    setContrast]    = useState(scene.filters?.contrast    ?? 100)
  const [saturation,  setSaturation]  = useState(scene.filters?.saturation  ?? 100)
  const [sharpness,   setSharpness]   = useState(scene.filters?.sharpness   ?? 0)
  const [warmth,      setWarmth]      = useState(scene.filters?.warmth      ?? 0)
  const [highlights,  setHighlights]  = useState(scene.filters?.highlights  ?? 0)
  const [shadows,     setShadows]     = useState(scene.filters?.shadows     ?? 0)

  const [activeSection, setActiveSection] = useState('zoom')
  const [saving,        setSaving]        = useState(false)
  const isImageMode = activeSection === 'image'

  const applyFilters = useCallback((br, co, sa, sh, wa, hl = highlights, sd = shadows) => {
    const canvas = viewer?.renderer?.container || viewer?.container
    if (!canvas) return
    applySceneFilters(canvas, { brightness: br, contrast: co, saturation: sa, sharpness: sh, warmth: wa, highlights: hl, shadows: sd })
  }, [viewer, highlights, shadows])

  const applyToViewer = useCallback((vals) => {
    if (!viewer) return
    try {
      viewer.setOption('minFov', 180 - vals.zx)
      viewer.setOption('maxFov', 180 - vals.zn)
      viewer.zoom(vals.zd)
      viewer.setOption('sphereCorrection', {
        tilt: vals.pt * Math.PI / 180,
        pan:  vals.pp * Math.PI / 180,
        roll: vals.pr * Math.PI / 180,
      })
    } catch(e) {}
  }, [viewer])

  useEffect(() => {
    applyToViewer({ zd: zoomDefault, zn: zoomMin, zx: zoomMax, pt: correctionTilt, pp: correctionPan, pr: correctionRoll })
    applyFilters(brightness, contrast, saturation, sharpness, warmth)
    return () => { try { viewer?.stopAutorotate?.() } catch(e) {} }
  }, [])

  const V = (zd, zn, zx, pt, pp, pr) => applyToViewer({ zd, zn, zx, pt, pp, pr })

  const handleSave = async () => {
    setSaving(true)
    await onSave({
      zoomDefault, zoomMin, zoomMax,
      correctionTilt, correctionPan, correctionRoll,
      autorotate, autorotSpeed, autorotDir,
      filters: { brightness, contrast, saturation, sharpness, warmth, highlights, shadows },
    })
  }

  const handleSaveAll = async () => {
    setSaving(true)
    await onSaveAll({
      zoomDefault, zoomMin, zoomMax,
      correctionTilt, correctionPan, correctionRoll,
      autorotate, autorotSpeed, autorotDir,
      filters: { brightness, contrast, saturation, sharpness, warmth, highlights, shadows },
    })
    setSaving(false)
  }

  const handleCancel = () => {
    applyToViewer({ zd: scene.zoomDefault ?? 80, zn: scene.zoomMin ?? 70, zx: scene.zoomMax ?? 90, pt: scene.correctionTilt ?? 0, pp: scene.correctionPan ?? 0, pr: scene.correctionRoll ?? 0 })
    onClose()
  }

  return (
    <div
      className={styles.modalOverlay}
      onClick={e => e.target === e.currentTarget && handleCancel()}
      style={isImageMode ? { background: 'transparent', backdropFilter: 'none', alignItems: 'flex-end', justifyContent: 'flex-start', padding: 16 } : {}}
    >
      <div className={styles.modal} style={isImageMode ? { maxHeight: '80dvh', width: 320 } : {}}>
        <div className={styles.modalHeader}>
          <h3 className={styles.modalTitle}>⚙ Réglages — {scene.name}</h3>
          <button className={styles.modalClose} onClick={handleCancel}>✕</button>
        </div>

        {/* Onglets de navigation */}
        <div style={{display:'flex', gap:6, flexShrink:0}}>
          {[
            { id:'zoom',      label:'🔍 Zoom' },
            { id:'correction',label:'📐 Correction' },
            { id:'image',     label:'🎨 Image' },
            { id:'autorot',   label:'🔄 Auto' },
          ].map(tab => (
            <button key={tab.id}
              onClick={() => setActiveSection(tab.id)}
              style={{
                flex:1, padding:'5px 4px', fontSize:11, fontWeight:600,
                borderRadius:6, border:'1px solid',
                borderColor: activeSection === tab.id ? 'var(--accent)' : 'var(--border)',
                background: activeSection === tab.id ? 'rgba(29,78,216,.15)' : 'transparent',
                color: activeSection === tab.id ? 'var(--accent)' : 'var(--text-2)',
                cursor:'pointer',
              }}
            >{tab.label}</button>
          ))}
        </div>

        <div className={styles.sceneSettingsBody}>

          {activeSection === 'zoom' && <div className={styles.settingsSection}>
            <p className={styles.settingsSectionTitle}>Zoom</p>
            <div className={styles.modalField}>
              <label className={styles.modalLabel}>Zoom par défaut — <strong>{zoomDefault}%</strong></label>
              <input type="range" min="0" max="100" step="1" value={zoomDefault} className={styles.slider}
                onChange={e => { const v = +e.target.value; setZoomDefault(v); V(v, zoomMin, zoomMax, correctionTilt, correctionPan, correctionRoll) }} />
            </div>
            <div className={styles.zoomRange}>
              <div className={styles.modalField}>
                <label className={styles.modalLabel}>Minimum — <strong>{zoomMin}%</strong></label>
                <input type="range" min="0" max="100" step="1" value={zoomMin} className={styles.slider}
                  onChange={e => { const v = Math.min(+e.target.value, zoomMax-5); setZoomMin(v); V(zoomDefault, v, zoomMax, correctionTilt, correctionPan, correctionRoll) }} />
              </div>
              <div className={styles.modalField}>
                <label className={styles.modalLabel}>Maximum — <strong>{zoomMax}%</strong></label>
                <input type="range" min="0" max="100" step="1" value={zoomMax} className={styles.slider}
                  onChange={e => { const v = Math.max(+e.target.value, zoomMin+5); setZoomMax(v); V(zoomDefault, zoomMin, v, correctionTilt, correctionPan, correctionRoll) }} />
              </div>
            </div>
            <div className={styles.zoomBar}>
              <div className={styles.zoomBarTrack}>
                <div className={styles.zoomBarRange} style={{ left:`${zoomMin}%`, width:`${zoomMax-zoomMin}%` }} />
                <div className={styles.zoomBarDefault} style={{ left:`${zoomDefault}%` }} />
              </div>
              <div className={styles.zoomBarLabels}><span>Dézoom max</span><span>Zoom max</span></div>
            </div>
          </div>}

          {activeSection === 'correction' && <div className={styles.settingsSection}>
            <p className={styles.settingsSectionTitle}>Correction d'horizontalité</p>
            <p className={styles.settingsSectionHint}>Redresse le panorama. Réglez en regardant le viewer derrière.</p>
            {[
              { label: 'Tilt — gauche/droite', val: correctionTilt, set: v => { setCorrectionTilt(v); V(zoomDefault, zoomMin, zoomMax, v, correctionPan, correctionRoll) } },
              { label: 'Pan — avant/arrière',  val: correctionPan,  set: v => { setCorrectionPan(v);  V(zoomDefault, zoomMin, zoomMax, correctionTilt, v, correctionRoll) } },
              { label: 'Roll — rotation',       val: correctionRoll, set: v => { setCorrectionRoll(v); V(zoomDefault, zoomMin, zoomMax, correctionTilt, correctionPan, v) } },
            ].map(({ label, val, set }) => (
              <div key={label} className={styles.modalField}>
                <label className={styles.modalLabel}>{label} — <strong>{val > 0 ? '+' : ''}{val}°</strong></label>
                <div className={styles.correctionRow}>
                  <input type="range" min="-20" max="20" step="0.5" value={val} className={styles.slider} onChange={e => set(+e.target.value)} />
                  <button className={styles.resetSmall} onClick={() => set(0)}>0</button>
                </div>
              </div>
            ))}
          </div>}

          {activeSection === 'image' && <div className={styles.settingsSection}>
            <p className={styles.settingsSectionTitle}>Réglages image</p>
            <p className={styles.settingsSectionHint}>Temps réel — visible par tous les visiteurs.</p>
            {[
              { label: 'Luminosité',       val: brightness, set: v => { setBrightness(v); applyFilters(v, contrast, saturation, sharpness, warmth) }, min: 50, max: 150, step: 1,   unit: '%', zero: 100 },
              { label: 'Contraste',         val: contrast,   set: v => { setContrast(v);   applyFilters(brightness, v, saturation, sharpness, warmth) }, min: 50, max: 150, step: 1,   unit: '%', zero: 100 },
              { label: 'Saturation',        val: saturation, set: v => { setSaturation(v); applyFilters(brightness, contrast, v, sharpness, warmth)  }, min: 0,  max: 200, step: 1,   unit: '%', zero: 100 },
              { label: 'Chaleur',           val: warmth,     set: v => { setWarmth(v);     applyFilters(brightness, contrast, saturation, sharpness, v) }, min: -100, max: 100, step: 1, unit: '', zero: 0 },
              { label: 'Hautes lumières',   val: highlights, set: v => { setHighlights(v); applyFilters(brightness, contrast, saturation, sharpness, warmth, v, shadows) }, min: -100, max: 0, step: 1, unit: '', zero: 0 },
              { label: 'Ombres',            val: shadows,    set: v => { setShadows(v);    applyFilters(brightness, contrast, saturation, sharpness, warmth, highlights, v) }, min: 0, max: 100, step: 1, unit: '', zero: 0 },
              { label: 'Netteté',           val: sharpness,  set: v => { setSharpness(v);  applyFilters(brightness, contrast, saturation, v, warmth)  }, min: -5,  max: 10,  step: 0.5, unit: '', zero: 0 },
            ].map(({ label, val, set, min, max, step, unit, zero }) => (
              <div key={label} className={styles.modalField}>
                <label className={styles.modalLabel}>{label} — <strong>{val > 0 && zero === 0 ? '+' : ''}{val}{unit}</strong></label>
                <div className={styles.correctionRow}>
                  <input type="range" min={min} max={max} step={step} value={val} className={styles.slider} onChange={e => set(+e.target.value)} />
                  <button className={styles.resetSmall} onClick={() => set(zero)}>↺</button>
                </div>
              </div>
            ))}
          </div>}

          {activeSection === 'autorot' && <div className={styles.settingsSection}>
            <p className={styles.settingsSectionTitle}>Autorotation</p>
            <p className={styles.settingsSectionHint}>Reprend après 3s d'inactivité. Désactivée si gyroscope actif.</p>
            <div className={styles.autorotToggle}>
              <span className={styles.modalLabel}>Activer l'autorotation</span>
              <button className={`${styles.toggleSwitch} ${autorotate ? styles.toggleOn : ''}`}
                onClick={() => setAutorotate(v => !v)}>
                <span className={styles.toggleThumb} />
              </button>
            </div>
            {autorotate && <>
              <div className={styles.modalField}>
                <label className={styles.modalLabel}>Vitesse — <strong>{autorotSpeed} °/s</strong></label>
                <input type="range" min="0.2" max="5" step="0.2" value={autorotSpeed} className={styles.slider}
                  onChange={e => setAutorotSpeed(+e.target.value)} />
              </div>
              <div className={styles.modalField}>
                <label className={styles.modalLabel}>Direction</label>
                <div className={styles.dirBtns}>
                  <button className={`${styles.dirBtn} ${autorotDir === 1 ? styles.dirBtnActive : ''}`} onClick={() => setAutorotDir(1)}>← Gauche</button>
                  <button className={`${styles.dirBtn} ${autorotDir === -1 ? styles.dirBtnActive : ''}`} onClick={() => setAutorotDir(-1)}>Droite →</button>
                </div>
              </div>
            </>}
          </div>}
        </div>
        <div className={styles.modalActions}>
          <button className={styles.modalCancel} onClick={() => { setZoomDefault(50); setZoomMin(10); setZoomMax(90); setCorrectionTilt(0); setCorrectionPan(0); setCorrectionRoll(0); applyToViewer({zd:50,zn:10,zx:90,pt:0,pp:0,pr:0}) }}>↺ Reset</button>
          <button className={styles.modalCancel} onClick={handleCancel}>Annuler</button>
          <button
            className={styles.modalCancel}
            style={{background:'#1877f2', color:'#fff', border:'none'}}
            onClick={async () => {
              const { exportFor360Facebook } = await import('@utils/facebook360')
              exportFor360Facebook(scene.imageUrl, scene.name || 'panorama')
            }}
            title="Télécharger avec métadonnées 360° pour Facebook"
          >
            📤 Export Facebook 360°
          </button>
          <button className={styles.modalConfirm} onClick={handleSave} disabled={saving} style={{marginRight:4}}>{saving ? 'Sauvegarde…' : '✓ Enregistrer'}</button>
          <button className={styles.modalConfirm} onClick={handleSaveAll} disabled={saving} title="Appliquer ces réglages à toutes les scènes" style={{background:'var(--accent-2,#e8a55a)'}}>{saving ? 'Sauvegarde…' : '↕ Toutes les scènes'}</button>
        </div>
      </div>
    </div>
  )
}

// ── ReplaceSceneModal ──────────────────────────────────────────
function ReplaceSceneModal({ project, allProjects, sceneIdx, onClose }) {
  const scene   = project.scenes[sceneIdx]
  const [tab,         setTab]         = useState('upload')
  const [file,        setFile]        = useState(null)
  const [progress,    setProgress]    = useState(0)
  const [uploading,   setUploading]   = useState(false)
  const [error,       setError]       = useState(null)
  const [cloudImgs,   setCloudImgs]   = useState([])
  const inputRef = useRef(null)
  const authUser = useAtomValue(authUserAtom)

  // Charger toutes les images Cloudinary
  useEffect(() => {
    if (!authUser?.uid) return
    import('firebase/firestore').then(({ doc: fsDoc, getDoc }) => {
      getDoc(fsDoc(db, 'users', authUser.uid)).then(snap => {
        const key = snap.data()?.sketchupKey
        if (!key) return
        fetch('https://izi360-backend-694882487700.europe-west1.run.app/api/media-library', {
          headers: { 'Authorization': `Bearer ${key}` }
        }).then(r => r.json()).then(data => {
          if (data.status === 'success') {
            setCloudImgs(data.images.map(img => ({
              url: img.url,
              sceneName: img.public_id.split('/').pop() || 'Image',
              projectName: img.folder || 'Cloudinary',
              source: img.folder?.includes('projects') ? 'lc360' : 'sketchup',
            })))
          }
        }).catch(() => {})
      })
    })
  }, [authUser?.uid])

  const gallery = (() => {
    const seen = new Set([scene.imageUrl])
    const imgs = []
    const sorted = [...(allProjects || [])].sort((a, b) => (b.updatedAt?.toMillis?.() ?? 0) - (a.updatedAt?.toMillis?.() ?? 0))
    for (const proj of sorted) {
      for (const s of (proj.scenes || [])) {
        if (!s.imageUrl || seen.has(s.imageUrl)) continue
        seen.add(s.imageUrl)
        imgs.push({ url: s.imageUrl, sceneName: s.name || 'Sans nom', projectName: proj.name || 'Projet' })
      }
    }
    for (const img of cloudImgs) {
      if (!img.url || seen.has(img.url)) continue
      seen.add(img.url)
      imgs.push(img)
    }
    return imgs
  })()

  const doReplace = async (newUrl) => {
    await updateProject(project.id, { scenes: project.scenes.map((s, i) => i === sceneIdx ? { ...s, imageUrl: newUrl } : s) })
    onClose()
  }

  const handleFile = (e) => {
    const f = e.target.files?.[0]
    if (!f || !f.type.startsWith('image/')) { setError('Format image uniquement'); return }
    if (f.size > 100*1024*1024) { setError('Max 100 Mo'); return }
    setError(null); setFile(f)
  }

  const handleUpload = async () => {
    if (!file) return
    setUploading(true); setError(null)
    try {
      const { url } = await uploadImage(file, `lc360/projects/${project.id}`, setProgress)
      await doReplace(url)
    } catch(err) { setError('Erreur : ' + err.message); setUploading(false) }
  }

  return (
    <div className={styles.modalOverlay} onClick={e => e.target === e.currentTarget && !uploading && onClose()}>
      <div className={styles.modal} style={{ maxWidth: 560, maxHeight: '85vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div className={styles.modalHeader}>
          <div>
            <h3 className={styles.modalTitle}>🔄 Remplacer l'image</h3>
            <p style={{ fontSize: 12, color: 'var(--text-2)', marginTop: 2 }}>{scene.name} · hotspots et réglages conservés</p>
          </div>
          {!uploading && <button className={styles.modalClose} onClick={onClose}>✕</button>}
        </div>

        <div className={styles.replaceTabs}>
          <button className={`${styles.replaceTab} ${tab === 'upload' ? styles.replaceTabActive : ''}`} onClick={() => setTab('upload')}>⬆ Uploader</button>
          <button className={`${styles.replaceTab} ${tab === 'gallery' ? styles.replaceTabActive : ''}`} onClick={() => setTab('gallery')}>🖼 Médiathèque ({gallery.length})</button>
        </div>

        <div className={styles.modalBody}>
          <div style={{ flex:1, display:'flex', flexDirection:'column', gap:14 }}>
            <div className={styles.replaceCurrentWrap}>
              <span className={styles.replaceCurrentLabel}>Image actuelle</span>
              <img src={scene.imageUrl} alt={scene.name} className={styles.replaceCurrentImg} />
            </div>

            {tab === 'upload' && <>
              <div className={`${styles.dropZone} ${file ? styles.dropZoneHasFile : ''}`}
                onClick={() => !uploading && inputRef.current?.click()}
                onDragOver={e => e.preventDefault()}
                onDrop={e => { e.preventDefault(); handleFile({ target: { files: [e.dataTransfer.files[0]] } }) }}>
                <input ref={inputRef} type="file" accept="image/*" onChange={handleFile} style={{ display:'none' }} />
                {file
                  ? <div className={styles.filePreview}><span className={styles.fileIcon}>🖼</span><div><p className={styles.fileName}>{file.name}</p><p className={styles.fileSize}>{(file.size/1024/1024).toFixed(1)} Mo</p></div></div>
                  : <><span className={styles.dropIcon}>⬆</span><p className={styles.dropText}>Cliquez ou glissez la nouvelle image 360°</p><p className={styles.dropHint}>JPG, PNG, WebP — max 100 Mo</p></>}
              </div>
              {error && <p className={styles.modalError}>{error}</p>}
              {uploading && <div className={styles.progressWrap}><div className={styles.progressBar}><div className={styles.progressFill} style={{ width:`${progress}%` }} /></div><span className={styles.progressLabel}>{progress}%</span></div>}
            </>}

            {tab === 'gallery' && (
              gallery.length === 0
                ? <div className={styles.galleryEmpty}><p>Aucune autre image disponible.</p></div>
                : <div style={{display:'grid', gridTemplateColumns:'1fr', gap:'8px', maxHeight:'50vh', overflowY:'auto', padding:'4px'}}>
                    {gallery.map((img, i) => (
                      <button key={i} className={styles.galleryItem} onClick={() => doReplace(img.url)} style={{position:'relative'}}>
                        <img src={img.url} alt={img.sceneName} style={{width:'100%', height:'auto', display:'block'}} />
                        {img.source === 'sketchup' && (
                          <span style={{position:'absolute',top:4,left:4,background:'#1d4ed8',color:'#fff',fontSize:9,fontWeight:800,padding:'2px 5px',borderRadius:4}}>SU</span>
                        )}
                        <div className={styles.galleryInfo}>
                          <span className={styles.galleryName}>{img.sceneName}</span>
                          <span className={styles.galleryProject}>{img.projectName}</span>
                        </div>
                      </button>
                    ))}
                  </div>
            )}
          </div>
        </div>

        <div className={styles.modalActions}>
          <button className={styles.modalCancel} onClick={onClose} disabled={uploading}>Annuler</button>
          {tab === 'upload' && <button className={styles.modalConfirm} onClick={handleUpload} disabled={!file || uploading}>{uploading ? 'Upload…' : '🔄 Remplacer'}</button>}
        </div>
      </div>
    </div>
  )
}

function ViewerSkeleton() {
  return (
    <div className={styles.layout}>
      <div className={styles.sidebar} style={{ background:'var(--surface)' }}>
        {[1,2,3].map(i => <div key={i} style={{ height:72, margin:'8px 16px', borderRadius:8, background:'var(--surface-2)', animation:'pulse 1.4s ease-in-out infinite' }} />)}
        <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:.4}}`}</style>
      </div>
      <div data-tour="viewer" className={styles.viewerWrap} style={{ background:'var(--surface-2)', display:'flex', alignItems:'center', justifyContent:'center' }}>
        <span style={{ color:'var(--text-3)', fontFamily:'var(--font-display)', fontSize:13, letterSpacing:'0.1em' }}>CHARGEMENT…</span>
      </div>
    </div>
  )
}

// ── Paramètres projet depuis l'éditeur ───────────────────────
function ProjectSettingsInline({ project, onClose }) {
  return (
    <EditProjectModal
      project={project}
      onClose={onClose}
      onDeleted={onClose}
    />
  )
}
