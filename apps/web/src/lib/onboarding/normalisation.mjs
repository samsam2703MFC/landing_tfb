/**
 * Le schéma canonique d'une ligne de vente, et la façon d'y arriver.
 *
 * C'est le seul contrat que les modules du SaaS consomment. Quelle que soit
 * la caisse, ils lisent ces colonnes-là — c'est ce qui permet à un réseau de
 * mélanger trois caisses et de n'avoir qu'un seul tableau de bord.
 *
 * Quatre pièges y sont traités explicitement, parce qu'ils ne se voient pas :
 *
 *   · **les centimes.** Beaucoup de caisses rendent des entiers. Lus comme
 *     des euros, ils multiplient le chiffre par cent — et personne ne s'en
 *     aperçoit avant la première facture ;
 *   · **les annulations.** Une quantité négative est un remboursement, pas
 *     une erreur. La filtrer gonflerait le chiffre d'affaires ;
 *   · **la journée d'exploitation.** Une vente à 01h30 appartient à la
 *     journée de la veille. Sans cela, le lundi d'un bar paraît vide et son
 *     dimanche exceptionnel ;
 *   · **la devise.** Une caisse qui rend des dollars dans un réseau en euros
 *     est refusée plutôt que silencieusement additionnée.
 */

/** Les champs canoniques, et lesquels ne se devinent pas. */
export const CHAMPS_CANONIQUES = [
  { cle: 'externe_id', libelle: 'Identifiant de ligne', requis: true },
  { cle: 'commande_externe_id', libelle: 'Ticket' },
  { cle: 'boutique_externe_id', libelle: 'Boutique', requis: true },
  { cle: 'vendu_le', libelle: 'Date de vente', requis: true },
  { cle: 'produit_externe_id', libelle: 'Produit', requis: true },
  { cle: 'produit_libelle', libelle: 'Nom du produit', requis: true },
  { cle: 'categorie_externe_id', libelle: 'Catégorie', requis: true },
  { cle: 'categorie_libelle', libelle: 'Nom de la catégorie' },
  { cle: 'quantite', libelle: 'Quantité', requis: true },
  { cle: 'prix_unitaire_ttc', libelle: 'Prix unitaire', requis: true },
  { cle: 'prix_unitaire_ht', libelle: 'Prix unitaire hors taxes' },
  { cle: 'taux_tva', libelle: 'Taux de TVA' },
  { cle: 'remise', libelle: 'Remise' },
  { cle: 'total_ttc', libelle: 'Total', requis: true },
  { cle: 'total_ht', libelle: 'Total hors taxes' },
  { cle: 'devise', libelle: 'Devise' },
  { cle: 'moyen_paiement', libelle: 'Moyen de paiement' },
  { cle: 'canal', libelle: 'Canal' },
];

/** Les canaux qu'on sait ranger. Tout le reste tombe dans « autre ». */
const CANAUX = {
  dine_in: 'sur_place', eat_in: 'sur_place', sur_place: 'sur_place', table: 'sur_place',
  takeaway: 'emporter', take_away: 'emporter', to_go: 'emporter', emporter: 'emporter',
  delivery: 'livraison', deliveroo: 'livraison', ubereats: 'livraison', livraison: 'livraison',
};

/**
 * Ce que la caisse renvoie sur les clients finaux, et qu'on n'écrit jamais.
 *
 * Retiré **avant** l'écriture de la ligne brute, pas après : une donnée
 * personnelle écrite puis effacée est restée écrite. La liste est large à
 * dessein — on préfère perdre un champ neutre que garder un nom.
 */
const PERSONNEL = /^(customer|client|buyer|guest|user|contact)?_?(name|nom|firstname|lastname|prenom|email|mail|phone|tel|telephone|address|adresse|birth|naissance|vat_number)$/i;

/** Retire récursivement ce qui ressemble à une donnée personnelle. */
export function sansDonneesPersonnelles(objet) {
  if (Array.isArray(objet)) return objet.map(sansDonneesPersonnelles);
  if (!objet || typeof objet !== 'object') return objet;
  const propre = {};
  for (const [cle, valeur] of Object.entries(objet)) {
    if (PERSONNEL.test(cle)) continue;
    // Un objet « customer » entier disparaît, quel que soit son contenu.
    if (/^(customer|client|buyer|guest|contact)$/i.test(cle)) continue;
    propre[cle] = sansDonneesPersonnelles(valeur);
  }
  return propre;
}

/** Lit une valeur par chemin pointé : « data.items.0.price ». */
export function parChemin(objet, chemin) {
  if (!chemin) return undefined;
  let courant = objet;
  for (const morceau of String(chemin).split('.')) {
    if (courant === null || courant === undefined) return undefined;
    courant = courant[morceau];
  }
  return courant;
}

/**
 * Applique une transformation à une valeur lue.
 *
 * Le cas qui compte est `diviser` : c'est lui qui rattrape les prix en
 * centimes, et c'est celui que l'écran de mapping fait confirmer.
 */
export function transformer(valeur, transform) {
  if (!transform || !transform.type) return valeur;
  const t = transform;
  if (t.type === 'constante') return t.valeur;
  if (valeur === undefined || valeur === null || valeur === '') return valeur;

  if (t.type === 'diviser') {
    const n = Number(valeur);
    return Number.isFinite(n) && Number(t.par) ? n / Number(t.par) : valeur;
  }
  if (t.type === 'multiplier') {
    const n = Number(valeur);
    return Number.isFinite(n) && Number(t.par) ? n * Number(t.par) : valeur;
  }
  if (t.type === 'table') {
    // Une table de correspondance : « takeaway » → « emporter ». La valeur
    // inconnue passe telle quelle plutôt que de devenir vide.
    const cle = String(valeur);
    return Object.prototype.hasOwnProperty.call(t.table || {}, cle) ? t.table[cle] : valeur;
  }
  if (t.type === 'concat') {
    return (t.champs || []).map((c) => valeur?.[c] ?? '').join(t.entre || ' ').trim();
  }
  return valeur;
}

/** Un nombre, ou null. Jamais NaN, jamais zéro par défaut. */
function nombre(valeur) {
  if (valeur === null || valeur === undefined || valeur === '') return null;
  const n = Number(valeur);
  return Number.isFinite(n) ? n : null;
}

/** Une chaîne propre, ou null. */
function texte(valeur) {
  if (valeur === null || valeur === undefined) return null;
  const s = String(valeur).trim();
  return s === '' ? null : s;
}

/**
 * La journée d'exploitation d'une vente.
 *
 * Une vente à 01h30 appartient à la journée de la veille : c'est la
 * convention de tous les métiers qui ferment après minuit, et c'est ce que le
 * client compare avec son livre de caisse. La coupure se règle par boutique —
 * un glacier ferme à 23h, un bar à 4h.
 *
 * Le calcul se fait dans le **fuseau de la boutique**, pas dans celui du
 * serveur : une vente de 23h30 à Bruxelles ne doit pas changer de jour parce
 * que le serveur est à Londres.
 */
export function journeeExploitation(instant, { fuseau = 'Europe/Brussels', coupure = 4 } = {}) {
  // `new Date(null)` vaut le 1er janvier 1970 et non une date invalide : sans
  // ce garde-fou, une vente sans date serait rangée dans la journée
  // d'exploitation du 31 décembre 1969.
  if (instant === null || instant === undefined || instant === '') return null;
  const d = instant instanceof Date ? instant : new Date(instant);
  if (Number.isNaN(d.getTime())) return null;

  // L'heure locale de la boutique, lue par le formateur plutôt que calculée :
  // c'est le seul moyen sûr de tenir compte de l'heure d'été.
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: fuseau, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', hourCycle: 'h23',
  }).formatToParts(d);
  const p = Object.fromEntries(parts.map((x) => [x.type, x.value]));
  const heure = Number(p.hour);

  // Avant la coupure, on retranche un jour. En passant par UTC parce qu'on ne
  // manipule plus qu'une date, sans heure : aucun risque de décalage.
  const jour = new Date(`${p.year}-${p.month}-${p.day}T00:00:00Z`);
  if (heure < coupure) jour.setUTCDate(jour.getUTCDate() - 1);
  return { date: jour.toISOString().slice(0, 10), heure };
}

/** Levée quand une ligne ne peut pas être normalisée. Va au rebut avec sa raison. */
export class LigneRefusee extends Error {
  constructor(code, message) {
    super(message);
    this.code = code;
  }
}

/**
 * Une ligne brute → une ligne canonique.
 *
 * Ne lève que sur ce qui rend la ligne inutilisable : un identifiant absent
 * — on ne saurait pas la dédoublonner — une date illisible, ou une devise qui
 * n'est pas celle du réseau. Tout le reste se remplit au mieux et se voit à
 * l'écran.
 */
export function normaliser(brute, {
  correspondances = {},
  boutique = {},
  devise = 'EUR',
  connecteur = null,
} = {}) {
  const lire = (cible) => {
    const c = correspondances[cible];
    if (!c) return undefined;
    if (c.transform && c.transform.type === 'constante') return c.transform.valeur;
    return transformer(parChemin(brute, c.source), c.transform);
  };

  const externeId = texte(lire('externe_id'));
  if (!externeId) {
    throw new LigneRefusee('CHAMP_REQUIS_ABSENT',
      "Cette ligne n'a pas d'identifiant : sans lui, on ne peut pas éviter de l'importer deux fois.");
  }

  const brutDate = lire('vendu_le');
  const vendu = new Date(brutDate);
  if (!brutDate || Number.isNaN(vendu.getTime())) {
    throw new LigneRefusee('DATE_ILLISIBLE', `« ${brutDate} » n'est pas une date lisible.`);
  }

  const deviseLue = texte(lire('devise')) || devise;
  if (deviseLue.toUpperCase() !== String(devise).toUpperCase()) {
    throw new LigneRefusee('DEVISE_ETRANGERE',
      `Cette vente est en ${deviseLue.toUpperCase()} alors que le réseau compte en ${String(devise).toUpperCase()}.`);
  }

  const jour = journeeExploitation(vendu, {
    fuseau: boutique.fuseau || 'Europe/Brussels',
    coupure: Number.isFinite(Number(boutique.coupure_jour)) ? Number(boutique.coupure_jour) : 4,
  });

  const quantite = nombre(lire('quantite'));
  const prixTtc = nombre(lire('prix_unitaire_ttc'));
  const totalTtc = nombre(lire('total_ttc'));
  const tva = nombre(lire('taux_tva'));

  // Le hors-taxes se déduit quand on connaît le taux, plutôt que de laisser un
  // trou : c'est un calcul exact, pas une estimation.
  const ht = (ttc) => (ttc !== null && tva !== null && tva >= 0 ? ttc / (1 + tva / 100) : null);

  const canalBrut = texte(lire('canal'));
  return {
    externe_id: externeId,
    commande_externe_id: texte(lire('commande_externe_id')),
    boutique_externe_id: texte(lire('boutique_externe_id')),
    vendu_le: vendu,
    jour_exploitation: jour ? jour.date : null,
    heure: jour ? jour.heure : null,
    produit_externe_id: texte(lire('produit_externe_id')),
    produit_libelle: texte(lire('produit_libelle')),
    categorie_externe_id: texte(lire('categorie_externe_id')),
    categorie_libelle: texte(lire('categorie_libelle')),
    // Négatif conservé : c'est une annulation ou un retour, et la filtrer
    // gonflerait le chiffre d'affaires de tout ce qui a été remboursé.
    quantite,
    prix_unitaire_ttc: prixTtc,
    prix_unitaire_ht: nombre(lire('prix_unitaire_ht')) ?? ht(prixTtc),
    taux_tva: tva,
    remise: nombre(lire('remise')),
    total_ttc: totalTtc,
    total_ht: nombre(lire('total_ht')) ?? ht(totalTtc),
    devise: deviseLue.toUpperCase(),
    moyen_paiement: texte(lire('moyen_paiement')),
    canal: canalBrut ? (CANAUX[canalBrut.toLowerCase()] || 'autre') : null,
    connecteur,
  };
}

/**
 * Ce qui manque pour que le mapping soit utilisable.
 *
 * Appelée avant d'accepter l'étape de mapping : mieux vaut refuser d'avancer
 * que découvrir à l'import que la moitié des lignes part au rebut.
 */
export function mappingIncomplet(correspondances = {}) {
  return CHAMPS_CANONIQUES
    .filter((c) => c.requis)
    .filter((c) => !correspondances[c.cle] || !(correspondances[c.cle].source || correspondances[c.cle].transform))
    .map((c) => ({ cle: c.cle, libelle: c.libelle }));
}
