#!/usr/bin/env node
/**
 * Traduction de tout le contenu du site, langue par langue.
 *
 * Le français reste dans les colonnes d'origine : ce script ne le touche
 * jamais. Il ne fait qu'ajouter des surcharges dans `landing_traductions`,
 * ce qui a trois conséquences utiles :
 *
 *   · rejouer le script ne duplique rien — une surcharge est désignée par
 *     (langue, entité, ligne, champ) ;
 *   · une traduction retouchée dans la console n'est pas écrasée, sauf
 *     `--force` ;
 *   · abandonner une langue se fait d'une requête `DELETE`.
 *
 * Chaque surcharge garde une copie du français au moment où elle a été
 * écrite. C'est ce qui permet de repérer plus tard qu'une phrase française a
 * changé et que sa traduction ment — sans ce repère, il faudrait tout relire.
 *
 * Usage :
 *   node traduire.mjs                    ce qui manque, dans les langues publiées
 *   node traduire.mjs --langue=en,it     seulement ces langues
 *   node traduire.mjs --entite=modules   seulement cette entité
 *   node traduire.mjs --toutes-langues   y compris les langues non publiées
 *   node traduire.mjs --perimees         reprend aussi celles dont le français a bougé
 *   node traduire.mjs --force            refait tout, y compris ce qui est traduit
 *   node traduire.mjs --verifier         ne traduit rien : dit ce qui manque
 *   node traduire.mjs --lot=15           taille des lots envoyés au modèle
 */

import { ENTITES, entiteTraduisible } from './lib/traduisible.mjs';
import { traduireLot } from './lib/ai.mjs';
import { ouvrir, table } from './lib/db.mjs';

const ARGS = process.argv.slice(2);
const drapeau = (nom) => ARGS.includes(`--${nom}`);
const valeur = (nom) => {
  const trouve = ARGS.find((a) => a.startsWith(`--${nom}=`));
  return trouve ? trouve.slice(nom.length + 3) : null;
};

const OPTIONS = {
  langues: (valeur('langue') || '').split(',').map((l) => l.trim()).filter(Boolean),
  entites: (valeur('entite') || '').split(',').map((e) => e.trim()).filter(Boolean),
  toutesLangues: drapeau('toutes-langues'),
  perimees: drapeau('perimees'),
  force: drapeau('force'),
  verifier: drapeau('verifier'),
  // Assez grand pour que le modèle voie le contexte d'un module entier, assez
  // petit pour qu'un lot refusé ne coûte pas cher à rejouer.
  lot: Number(valeur('lot')) || 12,
};

/** Les langues à traiter : jamais celle par défaut, qui est la référence. */
async function languesCibles(db) {
  const lignes = await db.requete(`SELECT code, nom, defaut, publiee FROM ${table('langues')} ORDER BY ordre, code`);
  return lignes
    .filter((l) => !l.defaut)
    .filter((l) => (OPTIONS.toutesLangues ? true : Boolean(l.publiee)))
    .filter((l) => (OPTIONS.langues.length ? OPTIONS.langues.includes(l.code) : true));
}

/** Les entités à traiter. */
function entitesCibles() {
  if (!OPTIONS.entites.length) return ENTITES;
  return OPTIONS.entites.map(entiteTraduisible);
}

/**
 * Ce qu'il reste à traduire pour une langue et une entité.
 *
 * Un champ français vide n'est pas à traduire — le compter ferait stagner la
 * couverture sous 100 % pour toujours.
 */
async function aFaire(db, langue, entite) {
  const toutes = await db.requete(`SELECT * FROM ${table(entite.table)} ORDER BY ${entite.ordre}`);
  const lignes = entite.filtre ? toutes.filter(entite.filtre) : toutes;
  const posees = await db.requete(
    `SELECT ligne_id, champ, valeur, source FROM ${table('traductions')} WHERE langue = ? AND entite = ?`,
    [langue, entite.cle],
  );
  const par = new Map(posees.map((p) => [`${p.ligne_id}:${p.champ}`, p]));

  const restant = [];
  let total = 0;
  let faits = 0;
  let perimes = 0;

  for (const ligne of lignes) {
    for (const champ of entite.champs) {
      const fr = ligne[champ.nom] == null ? '' : String(ligne[champ.nom]);
      if (!fr.trim()) continue;
      total += 1;

      const posee = par.get(`${ligne.id}:${champ.nom}`);
      const traduit = Boolean(posee?.valeur);
      const perime = traduit && Boolean(posee.source) && posee.source !== fr;
      if (traduit) faits += 1;
      if (perime) perimes += 1;

      const aReprendre = OPTIONS.force || !traduit || (OPTIONS.perimees && perime);
      if (!aReprendre) continue;

      restant.push({
        cle: `${ligne.id}:${champ.nom}`,
        valeur: fr,
        contexte: [entite.libelle(ligne), champ.libelle, champ.contexte].filter(Boolean).join(' — '),
        ligneId: ligne.id,
        champ: champ.nom,
        source: fr,
      });
    }
  }
  return { restant, total, faits, perimes };
}

/** Pose une surcharge, en gardant le français du moment. */
async function poser(db, { langue, entite, ligneId, champ, valeurTraduite, source }) {
  const dejaLa = await db.requete(
    `SELECT id FROM ${table('traductions')}
     WHERE langue = ? AND entite = ? AND ligne_id = ? AND champ = ? LIMIT 1`,
    [langue, entite, ligneId, champ],
  );
  if (dejaLa.length > 0) {
    await db.executer(
      `UPDATE ${table('traductions')} SET valeur = ?, source = ? WHERE id = ?`,
      [valeurTraduite, source, dejaLa[0].id],
    );
  } else {
    await db.executer(
      `INSERT INTO ${table('traductions')} (langue, entite, ligne_id, champ, valeur, source)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [langue, entite, ligneId, champ, valeurTraduite, source],
    );
  }
}

async function principal() {
  const db = await ouvrir();
  try {
    const langues = await languesCibles(db);
    if (langues.length === 0) {
      console.log(
        OPTIONS.langues.length
          ? `Aucune langue ne correspond à « ${OPTIONS.langues.join(', ')} ».`
          : 'Aucune langue publiée à traduire. --toutes-langues pour préparer celles qui ne le sont pas.',
      );
      return;
    }

    const entites = entitesCibles();
    let ecrites = 0;

    for (const langue of langues) {
      console.log(`\n─── ${langue.nom} (${langue.code}) ───`);
      let restantLangue = 0;

      for (const entite of entites) {
        const { restant, total, faits, perimes } = await aFaire(db, langue.code, entite);
        const etat = `${faits}/${total}${perimes ? `, ${perimes} périmée(s)` : ''}`;

        if (OPTIONS.verifier) {
          const manque = total - faits;
          console.log(
            `  ${entite.nom.padEnd(20)} ${etat}` +
              (manque > 0 ? `  → ${manque} à traduire` : '  ✓') +
              (perimes && !OPTIONS.perimees ? '  (--perimees pour les reprendre)' : ''),
          );
          restantLangue += restant.length;
          continue;
        }

        if (restant.length === 0) {
          console.log(`  ${entite.nom.padEnd(20)} ${etat}  ✓`);
          continue;
        }

        console.log(`  ${entite.nom.padEnd(20)} ${etat}  → ${restant.length} à traduire`);
        for (let i = 0; i < restant.length; i += OPTIONS.lot) {
          const lot = restant.slice(i, i + OPTIONS.lot);
          let rendu;
          try {
            rendu = await traduireLot(
              lot.map(({ cle, valeur: v, contexte }) => ({ cle, valeur: v, contexte })),
              langue.code,
            );
          } catch (err) {
            // Un lot qui échoue ne fait pas tomber le reste : la traduction
            // est reprenable, il suffit de relancer le script.
            console.error(`    ✗ lot ${i / OPTIONS.lot + 1} : ${err.message}`);
            continue;
          }
          for (const item of lot) {
            const traduite = rendu.get(item.cle);
            if (!traduite) continue;
            await poser(db, {
              langue: langue.code,
              entite: entite.cle,
              ligneId: item.ligneId,
              champ: item.champ,
              valeurTraduite: traduite,
              source: item.source,
            });
            ecrites += 1;
          }
          process.stdout.write(`    ${Math.min(i + OPTIONS.lot, restant.length)}/${restant.length}\r`);
        }
        process.stdout.write('    '.padEnd(30) + '\r');
      }

      if (OPTIONS.verifier && restantLangue === 0) {
        console.log(`  → ${langue.nom} est complète.`);
      }
    }

    if (!OPTIONS.verifier) {
      console.log(`\n${ecrites} traduction(s) écrite(s).`);
      console.log('Relancez avec --verifier pour contrôler la couverture.');
    }
  } finally {
    await db.fermer();
  }
}

principal().catch((err) => {
  console.error(`✗ ${err.message}`);
  process.exitCode = 1;
});
