/**
 * La société qui facture — lectures et écritures.
 *
 * Il n'y en a qu'une aujourd'hui : ASIMA, à Wrocław. La table en accepte
 * plusieurs parce que le jour où une entité belge facturera les clients
 * belges, il faudra pouvoir choisir laquelle édite un contrat — et refaire un
 * schéma à ce moment-là coûterait plus cher que prévoir une colonne `defaut`
 * aujourd'hui.
 *
 * Rien ici n'est secret. La clé Stripe reste en variable d'environnement ;
 * ce que la table garde — l'identifiant du compte connecté — ne permet rien
 * sans elle. C'est ce qui autorise à éditer ces valeurs dans la console.
 */
import { connexion, estPostgres, table, viderCache } from '../db.mjs';

/** Vrai littéral du dialecte : MySQL n'a pas de type booléen. */
function vrai(valeur) {
  return estPostgres() ? Boolean(valeur) : valeur ? 1 : 0;
}

/**
 * Les champs éditables, dans l'ordre du formulaire.
 *
 * `pays_note` n'existe pas : le libellé du registre change avec le pays et
 * s'édite (`numero_registre_nom`), plutôt que d'être deviné par une table de
 * correspondance qu'il faudrait tenir pour vingt-sept pays.
 */
export const CHAMPS_SOCIETE = [
  { nom: 'nom', libelle: 'Raison sociale', requis: true, groupe: 'identite', taille: 200 },
  { nom: 'forme_juridique', libelle: 'Forme juridique', groupe: 'identite', taille: 120, exemple: 'Société à responsabilité limitée' },
  { nom: 'numero_registre_nom', libelle: 'Nom du registre', groupe: 'identite', taille: 20, exemple: 'KRS', aide: 'KRS en Pologne, BCE en Belgique, SIREN en France.' },
  { nom: 'numero_registre', libelle: 'Numéro au registre', groupe: 'identite', taille: 60, exemple: '0000000000' },
  { nom: 'tva', libelle: 'Numéro de TVA', groupe: 'identite', taille: 20, exemple: 'PL0000000000', aide: 'Avec le préfixe pays. C’est ce numéro que VIES vérifie.' },
  { nom: 'numero_stat', libelle: 'Numéro statistique', groupe: 'identite', taille: 40, exemple: '000000000', aide: 'REGON en Pologne. Sans usage fiscal, mais attendu sur les documents polonais.' },

  { nom: 'adresse', libelle: 'Adresse du siège', groupe: 'adresse', zone: true },
  { nom: 'code_postal', libelle: 'Code postal', groupe: 'adresse', taille: 20, exemple: '1000' },
  { nom: 'ville', libelle: 'Ville', groupe: 'adresse', taille: 120, exemple: 'Bruxelles' },
  { nom: 'pays', libelle: 'Pays', groupe: 'adresse', taille: 2, exemple: 'PL' },

  { nom: 'email', libelle: 'Courriel de facturation', groupe: 'contact', type: 'email', taille: 200 },
  { nom: 'telephone', libelle: 'Téléphone', groupe: 'contact', taille: 40 },
  { nom: 'site_web', libelle: 'Site web', groupe: 'contact', taille: 255 },

  { nom: 'iban', libelle: 'IBAN', groupe: 'banque', taille: 40 },
  { nom: 'bic', libelle: 'BIC', groupe: 'banque', taille: 20 },
  { nom: 'banque', libelle: 'Banque', groupe: 'banque', taille: 160 },
  { nom: 'devise', libelle: 'Devise de facturation', groupe: 'banque', taille: 3, exemple: 'EUR' },
  { nom: 'stripe_compte', libelle: 'Compte Stripe connecté', groupe: 'banque', taille: 60, exemple: 'acct_1A2b3C4d5E6f7G8h', aide: 'L’identifiant du compte, jamais la clé. La clé se pose en variable d’environnement sur le serveur.' },

  { nom: 'mention_pied', libelle: 'Mention de pied de document', groupe: 'documents', zone: true, aide: 'Conditions de paiement, tribunal compétent. S’imprime sous chaque offre et chaque contrat.' },
];

export const GROUPES_SOCIETE = [
  { cle: 'identite', titre: 'Identité', aide: 'Ce qui figure en tête de chaque document. L’import VIES remplit la raison sociale et l’adresse.' },
  { cle: 'adresse', titre: 'Siège', aide: 'L’adresse fiscale. Une adresse de correspondance différente se met dans la mention de pied.' },
  { cle: 'contact', titre: 'Contact', aide: 'Où le client répond, et où il réclame une facture.' },
  { cle: 'banque', titre: 'Encaissement', aide: 'Le virement d’abord — c’est ce qui figure sur la facture. Stripe ensuite, pour les paiements par carte.' },
  { cle: 'documents', titre: 'Documents', aide: 'Le bas de page, qui change plus souvent que le reste.' },
];

/** Toutes les sociétés, celle par défaut en tête. */
export async function listerSocietes() {
  const db = await connexion();
  const lignes = await db.requete(
    `SELECT * FROM ${table('societes')} ORDER BY defaut DESC, nom`,
  );
  return lignes.map(normaliser);
}

/**
 * La société qui facture.
 *
 * Celle marquée par défaut, sinon la première active. Un repli plutôt qu'une
 * erreur : un document à éditer ne doit pas s'arrêter parce que personne n'a
 * coché la case, et l'écran de réglages dit qu'aucune n'est marquée.
 */
export async function societeEmettrice() {
  const toutes = (await listerSocietes()).filter((s) => s.actif);
  return toutes.find((s) => s.defaut) || toutes[0] || null;
}

/** Une société par son identifiant. */
export async function chargerSociete(id) {
  const db = await connexion();
  const lignes = await db.requete(`SELECT * FROM ${table('societes')} WHERE id = ? LIMIT 1`, [Number(id)]);
  return lignes[0] ? normaliser(lignes[0]) : null;
}

function normaliser(ligne) {
  return { ...ligne, actif: Boolean(ligne.actif), defaut: Boolean(ligne.defaut) };
}

/** Nettoie une saisie de formulaire. Les longueurs viennent des colonnes. */
function propre(valeurs) {
  const sortie = {};
  for (const c of CHAMPS_SOCIETE) {
    let v = String(valeurs[c.nom] ?? '').trim();
    if (c.requis && !v) throw new Error(`« ${c.libelle} » est obligatoire.`);
    if (c.nom === 'pays' || c.nom === 'devise') v = v.toUpperCase();
    if (c.nom === 'tva' || c.nom === 'iban' || c.nom === 'bic') v = v.replace(/\s/g, '').toUpperCase();
    if (c.taille) v = v.slice(0, c.taille);
    sortie[c.nom] = v || null;
  }
  // Un compte Stripe se reconnaît à son préfixe. Refuser tôt évite une
  // interrogation qui échouera avec un message beaucoup moins clair.
  if (sortie.stripe_compte && !/^acct_[A-Za-z0-9]+$/.test(sortie.stripe_compte)) {
    throw new Error('Un compte Stripe connecté commence par « acct_ ». Ce n’est pas une clé secrète — celle-là ne se saisit jamais ici.');
  }
  return sortie;
}

/** Crée une société. La première créée devient celle qui facture. */
export async function ajouterSociete(valeurs) {
  const v = propre(valeurs);
  const db = await connexion();
  const existantes = await db.requete(`SELECT id FROM ${table('societes')}`);
  const cle = String(valeurs.cle || v.nom)
    .toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || `societe-${Date.now()}`;

  const colonnes = [...CHAMPS_SOCIETE.map((c) => c.nom), 'cle', 'defaut', 'actif', 'maj_le'];
  const params = [
    ...CHAMPS_SOCIETE.map((c) => v[c.nom]),
    cle, vrai(existantes.length === 0), vrai(true), new Date(),
  ];
  await db.executer(
    `INSERT INTO ${table('societes')} (${colonnes.join(', ')}) VALUES (${colonnes.map(() => '?').join(', ')})`,
    params,
  );
  viderCache();
}

/** Enregistre une société existante. */
export async function enregistrerSociete(id, valeurs) {
  const v = propre(valeurs);
  const db = await connexion();
  const avant = await chargerSociete(id);
  const sets = CHAMPS_SOCIETE.map((c) => `${c.nom} = ?`);
  const params = CHAMPS_SOCIETE.map((c) => v[c.nom]);

  // Changer le numéro de TVA périme la vérification : garder la date d'une
  // vérification faite sur un autre numéro serait exactement le genre de
  // preuve qui se retourne contre soi.
  if (avant && avant.tva !== v.tva) {
    sets.push('tva_verifiee_le = ?', 'tva_verifiee_ref = ?');
    params.push(null, null);
  }
  // De même pour Stripe : un autre compte, un autre état.
  if (avant && avant.stripe_compte !== v.stripe_compte) {
    sets.push('stripe_etat = ?', 'stripe_verifie_le = ?');
    params.push(null, null);
  }
  sets.push('maj_le = ?');
  params.push(new Date(), Number(id));
  await db.executer(`UPDATE ${table('societes')} SET ${sets.join(', ')} WHERE id = ?`, params);
  viderCache();
}

/** Désigne la société qui facture. Une seule à la fois. */
export async function designerSociete(id) {
  const db = await connexion();
  await db.executer(`UPDATE ${table('societes')} SET defaut = ?`, [vrai(false)]);
  await db.executer(
    `UPDATE ${table('societes')} SET defaut = ?, actif = ? WHERE id = ?`,
    [vrai(true), vrai(true), Number(id)],
  );
  viderCache();
}

/** Note le résultat d'une vérification VIES sur la société. */
export async function noterViesSociete(id, resultat) {
  const db = await connexion();
  await db.executer(
    `UPDATE ${table('societes')} SET tva_verifiee_le = ?, tva_verifiee_ref = ? WHERE id = ?`,
    [new Date(), (resultat.reference || '').slice(0, 60) || null, Number(id)],
  );
  viderCache();
}

/** Note ce que Stripe a répondu, pour ne pas le redemander à chaque page. */
export async function noterStripe(id, etat) {
  const db = await connexion();
  await db.executer(
    `UPDATE ${table('societes')} SET stripe_etat = ?, stripe_verifie_le = ? WHERE id = ?`,
    [String(etat || '').slice(0, 40) || null, new Date(), Number(id)],
  );
  viderCache();
}

/**
 * L'en-tête d'un document.
 *
 * Une seule fonction pour que l'offre, le contrat et la facture disent la
 * même chose. Chaque ligne vide disparaît : une adresse sans code postal ne
 * doit pas imprimer une ligne blanche au milieu du bloc.
 */
export function enTeteSociete(societe) {
  if (!societe) return [];
  const registre = societe.numero_registre
    ? `${societe.numero_registre_nom || 'Registre'} ${societe.numero_registre}`
    : '';
  const ville = [societe.code_postal, societe.ville].filter(Boolean).join(' ');
  return [
    societe.nom,
    societe.forme_juridique,
    societe.adresse,
    [ville, societe.pays].filter(Boolean).join(', '),
    [registre, societe.tva && `TVA ${societe.tva}`, societe.numero_stat && `REGON ${societe.numero_stat}`]
      .filter(Boolean).join(' · '),
    societe.iban && `IBAN ${societe.iban}${societe.bic ? ` · BIC ${societe.bic}` : ''}`,
  ].filter((l) => String(l || '').trim());
}
