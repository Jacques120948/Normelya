import type { Metadata } from 'next'
import { AVenir } from '@/components/a-venir'
import { fr } from '@/i18n/fr'
import { exigerAtelier } from '@/server/security/guard'

export const metadata: Metadata = { title: 'Documents' }
export const dynamic = 'force-dynamic'

export default async function Page() {
  await exigerAtelier()
  return (
    <AVenir
      titre={fr.navigation.documents}
      description="Vos fiches fournisseurs, analyses et étiquettes, classées par produit."
      etape="L’import des documents arrive avec la lecture des fiches de données de sécurité."
      disponibleMaintenant={{
        libelle: fr.matieres.titre,
        href: '/matieres-premieres',
      }}
    />
  )
}
