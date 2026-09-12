/**
 * Lecture du texte d'un PDF.
 *
 * Séparé du reste du paquet : le cœur de l'extraction travaille sur du texte et
 * reste testable sans aucun fichier. Ce module est le seul à dépendre d'une
 * bibliothèque de rendu.
 *
 * Deux informations sont produites :
 *   · le texte, page par page ;
 *   · l'indication qu'une couche de texte existe réellement. Un PDF scanné en
 *     est dépourvu et devra passer par la reconnaissance optique.
 */

export type PdfPage = {
  pageNumber: number
  text: string
  /** Nombre d'éléments de texte trouvés. Zéro signale une page image. */
  itemCount: number
}

export type PdfTextResult = {
  pages: PdfPage[]
  text: string
  pageCount: number
  /** Vrai si au moins une page porte du texte exploitable. */
  hasTextLayer: boolean
}

/** Seuil en deçà duquel une page est considérée comme une image. */
const MIN_CARACTERES_PAR_PAGE = 40

export async function extractTextFromPdf(data: Uint8Array): Promise<PdfTextResult> {
  // Import différé : la bibliothèque n'est chargée que lorsqu'un PDF arrive.
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs')

  // La bibliothèque prend possession du tampon transmis et le détache. Or
  // Normelya conserve le PDF original : il doit rester intact et relisible.
  // On travaille donc sur une copie.
  const copie = new Uint8Array(data.byteLength)
  copie.set(data)

  const document = await pdfjs.getDocument({
    data: copie,
    // Une fiche de données de sécurité n'a aucune raison d'exécuter du code,
    // de charger une police distante ou d'ouvrir un lien.
    isEvalSupported: false,
    disableFontFace: true,
    useSystemFonts: false,
    // Seules les erreurs sont journalisées. Normelya n'affiche pas le document,
    // il n'en lit que le texte : les avertissements de rendu (police absente,
    // glyphe non résolu) n'apportent rien et masqueraient le reste. La qualité
    // de lecture se mesure sur le texte obtenu, pas sur ces messages.
    verbosity: 0,
  }).promise

  const pages: PdfPage[] = []

  try {
    for (let numero = 1; numero <= document.numPages; numero += 1) {
      const page = await document.getPage(numero)
      const contenu = await page.getTextContent()

      const morceaux: string[] = []
      let derniereHauteur: number | null = null

      for (const element of contenu.items) {
        if (!('str' in element)) continue
        const texte = element.str
        const hauteur = Array.isArray(element.transform) ? Number(element.transform[5]) : null

        // Un changement de position verticale marque un retour à la ligne :
        // sans cela, un tableau se retrouve aplati sur une seule ligne.
        if (derniereHauteur !== null && hauteur !== null && Math.abs(hauteur - derniereHauteur) > 2) {
          morceaux.push('\n')
        } else if (element.hasEOL) {
          morceaux.push('\n')
        }

        morceaux.push(texte)
        if (hauteur !== null) derniereHauteur = hauteur
      }

      const texte = morceaux
        .join('')
        .replace(/[ \t]{2,}/g, '  ')
        .replace(/\n{3,}/g, '\n\n')
        .trim()

      pages.push({ pageNumber: numero, text: texte, itemCount: contenu.items.length })
      page.cleanup()
    }
  } finally {
    await document.destroy()
  }

  const texteComplet = pages.map((page) => page.text).join('\n\n')
  const hasTextLayer = pages.some((page) => page.text.length >= MIN_CARACTERES_PAR_PAGE)

  return {
    pages,
    text: texteComplet,
    pageCount: pages.length,
    hasTextLayer,
  }
}

/**
 * Contrôle d'entrée d'un fichier déposé.
 *
 * Vérifie les octets d'en-tête plutôt que l'extension ou le type déclaré par le
 * navigateur, qui sont tous deux falsifiables.
 */
export function looksLikePdf(data: Uint8Array): boolean {
  if (data.byteLength < 5) return false
  // « %PDF- »
  return (
    data[0] === 0x25 &&
    data[1] === 0x50 &&
    data[2] === 0x44 &&
    data[3] === 0x46 &&
    data[4] === 0x2d
  )
}
