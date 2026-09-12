/**
 * Résultat explicite, sans exception, pour les opérations métier.
 * Le domaine réglementaire ne tolère pas les échecs silencieux : une opération
 * qui peut échouer le déclare dans son type de retour.
 */
export type Ok<T> = { ok: true; value: T }
export type Err<E> = { ok: false; error: E }
export type Result<T, E = Error> = Ok<T> | Err<E>

export function ok<T>(value: T): Ok<T> {
  return { ok: true, value }
}

export function err<E>(error: E): Err<E> {
  return { ok: false, error }
}

export function isOk<T, E>(result: Result<T, E>): result is Ok<T> {
  return result.ok
}

export function isErr<T, E>(result: Result<T, E>): result is Err<E> {
  return !result.ok
}

/** Déballe un résultat ou lève — réservé aux cas où l'échec est un bug. */
export function unwrap<T, E>(result: Result<T, E>): T {
  if (result.ok) return result.value
  throw new Error(`unwrap() sur un résultat en échec : ${JSON.stringify(result.error)}`)
}
