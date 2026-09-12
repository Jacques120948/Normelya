# ADR 0002 — Supabase utilisé derrière des ports

- **Statut** : accepté
- **Date** : 2026-09-12

## Contexte

Supabase offre PostgreSQL, l'authentification et le stockage à coût nul au
démarrage. Mais une dépendance directe dans le code métier rendrait une migration
future très coûteuse.

## Décision

Le code métier dépend d'interfaces (`AuthProvider`, `Database`, `FileStorage`,
`MailSender`, `PaymentGateway`). Supabase n'est qu'une implémentation. Les
migrations sont écrites en SQL PostgreSQL standard, sans extension propriétaire.
Les politiques RLS s'appuient sur une fonction `app.current_user_id()` qui lit
soit un paramètre de session PostgreSQL, soit une revendication de jeton — ce qui
fonctionne avec ou sans Supabase.

## Conséquences

- Migration = réécriture de quatre adaptateurs.
- Les tests d'intégration tournent sur un PostgreSQL nu.
- Coût : une couche d'indirection supplémentaire, assumée.
