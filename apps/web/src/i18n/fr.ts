/**
 * Dictionnaire français.
 *
 * Toute chaîne visible passe par ce fichier, même en V1 où le français est la
 * seule langue livrée : ajouter l'allemand, l'italien ou l'anglais consistera à
 * dupliquer ce fichier, pas à parcourir les composants.
 *
 * Les libellés réglementaires (mentions H, EUH, P) ne figurent PAS ici : ce sont
 * des données officielles, pas des traductions d'interface.
 */
export const fr = {
  marque: {
    nom: 'Normelya',
    signature: 'La conformité simplifiée pour les créateurs.',
    promesse: 'De votre recette à votre analyse réglementaire, en quelques minutes.',
  },

  navigation: {
    tableauDeBord: 'Tableau de bord',
    produits: 'Produits',
    matieresPremieres: 'Matières premières',
    documents: 'Documents',
    conformite: 'Conformité',
    alertes: 'Alertes',
    assistant: 'Assistant Normelya',
    parametres: 'Paramètres',
    abonnement: 'Abonnement',
  },

  actions: {
    continuer: 'Continuer',
    enregistrer: 'Enregistrer',
    annuler: 'Annuler',
    supprimer: 'Supprimer',
    modifier: 'Modifier',
    retour: 'Retour',
    seConnecter: 'Se connecter',
    seDeconnecter: 'Se déconnecter',
    creerCompte: 'Créer mon compte',
    nouveauProduit: 'Nouveau produit',
    ajouterParfum: 'Ajouter un parfum',
    importerFds: 'Importer une FDS',
    ajouterMatiere: 'Ajouter une matière première',
  },

  auth: {
    connexionTitre: 'Connexion à Normelya',
    connexionSousTitre: 'Retrouvez votre atelier.',
    inscriptionTitre: 'Créer votre compte Normelya',
    inscriptionSousTitre: 'Quelques secondes suffisent pour commencer.',
    email: 'Adresse e-mail',
    motDePasse: 'Mot de passe',
    motDePasseAide: 'Au moins 12 caractères.',
    motDePasseOublie: 'Mot de passe oublié ?',
    confirmerMotDePasse: 'Confirmer le mot de passe',
    accepterConditions: "J'accepte les conditions d'utilisation et la politique de confidentialité.",
    dejaInscrit: 'Vous avez déjà un compte ?',
    pasEncoreInscrit: 'Pas encore de compte ?',
    verifiezEmail: 'Vérifiez votre boîte e-mail',
    verifiezEmailCorps:
      'Si un compte correspond à cette adresse, un message vient d’être envoyé. Ouvrez le lien qu’il contient pour confirmer votre adresse.',
    lienReinitialisation: 'Réinitialiser mon mot de passe',
    reinitialisationEnvoyee:
      'Si un compte correspond à cette adresse, un lien de réinitialisation vient d’être envoyé.',
    identifiantsIncorrects: 'Adresse e-mail ou mot de passe incorrect.',
  },

  onboarding: {
    titre: 'Bienvenue sur Normelya',
    sousTitre: 'Configurons votre atelier.',
    prenom: 'Prénom',
    nom: 'Nom',
    nomAtelier: "Nom de l'entreprise / atelier",
    pays: 'Pays',
    fabrication: 'Que fabriquez-vous ?',
    bougies: 'Bougies',
    fondants: 'Fondants parfumés',
    lesDeux: 'Les deux',
    adresse: 'Adresse professionnelle',
    complementAdresse: "Complément d'adresse",
    codePostal: 'Code postal',
    ville: 'Ville',
    emailContact: 'E-mail',
    telephone: 'Téléphone',
    telephoneFacultatif: 'Facultatif',
    pret: 'Votre atelier est prêt.',
    acceder: 'Accéder à Normelya',
  },

  tableauDeBord: {
    bonjour: (prenom: string) => `Bonjour ${prenom} 👋`,
    sousTitre: 'Voici l’état de votre atelier.',
    produitsAnalyses: 'Produits analysés',
    produitsAVerifier: 'Produits à vérifier',
    documentsAMettreAJour: 'Documents à mettre à jour',
    matieresPremieres: 'Matières premières',
    produitsRecents: 'Produits récents',
    alertes: 'Alertes',
    documentsRecents: 'Documents récents',
    aucunProduit: 'Aucun produit pour le moment.',
    aucuneAlerte: 'Aucune alerte. Votre atelier est à jour.',
    aucunDocument: 'Aucun document déposé pour le moment.',
  },

  matieres: {
    titre: 'Mes matières premières',
    sousTitre: 'Vos parfums, cires, colorants et additifs, avec leurs documents.',
    aucune: 'Aucune matière première enregistrée.',
    aucuneAide:
      'Commencez par ajouter la cire et le parfum que vous utilisez le plus souvent.',
    nom: 'Nom',
    fournisseur: 'Fournisseur',
    reference: 'Référence',
    type: 'Type',
    dateAjout: 'Date d’ajout',
    prix: 'Prix',
    quantite: 'Quantité',
    documents: 'Documents',
    sansFournisseur: 'Fournisseur non renseigné',
    sansDocument: 'Aucun document',
    fdsManquante: 'FDS manquante',
    fdsAVerifier: 'FDS à vérifier',
    fdsValidee: 'FDS validée',
  },

  produits: {
    titre: 'Mes produits',
    sousTitre: 'Vos bougies et fondants, leurs recettes et leurs analyses.',
    aucun: 'Aucun produit enregistré.',
    aucunAide:
      'Créez votre premier produit, puis composez sa recette à partir de vos matières premières.',
    nom: 'Nom du produit',
    type: 'Type de produit',
    marches: 'Marchés visés',
    poidsNet: 'Poids net (g)',
    contenant: 'Contenant',
    recette: 'Recette',
    versions: 'Versions',
    version: 'Version',
    ingredients: 'Matières',
    total: 'Total',
    derniereAnalyse: 'Dernière analyse',
    aucuneAnalyse: 'Pas encore analysé',
    archiver: 'Archiver ce produit',
    reactiver: 'Réactiver ce produit',
    archive: 'Archivé',
    voirArchives: 'Voir les produits archivés',
    masquerArchives: 'Masquer les produits archivés',
    recetteEnregistree: 'Recette enregistrée.',
    nouvelleVersionCreee:
      'Une analyse était rattachée à la version précédente : une nouvelle version a été créée. L’ancienne reste consultable à l’identique.',
    versionFigee:
      'Cette version porte une analyse. Toute modification de la recette créera une nouvelle version.',
    totalAttendu: 'Le total doit atteindre exactement 100 %.',
    tauxParfum: 'Taux de parfum',
    ajouterLigne: 'Ajouter une matière',
    retirerLigne: 'Retirer',
    aucuneMatiere:
      'Aucune matière première enregistrée. Ajoutez d’abord vos cires et vos parfums.',
    fdsUtilisee: 'FDS utilisée',
    sansFds: 'Aucune FDS validée',
    role: 'Rôle',
    pourcentage: 'Pourcentage',
  },

  statuts: {
    analyseTerminee: 'Analyse terminée',
    verificationNecessaire: 'Vérification nécessaire',
    actionRequise: 'Action requise',
    nonApplicable: 'Non applicable',
  },

  avertissements: {
    outilAssistance:
      'Normelya est un outil d’assistance. Il ne remplace ni les autorités compétentes, ni un expert réglementaire lorsque celui-ci est nécessaire, ni les démarches officielles.',
    donneesDemo: 'Données de démonstration',
  },

  erreurs: {
    generique: 'Une erreur est survenue. Réessayez dans un instant.',
    champRequis: 'Ce champ est obligatoire.',
    accesRefuse: 'Vous n’avez pas accès à cette ressource.',
    tropDeTentatives: 'Trop de tentatives. Réessayez dans quelques instants.',
  },
} as const

export type Dictionnaire = typeof fr
