/**
 * L'import : reprise d'historique, incrémental, et le verrou qui les protège.
 *
 * Pas de file d'attente : une table et un verrou en base. C'est assez pour un
 * cron toutes les cinq minutes, et cela évite un service de plus à surveiller.
 *
 * Le verrou est une **date d'expiration** et non un drapeau : un processus tué
 * au milieu d'un import ne laisse pas la tâche bloquée pour toujours. Elle se
 * libère d'elle-même, et le curseur reprend là où il s'était arrêté.
 *
 * Trois garanties, et elles ne tiennent pas au code de ce fichier mais aux
 * deux clés uniques de la base :
 *
 *   · rejouer une page n'écrit pas deux fois la même vente ;
 *   · une coupure reprend au curseur, pas au début ;
 *   · une vente corrigée par la caisse est mise à jour, pas dupliquée.
 */

import { connexion, estPostgres, table } from '../db.mjs';
import {
  adaptateurDe,
  contexteDe,
  chargerConnexion,
  ecrirePage,
  listerBoutiques,
  listerCorrespondances,
  listerRapprochements,
} from './onboarding.mjs';

const vrai = (v) => (estPostgres() ? Boolean(v) : (v ? 1 : 0));

/** Combien de temps un verrou tient avant d'être considéré comme abandonné. */
const VERROU_MINUTES = 30;

/**
 * Découpe une période en fenêtres d'une semaine.
 *
 * Une reprise de douze mois en un seul appel est ingérable : elle ne se
 * reprend pas, elle ne montre pas de progression, et la moindre coupure fait
 * tout recommencer. En semaines, chaque morceau réussi est acquis.
 */
export function fenetres(de, a, jours = 7) {
  const sortie = [];
  let debut = new Date(de);
  const fin = new Date(a);
  while (debut < fin) {
    const suivant = new Date(debut.getTime() + jours * 86400000);
    sortie.push({ de: new Date(debut), a: suivant > fin ? new Date(fin) : suivant });
    debut = suivant;
  }
  return sortie;
}

/** Crée la tâche de synchronisation d'une connexion. */
export async function poserTache(connexionId, {
  genre = 'incrementale', frequenceHeures = 24, heureLocale = 5, rattrapageJours = 7,
} = {}) {
  const db = await connexion();
  await db.executer(`DELETE FROM ${table('sync_taches')} WHERE connexion_id = ? AND genre = ?`,
    [Number(connexionId), genre]);
  await db.executer(
    `INSERT INTO ${table('sync_taches')}
     (connexion_id, genre, active, frequence_heures, heure_locale, rattrapage_jours, prochain_le)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [Number(connexionId), genre, vrai(true), Number(frequenceHeures), Number(heureLocale),
      Number(rattrapageJours), new Date()],
  );
}

export async function listerTaches(connexionId = null) {
  const db = await connexion();
  const lignes = connexionId
    ? await db.requete(`SELECT * FROM ${table('sync_taches')} WHERE connexion_id = ?`, [Number(connexionId)])
    : await db.requete(`SELECT * FROM ${table('sync_taches')}`);
  return lignes.map((t) => ({ ...t, active: Boolean(t.active) }));
}

/**
 * Prend le verrou d'une tâche, ou rend faux.
 *
 * L'écriture conditionnelle est la clé : `WHERE verrou_jusqu_a IS NULL OR
 * verrou_jusqu_a < maintenant`. Deux processus qui tentent en même temps
 * n'en verront qu'un réussir, parce que c'est la base qui tranche — un
 * contrôle en lecture puis une écriture laisserait une fenêtre entre les deux.
 */
export async function prendreVerrou(tacheId, parQui = 'cron') {
  const db = await connexion();
  const maintenant = new Date();
  const jusqua = new Date(maintenant.getTime() + VERROU_MINUTES * 60000);
  const r = await db.executer(
    `UPDATE ${table('sync_taches')} SET verrou_jusqu_a = ?, verrou_par = ?
     WHERE id = ? AND (verrou_jusqu_a IS NULL OR verrou_jusqu_a < ?)`,
    [jusqua, String(parQui), Number(tacheId), maintenant],
  );
  // `lignes` est le nombre de lignes touchées, rendu par les deux dialectes.
  return Number(r?.lignes ?? 0) > 0;
}

export async function rendreVerrou(tacheId, prochainLe = null) {
  const db = await connexion();
  await db.executer(
    `UPDATE ${table('sync_taches')} SET verrou_jusqu_a = NULL, verrou_par = NULL${prochainLe ? ', prochain_le = ?' : ''}
     WHERE id = ?`,
    prochainLe ? [prochainLe, Number(tacheId)] : [Number(tacheId)],
  );
}

/** Ouvre un passage et rend son identifiant. */
async function ouvrirPassage(db, { tacheId, connexionId, de, a }) {
  const { id } = await db.executer(
    `INSERT INTO ${table('sync_passages')}
     (tache_id, connexion_id, statut, debut_le, plage_de, plage_a) VALUES (?, ?, ?, ?, ?, ?)`,
    [tacheId, Number(connexionId), 'en_cours', new Date(), de, a],
    'id',
  );
  return Number(id);
}

async function fermerPassage(db, id, { statut, compteurs, curseur = null, erreur = null }) {
  await db.executer(
    `UPDATE ${table('sync_passages')}
     SET statut = ?, fin_le = ?, lues = ?, inserees = ?, doublons = ?, rejetees = ?,
         curseur_a = ?, code_erreur = ?, detail_erreur = ?
     WHERE id = ?`,
    [statut, new Date(), compteurs.lues, compteurs.inserees, compteurs.doublons, compteurs.rejetees,
      curseur, erreur?.code || null, erreur ? JSON.stringify(erreur) : null, id],
  );
}

/**
 * Importe une période pour une connexion.
 *
 * Le cœur du système. Il écrit page par page — jamais tout en mémoire — et
 * garde le curseur à chaque page réussie, si bien qu'une coupure au bout de
 * onze mois ne fait pas recommencer les onze mois.
 *
 * `surProgres` sert à l'écran : il reçoit le compte courant après chaque page.
 */
export async function importer(connexionId, { de, a, tacheId = null, curseur = null, surProgres = null } = {}) {
  const db = await connexion();
  const cx = await chargerConnexion(connexionId);
  if (!cx) throw new Error("Cette connexion n'existe pas.");

  const correspondances = await listerCorrespondances(cx.id);
  const rapprochements = await listerRapprochements(cx.id);
  const boutiques = await listerBoutiques(cx.prospect_id);
  const parId = new Map(boutiques.map((b) => [b.id, b]));
  // La table de rapprochement, prête à l'emploi : identifiant chez la caisse
  // → notre boutique, avec son fuseau et sa coupure de journée.
  const carte = rapprochements.map((r) => ({
    externe_id: r.externe_id,
    boutique_id: r.boutique_id,
    ignoree: r.ignoree,
    boutique: parId.get(r.boutique_id) || {},
  }));

  const passageId = await ouvrirPassage(db, { tacheId, connexionId: cx.id, de, a });
  const compteurs = { lues: 0, inserees: 0, doublons: 0, rejetees: 0 };
  let dernierCurseur = curseur;

  try {
    const pos = await adaptateurDe(cx.id);
    const ctx = await contexteDe(cx.id);
    for await (const page of pos.ventes({ ...ctx, depuis: de, jusqua: a, curseur })) {
      if (!page.ok) {
        await fermerPassage(db, passageId, {
          statut: compteurs.inserees > 0 ? 'partiel' : 'echec',
          compteurs, curseur: dernierCurseur, erreur: page,
        });
        return { ok: false, ...page, compteurs, curseur: dernierCurseur };
      }
      compteurs.lues += page.lignes.length;
      const r = await ecrirePage(cx.id, page.lignes, {
        passageId,
        prospectId: cx.prospect_id,
        correspondances,
        boutiques: carte,
        devise: cx.devise || 'EUR',
        connecteur: cx.connecteur_cle,
      });
      compteurs.inserees += r.inserees;
      compteurs.doublons += r.doublons;
      compteurs.rejetees += r.rejetees;
      dernierCurseur = page.curseur;

      // Le curseur est gardé **après chaque page**, et non à la fin : c'est
      // toute la différence entre reprendre à la onzième semaine et
      // recommencer les onze.
      await db.executer(
        `UPDATE ${table('connexions')} SET dernier_curseur = ?, derniere_sync_le = ? WHERE id = ?`,
        [dernierCurseur, new Date(), cx.id],
      );
      if (surProgres) await surProgres({ ...compteurs, curseur: dernierCurseur });
    }
    await fermerPassage(db, passageId, { statut: 'succes', compteurs, curseur: dernierCurseur });
    return { ok: true, compteurs, curseur: dernierCurseur, passageId };
  } catch (err) {
    await fermerPassage(db, passageId, {
      statut: 'echec', compteurs, curseur: dernierCurseur,
      erreur: { code: 'INTERNE', message: err.message },
    });
    throw err;
  }
}

/**
 * La reprise d'historique, semaine par semaine.
 *
 * Chaque fenêtre est un passage à part : une qui échoue n'annule pas les
 * précédentes, et relancer ne refait que ce qui manque.
 */
export async function reprendreHistorique(connexionId, { mois = 12, surProgres = null } = {}) {
  const a = new Date();
  const de = new Date(a.getTime() - mois * 30 * 86400000);
  const morceaux = fenetres(de, a, 7);
  const total = { lues: 0, inserees: 0, doublons: 0, rejetees: 0, fenetres: morceaux.length, faites: 0 };

  for (const [i, f] of morceaux.entries()) {
    const r = await importer(connexionId, { de: f.de, a: f.a });
    total.lues += r.compteurs.lues;
    total.inserees += r.compteurs.inserees;
    total.doublons += r.compteurs.doublons;
    total.rejetees += r.compteurs.rejetees;
    total.faites = i + 1;
    if (surProgres) await surProgres({ ...total, fenetre: f });
    if (!r.ok) return { ok: false, ...r, total };
  }
  return { ok: true, total };
}

/**
 * L'incrémental : le delta, plus une fenêtre glissante de rattrapage.
 *
 * Les caisses corrigent et annulent des tickets après coup. Une synchro qui ne
 * lirait que depuis la dernière fois ne verrait jamais ces corrections — et le
 * chiffre du mois dernier ne bougerait plus jamais, même quand il a changé.
 */
export async function synchroniser(connexionId, { rattrapageJours = 7, tacheId = null } = {}) {
  const cx = await chargerConnexion(connexionId);
  if (!cx) throw new Error("Cette connexion n'existe pas.");
  const a = new Date();
  const depuis = cx.derniere_sync_le ? new Date(cx.derniere_sync_le) : new Date(a.getTime() - 30 * 86400000);
  const de = new Date(depuis.getTime() - rattrapageJours * 86400000);
  return importer(connexionId, { de, a, tacheId });
}

/** Les passages d'une connexion, du plus récent au plus ancien. */
export async function listerPassages(connexionId, limite = 20) {
  const db = await connexion();
  const lignes = await db.requete(
    `SELECT * FROM ${table('sync_passages')} WHERE connexion_id = ? ORDER BY id DESC`,
    [Number(connexionId)],
  );
  return lignes.slice(0, limite);
}

export async function listerRebut(connexionId, limite = 50) {
  const db = await connexion();
  const lignes = await db.requete(
    `SELECT * FROM ${table('sync_rebut')} WHERE connexion_id = ? ORDER BY id DESC`,
    [Number(connexionId)],
  );
  return lignes.slice(0, limite);
}

/**
 * Le chiffre d'affaires importé sur un mois, par connexion.
 *
 * Sert au contrôle de cohérence. Réparti par caisse et non global : sur un
 * réseau à trois caisses, un écart de cinquante pour cent sur l'une se dilue
 * en six pour cent sur l'ensemble — assez petit pour passer inaperçu, assez
 * gros pour fausser les primes d'un franchisé pendant un an.
 */
export async function chiffreImporte(prospectId, { de, a }) {
  const db = await connexion();
  return db.requete(
    `SELECT x.id AS connexion_id, x.libelle, SUM(v.total_ttc) AS total, COUNT(*) AS lignes
     FROM ${table('ventes')} v
     JOIN ${table('connexions')} x ON x.id = v.connexion_id
     WHERE v.prospect_id = ? AND v.jour_exploitation >= ? AND v.jour_exploitation <= ?
     GROUP BY x.id, x.libelle ORDER BY x.libelle`,
    [Number(prospectId), de, a],
  );
}

/**
 * Le bilan d'une caisse : ce qui est réellement entré, depuis le début.
 *
 * Sert à l'écran de fin, et à lui seul. Sans borne de date, contrairement au
 * contrôle de cohérence : la question n'est pas « le mois dernier
 * correspond-il ? » mais « y a-t-il quelque chose ? ». Une caisse branchée
 * qui n'a jamais rien rendu est le défaut le plus fréquent d'une mise en
 * route, et le plus tardif à se voir — le client l'apprend en ouvrant son
 * tableau de bord vide, un mois après.
 *
 * Le compte de boutiques distinctes est celui qui trahit le mieux un mapping
 * incomplet : trois caisses branchées, une seule boutique qui vend, et c'est
 * le rapprochement des boutiques qu'il faut reprendre.
 */
export async function bilanConnexion(connexionId) {
  const db = await connexion();
  const lignes = await db.requete(
    `SELECT COUNT(*) AS lignes,
            COUNT(DISTINCT boutique_externe_id) AS boutiques,
            MIN(jour_exploitation) AS premiere,
            MAX(jour_exploitation) AS derniere,
            SUM(total_ttc) AS total
     FROM ${table('ventes')} WHERE connexion_id = ?`,
    [Number(connexionId)],
  );
  const l = lignes[0] || {};
  return {
    lignes: Number(l.lignes || 0),
    boutiques: Number(l.boutiques || 0),
    premiere: l.premiere || null,
    derniere: l.derniere || null,
    total: Number(l.total || 0),
  };
}
