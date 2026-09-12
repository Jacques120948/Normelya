import Link from 'next/link'
import { Logo } from '@/components/ui'
import { fr } from '@/i18n/fr'

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="px-5 py-6 sm:px-8">
        <Link href="/" aria-label={fr.marque.nom}>
          <Logo />
        </Link>
      </header>

      <main className="flex flex-1 items-start justify-center px-5 pb-16 sm:items-center sm:px-8">
        <div className="w-full max-w-md">{children}</div>
      </main>

      <footer className="space-y-3 px-5 pb-8 text-center text-xs text-[var(--color-ink-300)] sm:px-8">
        <p className="mx-auto max-w-md">{fr.avertissements.outilAssistance}</p>
        <nav aria-label="Pages légales" className="flex flex-wrap justify-center gap-3">
          <Link href="/mentions-legales" className="hover:underline">
            Mentions légales
          </Link>
          <Link href="/cgu" className="hover:underline">
            Conditions générales d’utilisation
          </Link>
          <Link href="/confidentialite" className="hover:underline">
            Politique de confidentialité
          </Link>
        </nav>
      </footer>
    </div>
  )
}
