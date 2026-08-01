/**
 * Les tests du calculateur d'offre — `node --test`, aucune dépendance.
 *
 * C'est le seul endroit du dépôt où une erreur se chiffre en euros sur un
 * document signé. Chaque cas vérifie un montant exact, jamais « un nombre
 * plausible ».
 */
import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';

import { calculerOffre, formater, formaterTaux, lignesDe } from '../src/lib/offres/calcul.mjs';

/** Les tarifs par défaut, tels qu'ils seront semés en base. */
const TARIFS = {
  prix_par_vue_cents: 100_000,        // 1 000 € par vue et par mois
  multiplicateur_achat: 24,           // 24 mois rachetés
  taux_annuel: 500,                   // 5 %
  prix_jour_formation_cents: 50_000,  // 500 € la journée
};

const DESIGN = { nom: 'Design', prix_cents: 50_000 };  // 500 €

/** Une offre minimale, que chaque test complète. */
function offre(surcharges = {}) {
  return {
    prestations: [],
    jours_formation: 0,
    option_app: 'aucune',
    vues: [],
    tarifs: TARIFS,
    remise: { type: 'pourcent', valeur: 0 },
    tva: { taux: 2100, exoneree: false },
    ...surcharges,
  };
}

describe('les prestations seules', () => {
  it('facture le module Design une fois, sans récurrent', () => {
    const { seaux } = calculerOffre(offre({ prestations: [DESIGN] }));
    assert.equal(seaux.unique.sousTotal, 50_000);
    assert.equal(seaux.unique.tva, 10_500);         // 21 % de 500 €
    assert.equal(seaux.unique.ttc, 60_500);         // 605 €
    assert.equal(seaux.mensuel.ttc, 0);
    assert.equal(seaux.annuel.ttc, 0);
  });

  it('multiplie par la quantité', () => {
    const { seaux } = calculerOffre(offre({ prestations: [{ ...DESIGN, quantite: 3 }] }));
    assert.equal(seaux.unique.sousTotal, 150_000);
  });
});

describe('la formation', () => {
  it('se facture au jour, une fois', () => {
    const { lignes, seaux } = calculerOffre(offre({ jours_formation: 4 }));
    const ligne = lignes.find((l) => l.type === 'formation');
    assert.equal(ligne.quantite, 4);
    assert.equal(ligne.prix_unitaire_cents, 50_000);
    assert.equal(ligne.recurrence, 'unique');
    assert.equal(seaux.unique.sousTotal, 200_000);  // 2 000 €
  });

  it("n'apparaît pas à zéro jour", () => {
    const { lignes } = calculerOffre(offre({ jours_formation: 0 }));
    assert.equal(lignes.filter((l) => l.type === 'formation').length, 0);
  });

  it('ignore un nombre de jours négatif au lieu de créditer le client', () => {
    const { seaux } = calculerOffre(offre({ jours_formation: -3 }));
    assert.equal(seaux.unique.sousTotal, 0);
  });
});

describe("l'option A — location à la vue", () => {
  it('est entièrement mensuelle, jamais dans le paiement unique', () => {
    const { seaux } = calculerOffre(offre({
      option_app: 'par_vue',
      vues: [{ nombre: 3, note: 'Tableau de bord' }, { nombre: 2, note: 'Commandes' }],
    }));
    assert.equal(seaux.unique.sousTotal, 0);
    assert.equal(seaux.mensuel.sousTotal, 500_000);   // 5 vues × 1 000 €
    assert.equal(seaux.mensuel.tva, 105_000);
    assert.equal(seaux.mensuel.ttc, 605_000);         // 6 050 € par mois
    assert.equal(seaux.annuel.ttc, 0);
  });

  it('garde une ligne par vue, avec sa description', () => {
    const { lignes } = calculerOffre(offre({
      option_app: 'par_vue',
      vues: [{ nombre: 3, note: 'Tableau de bord' }, { nombre: 2, note: 'Commandes' }],
    }));
    const vues = lignes.filter((l) => l.type === 'vue');
    assert.equal(vues.length, 2);
    assert.equal(vues[0].libelle, 'Tableau de bord');
    assert.equal(vues[0].total_cents, 300_000);
    assert.equal(vues[1].libelle, 'Commandes');
  });
});

describe("l'option B — achat ferme et maintenance", () => {
  it('vaut 24 mois de location, plus 5 % par an', () => {
    const { seaux } = calculerOffre(offre({
      option_app: 'achat',
      vues: [{ nombre: 5, note: 'Toutes les vues' }],
    }));
    // 5 vues × 1 000 €/mois × 24 mois
    assert.equal(seaux.unique.sousTotal, 12_000_000);  // 120 000 €
    assert.equal(seaux.unique.ttc, 14_520_000);        // 145 200 € TTC
    // 5 % de 120 000 €
    assert.equal(seaux.annuel.sousTotal, 600_000);     // 6 000 €
    assert.equal(seaux.annuel.ttc, 726_000);           // 7 260 € TTC
    // Rien de mensuel : on a acheté, on ne loue plus.
    assert.equal(seaux.mensuel.sousTotal, 0);
  });

  it('ne facture rien sans vue déclarée', () => {
    const { lignes } = calculerOffre(offre({ option_app: 'achat', vues: [] }));
    assert.equal(lignes.length, 0);
  });

  it('se combine avec les prestations et la formation', () => {
    const { seaux } = calculerOffre(offre({
      prestations: [DESIGN],
      jours_formation: 2,
      option_app: 'achat',
      vues: [{ nombre: 5 }],
    }));
    // 120 000 € + 500 € + 1 000 €
    assert.equal(seaux.unique.sousTotal, 12_150_000);
    assert.equal(seaux.annuel.sousTotal, 600_000);
  });
});

describe('la remise', () => {
  it('en pourcentage, elle touche les trois rythmes', () => {
    const { seaux } = calculerOffre(offre({
      option_app: 'achat',
      vues: [{ nombre: 5 }],
      prestations: [DESIGN],
      remise: { type: 'pourcent', valeur: 1000 },   // 10 %
    }));
    assert.equal(seaux.unique.sousTotal, 12_050_000);
    assert.equal(seaux.unique.remise, 1_205_000);
    assert.equal(seaux.unique.ht, 10_845_000);
    assert.equal(seaux.annuel.remise, 60_000);      // 10 % de 6 000 €
    assert.equal(seaux.annuel.ht, 540_000);
  });

  it('accepte une fraction de point', () => {
    const { seaux } = calculerOffre(offre({
      prestations: [DESIGN],
      remise: { type: 'pourcent', valeur: 750 },    // 7,5 %
    }));
    assert.equal(seaux.unique.remise, 3_750);       // 37,50 €
  });

  it('en montant fixe, elle ne touche que le paiement unique', () => {
    const { seaux } = calculerOffre(offre({
      prestations: [DESIGN],
      option_app: 'par_vue',
      vues: [{ nombre: 5 }],
      remise: { type: 'fixe', valeur: 20_000 },     // 200 €
    }));
    assert.equal(seaux.unique.remise, 20_000);
    assert.equal(seaux.unique.ht, 30_000);
    // L'abonnement n'est pas touché : 200 € par mois à vie n'a jamais été
    // l'intention de personne.
    assert.equal(seaux.mensuel.remise, 0);
    assert.equal(seaux.mensuel.ht, 500_000);
  });

  it('ne fabrique pas d’avoir, et dit ce qu’elle a laissé de côté', () => {
    const resultat = calculerOffre(offre({
      prestations: [DESIGN],                        // 500 €
      remise: { type: 'fixe', valeur: 80_000 },     // 800 € demandés
    }));
    assert.equal(resultat.seaux.unique.remise, 50_000);
    assert.equal(resultat.seaux.unique.ht, 0);
    assert.equal(resultat.seaux.unique.ttc, 0);
    assert.equal(resultat.remiseIgnoree, 30_000);   // les 300 € en trop
  });
});

describe('la TVA', () => {
  it('se calcule après la remise, pas avant', () => {
    const { seaux } = calculerOffre(offre({
      prestations: [DESIGN],
      remise: { type: 'pourcent', valeur: 1000 },
    }));
    assert.equal(seaux.unique.ht, 45_000);
    assert.equal(seaux.unique.tva, 9_450);          // 21 % de 450 €, pas de 500 €
  });

  it('tombe à zéro en exonération, sur les trois rythmes', () => {
    const resultat = calculerOffre(offre({
      prestations: [DESIGN],
      option_app: 'achat',
      vues: [{ nombre: 5 }],
      tva: { taux: 2100, exoneree: true },
    }));
    assert.equal(resultat.tauxTva, 0);
    assert.equal(resultat.exoneree, true);
    assert.equal(resultat.seaux.unique.tva, 0);
    assert.equal(resultat.seaux.unique.ttc, resultat.seaux.unique.ht);
    assert.equal(resultat.seaux.annuel.tva, 0);
    assert.equal(resultat.seaux.annuel.ttc, resultat.seaux.annuel.ht);
  });

  it('accepte un autre taux que 21 %', () => {
    const { seaux } = calculerOffre(offre({
      prestations: [DESIGN],
      tva: { taux: 600, exoneree: false },          // 6 %
    }));
    assert.equal(seaux.unique.tva, 3_000);
  });
});

describe('les arrondis', () => {
  it('ne laisse jamais de centime fractionnaire', () => {
    const { seaux } = calculerOffre(offre({
      prestations: [{ nom: 'Impair', prix_cents: 33_333 }],
      remise: { type: 'pourcent', valeur: 333 },    // 3,33 %
    }));
    for (const seau of Object.values(seaux)) {
      for (const montant of [seau.sousTotal, seau.remise, seau.ht, seau.tva, seau.ttc]) {
        assert.equal(Number.isInteger(montant), true, `${montant} n'est pas un entier`);
      }
    }
    assert.equal(seaux.unique.remise, 1_110);       // 33 333 × 0,0333 arrondi
    assert.equal(seaux.unique.ht, 32_223);
    assert.equal(seaux.unique.tva, 6_767);          // 21 % arrondi
    assert.equal(seaux.unique.ttc, 38_990);
  });
});

describe("l'ordre des lignes", () => {
  it('suit le document : prestations, formation, application', () => {
    const lignes = lignesDe(offre({
      prestations: [DESIGN],
      jours_formation: 2,
      option_app: 'achat',
      vues: [{ nombre: 5 }],
    }));
    assert.deepEqual(lignes.map((l) => l.type), ['prestation', 'formation', 'achat', 'maintenance']);
    assert.deepEqual(lignes.map((l) => l.ordre), [10, 20, 30, 40]);
  });
});

describe("l'affichage", () => {
  it('écrit les montants comme sur une facture', () => {
    // Espaces insécables selon la locale : on compare les chiffres, pas les
    // blancs, sinon le test casse au prochain ICU.
    assert.match(formater(12_000_000, 'fr').replace(/\s/g, ' '), /120 000,00/);
    assert.match(formater(60_500, 'nl').replace(/\s/g, ' '), /605,00/);
  });

  it('écrit les taux en pourcentage', () => {
    assert.equal(formaterTaux(2100), '21 %');
    assert.equal(formaterTaux(500), '5 %');
    assert.equal(formaterTaux(750), '7.5 %');
  });
});
