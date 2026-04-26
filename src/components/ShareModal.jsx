import { useState, useRef } from 'react'
import { QRCodeCanvas } from 'qrcode.react'
import { enableSharing, disableSharing } from '@services/firebase'
import styles from './ShareModal.module.css'

export default function ShareModal({ project, onClose, onFirstPublish }) {
  const [loading,     setLoading]     = useState(false)
  const [copied,      setCopied]      = useState(false)
  const [embedOpen,   setEmbedOpen]   = useState(false)
  const [embedCopied, setEmbedCopied] = useState(false)

  const isShared  = project.shareEnabled && project.shareToken
  const shareUrl  = isShared ? `${window.location.origin}/view/${project.shareToken}` : null
  const ogUrl     = isShared ? `https://izi360-backend-694882487700.europe-west1.run.app/og/${project.shareToken}` : null

  const handleEnable = async () => {
    setLoading(true)
    const wasShared = project.shareEnabled && project.shareToken
    await enableSharing(project.id)
    setLoading(false)
    if (!wasShared) onFirstPublish?.()
  }

  const handleDisable = async () => {
    setLoading(true)
    await disableSharing(project.id)
    setLoading(false)
  }

  const handleCopy = async () => {
    if (!ogUrl) return
    await navigator.clipboard.writeText(ogUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const embedCode = shareUrl
    ? '<iframe src="' + shareUrl + '" width="100%" height="600" frameborder="0" allowfullscreen allow="gyroscope; accelerometer"></iframe>'
    : null

  const handleCopyEmbed = async () => {
    if (!embedCode) return
    await navigator.clipboard.writeText(embedCode)
    setEmbedCopied(true)
    setTimeout(() => setEmbedCopied(false), 2000)
  }

  const qrRef = useRef(null)

  const handleDownloadQR = () => {
    const canvas = qrRef.current?.querySelector('canvas')
    if (!canvas) return
    const link = document.createElement('a')
    link.download = `qrcode-${project.name || 'visite'}.png`
    link.href = canvas.toDataURL('image/png')
    link.click()
  }

  return (
    <div className={styles.overlay} onClick={e => e.target === e.currentTarget && onClose()}>
      <div className={styles.modal}>
        <div className={styles.header}>
          <h3 className={styles.title}>Partager la visite</h3>
          <button className={styles.close} onClick={onClose}>✕</button>
        </div>

        <div className={styles.body}>
          <div className={styles.projectName}>{project.name}</div>

          {!isShared ? (
            <div className={styles.disabledState}>
              <div className={styles.icon}>🔗</div>
              <p className={styles.desc}>
                Générez un lien public pour partager cette visite virtuelle
                sans que vos visiteurs aient besoin de se connecter.
              </p>
              <button className={styles.btnEnable} onClick={handleEnable} disabled={loading}>
                {loading ? 'Génération…' : '✓ Activer le partage public'}
              </button>
            </div>
          ) : (
            <div className={styles.enabledState}>
              <div className={styles.statusBadge}>
                <span className={styles.statusDot} />
                Partage actif
              </div>

              <div className={styles.urlBox}>
                <input
                  type="text"
                  value={ogUrl}
                  readOnly
                  className={styles.urlInput}
                  onClick={e => e.target.select()}
                />
                <button className={`${styles.btnCopy} ${copied ? styles.btnCopied : ''}`} onClick={handleCopy}>
                  {copied ? '✓ Copié !' : 'Copier'}
                </button>
              </div>

              {/* QR Code */}
              <div className={styles.qrSection} ref={qrRef}>
                <QRCodeCanvas
                  value={ogUrl}
                  size={140}
                  bgColor="#ffffff"
                  fgColor="#0f131e"
                  level="M"
                  includeMargin={true}
                />
                <div className={styles.qrActions}>
                  <p className={styles.qrHint}>Scannez pour accéder à la visite</p>
                  <button className={styles.btnDownloadQR} onClick={handleDownloadQR}>
                    ⬇ Télécharger le QR code
                  </button>
                </div>
              </div>

              <div className={styles.actions}>
                <a href={shareUrl} target="_blank" rel="noopener noreferrer" className={styles.btnPreview}>
                  ↗ Ouvrir la visite
                </a>
                <button className={styles.btnDisable} onClick={handleDisable} disabled={loading}>
                  {loading ? '…' : '🔒 Désactiver le partage'}
                </button>
              </div>

              <p className={styles.hint}>
                Toute personne ayant ce lien peut voir la visite sans se connecter.
              </p>

              {/* ── Section intégration web ── */}
              <div className={styles.embedSection}>
                <button className={styles.embedToggle} onClick={() => setEmbedOpen(v => !v)}>
                  <span>{'{'+'}'} Intégration web</span>
                  <span className={embedOpen ? styles.chevronUp : styles.chevronDown}>›</span>
                </button>
                {embedOpen && (
                  <div className={styles.embedBody}>
                    <p className={styles.embedHint}>
                      Copiez ce code et collez-le dans n'importe quelle page web pour y afficher la visite.
                    </p>
                    <div className={styles.embedBox}>
                      <code className={styles.embedCode}>{embedCode}</code>
                      <button className={`${styles.btnCopy} ${embedCopied ? styles.btnCopied : ''}`} onClick={handleCopyEmbed}>
                        {embedCopied ? '✓ Copié !' : 'Copier'}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
