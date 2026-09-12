import type { Metadata } from 'next'
import { PlanJuridique, type SectionJuridique } from '@/components/plan-juridique'

export const metadata: Metadata = { title: 'Mentions légales' }

/**
 * Plan des mentions légales.
 * Contenu provisoire DEMO_JURIDIQUE : informations à compléter et à faire relire.
 */
const SECTIONS: readonly SectionJuridique[] = [
  {
    titre: 'Éditeur du service',
    points: [
      'Dénomination sociale, forme juridique, capital social.',
      'Adresse du siège, numéro d’immatriculation, numéro de taxe sur la valeur ajoutée.',
      'Nom du directeur de la publication.',
      'Coordonnées de contact : adresse électronique et téléphone.',
    ],
  },
  {
    titre: 'Hébergement',
    points: [
      'Identité et adresse de l’hébergeur de l’application.',
      'Identité et adresse de l’hébergeur des bases de données et du stockage de documents.',
      'Localisation géographique des données.',
    ],
  },
  {
    titre: 'Nature du service',
    points: [
      'Outil d’assistance à la gestion documentaire et réglementaire.',
      'Absence de prestation de conseil réglementaire, de contrôle ou de certification.',
      'Renvoi vers les autorités compétentes pour les démarches officielles.',
    ],
  },
  {
    titre: 'Propriété intellectuelle',
    points: [
      'Marque, identité visuelle, contenus éditoriaux et code de la plateforme.',
      'Références aux textes réglementaires cités : sources officielles et absence d’appropriation.',
      'Normes privées éventuellement citées par leur seule référence, sans reproduction.',
    ],
  },
  {
    titre: 'Signalement et contact',
    points: [
      'Adresse de signalement d’une erreur, notamment d’une erreur réglementaire.',
      'Délai de traitement annoncé et procédure suivie.',
      'Coordonnées du délégué à la protection des données, le cas échéant.',
    ],
  },
]

export default function Page() {
  return (
    <PlanJuridique
      titre="Mentions légales"
      objet="Informations sur l’éditeur et l’hébergement du service."
      sections={SECTIONS}
    />
  )
}
