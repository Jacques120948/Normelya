import type { Metadata } from 'next'
import { PLANS, PUBLIC_PLAN_ORDER, formatMoney, money } from '@normelya/core'
import { Alert, Badge, Card, CardBody } from '@/components/ui'
import { fr } from '@/i18n/fr'
import { exigerAtelier } from '@/server/security/guard'

export const metadata: Metadata = { title: 'Abonnement' }
export const dynamic = 'force-dynamic'

export default async function Page() {
  const { context } = await exigerAtelier()

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold sm:text-3xl">{fr.navigation.abonnement}</h1>
        <p className="mt-1 text-[var(--color-ink-500)]">
          Votre offre actuelle : <strong>{PLANS[context.plan].name}</strong>
        </p>
      </header>

      <Alert tone="info" title="Le paiement en ligne arrive prochainement">
        Les offres ci-dessous sont celles qui seront proposées. Votre atelier fonctionne
        aujourd’hui sur l’offre gratuite, sans limite de durée.
      </Alert>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {PUBLIC_PLAN_ORDER.map((code) => {
          const offre = PLANS[code]
          const actuelle = context.plan === code
          return (
            <Card
              key={code}
              className={actuelle ? 'border-[var(--color-normelya-400)] ring-1 ring-[var(--color-normelya-200)]' : undefined}
            >
              <CardBody className="space-y-3 p-5">
                <div className="flex items-center justify-between gap-2">
                  <h2 className="font-semibold">{offre.name}</h2>
                  {actuelle ? <Badge tone="brand">Actuelle</Badge> : null}
                </div>

                <p className="text-2xl font-semibold tabular-nums">
                  {offre.priceMonthlyCents === 0
                    ? '0 €'
                    : formatMoney(money(offre.priceMonthlyCents))}
                  <span className="text-sm font-normal text-[var(--color-ink-300)]">/mois</span>
                </p>

                <p className="text-sm text-[var(--color-ink-500)]">{offre.tagline}</p>

                <ul className="space-y-1 text-sm text-[var(--color-ink-500)]">
                  <li>
                    {offre.maxActiveProducts === null
                      ? 'Produits illimités'
                      : `${offre.maxActiveProducts} produit${offre.maxActiveProducts > 1 ? 's' : ''} actif${offre.maxActiveProducts > 1 ? 's' : ''}`}
                  </li>
                  {offre.maxLifetimeProducts !== null ? (
                    <li className="text-[var(--color-status-warning)]">
                      Quota non renouvelable : archiver un produit ne libère pas de place.
                    </li>
                  ) : null}
                  {offre.features.includes('product_sds') ? (
                    <li>Étiquette CLP et FDS du produit dilué</li>
                  ) : (
                    <li>Étiquette CLP</li>
                  )}
                  <li>
                    {offre.maxMembers} utilisateur{offre.maxMembers > 1 ? 's' : ''}
                  </li>
                  <li>{offre.maxStorageMb} Mo de documents</li>
                </ul>

                {offre.priceYearlyCents > 0 ? (
                  <p className="text-xs text-[var(--color-ink-300)]">
                    {formatMoney(money(offre.priceYearlyCents))} par an, soit deux mois offerts.
                  </p>
                ) : null}
              </CardBody>
            </Card>
          )
        })}
      </div>
    </div>
  )
}
