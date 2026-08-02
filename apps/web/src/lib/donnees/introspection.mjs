/**
 * L'introspection — lit `information_schema` pour **proposer** des ressources.
 *
 * L'introspection est excellente pour proposer et désastreuse pour servir. Rien
 * ici n'expose jamais une route : elle produit une déclaration qu'un humain
 * relit et valide, et l'exécution ne sert que ce qui figure au catalogue. C'est
 * précisément ce qui empêche le contenu d'une base de devenir une API publique
 * par accident.
 *
 * En lecture seule, réservée à la console, et bornée au schéma de la connexion :
 * chaque requête épingle `TABLE_SCHEMA = DATABASE()`, donc elle ne peut pas
 * énumérer une autre base du même serveur.
 */

import { connexion, estPostgres } from '../db.mjs';
import { estIdentifiant } from './catalogue.mjs';

/**
 * Les noms de colonnes qu'on ne coche jamais tout seul.
 *
 * La liste ne prétend pas être complète — elle ne peut pas l'être. Elle sert à
 * ce que la case ne soit pas cochée par défaut, pour que le choix d'exposer une
 * marge ou un e-mail soit un geste et non un oubli.
 *
 * Les motifs sont ancrés sur des segments entiers (`(^|_)…($|_)`) et non sur des
 * sous-chaînes. Sans cela, « moyen_paiement » était signalé comme donnée RH — à
 * cause de « paie » — et « taux_tva » comme donnée personnelle. Un assistant qui
 * crie au loup sur des colonnes anodines apprend à son lecteur à ne plus lire
 * les avertissements, et c'est ainsi qu'un vrai passe.
 */
const SENSIBLES = [
  { motif: /(^|_)(cout|cost|marge|margin|prix_achat|purchase_price|buy_price)($|_)/i, raison: 'marge' },
  { motif: /(^|_)(salaire|salary|paie|payroll|cree_par|maj_par|employe|employee|staff)($|_)/i, raison: 'donnée RH' },
  { motif: /(^|_)(email|mail|tel|telephone|phone|adresse|address|iban|naissance|birth|siret|siren|num_tva|tva_intra)($|_)/i,
    raison: 'donnée personnelle' },
  // Le vocabulaire de ce dépôt, et pas seulement l'anglais d'usage : l'empreinte
  // scrypt d'un mot de passe s'appelle `empreinte`. Écrits en anglais, ces
  // motifs laissaient l'assistant cocher un hachage de mot de passe par défaut.
  { motif: /(^|_)(mot_de_passe|password|hash|empreinte|secret|jeton|token|api_key|cle_api|version_cle)($|_)/i,
    raison: 'secret' },
];

/**
 * Les noms qui ne sont sensibles qu'**exacts**.
 *
 * Le coffre range ses secrets en `chiffre` / `iv` / `sceau`, mais « chiffre »
 * est aussi un mot ordinaire : le motif par segment attrapait
 * `chiffre_affaires`, c'est-à-dire le chiffre d'affaires du client — la donnée
 * qu'il vient précisément chercher. Signaler celle-là comme un secret aurait
 * appris à décocher les avertissements.
 */
const SENSIBLES_EXACTS = { chiffre: 'secret', iv: 'secret', sceau: 'secret', sel: 'secret' };

/** Ce qui ressemble à la colonne portant le client, donc présélectionnable. */
const CLIENT_PROBABLE = /^(prospect_id|client_id|tenant_id|organisation_id|compte_id)$/i;

const TYPES_DATE = new Set(['date', 'datetime', 'timestamp']);
const TYPES_EXACTS = new Set(['char', 'varchar', 'bigint', 'int', 'smallint', 'mediumint', 'tinyint']);

/**
 * Les opérateurs qui valent la peine d'être proposés pour ce type.
 *
 * Rien sur une colonne non indexée : offrir un filtre exact sur une colonne
 * sans index, c'est offrir un balayage complet de table à chaque appel d'une
 * application installée chez un client.
 */
function filtresSuggeres(type, indexee) {
  if (TYPES_DATE.has(type)) return ['gte', 'lte'];
  if (indexee && TYPES_EXACTS.has(type)) return ['eq', 'in'];
  return [];
}

/** Exporté pour être testé : c'est le réglage le plus facile à casser en silence. */
export function sensibiliteDe(colonne) {
  const exact = SENSIBLES_EXACTS[String(colonne).toLowerCase()];
  if (exact) return exact;
  for (const { motif, raison } of SENSIBLES) if (motif.test(colonne)) return raison;
  return null;
}

/** L'introspection est écrite pour MySQL. Le dire plutôt que produire du faux. */
export function introspectionDisponible() {
  return !estPostgres();
}

/** Les tables et les vues du schéma de la connexion. */
export async function listerSources() {
  if (!introspectionDisponible()) return [];
  const db = await connexion();
  const lignes = await db.requete(
    `SELECT t.TABLE_NAME, t.TABLE_TYPE, t.TABLE_ROWS,
            (SELECT COUNT(*) FROM information_schema.COLUMNS c
              WHERE c.TABLE_SCHEMA = t.TABLE_SCHEMA AND c.TABLE_NAME = t.TABLE_NAME) AS COLS
       FROM information_schema.TABLES t
      WHERE t.TABLE_SCHEMA = DATABASE()
      ORDER BY t.TABLE_TYPE DESC, t.TABLE_NAME ASC`,
    [],
  );

  return lignes
    .filter((l) => estIdentifiant(l.TABLE_NAME))
    .map((l) => ({
      nom: l.TABLE_NAME,
      genre: l.TABLE_TYPE === 'VIEW' ? 'vue' : 'table',
      lignes: Number(l.TABLE_ROWS ?? 0),
      colonnes: Number(l.COLS ?? 0),
    }));
}

/** Tout nom de colonne portant un index quelque part dans ce schéma. */
async function nomsIndexes() {
  const db = await connexion();
  const lignes = await db.requete(
    'SELECT DISTINCT COLUMN_NAME FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE()',
    [],
  );
  return new Set(lignes.map((l) => l.COLUMN_NAME));
}

/**
 * Les colonnes d'une source, annotées de ce qu'il faut pour un défaut sain :
 * ce qui est indexé, ce qui ressemble au client, ce qui doit rester décoché.
 */
export async function decrireSource(nom) {
  // Le nom part en paramètre lié, jamais en interpolation — mais il est vérifié
  // quand même, pour qu'une valeur malformée échoue ici et non à la base.
  if (!estIdentifiant(nom) || !introspectionDisponible()) return null;

  const db = await connexion();
  const [colonnes, indexees] = await Promise.all([
    db.requete(
      `SELECT COLUMN_NAME, DATA_TYPE, COLUMN_TYPE, IS_NULLABLE
         FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?
        ORDER BY ORDINAL_POSITION`,
      [nom],
    ),
    nomsIndexes(),
  ]);

  if (colonnes.length === 0) return null;

  return colonnes.map((c) => {
    // Pour une vue, MySQL ne tient aucune statistique : c'est un indice fondé
    // sur le nom, pas une garantie. L'écran le dit comme tel.
    const indexee = indexees.has(c.COLUMN_NAME);
    return {
      nom: c.COLUMN_NAME,
      type: c.DATA_TYPE,
      typeComplet: c.COLUMN_TYPE,
      nullable: c.IS_NULLABLE === 'YES',
      indexee,
      clientProbable: CLIENT_PROBABLE.test(c.COLUMN_NAME),
      sensible: sensibiliteDe(c.COLUMN_NAME),
      filtresSuggeres: filtresSuggeres(c.DATA_TYPE, indexee),
    };
  });
}

/**
 * Le `CREATE VIEW` qui transforme une table nue en quelque chose d'exposable.
 * Rendu comme du texte, à exécuter par quelqu'un : cette application n'émet
 * aucun DDL. Un back-office capable de modifier la forme d'une base est un
 * back-office capable de le faire par accident.
 *
 * La colonne du client figure dans la vue même si elle n'est pas exposée : sans
 * elle, la vue ne pourrait plus être filtrée par client, et la ressource
 * rendrait les lignes de tout le monde.
 */
export function instructionVue(table, nomVue, colonnes, colonneClient) {
  if (!estIdentifiant(table) || !estIdentifiant(nomVue)) return null;
  if (!colonnes.every(estIdentifiant) || !estIdentifiant(colonneClient)) return null;
  const toutes = colonnes.includes(colonneClient) ? colonnes : [colonneClient, ...colonnes];
  return `CREATE OR REPLACE VIEW \`${nomVue}\` AS\n  SELECT ${toutes.map((c) => `\`${c}\``).join(', ')}\n    FROM \`${table}\`;`;
}

/** Le nom de vue par défaut d'une table, selon la convention « v_ » du catalogue. */
export function nomVuePour(table, prefixe = process.env.DB_PREFIX || 'landing_') {
  const nu = String(table).startsWith(prefixe) ? String(table).slice(prefixe.length) : String(table);
  return `v_${nu}`;
}
