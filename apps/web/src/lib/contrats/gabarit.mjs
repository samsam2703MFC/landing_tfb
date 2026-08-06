/**
 * Le contrat : son gabarit, ses jetons, et le dossier qu'il exige.
 *
 * Rien ici ne touche à la base ni au réseau. C'est voulu : c'est la partie
 * qui décide si l'on a le droit d'éditer un contrat, et cette décision doit
 * pouvoir se tester en une ligne, sans serveur.
 *
 * Deux règles gouvernent le reste du module :
 *
 *   · **Un jeton inconnu n'est jamais remplacé par du vide.** Il reste écrit
 *     tel quel et remonte dans la liste des manques. Un contrat où
 *     « {iban} » s'est effacé tout seul se signe sans que personne ne voie
 *     le trou ; un contrat où « {iban} » est resté visible ne se signe pas.
 *   · **Le corps est figé à la génération.** Le gabarit se réécrit dans la
 *     console autant qu'on veut : le texte qu'un client a signé ne change
 *     plus. C'est la même règle que les tarifs recopiés sur une offre.
 */

/**
 * Les champs du dossier client, groupés comme ils se demandent.
 *
 * `requis` dit ce que le contrat ne peut pas fabriquer : on refuse d'éditer
 * sans. Le reste se remplit quand on l'a — un BIC se déduit d'un IBAN
 * européen, une adresse de facturation vaut celle du siège par défaut.
 */
export const CHAMPS_DOSSIER = [
  // L'entité qui signe. Sans elle, le contrat n'a pas de partie.
  { nom: 'forme_juridique', libelle: 'Forme juridique', groupe: 'entite', requis: true, exemple: 'SRL' },
  { nom: 'numero_registre', libelle: 'Numéro d’entreprise', groupe: 'entite', requis: true, exemple: 'BE 0123.456.789' },
  { nom: 'adresse_siege', libelle: 'Siège social', groupe: 'entite', requis: true, zone: true },

  // Qui signe, et de quel droit. « Gérant » ou « administrateur délégué » ne
  // se devine pas d'un prénom, et un contrat signé par quelqu'un sans
  // pouvoir n'engage personne.
  { nom: 'signataire_nom', libelle: 'Signataire', groupe: 'signature', requis: true },
  { nom: 'signataire_role', libelle: 'Qualité', groupe: 'signature', requis: true, exemple: 'Gérant' },
  { nom: 'signataire_email', libelle: 'Courriel du signataire', groupe: 'signature', requis: true, type: 'email' },
  {
    nom: 'signataire_pouvoir',
    libelle: 'Origine du pouvoir',
    groupe: 'signature',
    exemple: 'Statuts publiés au Moniteur du 12/03/2019',
  },

  // La facturation, qui n'est pas toujours à la même adresse que le siège —
  // franchiseur au centre, comptabilité ailleurs.
  { nom: 'facturation_adresse', libelle: 'Adresse de facturation', groupe: 'facturation', zone: true },
  { nom: 'facturation_email', libelle: 'Courriel de facturation', groupe: 'facturation', type: 'email' },
  { nom: 'iban', libelle: 'IBAN du franchiseur', groupe: 'facturation', requis: true, exemple: 'BE68 5390 0754 7034' },
  { nom: 'bic', libelle: 'BIC', groupe: 'facturation' },
  { nom: 'delai_paiement_jours', libelle: 'Délai de paiement', groupe: 'facturation', unite: 'j', nombre: true },
  { nom: 'mandat_sepa', libelle: 'Mandat de domiciliation signé', groupe: 'facturation', case: true },
];

export const GROUPES_DOSSIER = [
  { cle: 'entite', titre: 'L’entité qui signe', aide: "Ce qui identifie la société au registre : c'est elle qui s'engage, pas la personne en face de vous." },
  { cle: 'signature', titre: 'Le signataire', aide: 'Qui signe, et de quel droit. Un contrat signé par quelqu’un sans pouvoir n’engage personne.' },
  {
    cle: 'facturation',
    titre: 'Le compte du franchiseur',
    // Le sens de ce groupe se perdait derrière « Facturation et banque ».
    // C'est le compte sur lequel LE FRANCHISEUR est payé — les redevances de
    // ses franchisés, encaissées par la plateforme et reversées. Lu comme
    // « notre compte à nous », il se remplissait avec l'IBAN de TFB, et
    // l'erreur ne se voyait qu'au premier virement qui ne partait pas.
    aide: 'Sur quel compte le franchiseur est payé, et où part la facture. '
      + 'C’est SON IBAN, pas le nôtre.',
  },
];

/**
 * Les pièces du dossier.
 *
 * `requise` marque celles sans lesquelles on ne met pas un contrat en
 * signature. Les autres se réclament, mais ne bloquent pas : exiger une
 * attestation d'assurance pour éditer un contrat de service ferait attendre
 * un client pour une pièce qui arrivera de toute façon.
 */
export const TYPES_PIECE = [
  { cle: 'identite', libelle: 'Pièce d’identité du signataire', requise: true },
  { cle: 'registre', libelle: 'Extrait du registre des entreprises', requise: true },
  { cle: 'mandat', libelle: 'Mandat de domiciliation' },
  { cle: 'assurance', libelle: 'Attestation d’assurance' },
  { cle: 'licence', libelle: 'Licence ou autorisation d’exploiter' },
  { cle: 'contrat_signe', libelle: 'Contrat signé' },
  { cle: 'annexe', libelle: 'Annexe' },
  { cle: 'cgv', libelle: 'Conditions générales' },
  { cle: 'grille', libelle: 'Grille tarifaire' },
  { cle: 'autre', libelle: 'Autre' },
];

/** Vrai si la valeur compte comme renseignée. Zéro n'est pas vide. */
function rempli(valeur) {
  if (valeur === 0) return true;
  return String(valeur ?? '').trim() !== '';
}

/**
 * Ce qui manque au dossier d'un prospect pour éditer un contrat.
 *
 * Rend toujours la liste complète plutôt que le premier manque : on ne
 * rappelle pas un client quatre fois de suite pour lui demander un champ à
 * chaque appel.
 */
export function dossierComplet(prospect, { pieces = [] } = {}) {
  const manque = [];
  for (const champ of CHAMPS_DOSSIER) {
    if (!champ.requis) continue;
    if (!rempli(prospect ? prospect[champ.nom] : null)) {
      manque.push({ quoi: 'champ', nom: champ.nom, libelle: champ.libelle });
    }
  }
  // La raison sociale et le contact vivent sur la fiche du prospect depuis le
  // premier jour, mais un contrat sans eux n'existe pas non plus.
  for (const [nom, libelle] of [['raison_sociale', 'Raison sociale'], ['contact_email', 'Courriel du contact']]) {
    if (!rempli(prospect ? prospect[nom] : null)) manque.push({ quoi: 'champ', nom, libelle });
  }

  const deposees = new Set((pieces || []).map((p) => p.type));
  for (const type of TYPES_PIECE) {
    if (!type.requise) continue;
    if (!deposees.has(type.cle)) manque.push({ quoi: 'piece', nom: type.cle, libelle: type.libelle });
  }

  return { complet: manque.length === 0, manque };
}

/** Une date en JJ/MM/AAAA, ou une chaîne vide si elle n'existe pas. */
export function jourFr(valeur) {
  if (!valeur) return '';
  const d = valeur instanceof Date ? valeur : new Date(valeur);
  if (Number.isNaN(d.getTime())) return '';
  const n = (x) => String(x).padStart(2, '0');
  return `${n(d.getDate())}/${n(d.getMonth() + 1)}/${d.getFullYear()}`;
}

/**
 * Les valeurs des jetons, à partir de l'offre et du dossier.
 *
 * `recapitulatif` arrive tout fait : c'est le même texte que celui du
 * courriel de l'offre, et le refabriquer ici finirait par en donner deux
 * versions qui divergent.
 */
export function contexteContrat({
  offre = {},
  prospect = {},
  conditions = {},
  recapitulatif = '',
  aujourdhui = null,
} = {}) {
  const valeur = (x) => (x === 0 ? '0' : String(x ?? '').trim());
  return {
    reference: valeur(offre.reference),
    client: valeur(prospect.raison_sociale),
    forme_juridique: valeur(prospect.forme_juridique),
    numero_registre: valeur(prospect.numero_registre),
    adresse_siege: valeur(prospect.adresse_siege),
    signataire_nom: valeur(prospect.signataire_nom),
    signataire_role: valeur(prospect.signataire_role),
    signataire_email: valeur(prospect.signataire_email),
    signataire_pouvoir: valeur(prospect.signataire_pouvoir),
    // À défaut d'adresse de facturation propre, celle du siège : c'est le cas
    // le plus courant, et laisser le jeton en manque ferait refuser un
    // contrat parfaitement complet.
    facturation_adresse: valeur(prospect.facturation_adresse) || valeur(prospect.adresse_siege),
    facturation_email: valeur(prospect.facturation_email) || valeur(prospect.contact_email),
    iban: valeur(prospect.iban),
    bic: valeur(prospect.bic),
    delai_paiement_jours: valeur(prospect.delai_paiement_jours ?? 30),
    date_effet: jourFr(conditions.date_effet),
    duree_mois: valeur(conditions.duree_mois),
    preavis_jours: valeur(conditions.preavis_jours),
    reconduction: valeur(conditions.reconduction),
    date_du_jour: jourFr(aujourdhui || new Date()),
    recapitulatif: String(recapitulatif || ''),
  };
}

/**
 * Remplace les jetons d'un gabarit.
 *
 * Rend le texte **et** la liste de ce qui n'a pas pu être rempli : un jeton
 * inconnu du contexte, un jeton connu mais vide. L'appelant décide quoi en
 * faire — la fiche les affiche, l'envoi en signature les refuse.
 */
export function remplirGabarit(gabarit, contexte) {
  const inconnus = new Set();
  const vides = new Set();
  const texte = String(gabarit || '').replace(/\{([a-z_]+)\}/g, (entier, cle) => {
    if (!(cle in contexte)) {
      inconnus.add(cle);
      return entier;
    }
    const v = String(contexte[cle] ?? '');
    if (v.trim() === '') {
      vides.add(cle);
      return entier;
    }
    return v;
  });
  return { texte, inconnus: [...inconnus], vides: [...vides] };
}
