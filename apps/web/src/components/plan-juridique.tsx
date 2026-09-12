import { Alert } from '@/components/ui'

/**
 * Gabarit des pages légales.
 *
 * Ces pages ne contiennent, à ce stade, que leur PLAN : les sections attendues
 * et les points que chacune devra couvrir. Le texte définitif sera rédigé par un
 * juriste avant toute mise en vente. Tout contenu provisoire est marqué
 * DEMO_JURIDIQUE, à l'écran comme dans le code.
 */

export type SectionJuridique = {
  titre: string
  /** Points que la rédaction devra couvrir. */
  points: readonly string[]
}

export function PlanJuridique({
  titre,
  objet,
  sections,
}: {
  titre: string
  objet: string
  sections: readonly SectionJuridique[]
}) {
  return (
    <article className="space-y-8">
      <header className="space-y-3">
        <p className="inline-flex rounded-md bg-[var(--color-amber-brand-100)] px-2 py-0.5 text-xs font-semibold text-[var(--color-amber-brand-700)]">
          DEMO_JURIDIQUE
        </p>
        <h1 className="text-2xl font-semibold sm:text-3xl">{titre}</h1>
        <p className="text-[var(--color-ink-500)]">{objet}</p>
      </header>

      <Alert tone="warning" title="Document non contractuel">
        Cette page présente le plan du document, pas son texte définitif. La rédaction sera confiée
        à un juriste avant toute mise en vente. Aucun des éléments ci-dessous ne peut être opposé à
        un utilisateur ni invoqué par Normelya.
      </Alert>

      <ol className="space-y-6">
        {sections.map((section, index) => (
          <li key={section.titre}>
            <h2 className="text-base font-semibold">
              <span className="text-[var(--color-ink-300)]">{index + 1}.</span> {section.titre}
            </h2>
            <ul className="mt-2 space-y-1.5 border-l-2 border-[var(--color-ink-100)] pl-4 text-sm text-[var(--color-ink-500)]">
              {section.points.map((point) => (
                <li key={point}>{point}</li>
              ))}
            </ul>
          </li>
        ))}
      </ol>

      <p className="text-xs text-[var(--color-ink-300)]">
        Plan préparé pour la rédaction juridique. Dernière modification structurelle : voir
        l’historique du dépôt.
      </p>
    </article>
  )
}
