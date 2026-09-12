import type { NextConfig } from 'next'

/**
 * En-têtes de sécurité.
 *
 * La politique de contenu interdit tout script distant : l'application ne charge
 * aucune ressource tierce. Elle protège des injections issues, par exemple, du
 * texte extrait d'une FDS fournisseur.
 */
const enDeveloppement = process.env.NODE_ENV !== 'production'

/**
 * En développement, le rechargement à chaud de Next évalue du code à la volée.
 * Sans 'unsafe-eval', l'hydratation échoue silencieusement : la page s'affiche
 * mais plus aucun bouton ne répond. Cette tolérance est strictement limitée au
 * développement — la politique de production reste sans 'unsafe-eval'.
 */
const sourcesDeScript = enDeveloppement
  ? "script-src 'self' 'unsafe-inline' 'unsafe-eval'"
  : "script-src 'self' 'unsafe-inline'"

const securityHeaders = [
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'X-DNS-Prefetch-Control', value: 'off' },
  {
    key: 'Permissions-Policy',
    value: 'camera=(), microphone=(), geolocation=(), interest-cohort=()',
  },
  {
    key: 'Strict-Transport-Security',
    value: 'max-age=63072000; includeSubDomains; preload',
  },
  {
    key: 'Content-Security-Policy',
    value: [
      "default-src 'self'",
      // 'unsafe-inline' reste nécessaire aux styles générés par le framework.
      "style-src 'self' 'unsafe-inline'",
      sourcesDeScript,
      "img-src 'self' data: blob:",
      "font-src 'self' data:",
      // Les documents sont servis par des URL signées du fournisseur de stockage.
      // En développement, le rechargement à chaud ouvre une connexion locale.
      enDeveloppement
        ? "connect-src 'self' ws://localhost:* https://*.supabase.co"
        : "connect-src 'self' https://*.supabase.co",
      "frame-ancestors 'none'",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
    ].join('; '),
  },
]

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  transpilePackages: ['@normelya/core'],
  typedRoutes: true,
  async headers() {
    return [{ source: '/:path*', headers: securityHeaders }]
  },
}

export default nextConfig
