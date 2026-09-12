import { AppError, err, ok, type OnboardingInput, type Result } from '@normelya/core'
import type { Database } from '../ports/database'
import { recordAudit } from '../security/audit'

/**
 * Onboarding : création de l'atelier à la première connexion.
 *
 * L'opération est atomique : organisation, appartenance en tant que propriétaire,
 * profil utilisateur et abonnement gratuit sont créés ensemble, ou pas du tout.
 * Un compte à moitié configuré serait plus difficile à réparer qu'à refaire.
 */

export type OnboardingDeps = {
  serviceDb: Database
}

export type OnboardingOutcome = {
  organizationId: string
}

export async function completeOnboarding(
  deps: OnboardingDeps,
  input: OnboardingInput & { userId: string },
  meta: { ip?: string | null; userAgent?: string | null } = {},
): Promise<Result<OnboardingOutcome, AppError>> {
  return deps.serviceDb.transaction(async (client) => {
    const existant = await client.queryOne<{ organization_id: string }>(
      `SELECT organization_id FROM organization_members WHERE user_id = $1 LIMIT 1`,
      [input.userId],
    )
    if (existant) {
      // L'utilisateur appartient déjà à un atelier : on ne recrée rien.
      return err(
        new AppError('CONFLICT', 'Votre atelier est déjà configuré.', {
          details: { organizationId: existant.organization_id },
        }),
      )
    }

    const organisation = await client.queryOne<{ id: string }>(
      `INSERT INTO organizations
         (name, country, address_line1, address_line2, postal_code, city,
          contact_email, contact_phone, activity, onboarding_completed_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, now())
       RETURNING id`,
      [
        input.organizationName,
        input.country,
        input.addressLine1,
        input.addressLine2 || null,
        input.postalCode,
        input.city,
        input.contactEmail,
        input.contactPhone || null,
        input.activity,
      ],
    )
    if (!organisation) {
      return err(new AppError('INTERNAL', "L'atelier n'a pas pu être créé."))
    }

    await client.query(
      `INSERT INTO organization_members (organization_id, user_id, role)
       VALUES ($1, $2, 'owner')`,
      [organisation.id, input.userId],
    )

    await client.query(
      `UPDATE users SET first_name = $2, last_name = $3 WHERE id = $1`,
      [input.userId, input.firstName, input.lastName],
    )

    // Offre gratuite par défaut : l'utilisateur peut travailler immédiatement.
    await client.query(
      `INSERT INTO subscriptions (organization_id, plan_id, status, billing_interval)
       SELECT $1, p.id, 'active', 'month' FROM plans p WHERE p.code = 'free'`,
      [organisation.id],
    )

    await recordAudit(client, {
      organizationId: organisation.id,
      actorUserId: input.userId,
      action: 'organization.created',
      entityType: 'organization',
      entityId: organisation.id,
      after: {
        name: input.organizationName,
        country: input.country,
        activity: input.activity,
      },
      ip: meta.ip,
      userAgent: meta.userAgent,
    })

    return ok({ organizationId: organisation.id })
  })
}
