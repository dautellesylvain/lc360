import styles from './HotspotPanel.module.css'

/**
 * Panel glass affichant la liste des hotspots de la scène active.
 * Apparaît en haut à droite du viewer, uniquement si la scène contient des hotspots.
 *
 * Props:
 * - sceneName: string - Nom de la scène active
 * - hotspots: array - Liste des hotspots de la scène
 * - onEditHotspot: (hotspot) => void - Ouvrir l'édition d'un hotspot
 * - onPreviewHotspot: (hotspot) => void - Prévisualiser un hotspot (info, vidéo, etc.)
 * - onDeleteHotspot: (hotspot) => void - Supprimer un hotspot
 */
export default function HotspotPanel({
  sceneName,
  hotspots = [],
  onEditHotspot,
  onPreviewHotspot,
  onDeleteHotspot,
}) {
  // Ne rien afficher si aucun hotspot (Option B validée)
  if (!hotspots || hotspots.length === 0) return null

  // Icône selon le type de hotspot
  const getIcon = (type) => {
    switch (type) {
      case 'navigation': return '→'
      case 'info':       return 'ℹ'
      case 'video':      return '▶'
      case 'gallery':    return '🖼'
      case 'audio':      return '🔊'
      case 'url':        return '🔗'
      default:           return 'ℹ'
    }
  }

  // Type lisible pour l'utilisateur
  const getTypeLabel = (type) => {
    switch (type) {
      case 'navigation': return 'Navigation'
      case 'info':       return 'Information'
      case 'video':      return 'Vidéo'
      case 'gallery':    return 'Galerie'
      case 'audio':      return 'Audio'
      case 'url':        return 'Lien'
      default:           return 'Hotspot'
    }
  }

  // Vérifier si le hotspot est prévisualisable
  const isPreviewable = (type) =>
    ['info', 'video', 'gallery', 'audio', 'url'].includes(type)

  return (
    <div className={styles.panel}>
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <span className={styles.title}>HOTSPOTS</span>
          {sceneName && (
            <span className={styles.sceneName}>{sceneName}</span>
          )}
        </div>
        <span className={styles.count}>{hotspots.length}</span>
      </div>

      <div className={styles.body}>
        {hotspots.map((h) => (
          <div key={h.id} className={styles.item}>
            <div className={styles.itemIcon}>
              {getIcon(h.type)}
            </div>

            <div
              className={styles.itemInfo}
              onClick={() => onEditHotspot && onEditHotspot(h)}
              title="Cliquer pour modifier"
            >
              <span className={styles.itemLabel}>
                {h.label || 'Sans nom'}
              </span>
              <span className={styles.itemMeta}>
                {getTypeLabel(h.type)}
                {h.target && ` • ${h.target}`}
              </span>
            </div>

            <div className={styles.itemActions}>
              {isPreviewable(h.type) && (
                <button
                  className={styles.actionBtn}
                  title="Prévisualiser"
                  onClick={(e) => {
                    e.stopPropagation()
                    onPreviewHotspot && onPreviewHotspot(h)
                  }}
                >
                  👁
                </button>
              )}
              <button
                className={styles.actionBtn}
                title="Modifier"
                onClick={(e) => {
                  e.stopPropagation()
                  onEditHotspot && onEditHotspot(h)
                }}
              >
                ✏
              </button>
              <button
                className={`${styles.actionBtn} ${styles.actionBtnDanger}`}
                title="Supprimer"
                onClick={(e) => {
                  e.stopPropagation()
                  onDeleteHotspot && onDeleteHotspot(h)
                }}
              >
                ✕
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
