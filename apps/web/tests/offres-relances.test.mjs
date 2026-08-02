/**
 * Les tests de la relance commerciale.
 *
 * Ce qui est vérifié ici n'est pas qu'une relance part, mais qu'elle ne part
 * **pas deux fois**, et pas sur une offre déjà tranchée. Une notification de
 * trop et plus personne ne les lit — celle qui compte passe avec les autres.
 */
import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';

import { aRelancer, joursEntre, prochaineRelance } from '../src/lib/offres/relances.mjs';

const LUNDI = new Date('2026-03-02T09:00:00Z');
const jours = (n, depuis = LUNDI) => new Date(depuis.getTime() + n * 86_400_000);

const ETAPE = { cle: 'offre-envoyee', relance_active: true, relance_jours: 7 };

/** Une offre en cours, entrée dans son étape le lundi. */
function offre(surcharges = {}) {
  return { statut: 'envoyee', etape: 'offre-envoyee', etape_le: LUNDI, relance_le: null, ...surcharges };
}

describe('le compte des jours', () => {
  it('compte des jours entiers, pas des fractions', () => {
    assert.equal(joursEntre(LUNDI, jours(6.9)), 6);
    assert.equal(joursEntre(LUNDI, jours(7)), 7);
  });

  it('rend zéro plutôt que NaN sur une date absente', () => {
    assert.equal(joursEntre(null, LUNDI), 0);
    assert.equal(joursEntre(LUNDI, 'pas une date'), 0);
  });
});

describe('faut-il relancer', () => {
  it('se tait avant le délai', () => {
    const r = aRelancer(offre(), ETAPE, jours(6));
    assert.equal(r.relancer, false);
    assert.equal(r.dort, 6);
  });

  it('relance le jour du délai', () => {
    const r = aRelancer(offre(), ETAPE, jours(7));
    assert.equal(r.relancer, true);
    assert.match(r.raison, /7 j/);
  });

  it('ne relance pas deux fois pour le même silence', () => {
    // Le premier réveil a eu lieu ; le second serait du bruit.
    const dejaFaite = offre({ relance_le: jours(7) });
    assert.equal(aRelancer(dejaFaite, ETAPE, jours(9)).relancer, false);
    assert.equal(aRelancer(dejaFaite, ETAPE, jours(30)).relancer, false);
  });

  it('recommence à compter quand l’offre change d’étape', () => {
    // La relance date d'avant le mouvement : elle ne vaut plus pour celui-ci.
    const bougee = offre({ relance_le: jours(-3), etape_le: LUNDI });
    assert.equal(aRelancer(bougee, ETAPE, jours(8)).relancer, true);
  });

  it('laisse tranquille une offre tranchée', () => {
    for (const statut of ['acceptee', 'refusee']) {
      const r = aRelancer(offre({ statut }), ETAPE, jours(90));
      assert.equal(r.relancer, false, statut);
      assert.match(r.raison, /close/);
    }
  });

  it('respecte l’interrupteur de l’étape', () => {
    const eteinte = { ...ETAPE, relance_active: false };
    assert.equal(aRelancer(offre(), eteinte, jours(90)).relancer, false);
  });

  it('traite un délai de zéro jour comme un refus, pas comme « tout de suite »', () => {
    // Deux façons de dire non — la case et le zéro — et aucune ne surprend.
    const sansDelai = { ...ETAPE, relance_jours: 0 };
    assert.equal(aRelancer(offre(), sansDelai, jours(90)).relancer, false);
  });

  it('tient sans étape', () => {
    assert.equal(aRelancer(offre(), null, jours(90)).relancer, false);
  });
});

describe('la prochaine relance', () => {
  it('tombe au bout du délai', () => {
    assert.equal(prochaineRelance(offre(), ETAPE).toISOString(), jours(7).toISOString());
  });

  it('n’existe pas quand l’étape ne relance pas', () => {
    assert.equal(prochaineRelance(offre(), { ...ETAPE, relance_active: false }), null);
    assert.equal(prochaineRelance(offre(), { ...ETAPE, relance_jours: 0 }), null);
  });

  it('n’existe plus une fois la relance partie', () => {
    assert.equal(prochaineRelance(offre({ relance_le: jours(7) }), ETAPE), null);
  });

  it('n’existe pas sur une offre close', () => {
    assert.equal(prochaineRelance(offre({ statut: 'acceptee' }), ETAPE), null);
  });
});
