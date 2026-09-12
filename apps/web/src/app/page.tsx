import { redirect } from 'next/navigation'

/**
 * Racine.
 *
 * La landing publique est prévue en phase 9. En attendant, la racine mène à
 * l'espace applicatif, qui redirige lui-même selon l'état de la session.
 */
export default function Page() {
  redirect('/tableau-de-bord')
}
