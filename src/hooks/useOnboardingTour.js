import { useEffect, useRef } from 'react'
import Shepherd from 'shepherd.js'
import 'shepherd.js/dist/css/shepherd.css'
import { db } from '@services/firebase'
import { doc, updateDoc } from 'firebase/firestore'

function createTour(steps, onComplete, onCancel) {
  const tour = new Shepherd.Tour({
    useModalOverlay: true,
    defaultStepOptions: {
      cancelIcon: { enabled: true },
      classes: 'lc360-tour',
      scrollTo: { behavior: 'smooth', block: 'center' },
      when: {
        show() {
          const step = tour.getCurrentStep()
          const selector = step?.options?.attachTo?.element
          if (selector && !document.querySelector(selector)) {
            step.updateStepOptions({ attachTo: undefined })
          }
        }
      },
      canClickTarget: false
    },
  })

  steps.forEach(step => {
    tour.addStep({
      id: step.id,
      title: step.title,
      text: step.text,
      ...(step.attachTo ? { attachTo: step.attachTo } : {}),
      buttons: step.buttons.map(btn => ({
        label: btn.text,
        classes: btn.secondary ? 'shepherd-btn-secondary' : 'shepherd-btn-primary',
        action: () => {
          if (btn.action === 'next') tour.next()
          else if (btn.action === 'back') tour.back()
          else if (btn.action === 'cancel') { onCancel?.(); tour.cancel() }
        },
      })),
    })
  })

  tour.on('complete', () => onComplete?.())
  tour.on('cancel', () => onCancel?.())
  return tour
}

// ── Tour Dashboard ────────────────────────────────────────────
const DASHBOARD_STEPS = [
  {
    id: 'welcome',
    title: '👋 Bienvenue !',
    text: 'Ce guide va vous montrer comment créer votre première visite virtuelle 360° étape par étape. Vous pouvez l\'interrompre à tout moment.',
    attachTo: null,
    buttons: [
      { text: 'Passer', action: 'cancel', secondary: true },
      { text: 'C\'est parti ! →', action: 'next' },
    ],
  },
  {
    id: 'new-project',
    title: '1. Créer un projet',
    text: 'Cliquez sur ce bouton pour créer votre premier projet. Donnez-lui un nom — par exemple le nom d\'un bien immobilier ou d\'un espace.',
    attachTo: { element: '[data-tour="new-project"]', on: 'bottom' },
    buttons: [
      { text: '← Retour', action: 'back', secondary: true },
      { text: 'Compris →', action: 'next' },
    ],
  },
  {
    id: 'dashboard-end',
    title: '✓ C\'est parti !',
    text: 'Créez votre premier projet en cliquant sur "+ Nouveau projet". Le guide continuera automatiquement dans l\'éditeur pour vous montrer comment ajouter des panoramas et des hotspots.',
    attachTo: { element: '[data-tour="new-project"]', on: 'bottom' },
    buttons: [
      { text: '← Retour', action: 'back', secondary: true },
      { text: 'Terminer', action: 'next' },
    ],
  },
]

// ── Tour ProjectViewer ────────────────────────────────────────
const VIEWER_STEPS = [
  {
    id: 'add-scene',
    title: '2. Ajouter un panorama',
    text: 'Cliquez ici pour uploader votre première image 360°. Formats acceptés : JPG, PNG. Le ratio idéal est 2:1 (ex: 4096×2048px).',
    attachTo: { element: '[data-tour="add-scene"]', on: 'bottom' },
    buttons: [
      { text: 'Passer', action: 'cancel', secondary: true },
      { text: 'Suivant →', action: 'next' },
    ],
  },
  {
    id: 'scene-list',
    title: '3. Vos scènes',
    text: 'Chaque scène correspond à une vue 360°. Ajoutez-en plusieurs pour couvrir toutes les pièces ou espaces de votre visite.',
    attachTo: { element: '[data-tour="scene-list"]', on: 'right' },
    buttons: [
      { text: '← Retour', action: 'back', secondary: true },
      { text: 'Suivant →', action: 'next' },
    ],
  },
  {
    id: 'viewer',
    title: '4. Créer des hotspots',
    text: 'Double-cliquez sur le panorama pour créer un hotspot. Utilisez les hotspots de navigation pour relier vos scènes entre elles et créer un parcours fluide.',
    attachTo: { element: '[data-tour="viewer"]', on: 'top' },
    buttons: [
      { text: '← Retour', action: 'back', secondary: true },
      { text: 'Suivant →', action: 'next' },
    ],
  },
  {
    id: 'share',
    title: '5. Partager la visite',
    text: 'Quand votre visite est prête, cliquez ici pour la publier et obtenir un lien de partage. Envoyez-le à vos clients — accessible sur tous les appareils.',
    attachTo: { element: '[data-tour="share-btn"]', on: 'bottom' },
    buttons: [
      { text: '← Retour', action: 'back', secondary: true },
      { text: 'Terminer ✓', action: 'next' },
    ],
  },
  {
    id: 'congrats',
    title: '🎉 Félicitations !',
    text: 'Vous savez maintenant comment créer et partager une visite virtuelle 360°. Vous pouvez retrouver ce guide à tout moment depuis le dashboard.',
    attachTo: null,
    buttons: [
      { text: 'Fermer', action: 'next' },
    ],
  },
]

// ── Hook Dashboard ────────────────────────────────────────────
export function useDashboardTour(uid, onboardingDone) {
  const tourRef = useRef(null)

  const startTour = () => {
    if (tourRef.current) tourRef.current.cancel()
    const tour = createTour(
      DASHBOARD_STEPS,
      async () => {
        // Ne marque pas done ici — le viewer tour le fera
      },
      async () => {
        if (uid) await updateDoc(doc(db, 'users', uid), { onboardingDone: true })
      }
    )
    tourRef.current = tour
    tour.start()
  }

  useEffect(() => {
    if (uid && onboardingDone === false) {
      const timer = setTimeout(() => startTour(), 800)
      return () => clearTimeout(timer)
    }
  }, [uid, onboardingDone])

  return { startTour }
}

// ── Hook ProjectViewer ────────────────────────────────────────
export function useViewerTour(uid, onboardingDone) {
  const tourRef = useRef(null)

  const startTour = () => {
    if (tourRef.current) tourRef.current.cancel()
    const tour = createTour(
      VIEWER_STEPS,
      async () => {
        if (uid) await updateDoc(doc(db, 'users', uid), { onboardingDone: true })
      },
      async () => {
        if (uid) await updateDoc(doc(db, 'users', uid), { onboardingDone: true })
      }
    )
    tourRef.current = tour
    tour.start()
  }

  useEffect(() => {
    if (uid && onboardingDone === false) {
      const timer = setTimeout(() => startTour(), 1200)
      return () => clearTimeout(timer)
    }
  }, [uid, onboardingDone])

  return { startTour }
}
