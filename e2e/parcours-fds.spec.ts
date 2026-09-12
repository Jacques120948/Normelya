import { expect, test, type Page } from '@playwright/test'
import { mkdtemp, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

/**
 * Parcours d'une fiche de données de sécurité : import, vérification, validation.
 *
 * Exécuté dans un navigateur réel, contre une vraie base et un vrai stockage.
 */

const MOT_DE_PASSE = 'motdepasse-de-test-123'

function adresseUnique(prefixe: string): string {
  return `${prefixe}-${Date.now()}-${Math.floor(Math.random() * 10000)}@exemple.test`
}

/** PDF minimal et valide, porteur des lignes fournies. */
function construirePdf(lignes: readonly string[]): Buffer {
  const echapper = (t: string) => t.replace(/([()\\])/g, '\\$1')
  const contenu =
    'BT /F1 10 Tf\n' +
    lignes.map((l, i) => `1 0 0 1 40 ${800 - i * 16} Tm (${echapper(l)}) Tj`).join('\n') +
    '\nET'
  const objets = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>',
    `<< /Length ${contenu.length} >>\nstream\n${contenu}\nendstream`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
  ]
  let doc = '%PDF-1.4\n'
  const offsets: number[] = []
  objets.forEach((corps, i) => {
    offsets.push(doc.length)
    doc += `${i + 1} 0 obj\n${corps}\nendobj\n`
  })
  const debutXref = doc.length
  doc += `xref\n0 ${objets.length + 1}\n0000000000 65535 f \n`
  for (const o of offsets) doc += `${o.toString().padStart(10, '0')} 00000 n \n`
  doc += `trailer\n<< /Size ${objets.length + 1} /Root 1 0 R >>\nstartxref\n${debutXref}\n%%EOF\n`
  return Buffer.from(doc, 'latin1')
}

async function creerAtelier(page: Page): Promise<void> {
  const email = adresseUnique('fds')

  await page.goto('/inscription')
  await page.getByRole('textbox', { name: 'Adresse e-mail' }).fill(email)
  await page.locator('#password').fill(MOT_DE_PASSE)
  await page.getByRole('checkbox').check()
  await page.getByRole('button', { name: 'Créer mon compte' }).click()

  await page.goto('/connexion')
  await page.getByRole('textbox', { name: 'Adresse e-mail' }).fill(email)
  await page.locator('#password').fill(MOT_DE_PASSE)
  await page.getByRole('button', { name: 'Se connecter' }).click()

  await expect(page).toHaveURL(/\/bienvenue/)
  await page.getByRole('textbox', { name: 'Prénom' }).fill('Camille')
  await page.getByRole('textbox', { name: 'Nom', exact: true }).fill('Durand')
  await page.getByRole('textbox', { name: "Nom de l'entreprise / atelier" }).fill('DEMO Atelier')
  await page.getByRole('textbox', { name: 'Adresse professionnelle' }).fill('12 rue des Artisans')
  await page.getByRole('textbox', { name: 'Code postal' }).fill('69003')
  await page.getByRole('textbox', { name: 'Ville' }).fill('Lyon')
  await page.getByRole('button', { name: 'Accéder à Normelya' }).click()
  await expect(page).toHaveURL(/\/tableau-de-bord/)
}

async function creerMatiere(page: Page): Promise<void> {
  await page.goto('/matieres-premieres/nouvelle')
  await page.getByRole('textbox', { name: 'Nom' }).first().fill('DEMO Parfum Fleur')
  await page.getByRole('button', { name: 'Ajouter la matière' }).click()
  await expect(page.getByRole('heading', { name: 'DEMO Parfum Fleur' })).toBeVisible()
}

test('import, vérification et validation d’une fiche', async ({ page }) => {
  await creerAtelier(page)
  await creerMatiere(page)

  // L'état documentaire est signalé tant qu'aucune fiche n'est déposée.
  await expect(page.getByText('FDS manquante')).toBeVisible()

  const dossier = await mkdtemp(join(tmpdir(), 'normelya-e2e-'))
  const chemin = join(dossier, 'demo-fiche.pdf')
  await writeFile(
    chemin,
    construirePdf([
      'RUBRIQUE 1 : Identification',
      'Nom commercial : DEMO Parfum Fleur',
      'Fournisseur : DEMO Maison des Parfums',
      'RUBRIQUE 2 : Identification des dangers',
      'Classification : Skin Sens. 1, H317',
      'RUBRIQUE 3 : Composition',
      'DEMO Substance A 78-70-6 5 - 10 % Skin Sens. 1 H317',
      'RUBRIQUE 9 : Proprietes',
      "Point d'eclair : 93 C",
      'RUBRIQUE 16 : Autres informations',
      'Version : 1.0',
      'Date de version: 05/11/2025',
    ]),
  )

  await page.getByLabel('Importer une FDS').setInputFiles(chemin)
  await page.getByRole('button', { name: 'Importer et vérifier' }).click()

  // L'écran de vérification annonce clairement que rien n'est enregistré.
  await expect(page.getByRole('heading', { name: 'Vérifiez les informations détectées' })).toBeVisible()
  await expect(page.getByText('Rien n’est encore enregistré')).toBeVisible()

  // Les valeurs lues sont proposées, avec leur provenance.
  await expect(page.locator('#commercialName')).toHaveValue('DEMO Parfum Fleur')
  await expect(page.locator('#versionLabel')).toHaveValue('1.0')
  await expect(page.locator('#flashPointCelsius')).toHaveValue('93')
  await expect(page.getByText('Lu dans le document :').first()).toBeVisible()

  // La composition lue est éditable.
  await expect(page.locator('#cas-0')).toHaveValue('78-70-6')
  await expect(page.locator('#min-0')).toHaveValue('5')
  await expect(page.locator('#max-0')).toHaveValue('10')

  // Une correction humaine : le nom de la substance est précisé.
  await page.locator('#nom-0').fill('DEMO Substance A corrigée')

  // Sans confirmation, le navigateur bloque la soumission : la case est requise.
  await expect(page.locator('#confirmed')).toHaveAttribute('required', '')

  await page.locator('#confirmed').check()
  await page.getByRole('button', { name: 'Valider la fiche' }).click()

  await expect(page).toHaveURL(/\/matieres-premieres\/[0-9a-f-]+\?fds=validee/)
  await expect(page.getByText('FDS validée')).toBeVisible()
  await expect(page.getByText('Version 1.0')).toBeVisible()
  // Le badge de la version, distinct du libellé d'état de la matière.
  await expect(page.getByText('Validée', { exact: true })).toBeVisible()
})

test('une version validée ne peut plus être modifiée', async ({ page }) => {
  await creerAtelier(page)
  await creerMatiere(page)

  const dossier = await mkdtemp(join(tmpdir(), 'normelya-e2e-'))
  const chemin = join(dossier, 'demo-fiche.pdf')
  await writeFile(
    chemin,
    construirePdf([
      'RUBRIQUE 1 : Identification',
      'Nom commercial : DEMO Parfum Fleur',
      'RUBRIQUE 3 : Composition',
      'DEMO Substance A 78-70-6 5 %',
      'RUBRIQUE 16 : Autres informations',
      'Version : 1.0',
    ]),
  )

  await page.getByLabel('Importer une FDS').setInputFiles(chemin)
  await page.getByRole('button', { name: 'Importer et vérifier' }).click()

  // Attendre la redirection avant de relever l'adresse : sans cela, on
  // relèverait celle de la page précédente.
  await expect(page).toHaveURL(/\/fds\/[0-9a-f-]+$/)
  const urlVerification = page.url()

  await page.locator('#confirmed').check()
  await page.getByRole('button', { name: 'Valider la fiche' }).click()
  await expect(page).toHaveURL(/fds=validee/)

  // Retour sur l'écran de vérification : il refuse toute nouvelle saisie.
  await page.goto(urlVerification)
  await expect(page.getByText('Cette version est déjà validée')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Valider la fiche' })).toHaveCount(0)
})

test('un fichier qui n’est pas un PDF est refusé', async ({ page }) => {
  await creerAtelier(page)
  await creerMatiere(page)

  const dossier = await mkdtemp(join(tmpdir(), 'normelya-e2e-'))
  const chemin = join(dossier, 'faux.pdf')
  // Extension trompeuse : le contrôle porte sur les octets d'en-tête.
  await writeFile(chemin, Buffer.from('<html><body>pas un pdf</body></html>', 'utf8'))

  await page.getByLabel('Importer une FDS').setInputFiles(chemin)
  await page.getByRole('button', { name: 'Importer et vérifier' }).click()

  // L'annonceur de route de Next porte aussi le rôle d'alerte : on cible le
  // message lui-même.
  await expect(page.getByText('Ce fichier n’est pas un PDF.')).toBeVisible()
})
