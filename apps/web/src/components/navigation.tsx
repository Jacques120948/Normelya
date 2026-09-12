'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState } from 'react'
import { PLANS, type OrganizationRole, type PlanCode } from '@normelya/core'
import { Badge, Logo } from '@/components/ui'
import { fr } from '@/i18n/fr'
import { deconnexionAction } from '@/app/(auth)/actions'

/**
 * Navigation principale.
 *
 * Barre latérale sur grand écran, menu repliable sur mobile : la consultation
 * depuis l'atelier, téléphone en main, doit être aussi confortable que possible.
 */
const ENTREES = [
  { href: '/tableau-de-bord', libelle: fr.navigation.tableauDeBord, icone: '🏠' },
  { href: '/produits', libelle: fr.navigation.produits, icone: '📦' },
  { href: '/matieres-premieres', libelle: fr.navigation.matieresPremieres, icone: '🧪' },
  { href: '/documents', libelle: fr.navigation.documents, icone: '📄' },
  { href: '/conformite', libelle: fr.navigation.conformite, icone: '✓' },
  { href: '/alertes', libelle: fr.navigation.alertes, icone: '🔔' },
  { href: '/assistant', libelle: fr.navigation.assistant, icone: '✨' },
  { href: '/parametres', libelle: fr.navigation.parametres, icone: '⚙' },
  { href: '/abonnement', libelle: fr.navigation.abonnement, icone: '💳' },
] as const

export function BarreLaterale({
  prenom,
  email,
  role,
  plan,
}: {
  prenom: string
  email: string
  role: OrganizationRole
  plan: PlanCode
}) {
  const chemin = usePathname()
  const [ouvert, setOuvert] = useState(false)

  return (
    <>
      {/* En-tête mobile */}
      <div className="flex items-center justify-between border-b border-[var(--color-ink-100)] bg-white px-5 py-4 lg:hidden">
        <Link href="/tableau-de-bord">
          <Logo size="sm" />
        </Link>
        <button
          type="button"
          onClick={() => setOuvert((valeur) => !valeur)}
          aria-expanded={ouvert}
          aria-controls="navigation-principale"
          className="rounded-[var(--radius-control)] border border-[var(--color-ink-100)] px-3 py-1.5 text-sm"
        >
          {ouvert ? 'Fermer' : 'Menu'}
        </button>
      </div>

      <nav
        id="navigation-principale"
        aria-label="Navigation principale"
        className={`${ouvert ? 'block' : 'hidden'} w-full shrink-0 border-b border-[var(--color-ink-100)] bg-white px-4 py-4 lg:block lg:w-64 lg:border-b-0 lg:border-r lg:px-4 lg:py-6`}
      >
        <div className="mb-6 hidden px-2 lg:block">
          <Link href="/tableau-de-bord">
            <Logo />
          </Link>
        </div>

        <ul className="space-y-0.5">
          {ENTREES.map((entree) => {
            const actif = chemin === entree.href || chemin.startsWith(`${entree.href}/`)
            return (
              <li key={entree.href}>
                <Link
                  href={entree.href}
                  onClick={() => setOuvert(false)}
                  aria-current={actif ? 'page' : undefined}
                  className={`flex items-center gap-2.5 rounded-[var(--radius-control)] px-3 py-2 text-sm transition-colors ${
                    actif
                      ? 'bg-[var(--color-normelya-50)] font-medium text-[var(--color-normelya-700)]'
                      : 'text-[var(--color-ink-700)] hover:bg-[var(--color-surface-sunken)]'
                  }`}
                >
                  <span aria-hidden className="w-5 text-center">
                    {entree.icone}
                  </span>
                  {entree.libelle}
                </Link>
              </li>
            )
          })}
        </ul>

        <div className="mt-6 border-t border-[var(--color-ink-100)] pt-4">
          <div className="px-3">
            <p className="truncate text-sm font-medium text-[var(--color-ink-900)]">
              {prenom || email}
            </p>
            <p className="mt-0.5 truncate text-xs text-[var(--color-ink-300)]">{email}</p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              <Badge tone="brand">{PLANS[plan].name}</Badge>
              <Badge>{libelleRole(role)}</Badge>
            </div>
          </div>

          <form action={deconnexionAction} className="mt-3 px-3">
            <button
              type="submit"
              className="text-sm text-[var(--color-ink-500)] underline-offset-4 hover:underline"
            >
              {fr.actions.seDeconnecter}
            </button>
          </form>

          <div className="mt-4 flex flex-wrap gap-x-3 gap-y-1 px-3 text-xs text-[var(--color-ink-300)]">
            <Link href="/mentions-legales" className="hover:underline">
              Mentions légales
            </Link>
            <Link href="/cgu" className="hover:underline">
              CGU
            </Link>
            <Link href="/confidentialite" className="hover:underline">
              Confidentialité
            </Link>
          </div>
        </div>
      </nav>
    </>
  )
}

function libelleRole(role: OrganizationRole): string {
  const libelles: Record<OrganizationRole, string> = {
    owner: 'Propriétaire',
    admin: 'Administrateur',
    member: 'Membre',
    viewer: 'Lecture seule',
  }
  return libelles[role]
}
