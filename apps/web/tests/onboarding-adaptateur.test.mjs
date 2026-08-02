/**
 * Les tests de l'adaptateur générique, contre une fausse caisse.
 *
 * Une vraie caisse écoute sur un port local : c'est ce qui permet de vérifier
 * la pagination, les reprises et les redirections comme elles se passent
 * réellement, plutôt que de simuler `fetch` et de tester le simulacre.
 */
import { strict as assert } from 'node:assert';
import { createServer } from 'node:http';
import { after, before, describe, it } from 'node:test';

import {
  adaptateurGenerique,
  curseurSuivant,
  elementsDe,
  entetesAuth,
  remplirGabarit,
} from '../src/lib/onboarding/adaptateur.mjs';

const CLE = 'sk_test_9f3a2b7c4f2a8e11';

/** Le manifest d'une caisse REST ordinaire. */
const MANIFEST = {
  code: 'faux_pos',
  name: 'Fausse caisse',
  auth: { mode: 'bearer' },
  endpoints: [
    {
      kind: 'ventes', path_template: '/sales?from={from}&to={to}&page={page}',
      pagination: { mode: 'page', items_path: 'data', total_path: 'meta.total', size_default: 2 },
    },
    { kind: 'produits', path_template: '/products', pagination: { mode: 'aucune', items_path: 'data' } },
    { kind: 'categories', path_template: '/categories', pagination: { mode: 'aucune', items_path: 'data' } },
    { kind: 'boutiques', path_template: '/locations', pagination: { mode: 'aucune', items_path: 'data' } },
  ],
};

/** Une ligne de vente, avec un nom de client dedans — il ne doit pas ressortir. */
const vente = (n) => ({
  id: `L-${n}`, location_id: 'S1', closed_at: '2026-08-01T20:00:00+02:00',
  item_id: 'P-1', name: 'Pain', quantity: 1, price: 160,
  customer_name: 'Marie Delcourt', customer_email: 'marie@x.be',
});

let serveur;
let base;
let vus = [];
/** Ce que le serveur doit répondre, réglé test par test. */
let scenario = 'normal';

before(async () => {
  serveur = createServer((req, rep) => {
    vus.push({ url: req.url, auth: req.headers.authorization });
    const url = new URL(req.url, 'http://x');

    if (scenario === 'auth' ) { rep.writeHead(401).end('{}'); return; }
    if (scenario === 'introuvable') { rep.writeHead(404).end('{}'); return; }
    if (scenario === 'pasjson') { rep.writeHead(200).end('<html>coucou</html>'); return; }
    if (scenario === 'redirection-interne') {
      rep.writeHead(302, { Location: 'https://169.254.169.254/latest/meta-data/' }).end();
      return;
    }
    if (scenario === 'instable' && vus.length < 3) { rep.writeHead(503).end('{}'); return; }

    const json = (o) => rep.writeHead(200, { 'Content-Type': 'application/json' }).end(JSON.stringify(o));
    if (url.pathname === '/locations') return json({ data: [{ id: 'S1' }, { id: 'S2' }, { id: 'S3' }] });
    if (url.pathname === '/products') return json({ data: Array.from({ length: 5 }, (_, i) => ({ id: `P-${i}` })) });
    if (url.pathname === '/categories') return json({ data: [{ id: 'C-1' }, { id: 'C-2' }] });
    if (url.pathname === '/sales') {
      const page = Number(url.searchParams.get('page') || 1);
      // Cinq ventes en tout, deux par page : trois pages, la dernière courte.
      const toutes = [1, 2, 3, 4, 5].map(vente);
      return json({ data: toutes.slice((page - 1) * 2, page * 2), meta: { total: 5 } });
    }
    rep.writeHead(404).end('{}');
  });
  await new Promise((r) => serveur.listen(0, '127.0.0.1', r));
  base = `http://127.0.0.1:${serveur.address().port}`;
});

after(() => serveur.close());

/** L'adaptateur, autorisé à parler à 127.0.0.1 puisque c'est notre faux POS. */
const pos = () => adaptateurGenerique(MANIFEST, { autoriserLocal: true });
const ctx = () => ({ config: { base_url: base }, secrets: { api_key: CLE } });

describe('les pièces du manifest', () => {
  it('remplit un gabarit d’adresse', () => {
    assert.equal(remplirGabarit('/sales?page={page}', { page: 3 }), '/sales?page=3');
  });

  it('encode les valeurs — une esperluette casserait la requête', () => {
    assert.equal(remplirGabarit('/x?org={org}', { org: 'a&b=c' }), '/x?org=a%26b%3Dc');
  });

  it('empêche de sortir du chemin prévu', () => {
    assert.equal(remplirGabarit('/x/{id}', { id: '../admin' }), '/x/..%2Fadmin');
  });

  it('laisse un jeton inconnu tel quel plutôt que de l’effacer', () => {
    assert.equal(remplirGabarit('/x?a={inconnu}', {}), '/x?a={inconnu}');
  });

  it('pose l’en-tête d’authentification selon le mode', () => {
    assert.deepEqual(entetesAuth({ auth: { mode: 'bearer' } }, {}, { api_key: 'K' }),
      { Authorization: 'Bearer K' });
    assert.deepEqual(entetesAuth({ auth: { mode: 'entete' } }, { auth_header_name: 'X-Cle' }, { api_key: 'K' }),
      { 'X-Cle': 'K' });
    assert.deepEqual(entetesAuth({ auth: { mode: 'aucun' } }, {}, {}), {});
  });

  it('extrait les éléments, où qu’ils soient enveloppés', () => {
    assert.equal(elementsDe({ data: [1, 2] }, { items_path: 'data' }).length, 2);
    assert.equal(elementsDe([1, 2, 3], {}).length, 3);
    assert.equal(elementsDe({ data: null }, { items_path: 'data' }).length, 0);
  });

  it('sait quand s’arrêter de paginer', () => {
    const p = { mode: 'page', items_path: 'data', total_path: 'meta.total', size_default: 2 };
    assert.equal(curseurSuivant({ data: [1, 2], meta: { total: 5 } }, p, 1, 2), '2');
    assert.equal(curseurSuivant({ data: [1], meta: { total: 5 } }, p, 3, 5), null);
    // Sans total annoncé : on continue tant qu'une page est pleine.
    const q = { mode: 'page', items_path: 'data', size_default: 2 };
    assert.equal(curseurSuivant({ data: [1, 2] }, q, 1, 2), '2');
    assert.equal(curseurSuivant({ data: [1] }, q, 2, 3), null);
  });
});

describe('le test de connexion', () => {
  it('rend des nombres, pas un « OK »', async () => {
    scenario = 'normal'; vus = [];
    const r = await pos().tester(ctx());
    assert.equal(r.ok, true, JSON.stringify(r));
    assert.equal(r.detail.boutiques, 3);
    assert.equal(r.detail.produits, 5);
    assert.equal(r.detail.categories, 2);
    assert.equal(r.detail.lignes, 2, 'la première page de ventes');
  });

  it('envoie bien la clé, et une seule fois par appel', async () => {
    scenario = 'normal'; vus = [];
    await pos().tester(ctx());
    assert.equal(vus.every((v) => v.auth === `Bearer ${CLE}`), true);
  });

  it('ne lève pas sur une clé refusée : il rend un code et une phrase', async () => {
    scenario = 'auth'; vus = [];
    const r = await pos().tester(ctx());
    assert.equal(r.ok, false);
    assert.equal(r.code, 'AUTH_REFUSEE');
    assert.equal(r.message.includes('refusée'), true);
    // Et il n'a pas insisté : une clé fausse le restera au quatrième essai.
    assert.equal(vus.length, 1);
  });

  it('dit quand la réponse n’est pas du JSON', async () => {
    scenario = 'pasjson'; vus = [];
    const r = await pos().tester(ctx());
    assert.equal(r.code, 'FORMAT_INCONNU');
  });
});

describe('ce qui protège malgré tout', () => {
  it('refuse de suivre une redirection vers une adresse interne', async () => {
    // Le contrôle d'adresse serait inutile si une redirection permettait de
    // le contourner une fois passé.
    scenario = 'redirection-interne'; vus = [];
    const r = await pos().lister('produits', ctx());
    assert.equal(r.ok, false, JSON.stringify(r));
    assert.equal(r.code, 'HOTE_INTERDIT', JSON.stringify(r));
  });

  it('le drapeau de développement n’ouvre que la boucle locale', async () => {
    // Un drapeau censé permettre d'essayer contre 127.0.0.1 n'a aucune raison
    // d'ouvrir le service de métadonnées de l'hébergeur.
    const local = adaptateurGenerique(
      { ...MANIFEST, endpoints: [{ kind: 'produits', path_template: '/latest/meta-data/' }] },
      { autoriserLocal: true },
    );
    const r = await local.lister('produits', {
      config: { base_url: 'http://169.254.169.254' }, secrets: {},
    });
    assert.equal(r.ok, false);
    // Le protocole passe — c'est le rôle du drapeau — mais l'adresse, non.
    assert.equal(r.code, 'HOTE_INTERDIT');
  });

  it('refuse une caisse en http avant même d’appeler', async () => {
    vus = [];
    const strict = adaptateurGenerique(MANIFEST, {});
    const r = await strict.lister('produits', { config: { base_url: base }, secrets: { api_key: CLE } });
    assert.equal(r.code, 'HTTPS_REQUIS');
    assert.equal(vus.length, 0, 'rien n’est sorti du processus');
  });

  it('ne laisse pas sortir les données personnelles du client final', async () => {
    scenario = 'normal'; vus = [];
    const r = await pos().echantillon(ctx());
    assert.equal(r.ok, true);
    const brut = JSON.stringify(r.lignes);
    assert.equal(brut.includes('Marie Delcourt'), false, brut);
    assert.equal(brut.includes('marie@x.be'), false);
    // Mais la vente, elle, est bien là.
    assert.equal(r.lignes[0].id, 'L-1');
    assert.equal(r.lignes[0].price, 160);
  });

  it('ne met jamais la clé dans une trace', async () => {
    scenario = 'normal'; vus = [];
    const traces = [];
    await pos().lister('produits', { ...ctx(), journaliser: (t) => traces.push(t) });
    assert.equal(traces.length > 0, true);
    assert.equal(traces.join('\n').includes(CLE), false, traces.join('\n'));
  });
});

describe('la lecture des ventes', () => {
  it('rend les pages une à une, et s’arrête au bout', async () => {
    scenario = 'normal'; vus = [];
    const pages = [];
    for await (const p of pos().ventes(ctx())) pages.push(p);
    assert.equal(pages.length, 3, 'cinq ventes, deux par page');
    assert.deepEqual(pages.map((p) => p.lignes.length), [2, 2, 1]);
    assert.equal(pages.every((p) => p.ok), true);
  });

  it('rend un curseur à chaque page — c’est ce qui permet de reprendre', async () => {
    scenario = 'normal'; vus = [];
    const pages = [];
    for await (const p of pos().ventes(ctx())) pages.push(p);
    assert.deepEqual(pages.map((p) => p.curseur), ['1', '2', '3']);
  });

  it('reprend au curseur au lieu de tout relire', async () => {
    scenario = 'normal'; vus = [];
    const pages = [];
    for await (const p of pos().ventes({ ...ctx(), curseur: '3' })) pages.push(p);
    assert.equal(pages.length, 1);
    assert.equal(pages[0].lignes[0].id, 'L-5');
  });

  it('rend un échec au lieu de lever, et s’arrête là', async () => {
    scenario = 'introuvable'; vus = [];
    const pages = [];
    for await (const p of pos().ventes(ctx())) pages.push(p);
    assert.equal(pages.length, 1);
    assert.equal(pages[0].ok, false);
    assert.equal(pages[0].code, 'ADRESSE_INTROUVABLE');
  });
});

describe('la résistance aux pannes passagères', () => {
  it('réessaie après deux 503 et finit par réussir', async () => {
    scenario = 'instable'; vus = [];
    const r = await pos().lister('produits', ctx());
    assert.equal(r.ok, true, JSON.stringify(r));
    assert.equal(vus.length >= 3, true, `${vus.length} appels`);
  });
});
