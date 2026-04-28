import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  addEdge,
  MarkerType,
  Panel,
  Handle,
  Position,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import dagre from 'dagre'

// ── Layout automatique avec dagre ─────────────────────────────
const NODE_W = 180
const NODE_H = 70

function getLayoutedElements(nodes, edges) {
  const g = new dagre.graphlib.Graph()
  g.setDefaultEdgeLabel(() => ({}))
  g.setGraph({ rankdir: 'LR', ranksep: 80, nodesep: 40 })

  nodes.forEach(n => g.setNode(n.id, { width: NODE_W, height: NODE_H }))
  edges.forEach(e => g.setEdge(e.source, e.target))
  dagre.layout(g)

  return {
    nodes: nodes.map(n => {
      const pos = g.node(n.id)
      return { ...n, position: { x: pos.x - NODE_W / 2, y: pos.y - NODE_H / 2 } }
    }),
    edges,
  }
}

// ── Nœud personnalisé ─────────────────────────────────────────
function SceneNode({ data }) {
  const { label, isActive, isOrphan, isStart, hotspotCount, onSelect } = data

  const borderColor = isActive  ? '#1d4ed8'
    : isOrphan ? '#ef4444'
    : 'rgba(255,255,255,0.12)'

  const bg = isActive  ? 'rgba(29,78,216,0.15)'
    : isOrphan ? 'rgba(239,68,68,0.08)'
    : 'rgba(255,255,255,0.04)'

  return (
    <div
      onClick={onSelect}
      style={{
        width: NODE_W, minHeight: NODE_H,
        background: bg,
        border: `2px solid ${borderColor}`,
        borderRadius: 10,
        padding: '10px 14px',
        cursor: 'pointer',
        display: 'flex',
        flexDirection: 'column',
        gap: 4,
        position: 'relative',
        transition: 'all .2s',
      }}
    >
      <Handle type="target" position={Position.Left}  style={{ background: '#1d4ed8', width: 10, height: 10 }} />
      <Handle type="source" position={Position.Right} style={{ background: '#1d4ed8', width: 10, height: 10 }} />
      <Handle type="target" position={Position.Top}    style={{ background: '#1d4ed8', width: 10, height: 10 }} />
      <Handle type="source" position={Position.Bottom} style={{ background: '#1d4ed8', width: 10, height: 10 }} />
      {isStart && (
        <div style={{
          position: 'absolute', top: -10, left: 8,
          background: '#f59e0b', color: '#000',
          fontSize: 9, fontWeight: 800,
          padding: '1px 6px', borderRadius: 4,
          letterSpacing: '.05em',
        }}>START</div>
      )}
      {isOrphan && (
        <div style={{
          position: 'absolute', top: -10, right: 8,
          fontSize: 12,
        }}>⚠️</div>
      )}
      <div style={{
        fontSize: 13, fontWeight: 600,
        color: '#f0f2f7',
        whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
      }}>{label}</div>
      <div style={{ fontSize: 11, color: '#6b7280' }}>
        {hotspotCount} hotspot{hotspotCount !== 1 ? 's' : ''}
      </div>
    </div>
  )
}

const nodeTypes = { scene: SceneNode }

// ── Composant principal ───────────────────────────────────────
export default function NodeEditor({
  project,
  activeSceneIdx,
  onSelectScene,
  onConnect: onConnectExternal,
  onDeleteEdge,
  onSavePosition,
  onSaveFloorplan,
  gallery,
}) {
  const scenes = project?.scenes || []

  // Construire les nœuds depuis les scènes
  const initialNodes = useMemo(() => {
    return scenes.map((scene, i) => {
      const hasConnections = scenes.some(s =>
        (s.hotspots || []).some(h => h.targetSceneId === scene.id)
      ) || (scene.hotspots || []).length > 0

      return {
        id:   scene.id,
        type: 'scene',
        position: scene.nodePosition || { x: i * 220, y: 0 },
        data: {
          label:        scene.name || `Scène ${i + 1}`,
          isActive:     i === activeSceneIdx,
          isOrphan:     !hasConnections && scenes.length > 1,
          isStart:      i === 0,
          hotspotCount: (scene.hotspots || []).length,
          onSelect:     () => onSelectScene(i),
        },
      }
    })
  }, [scenes, activeSceneIdx, onSelectScene])

  // Construire les arêtes depuis les hotspots de navigation
  const initialEdges = useMemo(() => {
    const edges = []
    const seen  = new Set()
    scenes.forEach(scene => {
      ;(scene.hotspots || [])
        .filter(h => h.type === 'navigation' && h.targetSceneId)
        .forEach(h => {
          const key = [scene.id, h.targetSceneId].sort().join('--')
          if (seen.has(key)) return
          seen.add(key)
          edges.push({
            id:           `${scene.id}-${h.targetSceneId}`,
            source:       scene.id,
            target:       h.targetSceneId,
            type:         'default',
            animated:     true,
            style:        { stroke: '#1d4ed8', strokeWidth: 2 },
            markerEnd:    { type: MarkerType.ArrowClosed, color: '#1d4ed8' },
            markerStart:  { type: MarkerType.ArrowClosed, color: '#1d4ed8' },
          })
        })
    })
    return edges
  }, [scenes])

  const positionsRef = useCallback(() => {}, [])
  const [nodes, setNodes, onNodesChange] = useNodesState([])
  const [edges, setEdges, onEdgesChange] = useEdgesState([])
  const initializedRef = useRef(false)

  // Initialiser UNE SEULE FOIS au montage
  useEffect(() => {
    if (initializedRef.current || initialNodes.length === 0) return
    initializedRef.current = true
    const hasPositions = scenes.some(s => s.nodePosition)
    if (hasPositions) {
      setNodes(initialNodes)
      setEdges(initialEdges)
    } else {
      const { nodes: ln, edges: le } = getLayoutedElements(initialNodes, initialEdges)
      setNodes(ln)
      setEdges(le)
    }
  }, [initialNodes.length])

  // Mettre à jour labels, hotspots et état actif — sans bouger les positions
  useEffect(() => {
    if (!initializedRef.current) return
    setNodes(ns => ns.map(n => {
      const scene = scenes.find(s => s.id === n.id)
      if (!scene) return n
      return {
        ...n,
        data: {
          ...n.data,
          label:        scene.name || n.data.label,
          hotspotCount: (scene.hotspots || []).length,
          isActive:     scenes[activeSceneIdx]?.id === n.id,
        },
      }
    }))
  }, [activeSceneIdx, scenes.map(s => s.name + (s.hotspots||[]).length).join(',')])

  // Mettre à jour les arêtes quand les hotspots changent
  useEffect(() => {
    if (!initializedRef.current) return
    setEdges(initialEdges)
  }, [JSON.stringify(initialEdges.map(e => e.id))])

  // Sauvegarder la position d'un nœud après déplacement
  const onNodeDragStop = useCallback((_, node) => {
    onSavePosition?.(node.id, node.position)
  }, [onSavePosition])

  const onConnect = useCallback((params) => {
    setEdges(es => addEdge({
      ...params,
      animated:    true,
      style:       { stroke: '#1d4ed8', strokeWidth: 2 },
      markerEnd:   { type: MarkerType.ArrowClosed, color: '#1d4ed8' },
      markerStart: { type: MarkerType.ArrowClosed, color: '#1d4ed8' },
    }, es))
    onConnectExternal?.(params)
  }, [onConnectExternal])

  const onEdgeClick = useCallback((e, edge) => {
    // Supprimer l'arête au clic
    const ok = window.confirm(`Supprimer le lien entre ces deux scènes ?\nCela supprimera aussi les hotspots associés.`)
    if (ok) {
      setEdges(es => es.filter(ed => ed.id !== edge.id))
      onDeleteEdge?.(edge)
    }
  }, [onDeleteEdge])

  const [floorBg,      setFloorBg]      = useState(null)
  const [opacity,      setOpacity]      = useState(0.4)
  const [generating,   setGenerating]   = useState(false)
  const [showMedia,    setShowMedia]    = useState(false)
  const fileInputRef = useRef(null)

  // Charger le plan existant depuis le projet
  useEffect(() => {
    if (project?.floorplan?.url && !floorBg) {
      setFloorBg({ url: project.floorplan.url })
    }
  }, [project?.floorplan?.url])

  // Upload image vers Cloudinary
  const handleImportPlan = useCallback(async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    const localUrl = URL.createObjectURL(file)
    setFloorBg({ url: localUrl, file })
    setShowMedia(false)
    // Reset input pour permettre re-sélection du même fichier
    e.target.value = ''
  }, [])

  const imgRef = useRef(null)

  // Générer le floorplan navigable depuis les positions des nœuds
  const generateFloorplan = useCallback(async () => {
    if (!floorBg || !nodes.length) return
    setGenerating(true)
    try {
      // Récupérer la position réelle de l'image affichée
      const imgEl = imgRef.current
      if (!imgEl) { alert('Image non trouvée'); return }
      const imgRect = imgEl.getBoundingClientRect()

      // Récupérer les éléments DOM des nœuds pour leur position écran réelle
      const hotspots = nodes.map(n => {
        const nodeEl = document.querySelector(`[data-id="${n.id}"]`)
        let x = 0.5, y = 0.5
        if (nodeEl) {
          const nodeRect = nodeEl.getBoundingClientRect()
          // Centre du nœud en coordonnées relatives à l'image
          const cx = nodeRect.left + nodeRect.width  / 2
          const cy = nodeRect.top  + nodeRect.height / 2
          x = Math.max(0, Math.min(1, (cx - imgRect.left) / imgRect.width))
          y = Math.max(0, Math.min(1, (cy - imgRect.top)  / imgRect.height))
        }
        return {
          marker_id: n.id,
          name:      n.data.label,
          scene_id:  n.id,
          x:         parseFloat(x.toFixed(4)),
          y:         parseFloat(y.toFixed(4)),
        }
      })

      // Upload image vers Cloudinary si c'est un fichier local
      let imageUrl = floorBg.url
      if (floorBg.file) {
        const formData = new FormData()
        formData.append('file',          floorBg.file)
        formData.append('upload_preset', 'lc360_preset1')
        formData.append('folder',        'lc360/floorplans')
        const res  = await fetch('https://api.cloudinary.com/v1_1/dqbub7scb/image/upload', {
          method: 'POST', body: formData,
        })
        const data = await res.json()
        imageUrl   = data.secure_url
      }

      await onSaveFloorplan?.({ url: imageUrl, hotspots })
      setFloorBg(prev => ({ ...prev, url: imageUrl, file: null }))
      alert(`✓ Plan navigable généré avec ${hotspots.length} points !`)
    } catch(err) {
      alert('Erreur : ' + err.message)
    } finally {
      setGenerating(false)
    }
  }, [floorBg, nodes, project, onSaveFloorplan])

  const autoLayout = useCallback(() => {
    const { nodes: ln, edges: le } = getLayoutedElements(nodes, edges)
    setNodes(ln)
    setEdges(le)
  }, [nodes, edges])

  return (
    <div style={{ width: '100%', height: '100%', background: '#0f1117', position: 'relative' }}>
      {/* Input fichier caché */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        style={{ display: 'none' }}
        onChange={handleImportPlan}
      />

      {/* Image de fond — hors du viewport React Flow, en contain */}
      {floorBg && (
        <img
          ref={imgRef}
          src={floorBg.url}
          alt="Plan"
          style={{
            position:   'absolute',
            inset:      0,
            width:      '100%',
            height:     '100%',
            objectFit:  'contain',
            opacity,
            pointerEvents: 'none',
            zIndex:     0,
          }}
        />
      )}

      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onEdgeClick={onEdgeClick}
        onNodeDragStop={onNodeDragStop}
        nodeTypes={nodeTypes}
        fitView
        fitViewOptions={{ padding: 0.2 }}
        defaultEdgeOptions={{ animated: true }}
        style={{ background: 'transparent', position: 'relative', zIndex: 1 }}
      >
        <Background color="#2d2d4e" gap={20} size={1} style={{ opacity: floorBg ? 0.15 : 1 }} />
        <Controls style={{ background: '#1a1a2e', border: '1px solid rgba(255,255,255,.1)', borderRadius: 8 }} />
        <MiniMap
          style={{ background: '#1a1a2e', border: '1px solid rgba(255,255,255,.1)' }}
          nodeColor={n => n.data?.isActive ? '#1d4ed8' : n.data?.isOrphan ? '#ef4444' : '#374151'}
          maskColor="rgba(0,0,0,0.5)"
        />

        <Panel position="top-right" style={{ display: 'flex', gap: 8, flexWrap: 'wrap', maxWidth: 420 }}>
          {/* Import plan */}
          <button
            onClick={() => setShowMedia(true)}
            style={{
              background: '#1a1a2e', color: '#f0f2f7',
              border: '1px solid rgba(255,255,255,.15)',
              borderRadius: 8, padding: '6px 12px',
              fontSize: 12, fontWeight: 600, cursor: 'pointer',
            }}
          >🗺 {floorBg ? 'Changer le plan' : 'Importer un plan'}</button>

          {/* Slider opacité */}
          {floorBg && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6,
              background: '#1a1a2e', border: '1px solid rgba(255,255,255,.15)',
              borderRadius: 8, padding: '4px 10px' }}>
              <span style={{ fontSize: 11, color: '#9ca3af' }}>Opacité</span>
              <input type="range" min="0.05" max="1" step="0.05"
                value={opacity}
                onChange={e => setOpacity(parseFloat(e.target.value))}
                style={{ width: 70 }}
              />
              <span style={{ fontSize: 11, color: '#f0f2f7', minWidth: 28 }}>
                {Math.round(opacity * 100)}%
              </span>
            </div>
          )}

          {/* Générer floorplan */}
          {floorBg && (
            <button
              onClick={generateFloorplan}
              disabled={generating}
              style={{
                background: generating ? '#374151' : '#059669',
                color: '#fff',
                border: '1px solid rgba(255,255,255,.15)',
                borderRadius: 8, padding: '6px 12px',
                fontSize: 12, fontWeight: 600, cursor: generating ? 'wait' : 'pointer',
              }}
            >
              {generating ? '⏳ Génération...' : '✓ Générer le plan navigable'}
            </button>
          )}

          {/* Auto-layout */}
          <button
            onClick={autoLayout}
            style={{
              background: '#1a1a2e', color: '#f0f2f7',
              border: '1px solid rgba(255,255,255,.15)',
              borderRadius: 8, padding: '6px 12px',
              fontSize: 12, fontWeight: 600, cursor: 'pointer',
            }}
          >⚡ Auto-layout</button>
        </Panel>
      </ReactFlow>

      {/* Modal médiathèque */}
      {showMedia && (
        <div style={{
          position: 'absolute', inset: 0, zIndex: 1000,
          background: 'rgba(0,0,0,.92)',
          display: 'flex', flexDirection: 'column',
        }}>
          {/* Header fixe */}
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '14px 18px', borderBottom: '1px solid rgba(255,255,255,.1)',
            background: '#0f1117', flexShrink: 0,
          }}>
            <span style={{ fontSize: 14, fontWeight: 700, color: '#fff' }}>
              🗺 Choisir le plan — {(gallery || []).length} image{(gallery||[]).length > 1 ? 's' : ''}
            </span>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                onClick={() => fileInputRef.current?.click()}
                style={{
                  background: '#1d4ed8', color: '#fff',
                  border: 'none', borderRadius: 7,
                  padding: '6px 14px', fontSize: 12, fontWeight: 600, cursor: 'pointer',
                }}
              >📁 Depuis mon ordinateur</button>
              <button
                onClick={() => setShowMedia(false)}
                style={{
                  background: 'rgba(239,68,68,.15)', color: '#ef4444',
                  border: '1px solid rgba(239,68,68,.3)',
                  borderRadius: 7, padding: '6px 12px',
                  fontSize: 12, fontWeight: 700, cursor: 'pointer',
                }}
              >✕ Fermer</button>
            </div>
          </div>

          {/* Grille scrollable */}
          <div style={{
            flex: 1,
            overflowY: 'scroll',
            padding: 16,
          }}>
            {(gallery || []).length === 0 ? (
              <div style={{ color: '#6b7280', fontSize: 13, textAlign: 'center', marginTop: 40 }}>
                Aucune image dans la médiathèque
              </div>
            ) : (
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(4, 1fr)',
                gap: 12,
              }}>
                {(gallery || []).map((img, i) => (
                  <div
                    key={i}
                    onClick={() => { setFloorBg({ url: img.url }); setShowMedia(false) }}
                    style={{
                      cursor: 'pointer',
                      borderRadius: 8,
                      overflow: 'hidden',
                      border: '2px solid rgba(255,255,255,.08)',
                      transition: 'border-color .15s',
                      background: '#1a1a2e',
                    }}
                    onMouseEnter={e => e.currentTarget.style.borderColor = '#1d4ed8'}
                    onMouseLeave={e => e.currentTarget.style.borderColor = 'rgba(255,255,255,.08)'}
                  >
                    <img
                      src={img.url}
                      alt={img.sceneName}
                      style={{
                        width: '100%',
                        aspectRatio: '16/9',
                        objectFit: 'cover',
                        display: 'block',
                      }}
                    />
                    <div style={{
                      padding: '6px 8px',
                      fontSize: 11, color: '#d1d5db',
                      whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                      borderTop: '1px solid rgba(255,255,255,.06)',
                    }}>
                      {img.sceneName}
                      <span style={{ color: '#6b7280', marginLeft: 4 }}>· {img.projectName}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
