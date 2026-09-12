/**
 * Lecture des champs d'en-tête et des propriétés physiques.
 *
 * Ces champs sont repérés par des étiquettes multilingues fréquentes. Une
 * étiquette non reconnue ne produit jamais de valeur par défaut : le champ reste
 * vide et l'écran de vérification demandera la saisie.
 */

export type FieldReading<T> = {
  value: T
  /** Extrait du document d'où provient la valeur, pour la vérification humaine. */
  evidence: string
}

import { foldForMatching } from './normalize'

const MOIS_FR: Record<string, number> = {
  janvier: 1, fevrier: 2, mars: 3, avril: 4, mai: 5, juin: 6,
  juillet: 7, aout: 8, septembre: 9, octobre: 10, novembre: 11, decembre: 12,
}

/**
 * Cherche la première ligne portant l'une des étiquettes données.
 *
 * Les étiquettes sont essayées de la plus longue à la plus courte, et le
 * caractère qui suit doit être un séparateur : sans cela, « version »
 * s'apparierait au début de « versione » et tronquerait la valeur.
 */
function chercherEtiquette(texte: string, etiquettes: readonly string[]): string | null {
  const parLongueur = [...etiquettes].sort((a, b) => b.length - a.length)
  const lignes = texte.split(/\r?\n/)

  for (const ligne of lignes) {
    // Le repli conserve les positions : on cherche sur la version repliée et on
    // découpe sur la ligne d'origine, pour restituer l'extrait exact.
    const normalisee = foldForMatching(ligne)
    for (const etiquette of parLongueur) {
      const cible = foldForMatching(etiquette)
      const position = normalisee.indexOf(cible)
      if (position === -1) continue

      const suivant = normalisee[position + cible.length]
      if (suivant !== undefined && /[a-z0-9]/.test(suivant)) continue

      const apres = ligne.slice(position + cible.length)
      const valeur = apres.replace(/^[\s:.\-–]+/, '').trim()
      if (valeur.length > 0) return valeur
    }
  }
  return null
}

/* ------------------------------------------------------------------- Dates */

const ETIQUETTES_DATE = [
  'date de revision',
  'date de révision',
  'date de la revision',
  'version du',
  'revision date',
  'date of revision',
  'ueberarbeitet am',
  'überarbeitet am',
  'data di revisione',
] as const

/**
 * Lit une date de révision.
 * Trois écritures acceptées : jour/mois/année, année-mois-jour, et jour mois
 * en toutes lettres. Une année seule ne suffit pas.
 */
export function parseRevisionDate(texte: string): FieldReading<string> | null {
  const valeur = chercherEtiquette(texte, ETIQUETTES_DATE)
  if (!valeur) return null

  const numerique = /(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})/.exec(valeur)
  if (numerique) {
    const [, jour, mois, annee] = numerique
    const iso = construireIso(Number(annee), Number(mois), Number(jour))
    return iso ? { value: iso, evidence: valeur } : null
  }

  const iso8601 = /(\d{4})-(\d{1,2})-(\d{1,2})/.exec(valeur)
  if (iso8601) {
    const [, annee, mois, jour] = iso8601
    const resultat = construireIso(Number(annee), Number(mois), Number(jour))
    return resultat ? { value: resultat, evidence: valeur } : null
  }

  const litteral = /(\d{1,2})\s+([A-Za-zÀ-ÿ]+)\s+(\d{4})/.exec(valeur)
  if (litteral) {
    const [, jour, mois, annee] = litteral
    const numeroMois = MOIS_FR[foldForMatching(mois!)]
    if (numeroMois) {
      const resultat = construireIso(Number(annee), numeroMois, Number(jour))
      return resultat ? { value: resultat, evidence: valeur } : null
    }
  }

  return null
}

function construireIso(annee: number, mois: number, jour: number): string | null {
  if (mois < 1 || mois > 12 || jour < 1 || jour > 31) return null
  if (annee < 1990 || annee > 2100) return null
  const date = new Date(Date.UTC(annee, mois - 1, jour))
  // Rejette les dates impossibles comme le 31 février.
  if (date.getUTCMonth() !== mois - 1 || date.getUTCDate() !== jour) return null
  return `${annee.toString().padStart(4, '0')}-${mois.toString().padStart(2, '0')}-${jour.toString().padStart(2, '0')}`
}

/* ----------------------------------------------------------------- Version */

const ETIQUETTES_VERSION = [
  'version',
  'versione',
  'revision',
  'révision',
  'numero de version',
  'numéro de version',
] as const

export function parseVersionLabel(texte: string): FieldReading<string> | null {
  const valeur = chercherEtiquette(texte, ETIQUETTES_VERSION)
  if (!valeur) return null

  const numero = /^[:\s]*([0-9]+(?:[.,][0-9]+)*)/.exec(valeur)
  if (!numero) return null

  return { value: numero[1]!.replace(',', '.'), evidence: valeur }
}

/* ---------------------------------------------------- Nom et fournisseur */

const ETIQUETTES_NOM = [
  'nom du produit',
  'nom commercial',
  'identificateur de produit',
  'product name',
  'trade name',
  'produktname',
  'handelsname',
  'nome commerciale',
] as const

export function parseProductName(texte: string): FieldReading<string> | null {
  const valeur = chercherEtiquette(texte, ETIQUETTES_NOM)
  if (!valeur || valeur.length < 2 || valeur.length > 200) return null
  return { value: valeur, evidence: valeur }
}

const ETIQUETTES_FOURNISSEUR = [
  'fournisseur',
  'raison sociale',
  'societe',
  'société',
  'supplier',
  'company',
  'lieferant',
  'fornitore',
] as const

export function parseSupplierName(texte: string): FieldReading<string> | null {
  const valeur = chercherEtiquette(texte, ETIQUETTES_FOURNISSEUR)
  if (!valeur || valeur.length < 2 || valeur.length > 200) return null
  return { value: valeur, evidence: valeur }
}

/* ------------------------------------------------------------ Point éclair */

const ETIQUETTES_POINT_ECLAIR = [
  "point d'eclair",
  "point d'éclair",
  'point eclair',
  'flash point',
  'flammpunkt',
  'punto di infiammabilita',
] as const

export type FlashPointReading = FieldReading<number> & {
  /** Comparateur éventuel : « > 100 °C » n'est pas une mesure exacte. */
  operator: '<' | '>' | null
}

/**
 * Lit un point éclair et le ramène en degrés Celsius.
 * Les valeurs en degrés Fahrenheit sont converties ; toute autre unité est
 * refusée plutôt que supposée.
 */
export function parseFlashPoint(texte: string): FlashPointReading | null {
  const valeur = chercherEtiquette(texte, ETIQUETTES_POINT_ECLAIR)
  if (!valeur) return null

  const mesure = /([<>]?)\s*(-?\d{1,3}(?:[.,]\d{1,2})?)\s*°?\s*([CF])\b/i.exec(valeur)
  if (!mesure) return null

  const [, signe, nombre, unite] = mesure
  const brut = Number(nombre!.replace(',', '.'))
  const celsius = unite!.toUpperCase() === 'F' ? ((brut - 32) * 5) / 9 : brut

  return {
    value: Math.round(celsius * 100) / 100,
    operator: signe === '<' || signe === '>' ? signe : null,
    evidence: valeur,
  }
}
