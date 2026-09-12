import Link from 'next/link'
import { Logo } from '@/components/ui'

export default function LegalLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh">
      <header className="border-b border-[var(--color-ink-100)] bg-white px-5 py-5 sm:px-8">
        <Link href="/">
          <Logo size="sm" />
        </Link>
      </header>

      <main className="mx-auto max-w-3xl px-5 py-10 sm:px-8">{children}</main>

      <footer className="border-t border-[var(--color-ink-100)] px-5 py-8 sm:px-8">
        <nav aria-label="Pages légales" className="mx-auto flex max-w-3xl flex-wrap gap-4 text-sm">
          <Link href="/mentions-legales" className="text-[var(--color-ink-500)] hover:underline">
            Mentions légales
          </Link>
          <Link href="/cgu" className="text-[var(--color-ink-500)] hover:underline">
            Conditions générales d’utilisation
          </Link>
          <Link href="/cgv" className="text-[var(--color-ink-500)] hover:underline">
            Conditions générales de vente
          </Link>
          <Link href="/confidentialite" className="text-[var(--color-ink-500)] hover:underline">
            Politique de confidentialité
          </Link>
        </nav>
      </footer>
    </div>
  )
}
