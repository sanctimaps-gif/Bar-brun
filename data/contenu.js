/*
 * ─────────────────────────────────────────────────────────────
 *  CONTENU DU SITE — c'est le SEUL fichier à modifier au quotidien
 * ─────────────────────────────────────────────────────────────
 *
 *  Règles simples :
 *   - tout ce qui est entre "guillemets" est du texte libre ;
 *   - les prix sont des nombres (2.5 et non "2,50 €") ;
 *   - une ligne qui commence par // est un commentaire, elle est ignorée ;
 *   - ne pas supprimer les virgules ni les accolades { }.
 *
 *  ⚠️ Les horaires, tarifs, contacts et événements ci-dessous sont des
 *  EXEMPLES fournis pour la mise en route. Remplacez-les par les vraies
 *  informations du bar avant la mise en ligne.
 */

const CONTENU = {
  /* ---------------------------------------------------------------
   * 1. IDENTITÉ
   * ------------------------------------------------------------- */
  bar: {
    nom: 'Bar Brun',
    accroche: 'Le comptoir de la rue Cauchoise',
    description:
      'Un bar de quartier à Rouen : boiseries, lumière basse, bières bien tirées et ' +
      'conversations qui durent. On y vient pour un verre après le travail, on y reste ' +
      'pour le concert du jeudi.',

    adresse: {
      rue: '84 Rue Cauchoise',
      codePostal: '76000',
      ville: 'Rouen',
      pays: 'France',
      // Coordonnées approximatives de la rue Cauchoise (à affiner si besoin).
      latitude: 49.4438,
      longitude: 1.0838,
    },

    contact: {
      // Laisser une chaîne vide ('') pour masquer complètement une ligne.
      telephone: '+33 2 00 00 00 00', // ← à remplacer
      email: 'contact@barbrun-rouen.fr', // ← à remplacer
    },

    reseaux: [
      { nom: 'Instagram', url: 'https://instagram.com/' },
      { nom: 'Facebook', url: 'https://facebook.com/' },
    ],

    // Affiché en bas de page.
    mentions:
      "L'abus d'alcool est dangereux pour la santé. À consommer avec modération. " +
      'Vente d\'alcool interdite aux mineurs.',
  },

  /* ---------------------------------------------------------------
   * 2. HORAIRES
   * ------------------------------------------------------------- */
  // Format 24 h. Une fermeture après minuit s'écrit normalement :
  // { ouverture: '17:00', fermeture: '02:00' } = 17 h jusqu'à 2 h du matin.
  // Jour fermé : []
  horaires: {
    lundi: [],
    mardi: [{ ouverture: '17:00', fermeture: '00:00' }],
    mercredi: [{ ouverture: '17:00', fermeture: '00:00' }],
    jeudi: [{ ouverture: '17:00', fermeture: '02:00' }],
    vendredi: [{ ouverture: '16:00', fermeture: '02:00' }],
    samedi: [{ ouverture: '16:00', fermeture: '02:00' }],
    dimanche: [{ ouverture: '17:00', fermeture: '23:00' }],
  },

  // Fermetures exceptionnelles (congés, jours fériés).
  // Format : { du: '2026-12-24', au: '2026-12-26', motif: 'Fêtes' }
  // « au » est inclus. Pour un seul jour, mettre la même date des deux côtés.
  fermetures: [
    { du: '2026-12-24', au: '2026-12-25', motif: 'Fêtes de fin d\'année' },
  ],

  // Happy hour : tarifs réduits sur les pressions et les cocktails.
  happyHour: {
    actif: true,
    jours: ['mardi', 'mercredi', 'jeudi', 'vendredi'],
    debut: '17:00',
    fin: '19:00',
    texte: 'Pinte à 5 € et cocktails à 7 €',
  },

  /* ---------------------------------------------------------------
   * 3. LA CARTE
   * ------------------------------------------------------------- */
  // Étiquettes possibles : 'local', 'sans-alcool', 'vegan', 'nouveau'
  carte: [
    {
      id: 'pression',
      titre: 'Bières pression',
      note: 'Six becs, dont deux qui tournent toutes les semaines.',
      articles: [
        {
          nom: 'Blonde de la maison',
          description: 'Brassée à Rouen, légère et sèche.',
          prix: { '25 cl': 3.5, '50 cl': 6.5 },
          etiquettes: ['local'],
        },
        {
          nom: 'Ambrée normande',
          description: 'Malts caramel, finale ronde.',
          prix: { '25 cl': 4, '50 cl': 7 },
          etiquettes: ['local'],
        },
        {
          nom: 'IPA du moment',
          description: 'Le bec qui change le plus souvent — demandez au comptoir.',
          prix: { '25 cl': 4.5, '50 cl': 8 },
          etiquettes: ['nouveau'],
        },
        {
          nom: 'Stout',
          description: 'Café, cacao, mousse dense.',
          prix: { '25 cl': 4.5, '50 cl': 8 },
        },
        {
          nom: 'Blanche',
          description: 'Coriandre et zeste d\'orange.',
          prix: { '25 cl': 3.5, '50 cl': 6.5 },
        },
        {
          nom: 'Cidre brut du Pays de Caux',
          description: 'Bouché, servi au bol.',
          prix: { '25 cl': 4 },
          etiquettes: ['local'],
        },
      ],
    },
    {
      id: 'bouteilles',
      titre: 'Bouteilles',
      note: 'Une trentaine de références à la carte, en voici quelques-unes.',
      articles: [
        { nom: 'Triple d\'abbaye', description: '33 cl — 8,5 %', prix: { '33 cl': 6.5 } },
        { nom: 'Lambic framboise', description: '25 cl — acidulé', prix: { '25 cl': 6 } },
        { nom: 'Brune de garde', description: '33 cl — 7 %', prix: { '33 cl': 6 } },
        {
          nom: 'Bière sans alcool',
          description: 'Blonde houblonnée, 0,4 %',
          prix: { '33 cl': 4 },
          etiquettes: ['sans-alcool'],
        },
      ],
    },
    {
      id: 'cocktails',
      titre: 'Cocktails',
      note: 'Préparés au comptoir, sans sirop industriel.',
      articles: [
        { nom: 'Vieux Carré', description: 'Rye, cognac, vermouth rouge, bénédictine.', prix: { verre: 10 } },
        { nom: 'Négroni', description: 'Gin, campari, vermouth. Servi sur glaçon taillé.', prix: { verre: 9 } },
        { nom: 'Calvados sour', description: 'Calvados du Pays d\'Auge, citron, blanc d\'œuf.', prix: { verre: 10 }, etiquettes: ['local'] },
        { nom: 'Moscow mule', description: 'Vodka, citron vert, ginger beer maison.', prix: { verre: 9 } },
        {
          nom: 'Jardin d\'hiver',
          description: 'Sans alcool : concombre, sureau, tonic.',
          prix: { verre: 7 },
          etiquettes: ['sans-alcool', 'vegan'],
        },
      ],
    },
    {
      id: 'vins',
      titre: 'Vins & spiritueux',
      articles: [
        { nom: 'Rouge — Loire', description: 'Cabernet franc, léger, servi frais.', prix: { verre: 5, bouteille: 24 } },
        { nom: 'Blanc — Jura', description: 'Chardonnay ouillé.', prix: { verre: 6, bouteille: 29 } },
        { nom: 'Pétillant naturel', description: 'Bulle fine, peu dosée.', prix: { verre: 6, bouteille: 28 } },
        { nom: 'Calvados', description: 'Sélection de trois maisons normandes.', prix: { '4 cl': 7 }, etiquettes: ['local'] },
        { nom: 'Whiskies', description: 'Écosse, Irlande, Normandie.', prix: { '4 cl': 8 } },
      ],
    },
    {
      id: 'softs',
      titre: 'Sans alcool',
      articles: [
        { nom: 'Limonade artisanale', description: 'Citron ou gingembre.', prix: { '33 cl': 4 }, etiquettes: ['sans-alcool', 'vegan'] },
        { nom: 'Jus de pomme fermier', description: 'Pressé en Seine-Maritime.', prix: { '25 cl': 3.5 }, etiquettes: ['sans-alcool', 'local', 'vegan'] },
        { nom: 'Café / expresso', description: 'Torréfaction rouennaise.', prix: { tasse: 2 }, etiquettes: ['sans-alcool', 'local'] },
        { nom: 'Infusion', description: 'Verveine, menthe, tilleul.', prix: { tasse: 3 }, etiquettes: ['sans-alcool', 'vegan'] },
      ],
    },
    {
      id: 'grignoter',
      titre: 'À grignoter',
      note: 'Service jusqu\'à 22 h.',
      articles: [
        { nom: 'Planche mixte', description: 'Charcuterie et fromages normands, pain de campagne.', prix: { '2 pers.': 16, '4 pers.': 28 }, etiquettes: ['local'] },
        { nom: 'Planche végétarienne', description: 'Houmous, légumes rôtis, olives, pain.', prix: { '2 pers.': 14 }, etiquettes: ['vegan'] },
        { nom: 'Croque du comptoir', description: 'Jambon blanc, comté, salade.', prix: { unité: 8 } },
        { nom: 'Olives & amandes', description: 'Le petit truc à grignoter.', prix: { portion: 4 }, etiquettes: ['vegan'] },
      ],
    },
  ],

  /* ---------------------------------------------------------------
   * 4. AGENDA
   * ------------------------------------------------------------- */
  // Les événements passés disparaissent automatiquement de la page.
  // Date au format AAAA-MM-JJ, heures au format 24 h.
  agenda: [
    {
      titre: 'Concert — trio jazz',
      date: '2026-09-10',
      debut: '20:30',
      fin: '22:30',
      description: 'Standards et compositions. Entrée libre, chapeau à la fin.',
      prix: 'Entrée libre',
    },
    {
      titre: 'Blind test',
      date: '2026-09-17',
      debut: '20:00',
      fin: '22:00',
      description: 'Équipes de quatre maximum. Une tournée à gagner.',
      prix: 'Gratuit',
    },
    {
      titre: 'Dégustation — brasseries normandes',
      date: '2026-09-25',
      debut: '19:00',
      fin: '21:00',
      description: 'Cinq bières commentées par les brasseurs, avec planche.',
      prix: '15 € — réservation conseillée',
    },
    {
      titre: 'Scène ouverte',
      date: '2026-10-02',
      debut: '20:30',
      fin: '23:00',
      description: 'Micro, ampli et piano à disposition. Inscription sur place à partir de 19 h.',
      prix: 'Entrée libre',
    },
  ],

  /* ---------------------------------------------------------------
   * 5. RENDEZ-VOUS RÉGULIERS (affichés en bas de l'agenda)
   * ------------------------------------------------------------- */
  rituels: [
    { quand: 'Mardi', quoi: 'Soirée jeux de société — la boîte est au fond de la salle.' },
    { quand: 'Jeudi', quoi: 'Concert ou scène ouverte, à partir de 20 h 30.' },
    { quand: 'Dimanche', quoi: 'Vinyles et tarifs doux toute la soirée.' },
  ],
};

// Rend le contenu accessible au reste de l'application.
window.CONTENU = CONTENU;
