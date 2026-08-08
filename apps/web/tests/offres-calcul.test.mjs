/**
 * Les tests du calculateur d'offre — `node --test`, aucune dépendance.
 *
 * C'est le seul endroit du dépôt où une erreur se chiffre en euros sur un
 * document signé. Chaque cas vérifie un montant exact, jamais « un nombre
 * plausible ».
 */
import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';

import {
  calculerOffre,
  formater,
  formaterTaux,
  lignesDe,
  lignesIncompletes,
} from '../src/lib/offres/calcul.mjs';

/** Les tarifs par défaut, tels qu'ils seront semés en base. */
const TARIFS = {
  prix_par_vue_cents: 100_000,        // 1 000 € par vue et par mois
  multiplicateur_achat: 24,           // 24 mois rachetés
  taux_annuel: 500,                   // 5 %
  prix_jour_formation_cents: 50_000,  // 500 € la journée
  // Les deux tarifs d'avant les packs : une offre neuve les a à zéro.
  prix_poste_cents: 19_900,           // 199 € par magasin et par mois
  prix_poste_franchiseur_cents: 99_900,   // 999 € par mois pour le siège
  prix_onboarding_poste_cents: 150_000,   // 1 500 € par poste onboardé, une fois
};

const DESIGN = { nom: 'Design', prix_cents: 50_000 };  // 500 €

/** Une offre minimale, que chaque test complète. */
function offre(surcharges = {}) {
  return {
    prestations: [],
    packs: [],
    jours_formation: 0,
    nombre_postes: 0,
    postes_franchiseur: 0,
    postes_onboardes: 0,
    mois_offerts: 0,
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

describe('les postes en point de vente', () => {
  it('se facturent au mois, jamais à la signature', () => {
    const { lignes, seaux } = calculerOffre(offre({ nombre_postes: 12 }));
    const ligne = lignes.find((l) => l.type === 'poste');
    assert.equal(ligne.quantite, 12);
    assert.equal(ligne.prix_unitaire_cents, 19_900);
    assert.equal(ligne.recurrence, 'mensuel');
    assert.equal(seaux.unique.sousTotal, 0);
    assert.equal(seaux.mensuel.sousTotal, 238_800);   // 12 × 199 €
    assert.equal(seaux.mensuel.ttc, 288_948);         // 2 889,48 € par mois
  });

  it("n'apparaissent pas à zéro poste", () => {
    const { lignes } = calculerOffre(offre({ nombre_postes: 0 }));
    assert.equal(lignes.filter((l) => l.type === 'poste').length, 0);
  });

  it("s'ajoutent aux vues louées, dans le même rythme", () => {
    const { seaux } = calculerOffre(offre({
      nombre_postes: 12,
      option_app: 'par_vue',
      vues: [{ nombre: 5, note: 'Tout' }],
    }));
    // 12 × 199 € + 5 × 1 000 €
    assert.equal(seaux.mensuel.sousTotal, 738_800);
  });

  it("restent mensuels même quand l'application est achetée", () => {
    // L'achat vide la colonne mensuelle de ses vues, pas de ses postes : le
    // réseau continue de payer ses points de vente.
    const { seaux } = calculerOffre(offre({
      nombre_postes: 12,
      option_app: 'achat',
      vues: [{ nombre: 5 }],
    }));
    assert.equal(seaux.unique.sousTotal, 12_000_000);
    assert.equal(seaux.mensuel.sousTotal, 238_800);
    assert.equal(seaux.annuel.sousTotal, 600_000);
  });
});

describe('le poste franchiseur', () => {
  it('se compte à part des magasins, à son propre prix', () => {
    const { lignes, seaux } = calculerOffre(offre({ nombre_postes: 12, postes_franchiseur: 1 }));
    const siege = lignes.find((l) => l.type === 'poste_franchiseur');
    assert.equal(siege.prix_unitaire_cents, 99_900);
    assert.equal(siege.recurrence, 'mensuel');
    // 12 × 199 € + 1 × 999 €
    assert.equal(seaux.mensuel.sousTotal, 338_700);
  });

  it("n'apparaît pas à zéro", () => {
    const { lignes } = calculerOffre(offre({ nombre_postes: 5 }));
    assert.equal(lignes.filter((l) => l.type === 'poste_franchiseur').length, 0);
  });
});

describe("l'onboarding des postes", () => {
  it('se facture une seule fois, par poste onboardé', () => {
    const { lignes, seaux } = calculerOffre(offre({ nombre_postes: 12, postes_onboardes: 3 }));
    const ligne = lignes.find((l) => l.type === 'onboarding_poste');
    assert.equal(ligne.quantite, 3);
    assert.equal(ligne.recurrence, 'unique');
    assert.equal(seaux.unique.sousTotal, 450_000);   // 3 × 1 500 €
    // Les douze magasins restent facturés au mois, indépendamment.
    assert.equal(seaux.mensuel.sousTotal, 238_800);
  });

  it("peut ne porter que sur une partie du réseau", () => {
    // On n'onboarde pas trente magasins le même jour : la quantité est libre.
    const { seaux } = calculerOffre(offre({ nombre_postes: 30, postes_onboardes: 2 }));
    assert.equal(seaux.unique.sousTotal, 300_000);
  });
});

describe('les mois offerts', () => {
  it("ne changent pas le prix mensuel, et disent ce qu'ils valent", () => {
    const resultat = calculerOffre(offre({ nombre_postes: 12, mois_offerts: 3 }));
    // Le prix mensuel est intact : ce n'est pas une remise.
    assert.equal(resultat.seaux.mensuel.sousTotal, 238_800);
    assert.equal(resultat.seaux.mensuel.ttc, 288_948);
    // Trois échéances non facturées.
    assert.equal(resultat.offert.mois, 3);
    assert.equal(resultat.offert.ttc, 866_844);      // 3 × 2 889,48 €
    assert.equal(resultat.offert.ht, 716_400);
  });

  it("ne valent rien quand il n'y a pas d'abonnement", () => {
    const resultat = calculerOffre(offre({ prestations: [DESIGN], mois_offerts: 6 }));
    assert.equal(resultat.offert.ttc, 0);
  });

  it("n'existent pas à zéro mois", () => {
    assert.equal(calculerOffre(offre({ nombre_postes: 5 })).offert, null);
  });

  it('se cumulent avec une remise, sans se confondre avec elle', () => {
    const resultat = calculerOffre(offre({
      nombre_postes: 12,
      mois_offerts: 2,
      remise: { type: 'pourcent', valeur: 1000 },
    }));
    // La remise baisse le prix mensuel…
    assert.equal(resultat.seaux.mensuel.ht, 214_920);
    // …et les mois offerts portent sur le prix déjà remisé.
    assert.equal(resultat.offert.ht, 429_840);
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
      nombre_postes: 3,
      postes_franchiseur: 1,
      postes_onboardes: 2,
      option_app: 'achat',
      vues: [{ nombre: 5 }],
    }));
    assert.deepEqual(
      lignes.map((l) => l.type),
      ['prestation', 'formation', 'onboarding_poste', 'poste', 'poste_franchiseur', 'achat', 'maintenance'],
    );
    assert.deepEqual(lignes.map((l) => l.ordre), [10, 20, 30, 40, 50, 60, 70]);
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

describe('les lignes à moitié remplies', () => {
  it('ne dit rien d’une offre entièrement remplie', () => {
    assert.deepEqual(
      lignesIncompletes({
        vues: [{ nombre: 3, note: 'Tableau de bord' }],
        prestations: [{ nom: 'Design', prix_cents: 50_000 }],
      }),
      [],
    );
  });

  it('ignore une ligne entièrement vide — c’est la ligne de réserve', () => {
    assert.deepEqual(lignesIncompletes({ vues: [{ nombre: 0, note: '' }], prestations: [] }), []);
    assert.deepEqual(lignesIncompletes({ vues: [{ nombre: '', note: '   ' }] }), []);
  });

  it('signale une vue comptée mais sans description', () => {
    // Sans description, `lignesDe` l’imprime « Vue » : le client reçoit une
    // ligne facturée dont personne ne sait ce qu’elle est.
    const manques = lignesIncompletes({ vues: [{ nombre: 2, note: '' }] });
    assert.deepEqual(manques, [{ ou: 'vue', rang: 1, nom: null, manque: 'description' }]);
  });

  it('signale une vue décrite mais comptée zéro', () => {
    // Celle-là est pire : `lignesDe` la saute, elle disparaît sans un mot.
    const manques = lignesIncompletes({ vues: [{ nombre: 0, note: 'Agenda' }] });
    assert.deepEqual(manques, [{ ou: 'vue', rang: 1, nom: 'Agenda', manque: 'nombre' }]);
  });

  it('numérote la vue fautive telle qu’elle s’affiche', () => {
    const manques = lignesIncompletes({
      vues: [
        { nombre: 1, note: 'Accueil' },
        { nombre: 4, note: '' },
        { nombre: 0, note: '' },
        { nombre: 0, note: 'Stock' },
      ],
    });
    assert.deepEqual(manques.map((m) => m.rang), [2, 4]);
  });

  it('signale une ligne libre sans intitulé, numérotée parmi les libres', () => {
    const manques = lignesIncompletes({
      prestations: [
        { nom: 'Design', prix_cents: 50_000 },
        { nom: 'Reprise', prix_cents: 20_000, libre: true },
        { nom: '  ', prix_cents: 30_000, libre: true },
      ],
    });
    assert.deepEqual(manques, [{ ou: 'libre', rang: 2, nom: null, manque: 'intitulé' }]);
  });

  it('tient sans vues ni prestations', () => {
    assert.deepEqual(lignesIncompletes({}), []);
  });
});

describe('les packs', () => {
  /** Les tarifs d'une offre d'aujourd'hui : les postes n'existent plus. */
  const AUJOURD_HUI = { ...TARIFS, prix_poste_cents: 0, prix_poste_franchiseur_cents: 0 };

  const FRANCHISE = {
    cle: 'franchise', nom: 'Pack franchisé', prix_cents: 9_900,
    unite: 'poste_mois', base: true, avec_caisse: true,
  };
  const FRANCHISEUR = {
    cle: 'franchiseur', nom: 'Pack franchiseur', prix_cents: 19_900,
    unite: 'mois', base: true,
  };
  const WEBSHOP = { cle: 'webshop', nom: 'Pack webshop', prix_cents: 9_800, unite: 'mois' };

  it('facture un pack au point de vente en le multipliant', () => {
    const lignes = lignesDe(offre({ tarifs: AUJOURD_HUI, packs: [FRANCHISE], nombre_postes: 12 }));
    assert.deepEqual(lignes.map((l) => l.type), ['pack']);
    assert.equal(lignes[0].libelle, 'Pack franchisé');
    assert.equal(lignes[0].quantite, 12);
    assert.equal(lignes[0].total_cents, 118_800);   // 12 × 99 €
    assert.equal(lignes[0].recurrence, 'mensuel');
  });

  it('facture un pack au mois une seule fois pour le réseau', () => {
    const lignes = lignesDe(offre({ tarifs: AUJOURD_HUI, packs: [FRANCHISEUR], nombre_postes: 12 }));
    assert.equal(lignes[0].quantite, 1);
    assert.equal(lignes[0].total_cents, 19_900);
  });

  it('ne dit la caisse que sur le pack qui en contient une', () => {
    const [avec, sans] = lignesDe(offre({
      tarifs: AUJOURD_HUI, packs: [FRANCHISE, FRANCHISEUR], nombre_postes: 1, socle_pos: 'api',
    }));
    assert.equal(avec.note, 'Intégration API');
    assert.equal(sans.note, null);
  });

  it('ne facture pas un pack au point de vente sans point de vente', () => {
    // Cocher le pack sans dire combien de magasins ne veut rien dire : on ne
    // devine pas « au moins un ». Le pack au mois, lui, passe.
    const lignes = lignesDe(offre({ tarifs: AUJOURD_HUI, packs: [FRANCHISE, FRANCHISEUR] }));
    assert.deepEqual(lignes.map((l) => l.libelle), ['Pack franchiseur']);
  });

  it('additionne les packs et les options', () => {
    const { seaux } = calculerOffre(offre({
      tarifs: AUJOURD_HUI,
      packs: [FRANCHISE, FRANCHISEUR, WEBSHOP],
      nombre_postes: 10,
      modules: [{ slug: 'consultant', nom: 'Panel consultant', prix_cents: 4_900 }],
      tva: { taux: 2100, exoneree: false },
    }));
    // 10 × 99 € + 199 € + 98 € + 49 € = 1 336 €
    assert.equal(seaux.mensuel.ht, 133_600);
    assert.equal(seaux.mensuel.ttc, 161_656);
  });

  it('garde le prix du pack tel qu’il était sur l’offre', () => {
    // Le pack est recopié sur l'offre : une grille qui bouge ensuite ne doit
    // pas changer le montant d'une proposition déjà chiffrée.
    const gele = { ...WEBSHOP, prix_cents: 7_500 };
    const [ligne] = lignesDe(offre({ tarifs: AUJOURD_HUI, packs: [gele] }));
    assert.equal(ligne.total_cents, 7_500);
  });

  it('ne cumule jamais un pack au point de vente et le poste qu’il remplace', () => {
    // `nombre_postes` sert de quantité aux deux : les additionner ferait
    // payer le point de vente 99 € ET 199 € par mois.
    const lignes = lignesDe(offre({
      tarifs: TARIFS,               // l'ancien tarif est encore là
      packs: [FRANCHISE, FRANCHISEUR],
      nombre_postes: 5,
      postes_franchiseur: 1,
    }));
    assert.deepEqual(lignes.map((l) => l.libelle), ['Pack franchisé', 'Pack franchiseur']);
  });

  it('laisse intactes les offres d’avant les packs', () => {
    // Une offre chiffrée avant les packs porte ses anciens tarifs : la
    // rouvrir ne doit pas changer un centime.
    const lignes = lignesDe(offre({ tarifs: TARIFS, nombre_postes: 5, postes_franchiseur: 1 }));
    assert.deepEqual(lignes.map((l) => l.type), ['poste', 'poste_franchiseur']);
    assert.equal(lignes[0].total_cents, 99_500);    // 5 × 199 €
    assert.equal(lignes[1].total_cents, 99_900);
  });
});

/**
 * La remise accordée sur un pack.
 *
 * Le pack est ce qui se vend d'un bloc, et le geste consenti à la signature
 * porte sur ce bloc-là. C'est la seule ligne du devis qui porte sa propre
 * remise : un module optionnel se retire de l'offre plutôt que de se brader,
 * et une prestation d'onboarding aussi.
 *
 * Elle vit sur la ligne — donc déjà déduite quand la remise générale
 * s'applique — et elle doit rester visible sur le document.
 */
describe('la remise par pack', () => {
  // Zéro point de vente par défaut : avec les tarifs d'avant les packs, un
  // seul poste ajouterait une ligne « Postes en magasin » à 199 € dans le même
  // seau, et chaque total ci-dessous mesurerait deux choses à la fois.
  const offreAvec = (packs, reste = {}) => calculerOffre({
    packs,
    nombre_postes: 0,
    tarifs: TARIFS,
    tva: { taux: 2100 },
    ...reste,
  });

  const pack = (r, nom) => r.lignes.find((l) => l.libelle === nom);

  it('retire un pourcentage du prix du pack, et de lui seul', () => {
    const r = offreAvec([
      { cle: 'a', nom: 'A', prix_cents: 20_000, unite: 'mois' },
      { cle: 'b', nom: 'B', prix_cents: 20_000, unite: 'mois', remise: { type: 'pourcent', valeur: 2500 } },
    ]);
    assert.equal(pack(r, 'A').total_cents, 20_000);
    assert.equal(pack(r, 'A').remise_cents, 0);
    assert.equal(pack(r, 'B').brut_cents, 20_000);
    assert.equal(pack(r, 'B').remise_cents, 5_000);
    assert.equal(pack(r, 'B').total_cents, 15_000);
  });

  it('retire un montant fixe, qui sur une ligne mensuelle vaut « par mois »', () => {
    const r = offreAvec([{ cle: 'a', nom: 'A', prix_cents: 20_000, unite: 'mois', remise: { type: 'fixe', valeur: 3_000 } }]);
    assert.equal(pack(r, 'A').total_cents, 17_000);
    assert.equal(r.seaux.mensuel.ht, 17_000);
  });

  it('porte sur la ligne entière, jamais sur chaque point de vente', () => {
    // Trente magasins et « 50 € de remise » font cinquante euros de moins par
    // mois, pas mille cinq cents. La lecture inverse offrirait un mois de
    // service sans que personne ne s'en aperçoive avant la facture.
    const r = offreAvec(
      [{ cle: 'socle', nom: 'Socle', prix_cents: 10_000, unite: 'poste_mois', remise: { type: 'fixe', valeur: 5_000 } }],
      { nombre_postes: 30 },
    );
    const l = pack(r, 'Socle');
    assert.equal(l.quantite, 30);
    assert.equal(l.brut_cents, 300_000);
    assert.equal(l.remise_cents, 5_000);
    assert.equal(l.total_cents, 295_000);
  });

  it('en pourcentage, suit la quantité — c’est le sens de « dix pour cent »', () => {
    const r = offreAvec(
      [{ cle: 'socle', nom: 'Socle', prix_cents: 10_000, unite: 'poste_mois', remise: { type: 'pourcent', valeur: 1000 } }],
      { nombre_postes: 30 },
    );
    assert.equal(pack(r, 'Socle').remise_cents, 30_000);
    assert.equal(pack(r, 'Socle').total_cents, 270_000);
  });

  it('ne descend jamais sous zéro : une remise ne fabrique pas d’avoir', () => {
    const r = offreAvec([{ cle: 'a', nom: 'A', prix_cents: 10_000, unite: 'mois', remise: { type: 'fixe', valeur: 99_999 } }]);
    assert.equal(pack(r, 'A').remise_cents, 10_000);
    assert.equal(pack(r, 'A').total_cents, 0);
  });

  it('garde le prix d’avant : sans lui, le client voit un prix, pas un geste', () => {
    const r = offreAvec([{ cle: 'a', nom: 'A', prix_cents: 24_000, unite: 'mois', remise: { type: 'pourcent', valeur: 2000 } }]);
    const l = pack(r, 'A');
    assert.equal(l.brut_cents, 24_000);
    assert.equal(l.total_cents, 19_200);
    assert.equal(l.brut_cents - l.remise_cents, l.total_cents);
  });

  it('additionne les remises de lignes dans son seau, sans les déduire deux fois', () => {
    const r = offreAvec([
      { cle: 'a', nom: 'A', prix_cents: 20_000, unite: 'mois', remise: { type: 'pourcent', valeur: 2500 } },
      { cle: 'b', nom: 'B', prix_cents: 10_000, unite: 'mois', remise: { type: 'fixe', valeur: 1_000 } },
      { cle: 'c', nom: 'C', prix_cents: 10_000, unite: 'mois' },
    ]);
    const m = r.seaux.mensuel;
    assert.equal(m.remisesLignes, 6_000);
    // 40 000 de catalogue − 6 000 de remises = 34 000, et pas 28 000.
    assert.equal(m.sousTotal, 34_000);
    assert.equal(m.ht, 34_000);
  });

  it('applique la remise générale APRÈS celles des packs', () => {
    // L'ordre inverse ferait porter les 10 % sur un montant qu'on ne facture
    // pas — le client paierait moins que la somme de ses lignes.
    const r = offreAvec(
      [{ cle: 'a', nom: 'A', prix_cents: 20_000, unite: 'mois', remise: { type: 'pourcent', valeur: 5000 } }],
      { remise: { type: 'pourcent', valeur: 1000 } },
    );
    const m = r.seaux.mensuel;
    assert.equal(m.sousTotal, 10_000);
    assert.equal(m.remise, 1_000);
    assert.equal(m.ht, 9_000);
  });

  it('n’a pas d’effet quand elle vaut zéro, ni quand elle est absente', () => {
    for (const remise of [null, undefined, { type: 'pourcent', valeur: 0 }, { type: 'fixe', valeur: 0 }]) {
      const r = offreAvec([{ cle: 'a', nom: 'A', prix_cents: 20_000, unite: 'mois', remise }]);
      assert.equal(pack(r, 'A').total_cents, 20_000, JSON.stringify(remise));
      assert.equal(pack(r, 'A').remise_cents, 0);
      assert.equal(r.seaux.mensuel.remisesLignes, 0);
    }
  });

  it('ne se négocie que sur un pack — un module se retire, il ne se brade pas', () => {
    // `remise` posée sur un module doit rester sans effet : c'est le choix
    // qu'on a fait, et il vaut mieux qu'un test le tienne qu'un commentaire.
    const r = offreAvec(
      [{ cle: 'a', nom: 'A', prix_cents: 20_000, unite: 'mois' }],
      {
        modules: [{ slug: 'm', nom: 'M', prix_cents: 10_000, remise: { type: 'pourcent', valeur: 5000 } }],
        jours_formation: 2,
      },
    );
    for (const l of r.lignes.filter((x) => x.type !== 'pack')) {
      assert.equal(l.remise_cents, 0, l.libelle);
      assert.equal(l.total_cents, l.brut_cents, l.libelle);
    }
    assert.equal(r.lignes.find((l) => l.type === 'module').total_cents, 10_000);
  });

  it('la TVA porte sur le montant remisé, pas sur le prix catalogue', () => {
    const r = offreAvec([{ cle: 'a', nom: 'A', prix_cents: 20_000, unite: 'mois', remise: { type: 'pourcent', valeur: 5000 } }]);
    assert.equal(r.seaux.mensuel.ht, 10_000);
    assert.equal(r.seaux.mensuel.tva, 2_100);
    assert.equal(r.seaux.mensuel.ttc, 12_100);
  });

  it('les mois offerts se comptent sur le mensuel remisé', () => {
    const r = offreAvec(
      [{ cle: 'a', nom: 'A', prix_cents: 20_000, unite: 'mois', remise: { type: 'pourcent', valeur: 5000 } }],
      { mois_offerts: 3 },
    );
    assert.equal(r.offert.ht, 30_000);
  });
});
