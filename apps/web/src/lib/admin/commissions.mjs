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
import { commissionContrat, paliersDepuisTranches, paliersOrdonnes, tranchesDepuisPaliers } from '../commissions/calcul.mjs';
import { calculerOffre } from '../offres/calcul.mjs';
import { configDe, normaliserCle, normaliserOffre } from './donnees.mjs';

/* ------------------------------------------------------------------ plans -- */

/** Les plans, chacun avec ses paliers dans l'ordre. */
export async function listerPlans() {
  const db = await connexion();
  const [plans, paliers, portes] = await Promise.all([
    db.requete(`SELECT * FROM ${table('plans_commission')} ORDER BY ordre, nom`),
    db.requete(`SELECT * FROM ${table('paliers_commission')} ORDER BY plan_cle, depuis_mois`),
    // Combien de commerciaux sont sur chaque plan : c'est ce qui dit si le
    // modifier engage une personne ou toute l'équipe.
    db.requete(
      `SELECT plan_commission AS cle, COUNT(*) AS total FROM ${table('utilisateurs')}
        WHERE plan_commission IS NOT NULL AND plan_commission <> '' GROUP BY plan_commission`,
    ),
  ]);
  const comptes = new Map(portes.map((p) => [p.cle, Number(p.total)]));
  return plans.map((p) => {
    const siens = paliers
      .filter((x) => x.plan_cle === p.cle)
      .map((x) => ({ depuis_mois: Number(x.depuis_mois), taux_bp: Number(x.taux_bp) }));
    // Les tranches accompagnent les paliers partout : les écrans les
    // affichent, le calcul lit les paliers, et la conversion se fait ici une
    // fois plutôt que dans chaque page.
    const { tranches, finit } = tranchesDepuisPaliers(siens);
    return { ...p, actif: Boolean(p.actif), paliers: siens, tranches, finit, comptes: comptes.get(p.cle) || 0 };
  });
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
 * Les tranches d'un formulaire → des paliers.
 *
 * Le formulaire pose deux colonnes répétées : une durée en mois et un
 * pourcentage. « 12 mois à 70 %, puis 30 % » — la phrase qu'un commercial
 * indépendant entend quand il négocie sa rémunération. La dernière durée
 * laissée vide veut dire « pour le reste du contrat » ; renseignée, elle
 * arrête le plan.
 *
 * L'ancienne saisie était une ligne de texte, « 0:90, 12:20 ». Elle tenait
 * sur un champ, mais demandait de convertir des durées en mois cumulés de
 * tête à chaque relecture — et personne ne fait deux fois la même conversion
 * de la même façon.
 *
 * @param {Array|string} saisie tranches, ou paliers déjà faits
 */
export function lirePaliers(saisie) {
  if (Array.isArray(saisie)) {
    // Des paliers déjà bâtis passent tels quels ; des tranches se convertissent.
    if (saisie.length === 0) return [];
    return 'depuis_mois' in saisie[0] ? saisie : paliersDepuisTranches(saisie);
  }
  return paliersDepuisTranches(lireTranches(saisie));
}

/**
 * Les couples (durée, taux) d'un formulaire.
 *
 * Les deux listes arrivent en parallèle et se lisent par rang. Une ligne dont
 * les deux champs sont vides est ignorée : le formulaire en propose toujours
 * une de plus qu'il n'en faut, et refuser cette ligne-là ferait échouer tous
 * les enregistrements.
 */
export function lireTranches(formulaire) {
  if (!formulaire || typeof formulaire.getAll !== 'function') return [];
  const durees = formulaire.getAll('duree_mois');
  const taux = formulaire.getAll('taux');
  const tranches = [];
  for (let i = 0; i < Math.max(durees.length, taux.length); i += 1) {
    const d = String(durees[i] ?? '').trim();
    const t = String(taux[i] ?? '').trim();
    if (!d && !t) continue;
    if (!t) throw new Error(`La tranche ${i + 1} n’a pas de pourcentage.`);
    const pourcent = Number(t.replace(',', '.'));
    if (!Number.isFinite(pourcent) || pourcent < 0) {
      throw new Error(`« ${t} » n’est pas un pourcentage.`);
    }
    // Un plan ne peut pas reverser plus que ce qui est facturé : au-delà de
    // cent pour cent, chaque contrat signé coûterait de l'argent.
    if (pourcent > 100) {
      throw new Error(`« ${t} % » dépasse 100 % : un plan ne peut pas payer plus que la facture.`);
    }
    tranches.push({
      duree_mois: d === '' ? null : Number(d),
      taux_bp: Math.round(pourcent * 100),
    });
  }
  return tranches;
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
  const [comptes, plans, contrats, portefeuilles] = await Promise.all([
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
    // Le portefeuille : les clients **assignés** à quelqu'un, contrat ou pas.
    //
    // Les contrats seuls ne disent qu'une moitié du lien. Un commercial qui
    // vient de reprendre huit clients n'a encore signé pour aucun ; son écran
    // dirait « aucun client à son nom » alors qu'il en suit huit, et c'est
    // précisément le moment où il a besoin de les voir.
    db.requete(
      `SELECT id, raison_sociale, commercial_id FROM ${table('prospects')}
        WHERE commercial_id IS NOT NULL ORDER BY raison_sociale`,
    ),
  ]);

  const planDe = new Map(plans.map((p) => [p.cle, p]));

  return comptes.map((u) => {
    const plan = u.plan_commission ? planDe.get(u.plan_commission) || null : null;
    const paliers = plan ? paliersOrdonnes(plan.paliers) : null;
    const siens = contrats.filter((c) => Number(c.cree_par) === Number(u.id));
    const assignes = portefeuilles.filter((p) => Number(p.commercial_id) === Number(u.id));

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

    // Regroupé par client, et non à plat.
    //
    // Une liste de références de contrats ne se lit pas : « CTR-2026-014 » ne
    // dit pas de qui il s'agit, et un commercial qui suit huit clients en a
    // vingt. Ce qu'on cherche sur cet écran, c'est « combien me rapporte
    // Belleville », pas « combien rapporte le contrat quatorze ».
    //
    // Le client d'abord, ses contrats dessous, son sous-total à sa hauteur.
    const parClient = new Map();
    for (const l of lignes) {
      const cle = l.contrat.raison_sociale || `Client ${l.contrat.prospect_id ?? '?'}`;
      if (!parClient.has(cle)) parClient.set(cle, { nom: cle, contrats: [], total_cents: null });
      const groupe = parClient.get(cle);
      groupe.contrats.push(l);
      if (l.resultat.raison === 'ok') {
        groupe.total_cents = (groupe.total_cents || 0) + l.resultat.total_cents;
      }
    }
    // Les clients qui rapportent en premier ; ceux dont rien ne se calcule
    // ensuite, par ordre alphabétique — ils ne se perdent pas dans la liste,
    // et ils ne la commandent pas non plus.
    // Les clients assignés qui n'ont encore aucun contrat à son nom : ils
    // complètent la liste au lieu d'en être absents. Zéro contrat n'est pas
    // rien à montrer — c'est le travail en cours.
    for (const a of assignes) {
      const cle = a.raison_sociale || `Client ${a.id}`;
      if (!parClient.has(cle)) {
        parClient.set(cle, { nom: cle, contrats: [], total_cents: null, sans_contrat: true });
      }
    }

    const clients = [...parClient.values()].sort((a, b) => {
      if ((b.total_cents || 0) !== (a.total_cents || 0)) return (b.total_cents || 0) - (a.total_cents || 0);
      return a.nom.localeCompare(b.nom);
    });

    return {
      id: u.id,
      nom: u.nom || u.identifiant,
      identifiant: u.identifiant,
      role: u.role,
      actif: Boolean(u.actif),
      plan,
      clients,
      lignes,
      // Combien de clients lui sont assignés — le lien qui ne passe pas par
      // un contrat, et qui existe dès qu'on lui confie quelqu'un.
      portefeuille: assignes.length,
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
