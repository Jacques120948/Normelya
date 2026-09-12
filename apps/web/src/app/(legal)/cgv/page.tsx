import type { Metadata } from 'next'
import { PlanJuridique, type SectionJuridique } from '@/components/plan-juridique'

export const metadata: Metadata = { title: 'Conditions générales de vente' }

/**
 * Plan des conditions générales de vente.
 * Contenu provisoire DEMO_JURIDIQUE : texte à rédiger par un juriste.
 */
const SECTIONS: readonly SectionJuridique[] = [
  {
    titre: 'Champ d’application',
    points: [
      'Vente d’abonnements à des professionnels uniquement.',
      'Articulation avec les conditions générales d’utilisation.',
    ],
  },
  {
    titre: 'Offres et tarifs',
    points: [
      'Description des quatre offres et de leurs limites respectives.',
      'Offre gratuite : trois produits documentés, quota non renouvelable.',
      'Tarifs mensuels et annuels, deux mois offerts sur l’engagement annuel.',
      'Prix hors taxes, taxe applicable selon le pays d’établissement du client.',
      'Conditions de modification tarifaire et préavis.',
    ],
  },
  {
    titre: 'Souscription et paiement',
    points: [
      'Processus de souscription et prestataire de paiement.',
      'Moyens de paiement acceptés, échéances, renouvellement automatique.',
      'Facturation, mise à disposition des factures.',
    ],
  },
  {
    titre: 'Défaut de paiement',
    points: [
      'Relances, suspension de l’accès, conservation des données pendant la suspension.',
      'Pénalités de retard et indemnité forfaitaire applicables entre professionnels.',
    ],
  },
  {
    titre: 'Changement d’offre',
    points: [
      'Montée en offre et effet immédiat sur les quotas.',
      'Descente en offre, effet au terme de la période, conséquences sur les produits actifs excédentaires.',
    ],
  },
  {
    titre: 'Rétractation et remboursement',
    points: [
      'Absence de droit de rétractation entre professionnels, et fondement de cette exclusion.',
      'Politique commerciale de remboursement éventuelle, à arbitrer.',
      'Traitement des cas de double facturation ou d’erreur technique.',
    ],
  },
  {
    titre: 'Résiliation',
    points: [
      'Résiliation par le client, effet au terme de la période en cours.',
      'Résiliation par Normelya : motifs, préavis, remboursement au prorata.',
      'Export des données et délai de suppression après résiliation.',
    ],
  },
  {
    titre: 'Garanties et responsabilité',
    points: [
      'Renvoi aux limitations de responsabilité des conditions générales d’utilisation.',
      'Absence de garantie quant au caractère suffisant des résultats au regard d’une réglementation applicable.',
      'Plafond de responsabilité rapporté aux sommes effectivement versées.',
    ],
  },
  {
    titre: 'Droit applicable et litiges',
    points: [
      'Droit applicable, juridiction compétente.',
      'Médiation éventuelle entre professionnels.',
    ],
  },
]

export default function Page() {
  return (
    <PlanJuridique
      titre="Conditions générales de vente"
      objet="Conditions de souscription et de facturation des abonnements Normelya."
      sections={SECTIONS}
    />
  )
}
