/**
 * Les tests du catalogue de données — `node --test`, aucune dépendance.
 *
 * Ce fichier porte sur la seule chose qui compte ici : ce qui atteint le SQL.
 * Le catalogue tient parce qu'un identifiant vient toujours d'une déclaration
 * et jamais d'une requête, et qu'une valeur part toujours en paramètre lié. Si
 * cette propriété casse, elle casse en silence — d'où les tests ci-dessous, qui
 * inspectent le SQL produit plutôt que la valeur de retour d'une fonction.
 *
 * La leçon vient d'un vrai défaut : les tests de la version précédente
 * vérifiaient le retour du générateur, pas la sortie de la route, et un BIGINT
 * rendu par MySQL faisait lever `JSON.stringify` en production.
 */
import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';

import {
  COLONNE_CLIENT,
  OPERATEURS,
  controlerRessource,
  estCleRessource,
  estIdentifiant,
  garanties,
} from '../src/lib/donnees/catalogue.mjs';
import { DemandeRefusee, lireDemande, normaliserLigne, sqlDe } from '../src/lib/donnees/requete.mjs';
import { instructionVue, nomVuePour, sensibiliteDe } from '../src/lib/donnees/introspection.mjs';
import { enregistrerBase, hoteAcceptable, refusHote, sonderServeur } from '../src/lib/donnees/bases.mjs';
import { cleProposee, enregistrerEndpoint } from '../src/lib/donnees/endpoints.mjs';

/** Une ressource valide, dont partent la plupart des tests. */
const VENTES = {
  version: 1,
  portee: 'colonne',
  libelle: 'Ventes par jour',
  source: 'v_ventes',
  colonnes: ['jour_exploitation', 'boutique_id', 'total_ttc'],
  filtres: { jour_exploitation: ['gte', 'lte'], boutique_id: ['eq', 'in'] },
  triables: ['jour_exploitation'],
  maxLignes: 500,
  colonneClient: COLONNE_CLIENT,
};

const demande = (query) => lireDemande(new URL(`https://x/y${query}`), VENTES);

describe('identifiants', () => {
  it('accepte un nom SQL nu', () => {
    assert.equal(estIdentifiant('v_ventes'), true);
    assert.equal(estIdentifiant('total_ttc'), true);
  });

  it('refuse tout ce qui pourrait fermer une chaîne ou une parenthèse', () => {
    for (const mauvais of ['v_ventes; DROP TABLE x', 'a b', '`x`', "x'", 'X_MAJ', '1col', '']) {
      assert.equal(estIdentifiant(mauvais), false, mauvais);
    }
  });

  it('exige une clé pointée en minuscules', () => {
    assert.equal(estCleRessource('ventes.par_jour'), true);
    assert.equal(estCleRessource('ventes'), false);
    assert.equal(estCleRessource('Ventes.ParJour'), false);
  });
});

describe('contrôle d’une déclaration', () => {
  it('accepte une ressource bien formée', () => {
    assert.equal(controlerRessource('ventes.par_jour', VENTES), null);
  });

  it('refuse une table nue', () => {
    // Exposer une table fait de ses noms de colonnes le contrat public.
    const r = controlerRessource('ventes.par_jour', { ...VENTES, source: 'landing_ventes' });
    assert.match(r, /vue/);
  });

  it('exige la colonne du client', () => {
    assert.match(controlerRessource('a.b', { ...VENTES, colonneClient: '' }), /client/);
  });

  it('refuse d’exposer la colonne du client', () => {
    // Elle sert à filtrer. L'exposer aide à deviner celle des autres.
    const r = controlerRessource('a.b', { ...VENTES, colonnes: [...VENTES.colonnes, COLONNE_CLIENT] });
    assert.match(r, /filtre, elle ne sort pas/);
  });

  it('refuse un filtre sur une colonne non exposée', () => {
    assert.match(controlerRessource('a.b', { ...VENTES, filtres: { marge: ['eq'] } }), /non exposée/);
  });

  it('refuse un tri sur une colonne non exposée', () => {
    assert.match(controlerRessource('a.b', { ...VENTES, triables: ['marge'] }), /non exposée/);
  });

  it('refuse un plafond absent, nul ou démesuré', () => {
    for (const n of [0, -1, 5000, null, 1.5]) {
      assert.equal(typeof controlerRessource('a.b', { ...VENTES, maxLignes: n }), 'string', String(n));
    }
  });

  it('refuse un opérateur inventé', () => {
    assert.match(controlerRessource('a.b', { ...VENTES, filtres: { boutique_id: ['like'] } }), /Opérateur inconnu/);
  });
});

describe('garanties affichées', () => {
  it('sont toutes vertes sur une ressource saine', () => {
    assert.ok(garanties(VENTES).every((g) => g.ok));
  });

  // Une console qui affiche « sécurisé ✓ » en dur ment le jour où la
  // déclaration change. Chaque ligne est relue depuis la déclaration.
  it('virent au rouge quand la déclaration se dégrade', () => {
    const sale = garanties({ ...VENTES, source: 'landing_ventes', maxLignes: 99999 });
    assert.ok(sale.some((g) => !g.ok && g.libelle === 'Source'));
    assert.ok(sale.some((g) => !g.ok && g.libelle === 'Plafond de lignes'));
  });
});

describe('lecture d’une demande', () => {
  it('ne retient que les filtres déclarés', () => {
    const d = demande('?filtre[boutique_id][eq]=4');
    assert.deepEqual(d.filtres, [{ colonne: 'boutique_id', op: 'eq', valeur: '4' }]);
  });

  // Ignorer poliment un filtre inconnu rendrait plus de lignes que demandé, et
  // personne ne s'en apercevrait avant de lire un chiffre faux.
  it('refuse un filtre non déclaré au lieu de l’ignorer', () => {
    assert.throws(() => demande('?filtre[marge][eq]=1'), DemandeRefusee);
  });

  it('refuse un opérateur non autorisé sur une colonne pourtant filtrable', () => {
    assert.throws(() => demande('?filtre[jour_exploitation][eq]=2026-01-01'), /non autorisé/);
  });

  it('borne la limite au plafond de la ressource', () => {
    assert.equal(demande('?limite=99999').limite, 500);
    assert.equal(demande('?limite=10').limite, 10);
    assert.equal(demande('?limite=0').limite, 500);
    assert.equal(demande('?limite=abc').limite, 500);
  });

  it('refuse un tri hors des colonnes triables', () => {
    assert.throws(() => demande('?tri=total_ttc:asc'), /Tri non autorisé/);
    assert.deepEqual(demande('?tri=jour_exploitation:asc').tri, { colonne: 'jour_exploitation', sens: 'asc' });
  });

  it('ne prend jamais le client dans la requête', () => {
    // Un `?prospect_id=` pris au mot est exactement la façon dont un client
    // finit par lire les lignes d'un autre.
    const d = demande('?prospect_id=7&tenant=7');
    assert.equal(d.filtres.length, 0);
  });
});

describe('SQL produit', () => {
  it('filtre toujours sur le client, en premier', () => {
    const { sql } = sqlDe(VENTES, demande(''));
    assert.match(sql, /WHERE `prospect_id` = \?/);
  });

  it('n’expose que les colonnes déclarées', () => {
    const { sql } = sqlDe(VENTES, demande(''));
    assert.match(sql, /^SELECT `jour_exploitation`, `boutique_id`, `total_ttc` FROM `v_ventes`/);
    assert.ok(!sql.includes('*'));
  });

  // Le point qui compte : une valeur ne devient jamais du texte SQL.
  it('lie les valeurs au lieu de les écrire', () => {
    const d = demande("?filtre[boutique_id][eq]=4' OR '1'='1");
    const { sql, valeurs } = sqlDe(VENTES, d);
    assert.ok(!sql.includes("OR '1'='1"));
    assert.match(sql, /`boutique_id` = \?/);
    assert.deepEqual(valeurs, ["4' OR '1'='1"]);
  });

  it('borne un « in » à cent valeurs et les lie toutes', () => {
    const grand = Array.from({ length: 250 }, (_, i) => i).join(',');
    const { sql, valeurs } = sqlDe(VENTES, demande(`?filtre[boutique_id][in]=${grand}`));
    assert.equal(valeurs.length, 100);
    assert.equal((sql.match(/\?/g) || []).length, 1 + 100 + 1, 'client + 100 valeurs + limite');
  });

  it('refuse un « in » vide plutôt que de produire IN ()', () => {
    assert.throws(() => sqlDe(VENTES, demande('?filtre[boutique_id][in]=')), /vide/);
  });

  // Bretelles et ceinture : une entrée ajoutée à la main avec une faute doit
  // échouer ici plutôt qu'atteindre la base.
  it('échoue sur un identifiant malformé venu du catalogue lui-même', () => {
    const piege = { ...VENTES, source: 'v_ventes`; DROP TABLE x; --' };
    assert.throws(() => sqlDe(piege, demande('')), /Identifiant SQL invalide/);
  });

  it('n’écrit jamais', () => {
    const { sql } = sqlDe(VENTES, demande('?tri=jour_exploitation:desc'));
    assert.ok(!/INSERT|UPDATE|DELETE|DROP/i.test(sql));
  });
});

describe('normalisation des lignes', () => {
  it('rend un BIGINT sûr en nombre', () => {
    assert.equal(normaliserLigne({ id: 42n }).id, 42);
  });

  // Un identifiant faux est pire qu'un identifiant incommode.
  it('rend un BIGINT hors plage en chaîne plutôt qu’arrondi', () => {
    const enorme = BigInt(Number.MAX_SAFE_INTEGER) + 10n;
    assert.equal(normaliserLigne({ id: enorme }).id, enorme.toString());
  });

  it('rend une date en ISO et un tampon en base64', () => {
    assert.equal(normaliserLigne({ d: new Date('2026-01-02T03:04:05Z') }).d, '2026-01-02T03:04:05.000Z');
    assert.equal(normaliserLigne({ b: Buffer.from('ok') }).b, 'b2s=');
  });

  it('laisse le reste intact, y compris null', () => {
    assert.deepEqual(normaliserLigne({ a: 'x', b: null, c: 1.5 }), { a: 'x', b: null, c: 1.5 });
  });
});

describe('instruction CREATE VIEW', () => {
  it('inclut la colonne du client même si elle n’est pas exposée', () => {
    // Sans elle, la vue ne peut plus être filtrée par client — et la ressource
    // rendrait les lignes de tout le monde.
    const sql = instructionVue('landing_ventes', 'v_ventes', ['total_ttc'], 'prospect_id');
    assert.match(sql, /`prospect_id`, `total_ttc`/);
  });

  it('ne la duplique pas si elle est déjà là', () => {
    const sql = instructionVue('landing_ventes', 'v_ventes', ['prospect_id', 'total_ttc'], 'prospect_id');
    assert.equal((sql.match(/prospect_id/g) || []).length, 1);
  });

  it('refuse tout nom qui n’est pas un identifiant', () => {
    assert.equal(instructionVue('x`; DROP', 'v_x', ['a'], 'prospect_id'), null);
    assert.equal(instructionVue('x', 'v_x', ['a`b'], 'prospect_id'), null);
    assert.equal(instructionVue('x', 'v_x', ['a'], 'p`c'), null);
  });

  it('suit la convention de nommage des vues', () => {
    assert.equal(nomVuePour('landing_ventes', 'landing_'), 'v_ventes');
    assert.equal(nomVuePour('autre_table', 'landing_'), 'v_autre_table');
  });
});

describe('découverte des bases d’un serveur', () => {
  // Les deux refus qui doivent tomber AVANT toute tentative de connexion :
  // sonder un hôte, c'est déjà ouvrir une socket depuis le serveur.
  it('refuse le lien-local sans même essayer', async () => {
    const r = await sonderServeur({ hote: '169.254.169.254', port: 3306, identifiant: 'x', motDePasse: 'y' });
    assert.equal(r.ok, false);
    assert.match(r.dit, /lien-local/);
  });

  it('refuse une sonde sans mot de passe', async () => {
    const r = await sonderServeur({ hote: 'db.exemple', port: 3306, identifiant: 'x', motDePasse: '' });
    assert.equal(r.ok, false);
    assert.match(r.dit, /Mot de passe/);
  });

  it('ne lève jamais — l’écran doit pouvoir s’écrire', async () => {
    // Port fermé : l'appel doit rendre un échec décrit, pas une exception.
    const r = await sonderServeur({ hote: '127.0.0.1', port: 1, identifiant: 'x', motDePasse: 'y' });
    assert.equal(r.ok, false);
    assert.equal(typeof r.dit, 'string');
  });
});

/**
 * Chaque refus dit ce qui ne va pas, et rien d'autre.
 *
 * Un message unique pour tous les refus annonçait « pas sur le lien-local » à
 * quelqu'un qui avait simplement laissé le champ vide — signalé depuis l'écran.
 * Un message qui décrit une autre situation que la sienne fait chercher au
 * mauvais endroit, ce qui est pire que pas de message du tout.
 */
describe('refus d’un hôte de base', () => {
  it('distingue le champ vide du lien-local', () => {
    assert.match(refusHote(''), /Renseignez l’hôte/);
    assert.match(refusHote('   '), /Renseignez l’hôte/);
    assert.match(refusHote('169.254.169.254'), /lien-local/);
  });

  // Les collages depuis une chaîne de connexion : on dit quoi retirer, au lieu
  // de laisser le pilote échouer sur une résolution de nom incompréhensible.
  it('reconnaît un collage de chaîne de connexion', () => {
    assert.match(refusHote('mysql://db.exemple/base'), /sans schéma/);
    assert.match(refusHote('db.exemple/base'), /sans chemin/);
    assert.match(refusHote('127.0.0.1:3306'), /port se saisit/);
    assert.match(refusHote('db exemple'), /espace/);
  });

  it('accepte ce qu’un hôte est vraiment', () => {
    for (const h of ['127.0.0.1', 'localhost', '10.0.0.4', '192.168.1.10', 'db-01.interne', 'db.exemple.fr']) {
      assert.equal(refusHote(h), null, h);
      assert.equal(hoteAcceptable(h), true, h);
    }
  });

  it('exige l’identifiant avant d’ouvrir une socket', async () => {
    const r = await sonderServeur({ hote: 'db.exemple', identifiant: '', motDePasse: 'y' });
    assert.equal(r.ok, false);
    assert.match(r.dit, /identifiant/);
  });
});

describe('la base de la console n’est celle d’aucun client', () => {
  // Le refus tombe avant toute requête : ce test n'a donc pas besoin de base.
  // C'est voulu — le contrôle le plus important doit être le moins coûteux.
  it('la refuse, en disant ce qu’elle exposerait', async () => {
    process.env.DB_HOST = '10.0.0.9';
    process.env.DB_NAME = 'tfb_landing';
    const r = await enregistrerBase(1, { hote: '10.0.0.9', port: 3306, base: 'tfb_landing' }, 'x');
    assert.equal(r.ok, false);
    assert.match(r.erreur, /base de la console/);
    assert.match(r.erreur, /prospects, les offres et les contrats/);
  });

  it('laisse passer une base de même nom sur un autre serveur', async () => {
    // Deux serveurs peuvent porter une base au même nom ; seul le couple
    // hôte + base désigne celle de la console.
    process.env.DB_HOST = '10.0.0.9';
    process.env.DB_NAME = 'tfb_landing';
    const r = await enregistrerBase(1, { hote: '10.0.0.99', port: 3306, base: 'tfb_landing' }, 'x')
      .catch((e) => ({ ok: false, erreur: e.message }));
    // Elle ira jusqu'à la base — donc elle échouera ici faute de connexion —
    // mais surtout pas sur le message de la console.
    assert.ok(!/base de la console/.test(r.erreur || ''));
  });
});

/**
 * La bibliothèque vit en base, et c'est un changement de fond : une déclaration
 * dans le code se relit dans une diff, une ligne en base ne se relit nulle part.
 * Ce qui rachète l'échange, c'est que `controlerRessource()` s'applique à
 * l'écriture — donc rien d'invalide n'entre. Ces tests portent là-dessus.
 */
describe('clé proposée par le générateur', () => {
  it('dérive une clé lisible du nom de la vue', () => {
    assert.equal(cleProposee('v_ventes'), 'ventes.liste');
    assert.equal(cleProposee('ventes'), 'ventes.liste');
  });

  it('en trouve une libre quand la première est prise', () => {
    assert.equal(cleProposee('v_ventes', new Set(['ventes.liste'])), 'ventes.liste_2');
    assert.equal(cleProposee('v_ventes', new Set(['ventes.liste', 'ventes.liste_2'])), 'ventes.liste_3');
  });

  it('ne propose jamais une clé que le contrôle refuserait', () => {
    for (const source of ['v_Ventes-2026', 'v_', '', 'V_MAJ']) {
      const c = cleProposee(source);
      if (c) assert.equal(estCleRessource(c), true, `${source} → ${c}`);
    }
  });
});

describe('écriture d’un endpoint', () => {
  const bon = {
    cle: 'ventes.par_jour', nom: 'Ventes par jour',
    pourquoi: 'Alimente le graphe d’accueil de la caisse.',
    portee: 'base_client', source: 'v_ventes',
    colonnes: ['jour', 'total'], filtres: { jour: ['gte'] }, triables: ['jour'], maxLignes: 500,
  };

  // Ces trois refus tombent avant toute requête : le contrôle le plus important
  // est aussi celui qui ne coûte rien.
  it('exige un nom lisible', async () => {
    const r = await enregistrerEndpoint(0, { ...bon, nom: '' });
    assert.equal(r.ok, false);
    assert.match(r.erreur, /nom lisible/);
  });

  it('exige de dire à quoi il sert', async () => {
    // Un endpoint dont personne ne sait à quoi il sert ne se supprime jamais.
    const r = await enregistrerEndpoint(0, { ...bon, pourquoi: 'ventes' });
    assert.equal(r.ok, false);
    assert.match(r.erreur, /à quoi il sert/);
  });

  it('applique le contrôle d’une déclaration, mot pour mot', async () => {
    const surTable = await enregistrerEndpoint(0, { ...bon, source: 'landing_ventes' });
    assert.match(surTable.erreur, /doit être une vue/);
    const sansPlafond = await enregistrerEndpoint(0, { ...bon, maxLignes: 99999 });
    assert.match(sansPlafond.erreur, /plafond/);
    const filtreFantome = await enregistrerEndpoint(0, { ...bon, filtres: { marge: ['eq'] } });
    assert.match(filtreFantome.erreur, /non exposée/);
  });
});
