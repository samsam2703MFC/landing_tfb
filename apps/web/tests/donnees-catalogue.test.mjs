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
import { hoteAcceptable, refusHote, sonderServeur } from '../src/lib/donnees/bases.mjs';
import { codeProposition, controlerProposition } from '../src/lib/donnees/propositions.mjs';

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

describe('propositions', () => {
  const p = {
    cle: 'ventes.par_jour',
    portee: 'colonne',
    source: 'landing_ventes',
    sourceGenre: 'table',
    vue: 'v_ventes',
    colonnes: ['jour_exploitation', 'total_ttc'],
    filtres: { jour_exploitation: ['gte', 'lte'] },
    triables: ['jour_exploitation'],
    maxLignes: 500,
    colonneClient: 'prospect_id',
  };

  it('passent le même contrôle qu’une entrée du catalogue', () => {
    assert.equal(controlerProposition(p), null);
  });

  it('sont refusées quand la vue ne suit pas la convention', () => {
    assert.equal(typeof controlerProposition({ ...p, vue: 'landing_ventes' }), 'string');
  });

  it('produisent du code qui se relit dans une diff', () => {
    const code = codeProposition(p);
    assert.match(code, /'ventes\.par_jour': \{/);
    assert.match(code, /source: 'v_ventes',/);
    assert.match(code, /jour_exploitation: \['gte', 'lte'\],/);
    assert.match(code, /colonneClient: 'prospect_id',/);
  });

  it('n’écrivent pas de bloc de filtres vide de travers', () => {
    assert.match(codeProposition({ ...p, filtres: {} }), /filtres: \{\},/);
  });

  it('déclarent tous les opérateurs que le lecteur de demande connaît', () => {
    // Si les deux listes divergent, l'assistant propose un filtre que
    // l'exécution refusera — panne visible seulement chez le client.
    assert.deepEqual([...OPERATEURS].sort(), ['eq', 'gte', 'in', 'lte']);
  });
});

describe('détection des colonnes sensibles', () => {
  // Les motifs sont ancrés sur des segments entiers. Sans cela « moyen_paiement »
  // passait pour une donnée RH (« paie ») et « taux_tva » pour une donnée
  // personnelle — trouvé en exécutant l'assistant sur une vraie base. Un
  // assistant qui crie au loup apprend à son lecteur à ne plus le lire.
  it('ne se déclenche pas sur des colonnes anodines', () => {
    for (const nom of ['moyen_paiement', 'taux_tva', 'total_ttc', 'quantite', 'canal', 'devise']) {
      assert.equal(sensibiliteDe(nom), null, nom);
    }
  });

  it('se déclenche sur ce qui compte vraiment', () => {
    assert.equal(sensibiliteDe('prix_achat'), 'marge');
    assert.equal(sensibiliteDe('marge_brute'), 'marge');
    assert.equal(sensibiliteDe('email'), 'donnée personnelle');
    assert.equal(sensibiliteDe('client_iban'), 'donnée personnelle');
    assert.equal(sensibiliteDe('api_key'), 'secret');
    assert.equal(sensibiliteDe('cree_par'), 'donnée RH');
  });

  // Trouvé en lançant l'assistant sur les tables de ce dépôt : les motifs
  // venaient de la version anglaise et laissaient cocher `empreinte` — le
  // hachage scrypt d'un mot de passe — ainsi que le contenu du coffre.
  it('connaît le vocabulaire de ce dépôt, pas seulement l’anglais', () => {
    assert.equal(sensibiliteDe('empreinte'), 'secret');
    for (const colonne of ['chiffre', 'iv', 'sceau', 'version_cle']) {
      assert.equal(sensibiliteDe(colonne), 'secret', colonne);
    }
  });

  it('ne confond pas le chiffre d’affaires avec un chiffrement', () => {
    assert.equal(sensibiliteDe('chiffre_affaires'), null);
  });
});

/**
 * Chaque client a sa base, de structure identique aux autres. L'isolation n'est
 * donc plus un filtre dans le SQL mais la connexion elle-même — et c'est
 * précisément ce qui rend l'erreur invisible : un SQL sans WHERE sur le client
 * a l'air parfaitement sain. Ces tests portent sur la frontière entre les deux
 * portées, là où une confusion ferait fuiter sans rien casser.
 */
describe('base propre à chaque client', () => {
  const PAR_BASE = {
    version: 1,
    portee: 'base_client',
    libelle: 'Ventes par jour',
    source: 'v_ventes',
    colonnes: ['jour_exploitation', 'total_ttc'],
    filtres: { jour_exploitation: ['gte', 'lte'] },
    triables: ['jour_exploitation'],
    maxLignes: 500,
  };
  const sans = (q) => lireDemande(new URL(`https://x/y${q}`), PAR_BASE);

  it('accepte une déclaration sans colonne de client', () => {
    assert.equal(controlerRessource('ventes.par_jour', PAR_BASE), null);
  });

  // En poser une ferait croire à un filtre là où il n'y en a aucun : le jour où
  // la ressource passerait en base partagée, on croirait la protection déjà là.
  it('refuse une colonne de client dans une base qui n’appartient qu’à lui', () => {
    const r = controlerRessource('a.b', { ...PAR_BASE, colonneClient: 'prospect_id' });
    assert.match(r, /l’isolation est la connexion/);
  });

  it('exige une portée déclarée, sans défaut', () => {
    const { portee, ...sansPortee } = PAR_BASE;
    assert.match(controlerRessource('a.b', sansPortee), /Portée manquante/);
    assert.match(controlerRessource('a.b', { ...PAR_BASE, portee: 'globale' }), /Portée manquante/);
  });

  it('ne met aucun WHERE quand rien ne doit être filtré', () => {
    const { sql, valeurs } = sqlDe(PAR_BASE, sans(''));
    assert.equal(sql, 'SELECT `jour_exploitation`, `total_ttc` FROM `v_ventes` LIMIT ?');
    assert.deepEqual(valeurs, []);
  });

  it('garde le WHERE dès qu’un filtre est demandé', () => {
    const { sql, valeurs } = sqlDe(PAR_BASE, sans('?filtre[jour_exploitation][gte]=2026-08-01'));
    assert.match(sql, /WHERE `jour_exploitation` >= \?/);
    assert.deepEqual(valeurs, ['2026-08-01']);
    assert.ok(!sql.includes('prospect_id'));
  });

  it('produit une vue sans colonne de client', () => {
    const vue = instructionVue('ventes', 'v_ventes', ['jour_exploitation', 'total_ttc'], null);
    assert.equal(vue, 'CREATE OR REPLACE VIEW `v_ventes` AS\n  SELECT `jour_exploitation`, `total_ttc`\n    FROM `ventes`;');
  });

  it('écrit la portée dans le code proposé, et pas de colonne de client', () => {
    const code = codeProposition({ ...PAR_BASE, cle: 'ventes.par_jour', vue: 'v_ventes' });
    assert.match(code, /portee: 'base_client',/);
    assert.ok(!code.includes('colonneClient'));
  });

  // 169.254.169.254 répond en HTTP, pas en MySQL : pointer une « base » dessus
  // ne peut pas être une erreur de saisie honnête.
  it('refuse un hôte de base sur le lien-local', () => {
    assert.equal(hoteAcceptable('169.254.169.254'), false);
    assert.equal(hoteAcceptable('169.254.0.1'), false);
    assert.equal(hoteAcceptable(''), false);
    assert.equal(hoteAcceptable('db.belleville.example'), true);
    assert.equal(hoteAcceptable('10.0.0.4'), true);
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
