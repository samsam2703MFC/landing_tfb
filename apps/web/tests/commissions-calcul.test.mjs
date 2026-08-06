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
  paliersDepuisTranches,
  paliersOrdonnes,
  resumerPlan,
  tauxAuMois,
  tranchesDepuisPaliers,
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
  it('se relit en une phrase, en durées et non en mois cumulés', () => {
    // « à partir du mois 12 » demandait un calcul mental à chaque lecture.
    // Une durée se lit telle qu'on la négocie.
    assert.equal(resumerPlan(NEUF_VINGT), '90 % pendant 1 an, puis 20 %');
  });

  it('dit franchement qu’un plan est vide', () => {
    assert.equal(resumerPlan([]), 'aucune tranche');
  });

  it('écrit les taux à la française', () => {
    assert.equal(afficherTaux(9000), '90 %');
    assert.equal(afficherTaux(1550), '15,5 %');
  });
});

/**
 * Les tranches : « 70 % pendant un an, puis 30 % ».
 *
 * C'est la phrase qu'un commercial indépendant entend en négociant sa
 * rémunération. Le calcul, lui, a besoin de « à partir du mois 12, 30 % ».
 * Une seule vérité en base — les mois cumulés — et deux lectures : stocker
 * les deux garantirait qu'elles se contredisent le jour où l'une change sans
 * l'autre, et personne ne saurait laquelle paie.
 *
 * L'aller-retour est donc le test qui compte : ce qui est saisi doit se
 * relire à l'identique, sinon rouvrir un plan pour changer un chiffre en
 * changerait un autre au passage.
 */
describe('les tranches d’un plan', () => {
  const aller = paliersDepuisTranches;
  const retour = tranchesDepuisPaliers;

  it('traduisent « 70 % pendant un an, puis 30 % »', () => {
    const paliers = aller([{ duree_mois: 12, taux_bp: 7000 }, { duree_mois: null, taux_bp: 3000 }]);
    assert.deepEqual(paliers, [
      { depuis_mois: 0, taux_bp: 7000 },
      { depuis_mois: 12, taux_bp: 3000 },
    ]);
  });

  it('se relisent à l’identique', () => {
    const saisi = [{ duree_mois: 12, taux_bp: 7000 }, { duree_mois: null, taux_bp: 3000 }];
    assert.deepEqual(retour(aller(saisi)).tranches, saisi);
  });

  it('savent dire qu’un plan s’arrête', () => {
    // Ce que les mois cumulés seuls ne permettaient pas : le dernier palier
    // courait indéfiniment. La fin est un palier à 0 % — pas un trou.
    const paliers = aller([{ duree_mois: 12, taux_bp: 7000 }, { duree_mois: 24, taux_bp: 3000 }]);
    assert.deepEqual(paliers.at(-1), { depuis_mois: 36, taux_bp: 0 });
    assert.equal(retour(paliers).finit, true);
  });

  it('ne prennent pas une fin de plan pour une tranche à zéro', () => {
    const { tranches } = retour(aller([{ duree_mois: 12, taux_bp: 7000 }, { duree_mois: 24, taux_bp: 3000 }]));
    assert.equal(tranches.length, 2);
    assert.deepEqual(tranches.map((t) => t.taux_bp), [7000, 3000]);
  });

  it('refusent une tranche sans fin ailleurs qu’à la fin', () => {
    // Sinon les suivantes ne commenceraient jamais, en silence.
    assert.throws(
      () => aller([{ duree_mois: null, taux_bp: 7000 }, { duree_mois: 12, taux_bp: 3000 }]),
      /dernière tranche/,
    );
  });

  it('refusent une durée nulle ou négative', () => {
    assert.throws(() => aller([{ duree_mois: 0, taux_bp: 7000 }]), /au moins un/);
    assert.throws(() => aller([{ duree_mois: -3, taux_bp: 7000 }]), /au moins un/);
  });

  it('gardent un début sans taux au lieu de le combler', () => {
    // Un plan qui démarre au mois 3 laisse trois mois à découvert. Les combler
    // ferait payer un pourcentage que personne n'a négocié.
    const { tranches } = retour([{ depuis_mois: 3, taux_bp: 5000 }]);
    assert.deepEqual(tranches[0], { duree_mois: 3, taux_bp: null });
  });

  it('ne posent pas de palier pour une période sans taux', () => {
    const paliers = aller([{ duree_mois: 3, taux_bp: null }, { duree_mois: null, taux_bp: 5000 }]);
    assert.deepEqual(paliers, [{ depuis_mois: 3, taux_bp: 5000 }]);
  });

  it('rendent une phrase lisible, et disent les ans en ans', () => {
    const paliers = aller([{ duree_mois: 12, taux_bp: 7000 }, { duree_mois: null, taux_bp: 3000 }]);
    assert.equal(resumerPlan(paliers), '70 % pendant 1 an, puis 30 %');
  });

  it('disent la fin dans la phrase', () => {
    const paliers = aller([{ duree_mois: 12, taux_bp: 7000 }, { duree_mois: 24, taux_bp: 3000 }]);
    assert.equal(resumerPlan(paliers), '70 % pendant 1 an, puis 30 % pendant 2 ans, puis plus rien');
  });

  it('ne rendent rien d’un plan vide', () => {
    assert.deepEqual(aller([]), []);
    assert.equal(resumerPlan([]), 'aucune tranche');
  });

  it('calculent bien la rémunération d’un indépendant à 70 puis 30', () => {
    // Le cas réel, bout en bout : 1 000 € par mois facturés, contrat de deux
    // ans. Douze mois à 70 %, douze à 30 % — et pas un centime d'écart.
    const paliers = aller([{ duree_mois: 12, taux_bp: 7000 }, { duree_mois: null, taux_bp: 3000 }]);
    const r = commissionContrat(
      { statut: 'signe', duree_mois: 24 },
      { unique_cents: 0, mensuel_cents: 100_000 },
      paliers,
    );
    assert.equal(r.raison, 'ok');
    assert.equal(r.total_cents, 12 * 70_000 + 12 * 30_000);
  });

  it('ne paie plus rien après la fin d’un plan qui s’arrête', () => {
    // 12 mois à 70 %, puis plus rien, sur un contrat de 24 mois.
    const paliers = aller([{ duree_mois: 12, taux_bp: 7000 }]);
    const r = commissionContrat(
      { statut: 'signe', duree_mois: 24 },
      { unique_cents: 0, mensuel_cents: 100_000 },
      paliers,
    );
    assert.equal(r.total_cents, 12 * 70_000);
  });
});
