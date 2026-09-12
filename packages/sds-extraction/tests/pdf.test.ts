import { describe, expect, it } from 'vitest'
import { extractTextFromPdf, looksLikePdf } from '../src/pdf/index'

/**
 * Construit un PDF minimal et valide, contenant les lignes fournies.
 * Permet de tester la chaîne de lecture sans dépendre d'un fichier externe.
 */
function construirePdf(lignes: readonly string[]): Uint8Array {
  const echapper = (texte: string) => texte.replace(/([()\\])/g, '\\$1')

  const contenu =
    'BT /F1 12 Tf\n' +
    lignes
      .map((ligne, index) => `1 0 0 1 50 ${800 - index * 20} Tm (${echapper(ligne)}) Tj`)
      .join('\n') +
    '\nET'

  const objets = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 4 0 R ' +
      '/Resources << /Font << /F1 5 0 R >> >> >>',
    `<< /Length ${contenu.length} >>\nstream\n${contenu}\nendstream`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
  ]

  let document = '%PDF-1.4\n'
  const offsets: number[] = []

  objets.forEach((corps, index) => {
    offsets.push(document.length)
    document += `${index + 1} 0 obj\n${corps}\nendobj\n`
  })

  const debutXref = document.length
  document += `xref\n0 ${objets.length + 1}\n0000000000 65535 f \n`
  for (const offset of offsets) {
    document += `${offset.toString().padStart(10, '0')} 00000 n \n`
  }
  document += `trailer\n<< /Size ${objets.length + 1} /Root 1 0 R >>\nstartxref\n${debutXref}\n%%EOF\n`

  return new Uint8Array(Buffer.from(document, 'latin1'))
}

describe('contrôle du format de fichier', () => {
  it('reconnaît un PDF à ses octets d’en-tête, pas à son extension', () => {
    expect(looksLikePdf(construirePdf(['test']))).toBe(true)
  })

  it('refuse un fichier qui n’en est pas un', () => {
    expect(looksLikePdf(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d]))).toBe(false)
    expect(looksLikePdf(new Uint8Array(Buffer.from('<html>', 'utf8')))).toBe(false)
    expect(looksLikePdf(new Uint8Array([]))).toBe(false)
  })
})

describe('lecture du texte d’un PDF', () => {
  it('extrait le texte page par page', async () => {
    const pdf = construirePdf([
      'RUBRIQUE 3 : Composition',
      'DEMO Substance A 78-70-6 5 - 10 %',
    ])
    const resultat = await extractTextFromPdf(pdf)

    expect(resultat.pageCount).toBe(1)
    expect(resultat.hasTextLayer).toBe(true)
    expect(resultat.text).toContain('RUBRIQUE 3')
    expect(resultat.text).toContain('78-70-6')
  })

  it('sépare les lignes selon leur position verticale', async () => {
    const resultat = await extractTextFromPdf(
      construirePdf(['Première ligne', 'Deuxième ligne']),
    )
    const lignes = resultat.text.split('\n').filter((ligne) => ligne.trim().length > 0)
    expect(lignes).toHaveLength(2)
  })

  it('signale l’absence de couche de texte sur un document trop pauvre', async () => {
    const resultat = await extractTextFromPdf(construirePdf(['ab']))
    expect(resultat.hasTextLayer).toBe(false)
    expect(resultat.pages[0]?.itemCount).toBeGreaterThan(0)
  })

  it('laisse les octets d’origine intacts', async () => {
    // Non-régression : la bibliothèque de lecture détache le tampon qu'on lui
    // confie. Normelya conserve le PDF original et doit pouvoir le relire.
    const pdf = construirePdf(['RUBRIQUE 1 : Identification'])
    const taille = pdf.byteLength
    const premierOctet = pdf[0]

    await extractTextFromPdf(pdf)

    expect(pdf.byteLength).toBe(taille)
    expect(pdf[0]).toBe(premierOctet)
  })

  it('produit exactement le même texte pour un même fichier', async () => {
    const pdf = construirePdf(['RUBRIQUE 1 : Identification', 'Nom commercial : DEMO A'])
    const premier = await extractTextFromPdf(pdf)
    const second = await extractTextFromPdf(pdf)
    expect(premier.text).toBe(second.text)
  })
})
