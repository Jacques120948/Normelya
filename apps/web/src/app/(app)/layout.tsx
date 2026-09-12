import { exigerAtelier } from '@/server/security/guard'
import { BarreLaterale } from '@/components/navigation'

/**
 * Segment dynamique : ces pages dépendent de la session de l'utilisateur et ne
 * doivent jamais être pré-rendues ni mises en cache.
 */
export const dynamic = 'force-dynamic'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  // Garde unique de tout l'espace connecté : la session est revérifiée en base
  // à chaque requête, sur le serveur.
  const { user, context } = await exigerAtelier()

  return (
    <div className="flex min-h-dvh flex-col lg:flex-row">
      <BarreLaterale
        prenom={user.firstName ?? ''}
        email={user.email}
        role={context.role}
        plan={context.plan}
      />
      <main className="flex-1 px-5 py-6 sm:px-8 sm:py-10">
        <div className="mx-auto w-full max-w-6xl">{children}</div>
      </main>
    </div>
  )
}
