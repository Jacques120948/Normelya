import type { Metadata } from 'next'
import { PlanJuridique, type SectionJuridique } from '@/components/plan-juridique'

export const metadata: Metadata = { title: 'Conditions générales d’utilisation' }

/**
 * Plan des conditions générales d'utilisation.
 * Contenu provisoire DEMO_JURIDIQUE : texte à rédiger par un juriste.
 */
const SECTIONS: readonly SectionJuridique[] = [
  {
    titre: 'Objet et champ d’application',
    points: [
      'Description du service : centralisation documentaire, analyse réglementaire, génération de documents.',
      'Ce que le service n’est pas : ni conseil réglementaire, ni prestation de toxicologue, ni démarche officielle.',
      'Acceptation des conditions lors de la création du compte.',
    ],
  },
  {
    titre: 'Service réservé aux professionnels',
    points: [
      'Accès limité aux professionnels agissant dans le cadre de leur activité.',
      'Exclusion expresse des consommateurs, avec les conséquences sur le droit de rétractation.',
      'Déclaration de l’utilisateur sur sa qualité de professionnel à l’inscription.',
      'Conséquences d’une déclaration inexacte.',
    ],
  },
  {
    titre: 'Compte et accès',
    points: [
      'Création, vérification de l’adresse, confidentialité des identifiants.',
      'Utilisateurs multiples au sein d’un même atelier et rôles associés.',
      'Suspension et résiliation du compte.',
    ],
  },
  {
    titre: 'Responsabilité de mise sur le marché',
    points: [
      'La responsabilité légale de la mise sur le marché incombe entièrement à l’utilisateur.',
      'L’utilisateur demeure seul responsable de la classification, de l’étiquetage et des déclarations de ses produits.',
      'Obligation de vérification des données saisies et des documents produits avant tout usage commercial.',
      'Rappel du rôle d’assistance de l’outil, et des cas où l’intervention d’un expert reste nécessaire.',
    ],
  },
  {
    titre: 'Absence de garantie de conformité',
    points: [
      'Aucune garantie n’est donnée quant au caractère suffisant des résultats au regard d’une réglementation applicable.',
      'Les résultats dépendent des données fournies par l’utilisateur et de leur exactitude.',
      'Le périmètre couvert par le moteur est explicite et limité ; hors de ce périmètre, aucun résultat n’est produit.',
      'Portée du versionnage du moteur et des évolutions réglementaires postérieures à une analyse.',
    ],
  },
  {
    titre: 'Limitation de responsabilité',
    points: [
      'Plafonnement de la responsabilité au montant des sommes versées sur une période à définir.',
      'Exclusion des dommages indirects : perte d’exploitation, perte de clientèle, rappel de produits, sanctions administratives.',
      'Réserves d’ordre public : dol, faute lourde, dommages corporels.',
      'Articulation avec l’assurance de responsabilité civile professionnelle.',
    ],
  },
  {
    titre: 'Engagement de non-utilisation des formulations clients',
    points: [
      'Les recettes, formulations et pourcentages saisis restent la propriété exclusive de l’utilisateur.',
      'Engagement de ne pas les exploiter commercialement, les revendre, les agréger ni les publier.',
      'Engagement de ne transmettre aucune formulation à un fournisseur d’intelligence artificielle.',
      'Périmètre exact des données transmises à des sous-traitants, et finalité de chaque transmission.',
      'Possibilité de désactiver toute assistance par intelligence artificielle.',
    ],
  },
  {
    titre: 'Propriété intellectuelle',
    points: [
      'Droits de Normelya sur la plateforme, le moteur et la documentation.',
      'Droits de l’utilisateur sur ses données et sur les documents générés à partir de celles-ci.',
      'Licence d’utilisation consentie, durée et limites.',
    ],
  },
  {
    titre: 'Disponibilité et évolutions',
    points: [
      'Engagement de disponibilité et maintenance planifiée.',
      'Évolutions du service et des versions du moteur, information des utilisateurs.',
      'Conditions de fermeture du service et restitution des données.',
    ],
  },
  {
    titre: 'Durée, résiliation et sort des données',
    points: [
      'Durée du contrat, résiliation à l’initiative de chaque partie.',
      'Export des données avant clôture, délai de conservation puis suppression.',
      'Conservation des traces d’audit, et fondement de cette conservation.',
    ],
  },
  {
    titre: 'Droit applicable et règlement des litiges',
    points: [
      'Droit applicable et juridiction compétente.',
      'Procédure de réclamation préalable.',
      'Particularités liées aux utilisateurs établis en Suisse.',
    ],
  },
]

export default function Page() {
  return (
    <PlanJuridique
      titre="Conditions générales d’utilisation"
      objet="Règles d’accès et d’usage de la plateforme Normelya."
      sections={SECTIONS}
    />
  )
}
