import { useState, useRef } from 'react'
import { useAtomValue } from 'jotai'
import { userIsPROAtom } from '@store/auth'
import { updateProject, deleteProject, enableSharing, disableSharing } from '@services/firebase'
import { uploadImage } from '@services/cloudinary'
import styles from './Dashboard.module.css'

export { EditProjectModal as default }

// ── Logo Uploader ─────────────────────────────────────────────
function LogoUploader({ projectId, currentUrl, currentSize }) {
  const [uploading, setUploading] = useState(false)
  const [url,       setUrl]       = useState(currentUrl  || null)
  const [size,      setSize]      = useState(currentSize ?? 40)  // hauteur en px
  const inputRef = useRef(null)

  const handleFile = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith('image/')) return
    setUploading(true)
    try {
      const { url: newUrl } = await uploadImage(file, `lc360/logos/${projectId}`, () => {})
      await updateProject(projectId, { logoUrl: newUrl, logoSize: size })
      setUrl(newUrl)
    } catch(err) { console.error('Logo upload error:', err) }
    setUploading(false)
  }

  const handleSizeChange = async (v) => {
    setSize(v)
    if (url) await updateProject(projectId, { logoSize: v })
  }

  const handleRemove = async () => {
    await updateProject(projectId, { logoUrl: null, logoSize: null })
    setUrl(null)
  }

  return (
    <div className={styles.logoUploader}>
      {url ? (
        <>
          {/* Preview temps réel */}
          <div className={styles.logoLivePreview}>
            <div className={styles.logoLivePreviewBg}>
              <img src={url} alt="logo" style={{ height: size, width: 'auto', maxWidth: 200, objectFit: 'contain' }} />
            </div>
            <span className={styles.logoLiveLabel}>Aperçu dans la visite</span>
          </div>

          {/* Slider taille */}
          <div className={styles.modalField}>
            <label className={styles.modalLabel}>Taille du logo — <strong>{size}px</strong></label>
            <input type="range" min="20" max="120" step="2"
              value={size} onChange={e => handleSizeChange(+e.target.value)}
              className={styles.slider}
            />
          </div>

          <div className={styles.logoPreview}>
            <img src={url} alt="logo" style={{ height: 36, width: 'auto', maxWidth: 120, objectFit: 'contain', borderRadius: 4 }} />
            <div className={styles.logoPreviewActions}>
              <button className={styles.logoBtnChange} onClick={() => inputRef.current?.click()} disabled={uploading}>
                {uploading ? 'Upload…' : '↻ Changer'}
              </button>
              <button className={styles.logoBtnRemove} onClick={handleRemove}>✕ Supprimer</button>
            </div>
          </div>
        </>
      ) : (
        <button className={styles.logoUploadBtn} onClick={() => inputRef.current?.click()} disabled={uploading}>
          {uploading ? 'Upload…' : '+ Ajouter un logo'}
        </button>
      )}
      <input ref={inputRef} type="file" accept="image/*" onChange={handleFile} style={{ display:'none' }} />
      <p className={styles.logoHint}>PNG, SVG ou JPG — affiché en haut à gauche de la visite publique</p>
    </div>
  )
}

// ── Splash Uploader ───────────────────────────────────────────
function SplashUploader({ projectId, currentUrl }) {
  const [uploading, setUploading] = useState(false)
  const [url,       setUrl]       = useState(currentUrl || null)
  const inputRef = useRef(null)

  const handleFile = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith('image/')) return
    setUploading(true)
    try {
      const { url: newUrl } = await uploadImage(file, `lc360/splash/${projectId}`, () => {})
      await updateProject(projectId, { splashUrl: newUrl })
      setUrl(newUrl)
    } catch(err) { console.error('Splash upload error:', err) }
    setUploading(false)
  }

  const handleRemove = async () => {
    await updateProject(projectId, { splashUrl: null })
    setUrl(null)
  }

  return (
    <div className={styles.logoUploader}>
      {url ? (
        <div className={styles.splashPreviewWrap}>
          <img src={url} alt="splash" className={styles.splashPreviewImg} />
          <div className={styles.logoPreviewActions} style={{ marginTop: 8 }}>
            <button className={styles.logoBtnChange} onClick={() => inputRef.current?.click()} disabled={uploading}>
              {uploading ? 'Upload…' : '↻ Changer'}
            </button>
            <button className={styles.logoBtnRemove} onClick={handleRemove}>✕ Supprimer</button>
          </div>
        </div>
      ) : (
        <button className={styles.logoUploadBtn} onClick={() => inputRef.current?.click()} disabled={uploading}>
          {uploading ? 'Upload…' : '+ Ajouter une image splash'}
        </button>
      )}
      <input ref={inputRef} type="file" accept="image/*" onChange={handleFile} style={{ display:'none' }} />
    </div>
  )
}

function EmptyState({ onNavigate }) {
  return (
    <div className={styles.empty}>
      <div className={styles.emptyIcon}>⬡</div>
      <h3 className={styles.emptyTitle}>Aucun projet pour l'instant</h3>
      <p className={styles.emptyText}>Créez votre première visite virtuelle 360°</p>
      <button className={styles.emptyBtn} onClick={onNavigate}>+ Créer mon premier projet</button>
    </div>
  )
}

function EditProjectModal({ project, onClose, onDeleted }) {
  const isPRO = useAtomValue(userIsPROAtom)
  const [name,        setName]        = useState(project.name        || '')
  const [location,    setLocation]    = useState(project.location    || '')
  const [description, setDescription] = useState(project.description || '')
  const [published,   setPublished]   = useState(project.published === true)
  const [gyroOnStart,       setGyroOnStart]       = useState(project.gyroOnStart === true)
  const [vrEnabled,         setVrEnabled]         = useState(project.vrEnabled === true)
  const [accessCodeEnabled, setAccessCodeEnabled] = useState(!!project.accessCode)
  const [accessCode,        setAccessCode]        = useState(project.accessCode || '')
  const [ambientMusicUrl,   setAmbientMusicUrl]   = useState(project.ambientMusicUrl   || '')
  const [ambientMusicLoop,  setAmbientMusicLoop]  = useState(project.ambientMusicLoop  !== false)
  const [uploadingMusic,    setUploadingMusic]    = useState(false)
  const musicInputRef = useRef(null)
  const [contactEmail,      setContactEmail]      = useState(project.contactEmail      || '')
  const [contactPhone,      setContactPhone]      = useState(project.contactPhone      || '')
  const [contactFormEnabled,setContactFormEnabled] = useState(project.contactFormEnabled === true)
  const [saving,      setSaving]      = useState(false)
  const [confirmDel,  setConfirmDel]  = useState(false)
  const [deleting,    setDeleting]    = useState(false)

  const handleSave = async () => {
    if (!name.trim()) return
    setSaving(true)
    await updateProject(project.id, {
      name: name.trim(), location, description, gyroOnStart,
      accessCode: accessCodeEnabled ? accessCode.trim() : null,
      vrEnabled,
      ambientMusicUrl:    ambientMusicUrl.trim() || null,
      ambientMusicLoop,
      contactEmail:       contactEmail.trim()  || null,
      contactPhone:       contactPhone.trim()  || null,
      contactFormEnabled: contactFormEnabled,
    })
    setSaving(false)
    onClose()
  }

  const handleDelete = async () => {
    setDeleting(true)
    await deleteProject(project.id)
    onDeleted()
  }

  return (
    <div className={styles.modalOverlay} onClick={e => e.target === e.currentTarget && onClose()}>
      <div className={styles.modal}>

        <div className={styles.modalHeader}>
          <h3 className={styles.modalTitle}>Modifier le projet</h3>
          <button className={styles.modalClose} onClick={onClose}>✕</button>
        </div>

        <div className={styles.modalBody}>
          {/* Miniature */}
          {project.scenes?.[0]?.imageUrl && (
            <div className={styles.modalThumb}>
              <img src={project.scenes[0].imageUrl} alt={project.name} />
              <span>{project.scenes?.length ?? 0} scène{(project.scenes?.length ?? 0) !== 1 ? 's' : ''}</span>
            </div>
          )}

          {/* Logo personnalisé — PRO uniquement */}
          <div className={styles.modalField}>
            {isPRO ? (
              <>
                <label className={styles.modalLabel}>Logo personnalisé</label>
                <LogoUploader projectId={project.id} currentUrl={project.logoUrl} currentSize={project.logoSize} />
              </>
            ) : (
              <div style={{background:'rgba(245,158,11,.1)', border:'1px solid rgba(245,158,11,.3)', borderRadius:8, padding:'12px 16px', fontSize:13, color:'var(--text-2)'}}>
                ⭐ <strong>Fonctionnalité PRO</strong> — <a href="/upgrade" style={{color:'#1d4ed8'}}>Passez en PRO</a> pour ajouter votre logo personnalisé.
              </div>
            )}
          </div>

          {/* Image splash screen — PRO uniquement */}
          <div className={styles.modalField}>
            <label className={styles.modalLabel}>Image du splash screen</label>
            {isPRO ? (
              <>
                <p className={styles.logoHint} style={{ marginBottom: 6 }}>
                  Affiché pendant le chargement de la visite. Si absent, le logo sera utilisé.
                </p>
                <SplashUploader projectId={project.id} currentUrl={project.splashUrl} />
              </>
            ) : (
              <div style={{background:'rgba(245,158,11,.1)', border:'1px solid rgba(245,158,11,.3)', borderRadius:8, padding:'12px 16px', fontSize:13, color:'var(--text-2)'}}>
                ⭐ <strong>Fonctionnalité PRO</strong> — <a href="/upgrade" style={{color:'#1d4ed8'}}>Passez en PRO</a> pour personnaliser votre splash screen.
              </div>
            )}
          </div>

          {/* Nom */}
          <div className={styles.modalField}>
            <label className={styles.modalLabel}>Nom du projet</label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              className={styles.modalInput}
              placeholder="Ex : Villa Méditerranée"
              autoFocus
            />
          </div>

          {/* Localisation */}
          <div className={styles.modalField}>
            <label className={styles.modalLabel}>Localisation</label>
            <input
              type="text"
              value={location}
              onChange={e => setLocation(e.target.value)}
              className={styles.modalInput}
              placeholder="Ex : Nice, France"
            />
          </div>

          {/* Description */}
          <div className={styles.modalField}>
            <label className={styles.modalLabel}>Description</label>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              className={`${styles.modalInput} ${styles.modalTextarea}`}
              placeholder="Description courte du projet…"
              rows={3}
            />
          </div>

          {/* Statut */}
          <div className={styles.modalField}>
            <label className={styles.modalLabel}>Statut</label>
            <div className={styles.optionRow}>
              <div className={styles.optionInfo}>
                <span className={styles.optionLabel}>
                  {published ? '🟢 Publié et partageable' : '⚫ Non publié'}
                </span>
                <span className={styles.optionHint}>
                  {published
                    ? "La visite est accessible via le lien de partage."
                    : "La visite n'est pas accessible au public."}
                </span>
              </div>
              <button
                className={`${styles.toggleSwitch} ${published ? styles.toggleOn : ''}`}
                onClick={async () => {
                  if (!published) {
                    await enableSharing(project.id)
                    setPublished(true)
                  } else {
                    await disableSharing(project.id)
                    setPublished(false)
                  }
                }}
              >
                <span className={styles.toggleThumb} />
              </button>
            </div>
          </div>

          {/* Gyroscope au démarrage */}
          <div className={styles.modalField}>
            <label className={styles.modalLabel}>Options de la visite</label>
            <div className={styles.optionRow}>
              <div className={styles.optionInfo}>
                <span className={styles.optionLabel}>Gyroscope activé au démarrage</span>
                <span className={styles.optionHint}>Sur mobile, le gyroscope s'active automatiquement. Le visiteur peut toujours le désactiver.</span>
              </div>
              <button
                className={`${styles.toggleSwitch} ${gyroOnStart ? styles.toggleOn : ''}`}
                onClick={() => setGyroOnStart(v => !v)}
              >
                <span className={styles.toggleThumb} />
              </button>
            </div>
            <div className={styles.optionRow} style={{marginTop:12}}>
              <div className={styles.optionInfo}>
                <span className={styles.optionLabel}>🥽 Mode VR Cardboard</span>
                <span className={styles.optionHint}>Affiche un bouton VR dans la visite pour les casques Cardboard.</span>
              </div>
              <button
                className={`${styles.toggleSwitch} ${vrEnabled ? styles.toggleOn : ''}`}
                onClick={() => setVrEnabled(v => !v)}
              >
                <span className={styles.toggleThumb} />
              </button>
            </div>
          </div>

          {/* Code d'accès — PRO uniquement */}
          <div className={styles.modalField}>
            <label className={styles.modalLabel}>Code d'accès</label>
            {isPRO ? (
              <>
                <div className={styles.optionRow}>
                  <div className={styles.optionInfo}>
                    <span className={styles.optionLabel}>Protéger la visite par un code</span>
                    <span className={styles.optionHint}>Les visiteurs devront saisir ce code pour accéder à la visite.</span>
                  </div>
                  <button
                    className={`${styles.toggleSwitch} ${accessCodeEnabled ? styles.toggleOn : ''}`}
                    onClick={() => setAccessCodeEnabled(v => !v)}
                  >
                    <span className={styles.toggleThumb} />
                  </button>
                </div>
                {accessCodeEnabled && (
                  <input
                    type="text"
                    value={accessCode}
                    onChange={e => setAccessCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8))}
                    className={styles.modalInput}
                    placeholder="Ex : MAISON01"
                    maxLength={8}
                    style={{ marginTop: 8, fontFamily: 'monospace', letterSpacing: '0.15em', fontSize: 16, textAlign: 'center' }}
                  />
                )}
              </>
            ) : (
              <div style={{background:'rgba(245,158,11,.1)', border:'1px solid rgba(245,158,11,.3)', borderRadius:8, padding:'12px 16px', fontSize:13, color:'var(--text-2)'}}>
                ⭐ <strong>Fonctionnalité PRO</strong> — <a href="/upgrade" style={{color:'#1d4ed8'}}>Passez en PRO</a> pour protéger vos visites par un code d'accès.
              </div>
            )}
          </div>

          {/* Musique d'ambiance — PRO uniquement */}
          <div className={styles.modalField}>
            <label className={styles.modalLabel}>🎵 Musique d'ambiance</label>
            {isPRO ? (
              <>
                {ambientMusicUrl ? (
                  <div style={{display:'flex',flexDirection:'column',gap:8}}>
                    <audio controls src={ambientMusicUrl} style={{width:'100%',borderRadius:8}} />
                    <div style={{display:'flex',gap:8,alignItems:'center'}}>
                      <button className={styles.btnCancel} style={{flex:1}} onClick={() => setAmbientMusicUrl('')}>✕ Supprimer</button>
                      <label style={{display:'flex',alignItems:'center',gap:6,fontSize:13,color:'var(--text-2)',flex:1}}>
                        <input type="checkbox" checked={ambientMusicLoop} onChange={e => setAmbientMusicLoop(e.target.checked)} />
                        Lecture en boucle
                      </label>
                    </div>
                  </div>
                ) : (
                  <button className={styles.btnCancel} style={{width:'100%'}}
                    onClick={() => musicInputRef.current?.click()}
                    disabled={uploadingMusic}>
                    {uploadingMusic ? 'Upload…' : '+ Importer un fichier MP3/WAV'}
                  </button>
                )}
                <input ref={musicInputRef} type="file" accept="audio/*" style={{display:'none'}}
                  onChange={async (e) => {
                    const f = e.target.files?.[0]
                    if (!f) return
                    setUploadingMusic(true)
                    try {
                      const { uploadAudio } = await import('@services/cloudinary')
                      const { url } = await uploadAudio(f, 'lc360/music', () => {})
                      setAmbientMusicUrl(url)
                    } catch(err) { console.error(err) }
                    setUploadingMusic(false)
                  }}
                />
              </>
            ) : (
              <div style={{background:'rgba(245,158,11,.1)', border:'1px solid rgba(245,158,11,.3)', borderRadius:8, padding:'12px 16px', fontSize:13, color:'var(--text-2)'}}>
                ⭐ <strong>Fonctionnalité PRO</strong> — <a href="/upgrade" style={{color:'#1d4ed8'}}>Passez en PRO</a> pour ajouter une musique d'ambiance.
              </div>
            )}
          </div>

          {/* Contact — PRO uniquement */}
          <div className={styles.modalField}>
            <label className={styles.modalLabel}>Bouton contact dans la visite</label>
            {isPRO ? (
              <>
                <input type="email" value={contactEmail} onChange={e => setContactEmail(e.target.value)}
                  className={styles.modalInput} placeholder="Email de contact (ex: contact@agence.fr)" />
                <input type="tel" value={contactPhone} onChange={e => setContactPhone(e.target.value)}
                  className={styles.modalInput} placeholder="Téléphone (ex: 06 12 34 56 78)" style={{marginTop:8}} />
              </>
            ) : (
              <div style={{background:'rgba(245,158,11,.1)', border:'1px solid rgba(245,158,11,.3)', borderRadius:8, padding:'12px 16px', fontSize:13, color:'var(--text-2)'}}>
                ⭐ <strong>Fonctionnalité PRO</strong> — <a href="/upgrade" style={{color:'#1d4ed8'}}>Passez en PRO</a> pour ajouter un bouton contact.
              </div>
            )}
          </div>

          <div className={styles.modalField}>
            <label className={styles.modalLabel}>Formulaire de contact</label>
            {isPRO ? (
              <>
                <div className={styles.optionRow}>
                  <div className={styles.optionInfo}>
                    <span className={styles.optionLabel}>Activer le formulaire de contact</span>
                    <span className={styles.optionHint}>Les visiteurs pourront envoyer un message depuis la visite (gratuit via FormSubmit).</span>
                  </div>
                  <button className={`${styles.toggleSwitch} ${contactFormEnabled ? styles.toggleOn : ''}`}
                    onClick={() => setContactFormEnabled(v => !v)}>
                    <span className={styles.toggleThumb} />
                  </button>
                </div>
                {contactFormEnabled && (
                  <p style={{fontSize:12, color:'var(--text-3)', marginTop:8}}>
                    ✓ Un formulaire de contact apparaîtra dans la visite. Les messages seront envoyés à l'adresse email renseignée ci-dessus via FormSubmit (gratuit, sans compte).
                    <br/><strong style={{color:'var(--accent)'}}>Note :</strong> à la première utilisation, FormSubmit enverra un email de confirmation à votre adresse — cliquez sur le lien pour l'activer.
                  </p>
                )}
              </>
            ) : (
              <div style={{background:'rgba(245,158,11,.1)', border:'1px solid rgba(245,158,11,.3)', borderRadius:8, padding:'12px 16px', fontSize:13, color:'var(--text-2)'}}>
                ⭐ <strong>Fonctionnalité PRO</strong> — <a href="/upgrade" style={{color:'#1d4ed8'}}>Passez en PRO</a> pour activer le formulaire de contact.
              </div>
            )}
          </div>

          {/* Zone danger */}
          <div className={styles.dangerZone}>
            <p className={styles.dangerTitle}>Zone dangereuse</p>
            {!confirmDel ? (
              <button className={styles.btnDanger} onClick={() => setConfirmDel(true)}>
                🗑 Supprimer ce projet
              </button>
            ) : (
              <div className={styles.confirmDel}>
                <p>Supprimer définitivement <strong>{project.name}</strong> et toutes ses scènes ?</p>
                <div className={styles.confirmDelBtns}>
                  <button className={styles.btnDangerCancel} onClick={() => setConfirmDel(false)}>Annuler</button>
                  <button className={styles.btnDangerConfirm} onClick={handleDelete} disabled={deleting}>
                    {deleting ? 'Suppression…' : 'Oui, supprimer'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className={styles.modalFooter}>
          <button className={styles.btnCancel} onClick={onClose}>Annuler</button>
          <button className={styles.btnSave} onClick={handleSave} disabled={!name.trim() || saving}>
            {saving ? 'Sauvegarde…' : '✓ Enregistrer'}
          </button>
        </div>
      </div>
    </div>
  )
}