/**
 * Les tests du moteur du parcours.
 *
 * Toute la promesse de l'architecture tient dans une phrase : « quatre modules
 * cochés, une seule connexion à faire ». Si elle est fausse, le client se
 * retrouve à saisir quatre fois la même clé d'API, et rien du reste ne le
 * rattrapera.
 */
import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';

import {
  avancement,
  capacitesRequises,
  connecteursPossibles,
  construireParcours,
  etapesDeConnexion,
} from '../src/lib/onboarding/moteur.mjs';

/** Le catalogue de l'exemple, tel qu'il sortirait de la base. */
const REPORTING = {
  slug: 'reporting', nom: 'Reporting ventes',
  besoins: [
    { capacite: 'ventes', requis: true },
    { capacite: 'produits', requis: true },
    { capacite: 'categories', requis: true },
  ],
};
const FOODCOST = {
  slug: 'foodcost', nom: 'Food cost',
  besoins: [{ capacite: 'ventes', requis: true }, { capacite: 'produits', requis: true }],
};
const OBJECTIFS = {
  slug: 'objectifs', nom: 'Objectifs & primes',
  besoins: [{ capacite: 'ventes', requis: true }, { capacite: 'boutiques', requis: true }],
};
const MARKETING = {
  slug: 'marketing', nom: 'Marketing local',
  besoins: [
    { capacite: 'ventes', requis: true },
    { capacite: 'categories', requis: false, note_degradee: "On mesure l'effet global, pas par famille de produits." },
  ],
};

describe('les capacités d’un ensemble de modules', () => {
  it('dédoublonne : quatre modules, quatre capacités et non neuf besoins', () => {
    const r = capacitesRequises([REPORTING, FOODCOST, OBJECTIFS, MARKETING]);
    assert.deepEqual(r.requises.map((c) => c.capacite).sort(),
      ['boutiques', 'categories', 'produits', 'ventes']);
  });

  it('dit quels modules demandent quoi — c’est ce que l’écran affiche', () => {
    const r = capacitesRequises([REPORTING, FOODCOST, OBJECTIFS, MARKETING]);
    const ventes = r.requises.find((c) => c.capacite === 'ventes');
    assert.equal(ventes.modules.length, 4);
  });

  it('le plus exigeant l’emporte : requis quelque part n’est plus optionnel', () => {
    // « catégories » est optionnel pour Marketing et requis pour Reporting.
    const r = capacitesRequises([REPORTING, MARKETING]);
    assert.equal(r.requises.some((c) => c.capacite === 'categories'), true);
    assert.equal(r.optionnelles.some((c) => c.capacite === 'categories'), false);
  });

  it('garde l’optionnel quand personne ne l’exige, avec ce qu’on perd', () => {
    const r = capacitesRequises([MARKETING]);
    const opt = r.optionnelles.find((c) => c.capacite === 'categories');
    assert.equal(opt.note_degradee, "On mesure l'effet global, pas par famille de produits.");
  });

  it('ne rend rien pour aucun module', () => {
    const r = capacitesRequises([]);
    assert.deepEqual(r.requises, []);
    assert.deepEqual(r.toutes, []);
  });
});

describe('le parcours', () => {
  const modules = [REPORTING, FOODCOST, OBJECTIFS, MARKETING];

  it('quatre modules et une caisse : une seule série d’étapes techniques', () => {
    const p = construireParcours({ modules, groupes: [{ cle: 'gopos', nom: 'GoPOS' }] });
    assert.equal(p.connexions, 1);
    const config = p.etapes.filter((e) => e.cle === 'configuration');
    assert.equal(config.length, 1, 'une seule configuration à faire');
  });

  it('décocher un module ne retire pas une étape déjà exigée ailleurs', () => {
    const avec = construireParcours({ modules, groupes: [{ cle: 'gopos' }] });
    const sans = construireParcours({
      modules: [REPORTING, OBJECTIFS, MARKETING], groupes: [{ cle: 'gopos' }],
    });
    // Food cost demandait ventes + produits ; Reporting les demande déjà.
    assert.equal(sans.etapes.length, avec.etapes.length);
  });

  it('trois caisses : trois séries d’étapes, pas trois parcours', () => {
    const p = construireParcours({
      modules,
      groupes: [{ cle: 'gopos', nom: 'GoPOS' }, { cle: 'lightspeed', nom: 'Lightspeed' }, { cle: 'square', nom: 'Square' }],
    });
    assert.equal(p.connexions, 3);
    assert.equal(p.etapes.filter((e) => e.cle === 'configuration').length, 3);
    // Les étapes du client, elles, ne se répètent pas.
    assert.equal(p.etapes.filter((e) => e.cle === 'entreprise').length, 1);
  });

  it('quarante boutiques sur quatre caisses font quatre connexions', () => {
    const p = construireParcours({
      modules,
      groupes: ['a', 'b', 'c', 'd'].map((c) => ({ cle: c, boutiques: 10 })),
    });
    assert.equal(p.connexions, 4);
  });

  it('range les étapes d’une caisse ensemble, pas mêlées à la suivante', () => {
    const p = construireParcours({ modules, groupes: [{ cle: 'a' }, { cle: 'b' }] });
    const techniques = p.etapes.filter((e) => e.connexion);
    const rupture = techniques.findIndex((e) => e.connexion === 'b');
    assert.equal(techniques.slice(0, rupture).every((e) => e.connexion === 'a'), true);
    assert.equal(techniques.slice(rupture).every((e) => e.connexion === 'b'), true);
  });

  it('sans caisse décrite, rend les seules étapes du client', () => {
    const p = construireParcours({ modules, groupes: [] });
    assert.equal(p.etapes.every((e) => e.connexion === null), true);
    assert.equal(p.etapes.some((e) => e.cle === 'fin'), false);
  });

  it('une caisse qui ne donne pas les boutiques n’en fait pas rapprocher', () => {
    const p = construireParcours({
      modules,
      groupes: [{ cle: 'partielle', capacites: ['ventes', 'produits'] }],
    });
    assert.equal(p.etapes.some((e) => e.cle === 'boutiques'), false);
    // Mais elle garde le mapping et la cohérence : il y a des ventes.
    assert.equal(p.etapes.some((e) => e.cle === 'mapping'), true);
  });

  it('une source qui ne sert qu’au catalogue n’a pas d’étape de cohérence', () => {
    const e = etapesDeConnexion(['produits', 'categories']);
    assert.equal(e.some((x) => x.cle === 'coherence'), false);
    assert.equal(e.some((x) => x.cle === 'configuration'), true);
  });
});

describe('le choix des connecteurs', () => {
  const CONNECTEURS = [
    { cle: 'gopos', nom: 'GoPOS', capacites: ['ventes', 'produits', 'categories', 'boutiques'], ordre: 1 },
    { cle: 'petit', nom: 'Petite caisse', capacites: ['ventes'], ordre: 2 },
    { cle: 'retire', nom: 'Retiré', capacites: ['ventes'], actif: false, ordre: 3 },
  ];

  it('propose le plus couvrant en premier', () => {
    const p = connecteursPossibles(CONNECTEURS, ['ventes', 'produits', 'boutiques']);
    assert.equal(p[0].cle, 'gopos');
    assert.deepEqual(p[0].manquantes, []);
  });

  it('n’écarte pas une caisse incomplète, mais dit ce qui lui manque', () => {
    const p = connecteursPossibles(CONNECTEURS, ['ventes', 'produits', 'boutiques']);
    const petit = p.find((c) => c.cle === 'petit');
    assert.deepEqual(petit.manquantes.sort(), ['boutiques', 'produits']);
  });

  it('ne propose pas un connecteur désactivé', () => {
    const p = connecteursPossibles(CONNECTEURS, ['ventes']);
    assert.equal(p.some((c) => c.cle === 'retire'), false);
  });
});

describe('l’avancement, colonne par caisse', () => {
  const modules = [REPORTING];
  const p = construireParcours({
    modules, groupes: [{ cle: 'gopos', nom: 'GoPOS' }, { cle: 'square', nom: 'Square' }],
  });

  it('sépare le client et chaque caisse', () => {
    const a = avancement(p.etapes, []);
    assert.equal(a.colonnes.length, 3, 'client + deux caisses');
  });

  it('dit où reprendre dans chaque colonne', () => {
    const a = avancement(p.etapes, ['entreprise', 'modules', 'gopos:configuration', 'gopos:test']);
    const gopos = a.colonnes.find((c) => c.connexion === 'gopos');
    assert.equal(gopos.courante.cle, 'mapping');
    const square = a.colonnes.find((c) => c.connexion === 'square');
    assert.equal(square.courante.cle, 'configuration');
  });

  it('une caisse terminée n’empêche pas l’autre d’attendre', () => {
    const faites = p.etapes
      .filter((e) => e.connexion === 'gopos')
      .map((e) => `gopos:${e.cle}`);
    const a = avancement(p.etapes, faites);
    const gopos = a.colonnes.find((c) => c.connexion === 'gopos');
    assert.equal(gopos.terminee, true);
    assert.equal(a.fini, false, 'Square attend encore');
  });

  it('n’est fini que lorsque toutes les colonnes le sont', () => {
    const toutes = p.etapes.map((e) => (e.connexion ? `${e.connexion}:${e.cle}` : e.cle));
    assert.equal(avancement(p.etapes, toutes).fini, true);
  });
});
