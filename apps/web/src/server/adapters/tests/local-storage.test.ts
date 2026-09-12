import { afterAll, describe, expect, it } from 'vitest'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { LocalFileStorage } from '../local-storage'

const racine = await mkdtemp(join(tmpdir(), 'normelya-stockage-'))
const stockage = new LocalFileStorage({ directory: racine, signingSecret: 'secret-de-test' })

afterAll(async () => {
  await rm(racine, { recursive: true, force: true })
})

describe('stockage de fichiers', () => {
  it('dépose un fichier et calcule son empreinte', async () => {
    const resultat = await stockage.put({
      key: 'org-1/documents/fds.pdf',
      body: new Uint8Array([1, 2, 3]),
      contentType: 'application/pdf',
    })
    expect(resultat.ok).toBe(true)
    if (!resultat.ok) return
    expect(resultat.value.byteSize).toBe(3)
    expect(resultat.value.sha256).toMatch(/^[0-9a-f]{64}$/)
  })

  it('relit le fichier déposé', async () => {
    const resultat = await stockage.get('org-1/documents/fds.pdf')
    expect(resultat.ok).toBe(true)
    if (!resultat.ok) return
    expect([...resultat.value]).toEqual([1, 2, 3])
  })

  it('refuse une clé qui tente de sortir de la racine', async () => {
    for (const cle of ['../evasion.pdf', 'org-1/../../evasion.pdf', '/etc/passwd']) {
      const resultat = await stockage.put({
        key: cle,
        body: new Uint8Array([0]),
        contentType: 'application/pdf',
      })
      expect(resultat.ok, cle).toBe(false)
    }
  })

  it('n’émet jamais d’URL publique, seulement une URL signée et datée', async () => {
    const resultat = await stockage.getSignedUrl({ key: 'org-1/documents/fds.pdf' })
    expect(resultat.ok).toBe(true)
    if (!resultat.ok) return
    expect(resultat.value).toContain('signature=')
    expect(resultat.value).toContain('expires=')
    expect(resultat.value.startsWith('/api/documents/')).toBe(true)
  })

  it('refuse une signature falsifiée ou expirée', async () => {
    const dansUneHeure = Math.floor(Date.now() / 1000) + 3600
    const resultat = await stockage.getSignedUrl({ key: 'org-1/documents/fds.pdf' })
    if (!resultat.ok) throw new Error('inattendu')

    const signature = new URL(`https://exemple.test${resultat.value}`).searchParams.get('signature')!
    expect(stockage.verifySignature('org-1/documents/fds.pdf', dansUneHeure, signature)).toBe(false)
    expect(stockage.verifySignature('org-1/documents/fds.pdf', dansUneHeure, 'faux')).toBe(false)

    const passe = Math.floor(Date.now() / 1000) - 10
    expect(stockage.verifySignature('org-1/documents/fds.pdf', passe, signature)).toBe(false)
  })

  it('accepte une signature valide et non expirée', async () => {
    const resultat = await stockage.getSignedUrl({
      key: 'org-1/documents/fds.pdf',
      expiresInSeconds: 120,
    })
    if (!resultat.ok) throw new Error('inattendu')
    const url = new URL(`https://exemple.test${resultat.value}`)
    const expiration = Number(url.searchParams.get('expires'))
    const signature = url.searchParams.get('signature')!
    expect(stockage.verifySignature('org-1/documents/fds.pdf', expiration, signature)).toBe(true)
  })

  it('supprime un fichier', async () => {
    await stockage.delete('org-1/documents/fds.pdf')
    const relecture = await stockage.get('org-1/documents/fds.pdf')
    expect(relecture.ok).toBe(false)
  })
})
