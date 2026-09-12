import type { Metadata, Viewport } from 'next'
import { fr } from '@/i18n/fr'
import './globals.css'

export const metadata: Metadata = {
  title: {
    default: `${fr.marque.nom} — ${fr.marque.signature}`,
    template: `%s · ${fr.marque.nom}`,
  },
  description: fr.marque.promesse,
  applicationName: fr.marque.nom,
  // L'espace applicatif ne doit pas être indexé ; la landing publique
  // définira sa propre directive en phase 9.
  robots: { index: false, follow: false },
}

export const viewport: Viewport = {
  themeColor: '#1f5f52',
  width: 'device-width',
  initialScale: 1,
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <body className="min-h-dvh antialiased">{children}</body>
    </html>
  )
}
