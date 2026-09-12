import type { Metadata } from 'next'
import { AVenir } from '@/components/a-venir'
import { fr } from '@/i18n/fr'
import { exigerAtelier } from '@/server/security/guard'

export const metadata: Metadata = { title: 'Produits' }
export const dynamic = 'force-dynamic'

export default async function Page() {
  await exigerAtelier()
  return (
    <AVenir
      titre={fr.navigation.produits}
      description="Vos bougies et fondants, leurs recettes et leurs analyses."
      etape="La création de produits et de recettes est développée juste après l’import des fiches de données de sécurité : une recette n’a de sens que si les matières qu’elle utilise sont documentées."
      disponibleMaintenant={{
        libelle: fr.actions.ajouterMatiere,
        href: '/matieres-premieres/nouvelle',
      }}
    />
  )
}
