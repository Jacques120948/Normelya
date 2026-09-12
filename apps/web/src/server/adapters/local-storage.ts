import { mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { createHmac } from 'node:crypto'
import { dirname, join, normalize, resolve } from 'node:path'
import { err, ok, type Result } from '@normelya/core'
import {
  DEFAULT_SIGNED_URL_TTL_SECONDS,
  type FileStorage,
  type StorageError,
  type StoredObject,
} from '../ports/storage'
import { sha256Hex } from '../security/hashing'

/**
 * Stockage de fichiers sur disque.
 *
 * RÉSERVÉ AU DÉVELOPPEMENT ET AUX TESTS. En production, les documents sont
 * déposés dans un stockage objet privé.
 *
 * Deux propriétés du stockage réel sont reproduites, car ce sont elles qui
 * portent la sécurité :
 *
 *   · la racine est cloisonnée : une clé qui tenterait de remonter l'arborescence
 *     est refusée, pas nettoyée ;
 *   · l'accès passe par une URL signée à durée de vie courte, jamais par un
 *     chemin public.
 */
export class LocalFileStorage implements FileStorage {
  readonly name = 'local'
  private readonly racine: string
  private readonly secret: string

  constructor(options: { directory: string; signingSecret?: string }) {
    this.racine = resolve(options.directory)
    this.secret = options.signingSecret ?? process.env.HASH_SALT ?? 'secret-de-developpement'
  }

  async put(input: {
    key: string
    body: Uint8Array
    contentType: string
  }): Promise<Result<StoredObject, StorageError>> {
    const chemin = this.resoudre(input.key)
    if (!chemin) {
      return err({ kind: 'provider_unavailable', message: 'Clé de stockage invalide.' })
    }

    await mkdir(dirname(chemin), { recursive: true })
    await writeFile(chemin, input.body)

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
    if (!this.resoudre(input.key)) return err({ kind: 'not_found' })

    const expiration =
      Math.floor(Date.now() / 1000) + (input.expiresInSeconds ?? DEFAULT_SIGNED_URL_TTL_SECONDS)
    const signature = this.signer(input.key, expiration)

    return ok(
      `/api/documents/${encodeURIComponent(input.key)}?expires=${expiration}&signature=${signature}`,
    )
  }

  async get(key: string): Promise<Result<Uint8Array, StorageError>> {
    const chemin = this.resoudre(key)
    if (!chemin) return err({ kind: 'not_found' })
    try {
      return ok(new Uint8Array(await readFile(chemin)))
    } catch {
      return err({ kind: 'not_found' })
    }
  }

  async delete(key: string): Promise<Result<void, StorageError>> {
    const chemin = this.resoudre(key)
    if (!chemin) return err({ kind: 'not_found' })
    await rm(chemin, { force: true })
    return ok(undefined)
  }

  /** Vérifie une signature d'URL. */
  verifySignature(key: string, expiration: number, signature: string): boolean {
    if (!Number.isFinite(expiration) || expiration * 1000 < Date.now()) return false
    return this.signer(key, expiration) === signature
  }

  /**
   * Résout une clé en chemin absolu, ou renvoie null si elle sort de la racine.
   * Le refus est volontaire : nettoyer silencieusement une clé hostile
   * masquerait une tentative.
   */
  private resoudre(key: string): string | null {
    if (key.length === 0 || key.includes('\0')) return null

    // Une clé absolue ou remontante ne franchit pas forcément la racine une fois
    // jointe, mais elle trahit un appel mal construit : on la refuse au lieu de
    // la rattraper silencieusement.
    if (key.startsWith('/') || key.startsWith('\\')) return null
    if (normalize(key).split('/').includes('..')) return null

    const chemin = resolve(join(this.racine, normalize(key)))
    if (chemin !== this.racine && !chemin.startsWith(`${this.racine}/`)) return null
    return chemin
  }

  private signer(key: string, expiration: number): string {
    return createHmac('sha256', this.secret).update(`${key}:${expiration}`).digest('hex')
  }
}
