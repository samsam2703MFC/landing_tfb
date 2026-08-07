/**
 * Ce qu'un client est devenu après la signature.
 *
 * La fiche répondait à « qui est ce client » — coordonnées, offres, dossier.
 * Elle ne répondait à aucune des quatre questions qu'on pose ensuite, et dont
 * chacune obligeait à ouvrir un écran différent du rail, filtré à la main :
 *
 *   · **que s'est-il passé chez lui** — journal technique ;
 *   · **ses applications tournent-elles, et sur quelles API** ;
 *   · **qu'a-t-il acheté** — modules et packs ;
 *   · **qu'est-ce qui lui est facturé**.
 *
 * Un fichier plutôt que quatre fonctions dispersées dans `donnees.mjs`, qui en
 * porte déjà trois mille lignes : ces quatre-là ont en commun de partir d'un
 * `prospect_id` et de traverser des tables que rien d'autre ne relie.
 *
 * Une limite tenue partout : **rien n'est inventé**. Là où la donnée n'existe
 * pas — les encaissements, notamment — l'écran le dit au lieu d'afficher un
 * zéro qui se lirait comme « rien à payer ».
 */
import { connexion, lireJson, table } from '../db.mjs';
import { montantsDeLOffre } from './commissions.mjs';
import { normaliserOffre } from './donnees.mjs';

/* ------------------------------------------------------ journal technique -- */

/**
 * Tout ce qui a été fait à ce client, dans l'ordre inverse du temps.
 *
 * Quatre sources cousues en un seul fil. Séparées, elles obligent à comparer
 * des horodatages d'un onglet à l'autre pour répondre à « la synchro a cassé
 * après quoi ? » — la question qui justifie à elle seule ce journal.
 *
 * Le rebut n'est **pas** déplié : une reprise qui rejette trois mille lignes
 * produirait trois mille entrées et noierait tout le reste. Le passage porte
 * son compte, et l'écran du rebut porte le détail.
 */
export async function journalTechnique(prospectId, { limite = 150 } = {}) {
  const db = await connexion();
  const id = Number(prospectId);

  const [parcours, passages, chartes, jetons] = await Promise.all([
    db.requete(
      `SELECT j.quand, j.type, j.texte, j.detail, u.nom AS qui, u.identifiant AS qui_id
         FROM ${table('parcours_journal')} j
         JOIN ${table('parcours')} p ON p.id = j.parcours_id
         LEFT JOIN ${table('utilisateurs')} u ON u.id = j.utilisateur_id
        WHERE p.prospect_id = ?
        ORDER BY j.quand DESC, j.id DESC`,
      [id],
    ),
    db.requete(
      `SELECT s.debut_le, s.fin_le, s.statut, s.lues, s.inserees, s.doublons, s.rejetees,
              s.code_erreur, c.libelle AS connexion
         FROM ${table('sync_passages')} s
         JOIN ${table('connexions')} c ON c.id = s.connexion_id
        WHERE c.prospect_id = ?
        ORDER BY s.debut_le DESC, s.id DESC`,
      [id],
    ),
    db.requete(
      `SELECT version, publie_le, publie_par, modifiees
         FROM ${table('charte_journal')}
        WHERE prospect_id = ? AND (portee = 'client' OR portee IS NULL)
        ORDER BY version DESC`,
      [id],
    ),
    db.requete(
      `SELECT j.cree_le, j.libelle, j.actif, j.cree_par, a.nom AS application
         FROM ${table('jetons')} j
         LEFT JOIN ${table('applications')} a ON a.id = j.application_id
        WHERE j.prospect_id = ?
        ORDER BY j.cree_le DESC`,
      [id],
    ),
  ]);

  const entrees = [];

  for (const l of parcours) {
    entrees.push({
      quand: l.quand,
      source: 'Onboarding',
      titre: l.texte || l.type,
      detail: resumerDetail(lireJson(l.detail, null)),
      qui: l.qui || l.qui_id || null,
      // Le parcours nomme ses propres échecs ; on ne les réinterprète pas.
      gravite: /echec|erreur|bloqu/i.test(String(l.type)) ? 'erreur' : 'info',
    });
  }

  for (const s of passages) {
    const rejets = Number(s.rejetees) || 0;
    entrees.push({
      quand: s.fin_le || s.debut_le,
      source: 'Synchronisation',
      titre: `${s.connexion || 'Connexion'} — ${DIT_PASSAGE[s.statut] || s.statut}`,
      detail: [
        `${Number(s.lues) || 0} lue(s)`,
        `${Number(s.inserees) || 0} insérée(s)`,
        `${Number(s.doublons) || 0} doublon(s)`,
        // Le rebut n'apparaît que s'il y en a : « 0 rejetée » sur chaque ligne
        // fait du bruit et fait manquer les lignes où le compte n'est pas nul.
        rejets > 0 ? `${rejets} rejetée(s)` : null,
        s.code_erreur || null,
      ].filter(Boolean).join(' · '),
      qui: null,
      gravite: s.statut === 'echec' ? 'erreur' : (s.statut === 'partiel' || rejets > 0) ? 'attention' : 'info',
    });
  }

  for (const c of chartes) {
    const champs = Object.keys(lireJson(c.modifiees, {}) || {});
    entrees.push({
      quand: c.publie_le,
      source: 'Charte',
      titre: `Charte publiée en version ${c.version}`,
      detail: champs.length > 0 ? `${champs.length} variable(s) : ${champs.slice(0, 6).join(', ')}${champs.length > 6 ? '…' : ''}` : null,
      qui: c.publie_par || null,
      gravite: 'info',
    });
  }

  for (const j of jetons) {
    entrees.push({
      quand: j.cree_le,
      source: 'Accès',
      titre: `Jeton créé pour ${j.application || 'une application'}`,
      // Un jeton révoqué n'a pas de date de révocation en base : on ne peut
      // dire que son état d'aujourd'hui, et il vaut mieux le dire que laisser
      // croire que le jeton de cette ligne fonctionne encore.
      detail: [j.libelle || null, Number(j.actif) ? null : 'révoqué depuis'].filter(Boolean).join(' · ') || null,
      qui: j.cree_par || null,
      gravite: 'info',
    });
  }

  const horodate = (v) => new Date(v || 0).getTime() || 0;
  entrees.sort((a, b) => horodate(b.quand) - horodate(a.quand));

  return {
    entrees: entrees.slice(0, limite),
    total: entrees.length,
    // La coupe est dite plutôt que subie : un journal tronqué en silence se lit
    // comme un journal complet, et c'est justement l'entrée manquante qu'on
    // cherchait.
    tronque: entrees.length > limite,
    // De quoi savoir si un journal vide veut dire « rien fait » ou « rien
    // branché » — deux situations qui n'appellent pas le même geste.
    sources: {
      onboarding: parcours.length,
      synchronisation: passages.length,
      charte: chartes.length,
      acces: jetons.length,
    },
  };
}

const DIT_PASSAGE = {
  file: 'en file',
  en_cours: 'en cours',
  succes: 'réussi',
  partiel: 'partiel',
  echec: 'échec',
};

/** Un objet de détail ramené à une ligne lisible, ou rien. */
function resumerDetail(detail) {
  if (!detail || typeof detail !== 'object') return null;
  const paires = Object.entries(detail)
    .filter(([, v]) => v !== null && v !== undefined && v !== '' && typeof v !== 'object')
    .slice(0, 4)
    .map(([k, v]) => `${k} : ${v}`);
  return paires.length > 0 ? paires.join(' · ') : null;
}

/* ------------------------------------------------------------- les PWA ---- */

/**
 * Les applications de ce client, et ce qu'elles ont le droit de lire.
 *
 * Le couple qui compte est `(application, client)`, porté par le jeton : c'est
 * lui qui dit à la fois quelle application tourne et sur quelle base elle lit.
 * Une application sans jeton pour ce client-ci n'est pas la sienne, même si
 * elle existe pour d'autres.
 *
 * « En fonction » veut dire quelque chose de précis, et rien de plus : un
 * jeton actif, non expiré, **et déjà appelé au moins une fois**. Une PWA
 * livrée dont personne ne s'est jamais servi n'est pas en fonction, et compter
 * les jetons distribués comme des applications vivantes est exactement
 * l'erreur qui fait dire « tout tourne » d'un déploiement mort.
 */
export async function applicationsDuClient(prospectId) {
  const db = await connexion();
  const id = Number(prospectId);

  const jetons = await db.requete(
    `SELECT j.id, j.libelle, j.quatre, j.actif, j.expire_le, j.cree_le, j.vu_le, j.appels,
            j.application_id, a.cle AS application_cle, a.nom AS application_nom, a.actif AS application_active
       FROM ${table('jetons')} j
       LEFT JOIN ${table('applications')} a ON a.id = j.application_id
      WHERE j.prospect_id = ?
      ORDER BY j.actif DESC, j.cree_le DESC`,
    [id],
  );
  if (jetons.length === 0) return { applications: [], en_fonction: 0, jetons: 0 };

  // Les endpoints ne sont demandés que pour les applications réellement
  // présentes : la bibliothèque en compte plusieurs dizaines, dont ce client
  // ne voit qu'une poignée.
  const ids = [...new Set(jetons.map((j) => Number(j.application_id)).filter(Boolean))];
  const trous = ids.map(() => '?').join(', ');
  const liens = ids.length
    ? await db.requete(
      `SELECT ea.application_id, e.cle, e.nom, e.source, e.statut, e.portee, e.max_lignes
         FROM ${table('endpoint_applications')} ea
         JOIN ${table('endpoints')} e ON e.id = ea.endpoint_id
        WHERE ea.application_id IN (${trous})
        ORDER BY e.cle`,
      ids,
    )
    : [];

  const maintenant = Date.now();
  const expire = (v) => Boolean(v) && new Date(v).getTime() < maintenant;

  const parApplication = new Map();
  for (const j of jetons) {
    const cle = Number(j.application_id) || 0;
    if (!parApplication.has(cle)) {
      parApplication.set(cle, {
        id: cle,
        cle: j.application_cle || null,
        nom: j.application_nom || `Application ${cle}`,
        // Une application désactivée globalement dont ce client a un jeton
        // actif : le jeton ne sert plus, et rien ne le disait sur cet écran.
        application_active: j.application_nom ? Boolean(Number(j.application_active)) : true,
        // Une application supprimée dont le jeton subsiste. La jointure ne
        // rend rien, et il faut le dire plutôt que d'afficher un nom inventé.
        orpheline: !j.application_nom,
        jetons: [],
        appels: 0,
        dernier_appel: null,
        endpoints: [],
      });
    }
    const app = parApplication.get(cle);
    const perime = expire(j.expire_le);
    const vivant = Boolean(Number(j.actif)) && !perime;
    app.jetons.push({
      id: Number(j.id),
      libelle: j.libelle || null,
      masque: j.quatre ? `••••${j.quatre}` : '••••',
      actif: Boolean(Number(j.actif)),
      expire: perime,
      expire_le: j.expire_le || null,
      cree_le: j.cree_le || null,
      vu_le: j.vu_le || null,
      appels: Number(j.appels) || 0,
      vivant,
    });
    app.appels += Number(j.appels) || 0;
    if (j.vu_le && (!app.dernier_appel || new Date(j.vu_le) > new Date(app.dernier_appel))) {
      app.dernier_appel = j.vu_le;
    }
  }

  for (const l of liens) {
    const app = parApplication.get(Number(l.application_id));
    if (app) {
      app.endpoints.push({
        cle: l.cle,
        nom: l.nom,
        source: l.source,
        statut: l.statut,
        portee: l.portee,
        max_lignes: Number(l.max_lignes) || 0,
      });
    }
  }

  const applications = [...parApplication.values()].map((a) => ({ ...a, ...etatApplication(a) }));

  applications.sort((a, b) => {
    if (a.en_fonction !== b.en_fonction) return a.en_fonction ? -1 : 1;
    return (b.appels || 0) - (a.appels || 0) || a.nom.localeCompare(b.nom);
  });

  return {
    applications,
    en_fonction: applications.filter((a) => a.en_fonction).length,
    jetons: jetons.length,
  };
}

/**
 * L'état d'une application chez un client, en trois questions séparées.
 *
 * Séparées parce qu'elles appellent des gestes différents, et que les fondre
 * en un seul « ça marche / ça ne marche pas » perdrait exactement ce qui dit
 * quoi faire :
 *
 *   · **en fonction** — un jeton utilisable ET déjà utilisé. Compter les
 *     jetons distribués comme des applications vivantes est l'erreur qui fait
 *     dire « tout tourne » d'un déploiement mort ;
 *   · **jamais appelée** — livrée, valable, jamais servie. Ce n'est pas une
 *     panne : c'est une mise en service qui n'a pas eu lieu, et confondre les
 *     deux envoie chercher un bug là où il faut passer un coup de fil ;
 *   · **sans API** — un jeton et aucun endpoint lié. L'application ne peut
 *     rien lire ; tout appel repartira en 403, sans que rien ne l'explique.
 */
export function etatApplication({ jetons = [], appels = 0, endpoints = [] } = {}) {
  const vivants = jetons.filter((j) => j.vivant).length;
  return {
    jetons_vivants: vivants,
    en_fonction: vivants > 0 && appels > 0,
    jamais_appelee: vivants > 0 && appels === 0,
    sans_api: endpoints.length === 0,
  };
}

/* ------------------------------------------------------------- modules ---- */

/**
 * Ce que ce client a acheté — modules, packs, socle, option applicative.
 *
 * La source est **une** offre et non l'union de toutes : deux offres
 * successives se contredisent par construction (la seconde existe parce que la
 * première ne convenait pas), et les additionner afficherait un périmètre que
 * personne n'a jamais vendu.
 *
 * L'offre retenue, dans l'ordre : celle du contrat signé le plus récent, sinon
 * l'offre la plus récente. La première est ce qui est dû, la seconde ce qui est
 * proposé — l'écran dit toujours laquelle il montre.
 */
export async function modulesDuClient(prospectId) {
  const db = await connexion();
  const id = Number(prospectId);

  const [contrats, offres, catalogue] = await Promise.all([
    db.requete(
      `SELECT c.offre_id, c.reference, c.statut, c.signe_le
         FROM ${table('contrats')} c
        WHERE c.prospect_id = ? AND c.statut = 'signe'
        ORDER BY c.signe_le DESC, c.id DESC`,
      [id],
    ),
    db.requete(
      `SELECT * FROM ${table('offres')} WHERE prospect_id = ?
        ORDER BY cree_le DESC, id DESC`,
      [id],
    ),
    db.requete(`SELECT slug, nom, groupe, pack, actif FROM ${table('modules')}`),
  ]);

  const signe = contrats[0] || null;
  const offre = signe
    ? offres.find((o) => Number(o.id) === Number(signe.offre_id)) || offres[0] || null
    : offres[0] || null;
  if (!offre) return { source: null, modules: [], packs: [], vues: [] };

  const config = normaliserOffre(offre);
  const connu = new Map(catalogue.map((m) => [m.slug, m]));

  // Les modules qu'un pack comprend ne se facturent pas à l'unité. La
  // distinction se voit sur le devis ; elle doit se voir ici aussi, sinon la
  // somme des lignes ne retombe pas sur le montant du contrat.
  const dansUnPack = new Set(
    (config.packs || []).flatMap((p) => (p.modules || []).map((m) => m.slug)),
  );

  const modules = (config.modules || []).map((m) => {
    const fiche = connu.get(m.slug) || null;
    return {
      slug: m.slug,
      nom: m.nom || fiche?.nom || m.slug,
      groupe: fiche?.groupe || null,
      prix_cents: Number(m.prix_cents) || 0,
      compris_dans_pack: dansUnPack.has(m.slug),
      // Un module vendu puis retiré du catalogue : le contrat l'engage
      // toujours. Le taire ferait disparaître un engagement de l'écran.
      hors_catalogue: !fiche,
      retire: Boolean(fiche) && !Number(fiche.actif),
    };
  });

  return {
    source: {
      reference: offre.reference,
      version: Number(offre.version) || 1,
      statut: offre.statut,
      // Ce qui est dû, ou ce qui est proposé : deux lectures différentes du
      // même tableau, et l'écran ne doit pas laisser deviner laquelle.
      contrat: signe ? { reference: signe.reference, signe_le: signe.signe_le } : null,
    },
    modules,
    packs: (config.packs || []).map((p) => ({
      cle: p.cle,
      nom: p.nom || p.cle,
      prix_cents: Number(p.prix_cents) || 0,
      unite: p.unite || null,
      base: Boolean(p.base),
      avec_caisse: Boolean(p.avec_caisse),
      modules: p.modules || [],
    })),
    // `socle_pos` tranche entre notre caisse et l'intégration de la sienne :
    // c'est le choix qui décide de tout l'onboarding technique.
    socle_pos: config.socle_pos || 'pos',
    option_app: config.option_app || 'aucune',
    vues: config.vues || [],
    postes: {
      equipes: Number(config.nombre_postes) || 0,
      franchiseur: Number(config.postes_franchiseur) || 0,
      onboardes: Number(config.postes_onboardes) || 0,
    },
  };
}

/* ------------------------------------------------------------- contrats --- */

/**
 * Ses contrats, du côté du papier et de la signature.
 *
 * L'onglet Facturation dit ce que chaque contrat engage en euros. Celui-ci dit
 * où en est le document : généré, parti, signé, et par quel prestataire. Ce
 * sont deux questions qui ne se posent jamais le même jour — l'une au moment
 * de facturer, l'autre pendant qu'on attend une signature.
 */
export async function contratsDuClient(prospectId) {
  const db = await connexion();
  const id = Number(prospectId);

  const [lignes, pieces] = await Promise.all([
    db.requete(
      `SELECT c.id, c.reference, c.statut, c.genere_le, c.envoye_le, c.signe_le,
              c.date_effet, c.duree_mois, c.preavis_jours, c.reconduction,
              c.signature_service, c.signature_enveloppe, c.signature_statut, c.signature_maj_le,
              o.reference AS offre_reference, o.version AS offre_version,
              u.nom AS auteur_nom, u.identifiant AS auteur_identifiant
         FROM ${table('contrats')} c
         LEFT JOIN ${table('offres')} o ON o.id = c.offre_id
         LEFT JOIN ${table('utilisateurs')} u ON u.id = c.cree_par
        WHERE c.prospect_id = ?
        ORDER BY c.signe_le DESC, c.id DESC`,
      [id],
    ),
    db.requete(
      `SELECT contrat_id, type, nom FROM ${table('pieces')} WHERE prospect_id = ?`,
      [id],
    ),
  ]);

  const contrats = lignes.map((c) => {
    const siennes = pieces.filter((p) => Number(p.contrat_id) === Number(c.id));
    return {
      ...c,
      duree_mois: Number(c.duree_mois) || 0,
      preavis_jours: Number(c.preavis_jours) || 0,
      pieces: siennes,
      // Le PDF signé déposé au dossier. Un contrat « signé » chez le
      // prestataire mais sans pièce au dossier, c'est un document qu'on ne
      // pourra pas produire le jour où on en aura besoin.
      signe_au_dossier: siennes.some((p) => p.type === 'contrat_signe'),
      // Parti en signature et toujours pas revenu. Ce n'est pas une erreur —
      // c'est ce qu'il faut relancer.
      en_attente: c.statut === 'envoye',
    };
  });

  return {
    contrats,
    signes: contrats.filter((c) => c.statut === 'signe').length,
    en_attente: contrats.filter((c) => c.en_attente).length,
    // Ce que le contrat dit signé et que le dossier ne porte pas.
    sans_piece: contrats.filter((c) => c.statut === 'signe' && !c.signe_au_dossier),
  };
}

/* --------------------------------------------------------- facturation ---- */

/**
 * Ce qui est facturé à ce client — et ce que l'application ne sait pas.
 *
 * Il faut le dire d'emblée : **aucune facture émise, aucun encaissement n'est
 * enregistré ici**. Il n'y a pas de table pour ça, et aucune synchronisation
 * de facturation n'existe. Ce que cet écran porte est donc l'engagement
 * contractuel, pas un compte client.
 *
 * Le choix assumé est d'afficher cette limite plutôt qu'un solde à zéro. Un
 * zéro se lit « il ne doit rien » ; ici la vérité est « on ne sait pas », et
 * les deux n'appellent pas du tout le même geste. C'est la même règle que sur
 * les commissions, où le mot tenu est « projeté » et jamais « dû ».
 */
export async function facturationDuClient(prospectId) {
  const db = await connexion();
  const id = Number(prospectId);

  const [prospect] = await db.requete(
    `SELECT delai_paiement_jours, mandat_sepa, iban, bic, facturation_adresse, facturation_email, devise
       FROM ${table('prospects')} WHERE id = ? LIMIT 1`,
    [id],
  );

  const contrats = await db.requete(
    `SELECT o.*, c.id, c.reference, c.statut, c.duree_mois, c.signe_le, c.date_effet,
            c.preavis_jours, c.reconduction, c.offre_id, o.reference AS offre_reference
       FROM ${table('contrats')} c
       LEFT JOIN ${table('offres')} o ON o.id = c.offre_id
      WHERE c.prospect_id = ?
      ORDER BY c.signe_le DESC, c.id DESC`,
    [id],
  );

  let unique = 0;
  let mensuel = 0;
  const lignes = contrats.map((c) => {
    let montants = null;
    // Une offre illisible ne doit pas faire tomber l'écran : la ligne le dit,
    // et les autres continuent d'être chiffrées.
    try {
      montants = montantsDeLOffre(c);
    } catch {
      montants = null;
    }
    // Seuls les contrats signés entrent dans le total : un brouillon chiffré
    // gonflerait un montant qui a l'air d'être dû.
    if (montants && c.statut === 'signe') {
      unique += montants.unique_cents;
      mensuel += montants.mensuel_cents;
    }
    return {
      reference: c.reference,
      offre: c.offre_reference || null,
      statut: c.statut,
      signe_le: c.signe_le || null,
      date_effet: c.date_effet || null,
      duree_mois: Number(c.duree_mois) || 0,
      preavis_jours: Number(c.preavis_jours) || 0,
      reconduction: c.reconduction || null,
      mois_offerts: Number(c.mois_offerts) || 0,
      // Le premier mois réellement facturé. Les mois offerts ne sont pas une
      // remise — le prix ne bouge pas — ils décalent le début.
      premiere_echeance: premiereEcheance(c.date_effet, Number(c.mois_offerts) || 0),
      montants,
    };
  });

  const signes = lignes.filter((l) => l.statut === 'signe');

  return {
    conditions: {
      delai_paiement_jours: Number(prospect?.delai_paiement_jours) || 0,
      mandat_sepa: Boolean(Number(prospect?.mandat_sepa)),
      // Le numéro n'est jamais rendu : sa présence suffit à répondre à « peut-on
      // prélever ». L'afficher en entier mettrait un IBAN dans chaque capture
      // d'écran envoyée au support.
      iban_pose: Boolean(String(prospect?.iban || '').trim()),
      iban_fin: finIban(prospect?.iban),
      bic_pose: Boolean(String(prospect?.bic || '').trim()),
      facturation_adresse: prospect?.facturation_adresse || null,
      facturation_email: prospect?.facturation_email || null,
      devise: prospect?.devise || 'EUR',
    },
    contrats: lignes,
    engage: {
      unique_cents: signes.length > 0 ? unique : null,
      mensuel_cents: signes.length > 0 ? mensuel : null,
      contrats_signes: signes.length,
    },
    // Ce que l'application ne sait pas, écrit une fois pour toutes et lu par
    // l'écran : aucune facture, aucun encaissement, aucun impayé.
    connu: {
      factures: false,
      encaissements: false,
      pourquoi: 'Aucune facture ni encaissement n’est enregistré : l’application ne se branche à aucun outil de facturation. Ce qui suit est l’engagement contractuel, pas un compte client.',
    },
  };
}

/**
 * La date à laquelle le premier euro est réellement facturé.
 *
 * `setMonth` déborde : le 31 janvier plus un mois donne le 3 mars, parce que
 * février n'a pas de 31. Pour une échéance, ce glissement est faux — un
 * contrat qui prend effet le 31 se facture le dernier jour du mois, pas le
 * surlendemain. On rabat donc sur la fin du mois visé.
 */
export function premiereEcheance(dateEffet, moisOfferts) {
  if (!dateEffet) return null;
  const d = new Date(dateEffet);
  if (Number.isNaN(d.getTime())) return null;
  const mois = Number(moisOfferts) || 0;
  const jour = d.getUTCDate();
  const vise = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + mois, 1));
  // Le 0e jour du mois suivant, c'est le dernier du mois visé.
  const dernier = new Date(Date.UTC(vise.getUTCFullYear(), vise.getUTCMonth() + 1, 0)).getUTCDate();
  vise.setUTCDate(Math.min(jour, dernier));
  return vise.toISOString().slice(0, 10);
}

/**
 * Les quatre derniers caractères d'un IBAN, et rien d'autre.
 *
 * Jamais le numéro entier, nulle part. Sa présence répond à « peut-on
 * prélever » ; l'afficher le mettrait dans chaque capture d'écran envoyée au
 * support. Un numéro trop court ne rend rien plutôt qu'un fragment plus long
 * que prévu.
 */
export function finIban(iban) {
  const propre = String(iban || '').replace(/\s+/g, '');
  return propre.length >= 4 ? propre.slice(-4) : null;
}
