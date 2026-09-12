import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { err, ok, type Result } from '@normelya/core'
import {
  DEFAULT_SIGNED_URL_TTL_SECONDS,
  type FileStorage,
  type StorageError,
  type StoredObject,
} from '../ports/storage'
import { sha256Hex } from '../security/hashing'

/**
 * Adaptateur de stockage Supabase.
 *
 * Le bucket est privé : aucune URL publique n'est jamais produite. L'appelant
 * doit avoir vérifié l'appartenance à l'organisation avant de demander une URL
 * signée — ce contrôle est de la responsabilité du service métier, pas du
 * stockage.
 */
export class SupabaseFileStorage implements FileStorage {
  readonly name = 'supabase'
  private readonly client: SupabaseClient
  private readonly bucket: string

  constructor(config: { url: string; serviceRoleKey: string; bucket: string }) {
    this.client = createClient(config.url, config.serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    })
    this.bucket = config.bucket
  }

  async put(input: {
    key: string
    body: Uint8Array
    contentType: string
  }): Promise<Result<StoredObject, StorageError>> {
    const { error } = await this.client.storage.from(this.bucket).upload(input.key, input.body, {
      contentType: input.contentType,
      upsert: false,
    })
    if (error) return err({ kind: 'provider_unavailable', message: error.message })

    return ok({
      key: input.key,
      byteSize: input.body.byteLength,
      sha256: sha256Hex(input.body),
      contentType: input.contentType,
    })
  }

  async getSignedUrl(input: {
    key: string
    expiresInSeconds?: number
  }): Promise<Result<string, StorageError>> {
    const { data, error } = await this.client.storage
      .from(this.bucket)
      .createSignedUrl(input.key, input.expiresInSeconds ?? DEFAULT_SIGNED_URL_TTL_SECONDS)
    if (error || !data) return err({ kind: 'not_found' })
    return ok(data.signedUrl)
  }

  async get(key: string): Promise<Result<Uint8Array, StorageError>> {
    const { data, error } = await this.client.storage.from(this.bucket).download(key)
    if (error || !data) return err({ kind: 'not_found' })
    return ok(new Uint8Array(await data.arrayBuffer()))
  }

  async delete(key: string): Promise<Result<void, StorageError>> {
    const { error } = await this.client.storage.from(this.bucket).remove([key])
    if (error) return err({ kind: 'provider_unavailable', message: error.message })
    return ok(undefined)
  }
}
