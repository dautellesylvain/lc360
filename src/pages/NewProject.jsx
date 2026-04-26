import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useAtomValue } from 'jotai'
import { userUidAtom } from '@store/auth'
import { createProject } from '@services/firebase'
import styles from './NewProject.module.css'

const schema = z.object({
  name:        z.string().min(2, 'Minimum 2 caractères').max(80),
  location:    z.string().max(120).optional(),
  description: z.string().max(500).optional(),
})

export default function NewProject() {
  const uid      = useAtomValue(userUidAtom)
  const navigate = useNavigate()
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState(null)

  const { register, handleSubmit, formState: { errors } } = useForm({
    resolver: zodResolver(schema),
    defaultValues: { name: '', location: '', description: '' },
  })

  const onSubmit = async (data) => {
    if (!uid) return
    setLoading(true)
    setError(null)
    try {
      // createProject returns a Promise — we need the new doc id
      // We replicate the logic to capture the id
      const { doc, collection, setDoc, serverTimestamp } = await import('firebase/firestore')
      const { db } = await import('@services/firebase')

      const newRef = doc(collection(db, 'projects'))
      await setDoc(newRef, {
        id:          newRef.id,
        ownerId:     uid,
        name:        data.name.trim(),
        location:    data.location?.trim() || '',
        description: data.description?.trim() || '',
        scenes:      [],
        status:      'draft',
        createdAt:   serverTimestamp(),
        updatedAt:   serverTimestamp(),
      })

      navigate(`/project/${newRef.id}`, { replace: true })
    } catch (err) {
      setError('Erreur lors de la création : ' + err.message)
      setLoading(false)
    }
  }

  return (
    <div className={styles.page}>
      <div className={styles.card}>
        <div className={styles.header}>
          <h1 className={styles.title}>Nouveau projet</h1>
          <p className={styles.subtitle}>Créez votre visite virtuelle 360°</p>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className={styles.form} noValidate>

          <div className={styles.field}>
            <label className={styles.label}>Nom du projet <span className={styles.req}>*</span></label>
            <input
              type="text"
              className={`${styles.input} ${errors.name ? styles.inputError : ''}`}
              placeholder="Ex : Villa Méditerranée"
              autoFocus
              {...register('name')}
            />
            {errors.name && <span className={styles.error}>{errors.name.message}</span>}
          </div>

          <div className={styles.field}>
            <label className={styles.label}>Localisation</label>
            <input
              type="text"
              className={styles.input}
              placeholder="Ex : Côte d'Azur, France"
              {...register('location')}
            />
          </div>

          <div className={styles.field}>
            <label className={styles.label}>Description</label>
            <textarea
              className={styles.textarea}
              placeholder="Décrivez ce projet…"
              rows={3}
              {...register('description')}
            />
          </div>

          {error && <p className={styles.serverError}>{error}</p>}

          <div className={styles.actions}>
            <button type="button" className={styles.cancel} onClick={() => navigate('/dashboard')}>
              Annuler
            </button>
            <button type="submit" className={styles.submit} disabled={loading}>
              {loading ? 'Création…' : 'Créer le projet →'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
