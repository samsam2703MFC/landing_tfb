/**
 * Les tests du calcul de commission.
 *
 * C'est le seul endroit de l'application qui transforme du travail en argent.
 * Une erreur ici ne se voit pas à l'écran : elle se voit sur un virement, un
 * mois plus tard, quand quelqu'un compare avec son propre tableur.
 */
import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';

import {
  afficherTaux,
  appliquer,
  commissionContrat,
  paliersOrdonnes,
  resumerPlan,
  tauxAuMois,
} from '../src/lib/commissions/calcul.mjs';

const NEUF_VINGT = paliersOrdonnes([
  { depuis_mois: 12, taux_bp: 2000 },
  { depuis_mois: 0, taux_bp: 9000 },
]);

describe('les paliers d’un plan', () => {
  it('les trie par mois de départ', () => {
    assert.deepEqual(NEUF_VINGT, [
      { depuis_mois: 0, taux_bp: 9000 },
      { depuis_mois: 12, taux_bp: 2000 },
    ]);
  });

  it('refuse deux paliers au même mois plutôt que d’en départager un', () => {
    assert.throws(
      () => paliersOrdonnes([{ depuis_mois: 0, taux_bp: 9000 }, { depuis_mois: 0, taux_bp: 2000 }]),
      /Deux paliers commencent au mois 0/,
    );
  });

  it('refuse un taux au-dessus de 100 %', () => {
    assert.throws(() => paliersOrdonnes([{ depuis_mois: 0, taux_bp: 10_001 }]), /points de base/);
  });

  it('refuse un mois négatif ou fractionnaire', () => {
    assert.throws(() => paliersOrdonnes([{ depuis_mois: -1, taux_bp: 100 }]), /entier de mois/);
    assert.throws(() => paliersOrdonnes([{ depuis_mois: 1.5, taux_bp: 100 }]), /entier de mois/);
  });
});

describe('le taux en vigueur', () => {
  it('prend le palier le plus haut qui ne dépasse pas le mois', () => {
    assert.equal(tauxAuMois(NEUF_VINGT, 0), 9000);
    assert.equal(tauxAuMois(NEUF_VINGT, 11), 9000);
    assert.equal(tauxAuMois(NEUF_VINGT, 12), 2000);
    assert.equal(tauxAuMois(NEUF_VINGT, 240), 2000);
  });

  it('ne comble pas un trou en début d’échelle', () => {
    const tardif = paliersOrdonnes([{ depuis_mois: 6, taux_bp: 5000 }]);
    assert.equal(tauxAuMois(tardif, 0), null, 'deviner ici paierait un taux jamais négocié');
    assert.equal(tauxAuMois(tardif, 6), 5000);
  });
});

describe('l’application d’un taux', () => {
  it('arrondit une seule fois, à la fin', () => {
    assert.equal(appliquer(189_000, 9000), 170_100);
    // 33,33 % de 10,00 € : 333 centimes, pas 3,33 arrondis puis multipliés.
    assert.equal(appliquer(1000, 3333), 333);
  });
});

describe('la commission d’un contrat', () => {
  const mensuel = { unique_cents: 0, mensuel_cents: 100_000 };

  it('ne commissionne pas une offre non signée', () => {
    const r = commissionContrat({ statut: 'envoye', duree_mois: 24 }, mensuel, NEUF_VINGT);
    assert.equal(r.raison, 'non_signe');
    assert.equal(r.total_cents, null, 'null, jamais zéro : zéro se lirait comme une décision');
  });

  it('sans plan, ne calcule rien et le dit', () => {
    const r = commissionContrat({ statut: 'signe', duree_mois: 24 }, mensuel, null);
    assert.equal(r.raison, 'sans_plan');
    assert.equal(r.total_cents, null);
  });

  it('sur un plan vide, ne calcule rien et le dit', () => {
    const r = commissionContrat({ statut: 'signe', duree_mois: 24 }, mensuel, []);
    assert.equal(r.raison, 'plan_vide');
  });

  it('change de taux à l’ancienneté, pas à la date du jour', () => {
    const r = commissionContrat({ statut: 'signe', duree_mois: 24 }, mensuel, NEUF_VINGT);
    assert.equal(r.raison, 'ok');
    assert.equal(r.lignes.length, 24);
    assert.equal(r.lignes[0].taux_bp, 9000);
    assert.equal(r.lignes[11].taux_bp, 9000);
    assert.equal(r.lignes[12].taux_bp, 2000);
    // 12 mois à 90 % puis 12 à 20 %, sur 1 000 € par mois.
    assert.equal(r.total_cents, 12 * 90_000 + 12 * 20_000);
  });

  it('commissionne le ponctuel une fois, pas tous les mois', () => {
    const r = commissionContrat(
      { statut: 'signe', duree_mois: 3 },
      { unique_cents: 200_000, mensuel_cents: 100_000 },
      NEUF_VINGT,
    );
    const uniques = r.lignes.filter((l) => l.nature === 'unique');
    assert.equal(uniques.length, 1);
    assert.equal(uniques[0].mois, 0);
    assert.equal(r.total_cents, 180_000 + 3 * 90_000);
  });

  it('refuse de projeter un récurrent sans durée connue', () => {
    const r = commissionContrat({ statut: 'signe', duree_mois: 0 }, mensuel, NEUF_VINGT);
    assert.equal(r.raison, 'sans_duree');
  });

  it('accepte un contrat sans durée quand il n’y a que du ponctuel', () => {
    const r = commissionContrat(
      { statut: 'signe', duree_mois: 0 },
      { unique_cents: 49_000, mensuel_cents: 0 },
      NEUF_VINGT,
    );
    assert.equal(r.raison, 'ok');
    assert.equal(r.total_cents, 44_100);
  });

  it('signale un contrat sans montant au lieu de rendre zéro', () => {
    const r = commissionContrat({ statut: 'signe', duree_mois: 12 }, { unique_cents: 0, mensuel_cents: 0 }, NEUF_VINGT);
    assert.equal(r.raison, 'sans_montant');
    assert.equal(r.total_cents, null);
  });

  it('laisse les mois non couverts à null sans les compter', () => {
    const tardif = paliersOrdonnes([{ depuis_mois: 2, taux_bp: 5000 }]);
    const r = commissionContrat({ statut: 'signe', duree_mois: 4 }, mensuel, tardif);
    assert.equal(r.raison, 'ok');
    assert.equal(r.lignes[0].montant_cents, null);
    assert.equal(r.lignes[1].montant_cents, null);
    assert.equal(r.lignes[2].montant_cents, 50_000);
    assert.equal(r.total_cents, 2 * 50_000, 'les mois sans palier ne valent rien, et rien n’est pas zéro compté');
  });
});

describe('l’écriture d’un plan', () => {
  it('se relit en une phrase', () => {
    assert.equal(resumerPlan(NEUF_VINGT), '90 %, puis 20 % à partir du mois 12');
  });

  it('dit franchement qu’un plan est vide', () => {
    assert.equal(resumerPlan([]), 'aucun palier');
  });

  it('écrit les taux à la française', () => {
    assert.equal(afficherTaux(9000), '90 %');
    assert.equal(afficherTaux(1550), '15,5 %');
  });
});
