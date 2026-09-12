import type { Result } from '@normelya/core'

/**
 * Port de stockage de fichiers.
 *
 * Le bucket est privé. Aucun document utilisateur n'est jamais accessible par
 * une URL publique : l'accès passe par une URL signée de courte durée, émise
 * après vérification de l'appartenance à l'organisation.
 */

export type StorageError =
  | { kind: 'not_found' }
  | { kind: 'too_large'; maxBytes: number }
  | { kind: 'unsupported_type'; received: string }
  | { kind: 'provider_unavailable'; message: string }

export type StoredObject = {
  key: string
  byteSize: number
  sha256: string
  contentType: string
}

export interface FileStorage {
  readonly name: string

  put(input: {
    key: string
    body: Uint8Array
    contentType: string
  }): Promise<Result<StoredObject, StorageError>>

  /** URL de téléchargement temporaire. Durée volontairement courte. */
  getSignedUrl(input: {
    key: string
    expiresInSeconds?: number
  }): Promise<Result<string, StorageError>>

  get(key: string): Promise<Result<Uint8Array, StorageError>>

  delete(key: string): Promise<Result<void, StorageError>>
}

/** Durée par défaut d'une URL signée : une minute. */
export const DEFAULT_SIGNED_URL_TTL_SECONDS = 60
