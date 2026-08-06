/**
 * La bibliothèque de gabarits de contrat.
 *
 * Il n'y en avait qu'un, rangé dans une ligne de la table des tarifs et
 * modifiable depuis l'écran « Tarifs » — un endroit où personne ne va chercher
 * un contrat. Un seul suffit tant qu'on ne vend qu'une chose ; il en faut un
 * par nature d'accord dès qu'un pilote, une franchise et un contrat-cadre ne
 * s'écrivent pas pareil.
 *
 * ── Ce qui vit avec le texte ───────────────────────────────────────────────
 *
 * La durée, le préavis et la reconduction. Ce sont des **clauses**, pas des
 * réglages : les laisser dans les paramètres généraux garantissait qu'un
 * pilote de trois mois parte avec la durée du contrat-cadre — et que le texte
 * l'écrive noir sur blanc, puisqu'il lit le même jeton.
 *
 * ── Ce qui est vérifié avant d'écrire ──────────────────────────────────────
 *
 * Les jetons. Un `{signataire_nom}` mal orthographié ne se voit pas à la
 * relecture d'un contrat de six pages ; il se voit le jour où le client reçoit
 * un document qui dit littéralement « {signatiare_nom} ». La vérification se
 * fait donc à l'enregistrement, contre la liste réelle des jetons — celle que
 * `contexteContrat()` produit, et pas une copie qui divergerait d'elle.
 */
import { connexion, estPostgres, table, viderCache } from '../db.mjs';
import { contexteContrat, remplirGabarit } from '../contrats/gabarit.mjs';
import { normaliserCle } from './donnees.mjs';

/**
 * Les jetons qu'un gabarit peut employer, dans l'ordre du contexte.
 *
 * Tirés de `contexteContrat()` lui-même : une liste écrite à la main ici
 * divergerait au premier champ ajouté, et l'écran d'aide proposerait un jeton
 * que le remplissage refuserait.
 */
export function jetonsConnus() {
  return Object.keys(contexteContrat({}));
}

/**
 * Ce qui ne va pas dans ce texte, avant qu'on l'enregistre.
 *
 * Deux choses seulement, et la distinction compte :
 *
 *   · **inconnus** — le jeton n'existe pas. C'est une faute de frappe, et le
 *     contrat partirait avec `{signatiare_nom}` écrit en toutes lettres. On
 *     refuse ;
 *   · **sans_jeton** — le gabarit n'en emploie aucun. Ce n'est pas une faute :
 *     un avenant peut être un texte fixe. On le signale sans refuser.
 */
export function verifierGabarit(corps) {
  const contexte = contexteContrat({});
  // Un contexte vide rend tous les jetons « vides » : ici on ne cherche que
  // les inconnus, et l'on ignore volontairement les vides.
  const { inconnus } = remplirGabarit(corps, contexte);
  const employes = [...new Set(
    [...String(corps || '').matchAll(/\{([a-z_]+)\}/g)].map((m) => m[1]),
  )].filter((j) => !inconnus.includes(j));
  return { inconnus, employes, sans_jeton: employes.length === 0 && inconnus.length === 0 };
}

/** Les gabarits, du plus employé au moins, avec leurs jetons relevés. */
export async function listerGabarits({ actifsSeulement = false } = {}) {
  const db = await connexion();
  const [lignes, usages] = await Promise.all([
    db.requete(`SELECT * FROM ${table('contrat_gabarits')} ORDER BY ordre, nom`),
    db.requete(
      `SELECT gabarit_cle, COUNT(*) AS total FROM ${table('contrats')}
        WHERE gabarit_cle IS NOT NULL AND gabarit_cle <> '' GROUP BY gabarit_cle`,
    ),
  ]);
  const compte = new Map(usages.map((u) => [u.gabarit_cle, Number(u.total)]));
  return lignes
    .filter((g) => (actifsSeulement ? Boolean(Number(g.actif)) : true))
    .map((g) => ({
      ...g,
      actif: Boolean(Number(g.actif)),
      defaut: Boolean(Number(g.defaut)),
      duree_mois: Number(g.duree_mois) || 0,
      preavis_jours: Number(g.preavis_jours) || 0,
      // Combien de contrats en sont sortis. C'est ce qui dit si un gabarit se
      // supprime sans conséquence, et ce qui empêche d'effacer par erreur
      // celui sous lequel quarante clients ont signé.
      contrats: compte.get(g.cle) || 0,
      ...verifierGabarit(g.corps),
    }));
}

/** Le gabarit à employer : celui qu'on nomme, sinon celui par défaut. */
export async function gabaritPour(cle = '') {
  const db = await connexion();
  const voulu = String(cle || '').trim();
  if (voulu) {
    const [g] = await db.requete(
      `SELECT * FROM ${table('contrat_gabarits')} WHERE cle = ? LIMIT 1`, [voulu],
    );
    // Un gabarit nommé mais absent est une erreur qu'il faut dire : se replier
    // en silence sur le défaut ferait signer d'autres clauses que celles
    // demandées, et personne ne s'en apercevrait.
    if (!g) throw new Error(`Le gabarit « ${voulu} » n’existe pas.`);
    return normaliser(g);
  }
  const [defaut] = await db.requete(
    `SELECT * FROM ${table('contrat_gabarits')} WHERE defaut = ? AND actif = ? LIMIT 1`,
    [vrai(true), vrai(true)],
  );
  return defaut ? normaliser(defaut) : null;
}

function normaliser(g) {
  return {
    ...g,
    actif: Boolean(Number(g.actif)),
    defaut: Boolean(Number(g.defaut)),
    duree_mois: Number(g.duree_mois) || 0,
    preavis_jours: Number(g.preavis_jours) || 0,
  };
}

// MySQL veut 1, Postgres veut true : la même valeur ne se lie pas pareil.
// Même helper que dans donnees.mjs — un booléen lié en 1 sur Postgres lève.
function vrai(valeur = true) {
  return estPostgres() ? Boolean(valeur) : valeur ? 1 : 0;
}

export async function ajouterGabarit(valeurs, qui = null) {
  const db = await connexion();
  const cle = normaliserCle(valeurs.nom);
  if (!cle) throw new Error('Un gabarit a besoin d’un nom.');
  const [dejaLa] = await db.requete(
    `SELECT id FROM ${table('contrat_gabarits')} WHERE cle = ? LIMIT 1`, [cle],
  );
  if (dejaLa) throw new Error(`Le gabarit « ${cle} » existe déjà.`);

  const corps = String(valeurs.corps || '');
  refuserJetonsInconnus(corps);

  await db.executer(
    `INSERT INTO ${table('contrat_gabarits')}
       (cle, nom, description, corps, duree_mois, preavis_jours, reconduction, defaut, actif, ordre, maj_le, maj_par)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      cle, String(valeurs.nom).trim(), String(valeurs.description || ''),
      corps,
      Number(valeurs.duree_mois) || 0, Number(valeurs.preavis_jours) || 0,
      String(valeurs.reconduction || ''),
      // Jamais par défaut à la création : on désigne le défaut d'un geste à
      // part, pour que ça ne se fasse pas sans y penser.
      vrai(false), vrai(true), Number(valeurs.ordre) || 100, new Date(), qui,
    ],
  );
  viderCache();
  return cle;
}

export async function enregistrerGabarit(cle, valeurs, qui = null) {
  const db = await connexion();
  const corps = String(valeurs.corps || '');
  refuserJetonsInconnus(corps);
  await db.executer(
    `UPDATE ${table('contrat_gabarits')}
        SET nom = ?, description = ?, corps = ?, duree_mois = ?, preavis_jours = ?,
            reconduction = ?, ordre = ?, maj_le = ?, maj_par = ?
      WHERE cle = ?`,
    [
      String(valeurs.nom || '').trim(), String(valeurs.description || ''), corps,
      Number(valeurs.duree_mois) || 0, Number(valeurs.preavis_jours) || 0,
      String(valeurs.reconduction || ''), Number(valeurs.ordre) || 100,
      new Date(), qui, String(cle),
    ],
  );
  viderCache();
}

/**
 * Refuse un texte qui emploie un jeton inexistant.
 *
 * À l'enregistrement et non à la génération : un gabarit fautif enregistré
 * aujourd'hui se découvre le jour où quelqu'un édite un contrat pour un
 * client qui attend, et c'est le pire moment.
 */
function refuserJetonsInconnus(corps) {
  const { inconnus } = verifierGabarit(corps);
  if (inconnus.length > 0) {
    throw new Error(
      `Ces jetons n’existent pas : ${inconnus.map((j) => `{${j}}`).join(', ')}. `
      + `Les jetons disponibles sont listés sous l’éditeur.`,
    );
  }
}

/** Le gabarit pris quand personne ne choisit. Un seul à la fois. */
export async function designerGabaritDefaut(cle) {
  const db = await connexion();
  const [g] = await db.requete(
    `SELECT actif FROM ${table('contrat_gabarits')} WHERE cle = ? LIMIT 1`, [String(cle)],
  );
  if (!g) throw new Error('Ce gabarit n’existe pas.');
  if (!Number(g.actif)) {
    throw new Error('Un gabarit retiré ne peut pas être le gabarit par défaut : réactivez-le d’abord.');
  }
  await db.executer(`UPDATE ${table('contrat_gabarits')} SET defaut = ?`, [vrai(false)]);
  await db.executer(`UPDATE ${table('contrat_gabarits')} SET defaut = ? WHERE cle = ?`, [vrai(true), String(cle)]);
  viderCache();
}

/** Retire ou remet un gabarit dans la liste des choix. */
export async function basculerGabarit(cle, actif) {
  const db = await connexion();
  const allume = Boolean(actif);
  // Retirer le gabarit par défaut laisserait la génération sans repli et sans
  // rien pour le dire. On refuse : il faut d'abord en désigner un autre.
  if (!allume) {
    const [g] = await db.requete(
      `SELECT defaut FROM ${table('contrat_gabarits')} WHERE cle = ? LIMIT 1`, [String(cle)],
    );
    if (g && Number(g.defaut)) {
      throw new Error('C’est le gabarit par défaut : désignez-en un autre avant de le retirer.');
    }
  }
  await db.executer(
    `UPDATE ${table('contrat_gabarits')} SET actif = ? WHERE cle = ?`,
    [vrai(allume), String(cle)],
  );
  viderCache();
}

/**
 * Supprime un gabarit dont aucun contrat n'est sorti.
 *
 * Refusé sinon. Le texte signé vit dans le contrat, pas dans le gabarit — rien
 * ne serait perdu au sens strict —, mais « sous quelles conditions ce client
 * a-t-il signé » n'aurait plus de réponse nommable. Un gabarit qu'on ne veut
 * plus proposer se retire ; il ne s'efface pas.
 */
export async function supprimerGabarit(cle) {
  const db = await connexion();
  const [usage] = await db.requete(
    `SELECT COUNT(*) AS total FROM ${table('contrats')} WHERE gabarit_cle = ?`, [String(cle)],
  );
  const combien = Number(usage?.total) || 0;
  if (combien > 0) {
    throw new Error(
      `${combien} contrat(s) sont sortis de ce gabarit. Retirez-le de la liste plutôt que de l’effacer : `
      + `on doit pouvoir dire sous quelles conditions ils ont été signés.`,
    );
  }
  const [g] = await db.requete(
    `SELECT defaut FROM ${table('contrat_gabarits')} WHERE cle = ? LIMIT 1`, [String(cle)],
  );
  if (g && Number(g.defaut)) throw new Error('C’est le gabarit par défaut : désignez-en un autre d’abord.');
  await db.executer(`DELETE FROM ${table('contrat_gabarits')} WHERE cle = ?`, [String(cle)]);
  viderCache();
}
