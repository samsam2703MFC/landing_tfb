/**
 * La connexion par code à six chiffres, et son verrou.
 *
 * Un code à six chiffres, c'est un million de combinaisons — quelques minutes
 * pour une machine. Ce qui le rend utilisable n'est pas sa longueur mais le
 * nombre d'essais accordés. Ces tests portent donc autant sur le verrou que sur
 * le code : sans le verrou, le reste ne protège rien.
 */
import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';

process.env.ADMIN_PASSWORD = 'mot-de-passe-de-secours-long';

import {
  codeTropSimple, empreinteValide, estCode, hacherCode,
} from '../src/lib/admin/session.mjs';
import {
  REGLAGES_VERROU, noterEchec, noterReussite, origine, peutEssayer, viderVerrou,
} from '../src/lib/admin/verrou.mjs';

describe('forme du code', () => {
  it('exige six chiffres, ni plus ni moins', () => {
    assert.equal(estCode('407392'), true);
    for (const mauvais of ['12345', '1234567', 'abcdef', '40739 ', '', null]) {
      assert.equal(estCode(mauvais), false, String(mauvais));
    }
  });

  // Le verrou protège de la force brute ; cette liste protège du plus petit
  // effort — les codes qu'on essaie avant de commencer à chercher.
  it('refuse les codes qu’on devine en trois essais', () => {
    for (const faible of ['000000', '111111', '123456', '654321', '121212', '198412']) {
      assert.equal(typeof codeTropSimple(faible), 'string', faible);
    }
  });

  it('accepte un code sans motif', () => {
    assert.equal(codeTropSimple('407392'), null);
  });

  it('se hache et se vérifie, jamais en clair', () => {
    const h = hacherCode('407392');
    assert.match(h, /^scrypt\$/);
    assert.ok(!h.includes('407392'));
    assert.equal(empreinteValide('407392', h), true);
    assert.equal(empreinteValide('407393', h), false);
  });

  it('deux comptes de même code ont des empreintes différentes', () => {
    // Le sel : sans lui, deux personnes de même code se reconnaîtraient dans
    // un dump, et casser l'une casserait l'autre.
    assert.notEqual(hacherCode('407392'), hacherCode('407392'));
  });
});

describe('verrou d’essais', () => {
  it('laisse la franchise puis bloque', () => {
    viderVerrou();
    for (let n = 0; n < REGLAGES_VERROU.franchise; n += 1) {
      assert.equal(peutEssayer('a').permis, true, `essai ${n + 1}`);
      noterEchec('a');
    }
    const apres = peutEssayer('a');
    assert.equal(apres.permis, false);
    assert.ok(apres.attendreS > 0);
  });

  it('double l’attente à chaque échec supplémentaire', () => {
    viderVerrou();
    const t = 1_000_000;
    for (let n = 0; n < REGLAGES_VERROU.franchise; n += 1) noterEchec('b', t);
    const un = peutEssayer('b', t).attendreS;
    noterEchec('b', t);
    const deux = peutEssayer('b', t).attendreS;
    assert.ok(deux >= un * 2 - 1, `${un} → ${deux}`);
  });

  // Un million de combinaisons à cinq essais puis attente doublée : la borne
  // est le plafond, et il suffit à rendre l'exhaustif absurde.
  it('plafonne l’attente sans la faire redescendre', () => {
    viderVerrou();
    const t = 2_000_000;
    for (let n = 0; n < 40; n += 1) noterEchec('c', t);
    assert.equal(peutEssayer('c', t).attendreS, REGLAGES_VERROU.attenteMaxMs / 1000);
  });

  it('une réussite efface l’ardoise', () => {
    viderVerrou();
    for (let n = 0; n < 10; n += 1) noterEchec('d');
    assert.equal(peutEssayer('d').permis, false);
    noterReussite('d');
    assert.equal(peutEssayer('d').permis, true);
  });

  it('compte chaque origine pour elle-même', () => {
    viderVerrou();
    for (let n = 0; n < 10; n += 1) noterEchec('e');
    assert.equal(peutEssayer('f').permis, true, 'une origine bloquée n’enferme pas les autres');
  });

  it('oublie une faute de frappe isolée', () => {
    viderVerrou();
    const vieux = 1000;
    for (let n = 0; n < 10; n += 1) noterEchec('g', vieux);
    // Une heure plus tard, l'ardoise est effacée : sinon un mois de fautes de
    // frappe finirait par bloquer quelqu'un qui n'a rien fait.
    assert.equal(peutEssayer('g', vieux + 61 * 60_000).permis, true);
  });

  it('lit l’adresse derrière un proxy, pas celle du proxy', () => {
    const requete = { headers: { get: (n) => (n === 'x-forwarded-for' ? '203.0.113.9, 10.0.0.1' : null) } };
    assert.equal(origine(requete, '10.0.0.1'), '203.0.113.9');
    assert.equal(origine({ headers: { get: () => null } }, '10.0.0.1'), '10.0.0.1');
  });
});
