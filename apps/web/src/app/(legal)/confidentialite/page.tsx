import type { Metadata } from 'next'
import { PlanJuridique, type SectionJuridique } from '@/components/plan-juridique'

export const metadata: Metadata = { title: 'Politique de confidentialité' }

/**
 * Plan de la politique de confidentialité.
 * Contenu provisoire DEMO_JURIDIQUE : texte à rédiger par un juriste.
 */
const SECTIONS: readonly SectionJuridique[] = [
  {
    titre: 'Responsable de traitement',
    points: [
      'Identité et coordonnées du responsable de traitement.',
      'Point de contact pour toute question relative aux données.',
    ],
  },
  {
    titre: 'Données traitées',
    points: [
      'Données de compte : identité, adresse électronique, téléphone facultatif.',
      'Données d’atelier : raison sociale, adresse professionnelle, pays.',
      'Données d’usage : traces d’audit, empreintes d’adresse réseau et d’agent utilisateur, jamais en clair.',
      'Documents déposés : fiches fournisseurs et documents générés.',
      'Données de facturation traitées par le prestataire de paiement.',
    ],
  },
  {
    titre: 'Formulations et secret des affaires',
    points: [
      'Les recettes et pourcentages saisis relèvent du secret des affaires de l’utilisateur.',
      'Aucune exploitation commerciale, aucune agrégation, aucune revente.',
      'Aucune transmission à un fournisseur d’intelligence artificielle, en aucune circonstance.',
      'Statistiques internes strictement anonymisées et agrégées, sans contenu de formulation.',
    ],
  },
  {
    titre: 'Finalités et bases légales',
    points: [
      'Exécution du contrat : fourniture du service, facturation, assistance.',
      'Obligation légale : conservation comptable, traces d’audit.',
      'Intérêt légitime : sécurité, prévention des abus, amélioration du service.',
      'Consentement, lorsque celui-ci est requis.',
    ],
  },
  {
    titre: 'Sous-traitants et transferts',
    points: [
      'Liste des sous-traitants : hébergement, base de données, stockage, courrier, paiement, supervision.',
      'Finalité, catégories de données et localisation pour chacun.',
      'Encadrement des transferts hors Union européenne, le cas échéant.',
      'Particularités relatives aux utilisateurs établis en Suisse.',
    ],
  },
  {
    titre: 'Durées de conservation',
    points: [
      'Compte actif, puis délai après résiliation.',
      'Documents déposés et documents générés.',
      'Traces d’audit et attestations de validation, dont la conservation prolongée est justifiée par leur valeur probante.',
      'Données de facturation, selon les obligations comptables.',
    ],
  },
  {
    titre: 'Droits des personnes',
    points: [
      'Accès, rectification, effacement, limitation, opposition, portabilité.',
      'Modalités d’exercice et délai de réponse.',
      'Fonctions intégrées : export complet des données et suppression du compte.',
      'Droit d’introduire une réclamation auprès de l’autorité de contrôle compétente.',
    ],
  },
  {
    titre: 'Sécurité',
    points: [
      'Isolation des données par atelier, au niveau applicatif et au niveau de la base.',
      'Chiffrement en transit et au repos, stockage privé, liens de téléchargement temporaires.',
      'Journalisation des accès et procédure en cas de violation de données.',
    ],
  },
  {
    titre: 'Témoins de connexion',
    points: [
      'Témoins strictement nécessaires au fonctionnement de la session.',
      'Absence de traceur publicitaire.',
      'Mesure d’audience éventuelle, et conditions de son caractère exempté de consentement.',
    ],
  },
]

export default function Page() {
  return (
    <PlanJuridique
      titre="Politique de confidentialité"
      objet="Traitement des données personnelles et protection des formulations."
      sections={SECTIONS}
    />
  )
}
