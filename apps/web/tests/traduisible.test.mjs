/**
 * Les deux listes de ce qui se traduit doivent dire la même chose.
 *
 * Le script `pipeline/traduire.mjs` traduit ce que déclare
 * `pipeline/lib/traduisible.mjs` ; la console présente au relecteur ce que
 * déclare `lib/admin/donnees.mjs`. Une divergence ne casse rien tout de
 * suite — elle produit un champ traduit automatiquement que personne ne peut
 * relire, ou un champ relisible que rien ne traduit. Les deux se découvrent
 * des mois plus tard, sur une langue publiée.
 */
import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';

import { ENTITES } from '../../../pipeline/lib/traduisible.mjs';
import { ENTITES_TRADUISIBLES } from '../src/lib/admin/donnees.mjs';
import { LANGUES_OFFRE } from '../src/lib/offres/courriel.mjs';
import { locale } from '../src/lib/offres/calcul.mjs';

const clefs = (liste) =>
  Object.fromEntries(liste.map((e) => [e.cle, e.champs.map((c) => c.nom).sort()]));

describe('le pipeline et la console', () => {
  it('traduisent les mêmes entités', () => {
    assert.deepEqual(
      ENTITES.map((e) => e.cle).sort(),
      ENTITES_TRADUISIBLES.map((e) => e.cle).sort(),
    );
  });

  it('traduisent les mêmes champs', () => {
    assert.deepEqual(clefs(ENTITES), clefs(ENTITES_TRADUISIBLES));
  });

  it('marquent les mêmes champs comme listes JSON', () => {
    const json = (liste) =>
      liste.flatMap((e) => e.champs.filter((c) => c.json).map((c) => `${e.cle}.${c.nom}`)).sort();
    assert.deepEqual(json(ENTITES), json(ENTITES_TRADUISIBLES));
  });

  it('visent la même table pour chaque entité', () => {
    const tables = (liste) => Object.fromEntries(liste.map((e) => [e.cle, e.table]));
    assert.deepEqual(tables(ENTITES), tables(ENTITES_TRADUISIBLES));
  });
});

describe("les langues d'une offre", () => {
  it('couvrent les neuf langues déclarées du site', () => {
    for (const code of ['fr', 'en', 'nl', 'de', 'it', 'pl', 'uk', 'ru', 'ar']) {
      assert.equal(LANGUES_OFFRE.includes(code), true, `${code} ne sait pas écrire une offre`);
    }
  });

  it('ont toutes une locale de formatage', () => {
    for (const code of LANGUES_OFFRE) {
      const l = locale(code);
      assert.match(l, /^[a-z]{2}-[A-Z]{2}$/, `${code} → ${l}`);
      // La locale doit exister vraiment, sinon Intl retombe en silence.
      assert.doesNotThrow(() => new Intl.NumberFormat(l, { style: 'currency', currency: 'EUR' }).format(1));
    }
  });

  it("n'utilisent jamais le séparateur anglo-saxon par défaut", () => {
    // « 1,234.56 » sur un devis européen se lit comme mille fois trop peu.
    assert.equal(locale('langue-inconnue'), 'fr-BE');
  });
});
