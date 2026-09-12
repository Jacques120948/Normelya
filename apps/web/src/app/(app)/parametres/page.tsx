import type { Metadata } from 'next'
import { PLANS } from '@normelya/core'
import { Badge, Card, CardBody, CardHeader } from '@/components/ui'
import { fr } from '@/i18n/fr'
import { services } from '@/server/container'
import { exigerAtelier } from '@/server/security/guard'
import { ZoneSuppression } from './suppression'

export const metadata: Metadata = { title: 'Paramètres' }
export const dynamic = 'force-dynamic'

export default async function Page() {
  const { user, context } = await exigerAtelier()
  const { db } = services()

  const atelier = await db.withContext(
    { userId: context.userId, organizationId: context.organizationId },
    (client) =>
      client.queryOne<{
        name: string
        country: string
        city: string | null
        postal_code: string | null
        address_line1: string | null
        contact_email: string | null
        activity: string
      }>(
        `SELECT name, country::text, city, postal_code, address_line1, contact_email, activity::text
         FROM organizations WHERE id = $1`,
        [context.organizationId],
      ),
  )

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <header>
        <h1 className="text-2xl font-semibold sm:text-3xl">{fr.navigation.parametres}</h1>
      </header>

      <Card>
        <CardHeader title="Votre compte" />
        <CardBody className="space-y-2 text-sm">
          <Ligne libelle="Nom" valeur={[user.firstName, user.lastName].filter(Boolean).join(' ')} />
          <Ligne libelle="Adresse e-mail" valeur={user.email} />
          <Ligne libelle="Rôle" valeur={context.role} />
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Votre atelier" />
        <CardBody className="space-y-2 text-sm">
          <Ligne libelle="Nom" valeur={atelier?.name ?? '—'} />
          <Ligne libelle="Pays" valeur={atelier?.country === 'CH' ? 'Suisse' : 'France'} />
          <Ligne
            libelle="Adresse"
            valeur={[atelier?.address_line1, atelier?.postal_code, atelier?.city]
              .filter(Boolean)
              .join(', ')}
          />
          <Ligne libelle="E-mail de contact" valeur={atelier?.contact_email ?? '—'} />
          <div className="flex items-center justify-between gap-4 py-1">
            <span className="text-[var(--color-ink-500)]">Offre</span>
            <Badge tone="brand">{PLANS[context.plan].name}</Badge>
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardHeader
          title="Vos données"
          description="Vos recettes et vos documents vous appartiennent."
        />
        <CardBody className="space-y-3 text-sm text-[var(--color-ink-500)]">
          <p>
            Normelya n’exploite jamais commercialement le contenu de vos recettes. L’export complet
            de vos données est inclus dans toutes les offres, y compris l’offre gratuite.
          </p>
          <p>
            L’assistance par intelligence artificielle peut être désactivée pour tout votre
            atelier : dans ce mode, aucun contenu ne quitte l’infrastructure Normelya.
          </p>
        </CardBody>
      </Card>

      <ZoneSuppression />
    </div>
  )
}

function Ligne({ libelle, valeur }: { libelle: string; valeur: string }) {
  return (
    <div className="flex items-center justify-between gap-4 py-1">
      <span className="text-[var(--color-ink-500)]">{libelle}</span>
      <span className="truncate font-medium">{valeur || '—'}</span>
    </div>
  )
}
