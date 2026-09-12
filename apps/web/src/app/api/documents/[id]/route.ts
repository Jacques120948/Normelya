import { NextResponse } from 'next/server'
import { services } from '@/server/container'
import { exigerAtelier } from '@/server/security/guard'
import { recordAudit } from '@/server/security/audit'

export const dynamic = 'force-dynamic'

/**
 * Téléchargement d'un document.
 *
 * L'autorisation est faite ici, pas dans le stockage : on vérifie que le
 * document appartient bien à l'organisation de l'utilisateur avant d'en lire le
 * moindre octet. Le stockage reste privé, et aucune URL publique n'existe.
 *
 * La lecture de la ligne passe par le rôle applicatif, donc sous les politiques
 * d'isolation : un document d'un autre atelier est introuvable, pas refusé.
 */
export async function GET(
  requete: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { context } = await exigerAtelier()
  const { id } = await params
  const { db, serviceDb, storage } = services()

  const document = await db.withContext(
    { userId: context.userId, organizationId: context.organizationId },
    (client) =>
      client.queryOne<{
        storage_key: string
        original_filename: string
        mime_type: string
        byte_size: string
      }>(
        `SELECT storage_key, original_filename, mime_type, byte_size::text
         FROM documents
         WHERE organization_id = $1 AND id = $2 AND deleted_at IS NULL`,
        [context.organizationId, id],
      ),
  )

  if (!document) {
    return NextResponse.json({ error: 'Document introuvable.' }, { status: 404 })
  }

  const contenu = await storage.get(document.storage_key)
  if (!contenu.ok) {
    return NextResponse.json({ error: 'Document introuvable.' }, { status: 404 })
  }

  await serviceDb
    .transaction((client) =>
      recordAudit(client, {
        organizationId: context.organizationId,
        actorUserId: context.userId,
        action: 'document.downloaded',
        entityType: 'document',
        entityId: id,
        ip: requete.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null,
        userAgent: requete.headers.get('user-agent'),
      }),
    )
    .catch(() => undefined)

  // Le nom de fichier est assaini : il provient d'un dépôt utilisateur et se
  // retrouverait sinon tel quel dans un en-tête de réponse.
  const nom = document.original_filename.replace(/[^\w.\- ]+/g, '_').slice(0, 120)

  return new NextResponse(Buffer.from(contenu.value), {
    status: 200,
    headers: {
      // Le type est imposé, jamais celui déclaré au dépôt : un document servi
      // en text/html s'exécuterait dans le navigateur.
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="${nom}"`,
      'X-Content-Type-Options': 'nosniff',
      'Cache-Control': 'private, no-store',
      'Content-Length': String(contenu.value.byteLength),
    },
  })
}
