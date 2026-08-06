/**
 * §17 — les plans de commission, et ce que chaque commercial a projeté.
 *
 * Deux choses volontairement absentes de ce fichier.
 *
 * **Pas de table d'agents.** Un commercial est un compte : `landing_utilisateurs`
 * avec le rôle `commercial`. Créer une seconde liste de personnes à tenir à jour
 * aurait garanti qu'elles divergent, et qu'on ne sache plus laquelle fait foi.
 *
 * **Pas de table d'attributions.** L'offre porte déjà `cree_par`, et le contrat
 * porte l'offre. Le lien entre une personne et un contrat existe donc depuis le
 * premier jour ; le recopier ailleurs, c'est ajouter un endroit où il peut être
 * faux.
 */
import { connexion, table, viderCache } from '../db.mjs';
import { commissionContrat, paliersOrdonnes } from '../commissions/calcul.mjs';
import { calculerOffre } from '../offres/calcul.mjs';
import { configDe, normaliserCle, normaliserOffre } from './donnees.mjs';

/* ------------------------------------------------------------------ plans -- */

/** Les plans, chacun avec ses paliers dans l'ordre. */
export async function listerPlans() {
  const db = await connexion();
  const [plans, paliers] = await Promise.all([
    db.requete(`SELECT * FROM ${table('plans_commission')} ORDER BY ordre, nom`),
    db.requete(`SELECT * FROM ${table('paliers_commission')} ORDER BY plan_cle, depuis_mois`),
  ]);
  return plans.map((p) => ({
    ...p,
    actif: Boolean(p.actif),
    paliers: paliers
      .filter((x) => x.plan_cle === p.cle)
      .map((x) => ({ depuis_mois: Number(x.depuis_mois), taux_bp: Number(x.taux_bp) })),
  }));
}

export async function ajouterPlan({ nom, paliers }) {
  const db = await connexion();
  const cle = normaliserCle(nom);
  if (!cle) throw new Error('Un plan a besoin d’un nom.');
  const dejaLa = await db.requete(`SELECT id FROM ${table('plans_commission')} WHERE cle = ? LIMIT 1`, [cle]);
  if (dejaLa.length > 0) throw new Error(`Le plan « ${cle} » existe déjà.`);

  // Les paliers sont validés AVANT d'écrire le plan : un plan créé puis rejeté
  // sur ses paliers laisserait une coquille que personne ne remarque, et qui ne
  // calcule rien.
  const propres = paliersOrdonnes(lirePaliers(paliers));
  if (propres.length === 0) throw new Error('Un plan sans palier ne calcule rien : donnez-lui au moins un taux.');

  await db.executer(
    `INSERT INTO ${table('plans_commission')} (cle, nom, actif, ordre) VALUES (?, ?, ?, ?)`,
    [cle, String(nom).trim(), 1, 100],
  );
  await ecrirePaliers(db, cle, propres);
  viderCache();
  return cle;
}

/** Remplace l'échelle entière : un plan se lit d'un bloc. */
export async function enregistrerPaliers(cle, paliers) {
  const db = await connexion();
  const propres = paliersOrdonnes(lirePaliers(paliers));
  await db.executer(`DELETE FROM ${table('paliers_commission')} WHERE plan_cle = ?`, [String(cle)]);
  await ecrirePaliers(db, String(cle), propres);
  viderCache();
}

/**
 * Supprime un plan qu'aucun commercial n'utilise.
 *
 * Refusé sinon. La colonne `plan_commission` n'a pas de contrainte : la
 * suppression n'échouerait pas, elle laisserait ces comptes pointer vers un
 * plan disparu — et cesserait silencieusement de les payer.
 */
export async function supprimerPlan(cle) {
  const db = await connexion();
  const portes = await db.requete(
    `SELECT nom, identifiant FROM ${table('utilisateurs')} WHERE plan_commission = ?`,
    [String(cle)],
  );
  if (portes.length > 0) {
    const qui = portes.map((u) => u.nom || u.identifiant).join(', ');
    throw new Error(`${portes.length} compte(s) sont sur ce plan (${qui}). Changez-les de plan avant de le supprimer.`);
  }
  await db.executer(`DELETE FROM ${table('paliers_commission')} WHERE plan_cle = ?`, [String(cle)]);
  await db.executer(`DELETE FROM ${table('plans_commission')} WHERE cle = ?`, [String(cle)]);
  viderCache();
}

/** Rattache un compte à un plan, ou l'en détache avec une valeur vide. */
export async function rattacherAuPlan(utilisateurId, cle) {
  const db = await connexion();
  await db.executer(
    `UPDATE ${table('utilisateurs')} SET plan_commission = ? WHERE id = ?`,
    [String(cle || '').trim() || null, Number(utilisateurId)],
  );
  viderCache();
}

/**
 * « 0:90, 12:20 » → des paliers.
 *
 * Une ligne de texte plutôt que six champs : l'échelle se lit et se corrige
 * d'un coup d'œil, et se recopie d'un plan à l'autre sans cliquer douze fois.
 */
export function lirePaliers(saisie) {
  if (Array.isArray(saisie)) return saisie;
  const morceaux = String(saisie || '').split(',').map((s) => s.trim()).filter(Boolean);
  return morceaux.map((m) => {
    const trouve = /^(\d+)\s*:\s*(\d+(?:[.,]\d+)?)$/.exec(m);
    if (!trouve) {
      throw new Error(`« ${m} » ne se lit pas. Écrivez mois:pourcentage, par exemple « 0:90, 12:20 ».`);
    }
    const pourcent = Number(trouve[2].replace(',', '.'));
    if (pourcent > 100) throw new Error(`« ${m} » dépasse 100 % : un plan ne peut pas payer plus que la facture.`);
    return { depuis_mois: Number(trouve[1]), taux_bp: Math.round(pourcent * 100) };
  });
}

async function ecrirePaliers(db, cle, paliers) {
  for (const p of paliers) {
    await db.executer(
      `INSERT INTO ${table('paliers_commission')} (plan_cle, depuis_mois, taux_bp) VALUES (?, ?, ?)`,
      [cle, p.depuis_mois, p.taux_bp],
    );
  }
}

/* ------------------------------------------------------------ commissions -- */

/**
 * Les montants d'une offre, ramenés à deux seaux.
 *
 * L'annuel est ramené au mois — sinon un contrat facturé à l'année ne
 * commissionnerait qu'une fois sur douze, ce qui n'est pas ce qu'un commercial
 * a négocié.
 */
export function montantsDeLOffre(ligneOffre) {
  const { seaux } = calculerOffre(configDe(normaliserOffre(ligneOffre)));
  // Hors taxes : la TVA n'est pas du chiffre d'affaires, elle transite. La
  // commissionner reviendrait à payer un pourcentage de l'argent de l'État.
  const ht = (nom) => Number(seaux?.[nom]?.ht) || 0;
  return {
    unique_cents: ht('unique'),
    mensuel_cents: ht('mensuel') + Math.round(ht('annuel') / 12),
  };
}

/**
 * Ce que chaque commercial a projeté, contrat par contrat.
 *
 * Le mot « projeté » est tenu partout : cette application ne connaît pas les
 * encaissements. Un contrat signé dit ce que le client s'est engagé à payer,
 * pas ce qu'il a payé.
 */
export async function commissionsParCommercial() {
  const db = await connexion();
  const [comptes, plans, contrats] = await Promise.all([
    db.requete(
      `SELECT id, nom, identifiant, role, actif, plan_commission
       FROM ${table('utilisateurs')} ORDER BY actif DESC, nom, identifiant`,
    ),
    listerPlans(),
    db.requete(
      // `o.*` plutôt qu'une liste de colonnes : le calculateur d'offre en lit
      // une vingtaine, et une liste énumérée ici se désynchroniserait du jour
      // où une option s'ajoute — en produisant un montant faux, pas une erreur.
      // Les colonnes du contrat viennent après pour l'emporter sur celles de
      // l'offre qui portent le même nom (`reference`, `statut`).
      `SELECT o.*, c.id, c.reference, c.statut, c.duree_mois, c.signe_le, c.date_effet,
              c.offre_id, o.reference AS offre_reference, p.raison_sociale
       FROM ${table('contrats')} c
       LEFT JOIN ${table('offres')} o ON o.id = c.offre_id
       LEFT JOIN ${table('prospects')} p ON p.id = c.prospect_id
       ORDER BY c.signe_le DESC, c.id DESC`,
    ),
  ]);

  const planDe = new Map(plans.map((p) => [p.cle, p]));

  return comptes.map((u) => {
    const plan = u.plan_commission ? planDe.get(u.plan_commission) || null : null;
    const paliers = plan ? paliersOrdonnes(plan.paliers) : null;
    const siens = contrats.filter((c) => Number(c.cree_par) === Number(u.id));

    let total = 0;
    let calculables = 0;
    const lignes = siens.map((c) => {
      let montants = { unique_cents: 0, mensuel_cents: 0 };
      // Une offre illisible ne doit pas faire tomber l'écran des commissions :
      // la ligne le dit et les autres continuent d'être calculées.
      try {
        montants = montantsDeLOffre(c);
      } catch {
        return { contrat: c, resultat: { total_cents: null, lignes: [], raison: 'sans_montant' } };
      }
      const resultat = commissionContrat(c, montants, paliers);
      if (resultat.raison === 'ok') {
        total += resultat.total_cents;
        calculables += 1;
      }
      return { contrat: c, montants, resultat };
    });

    return {
      id: u.id,
      nom: u.nom || u.identifiant,
      identifiant: u.identifiant,
      role: u.role,
      actif: Boolean(u.actif),
      plan,
      lignes,
      contrats: siens.length,
      signes: siens.filter((c) => c.statut === 'signe').length,
      calculables,
      total_cents: calculables > 0 ? total : null,
      // Un commercial avec des contrats signés et aucun plan : rien ne se
      // calcule pour lui, silencieusement, si personne ne le nomme.
      sans_plan: !plan && siens.some((c) => c.statut === 'signe'),
    };
  });
}
