/**
 * Les trois règles de la fiche client qui se trompent en silence.
 *
 * Le reste du fichier lit des tables et se vérifie à l'écran. Ces trois-là,
 * non : chacune peut rendre une valeur crédible et fausse, que personne ne
 * relira parce qu'elle a l'air juste.
 *
 *   · l'état d'une application — dire « en fonction » d'un déploiement mort ;
 *   · la première échéance — un mois de facturation en trop ou en moins ;
 *   · le masque d'IBAN — un numéro complet dans une capture d'écran.
 */
import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';

import { etatApplication, finIban, premiereEcheance } from '../src/lib/admin/fiche-client.mjs';

const VIVANT = { vivant: true };
const MORT = { vivant: false };

describe('l’état d’une application chez un client', () => {
  it('« en fonction » exige un jeton valable ET un appel', () => {
    const e = etatApplication({ jetons: [VIVANT], appels: 12, endpoints: [{}] });
    assert.equal(e.en_fonction, true);
    assert.equal(e.jamais_appelee, false);
  });

  it('ne compte pas une application livrée mais jamais appelée', () => {
    // C'est l'erreur qui fait dire « tout tourne » d'un déploiement mort.
    const e = etatApplication({ jetons: [VIVANT], appels: 0, endpoints: [{}] });
    assert.equal(e.en_fonction, false);
    assert.equal(e.jamais_appelee, true);
  });

  it('ne compte pas une application dont tous les jetons sont morts', () => {
    const e = etatApplication({ jetons: [MORT, MORT], appels: 4000, endpoints: [{}] });
    assert.equal(e.en_fonction, false);
    // Ni « jamais appelée » : elle l'a été, elle ne peut plus l'être.
    assert.equal(e.jamais_appelee, false);
  });

  it('un seul jeton vivant parmi des révoqués suffit', () => {
    const e = etatApplication({ jetons: [MORT, VIVANT, MORT], appels: 1, endpoints: [{}] });
    assert.equal(e.en_fonction, true);
    assert.equal(e.jetons_vivants, 1);
  });

  it('signale une application sans aucun endpoint autorisé', () => {
    // Elle a un jeton et ne peut rien lire : tout appel repart en 403.
    assert.equal(etatApplication({ jetons: [VIVANT], appels: 3, endpoints: [] }).sans_api, true);
  });

  it('ne signale rien pour une application qui a des endpoints', () => {
    assert.equal(etatApplication({ jetons: [VIVANT], appels: 3, endpoints: [{}, {}] }).sans_api, false);
  });

  it('supporte une application sans jeton du tout', () => {
    const e = etatApplication();
    assert.equal(e.en_fonction, false);
    assert.equal(e.jamais_appelee, false);
  });
});

describe('la première échéance', () => {
  it('est la date d’effet quand aucun mois n’est offert', () => {
    assert.equal(premiereEcheance('2026-03-15', 0), '2026-03-15');
  });

  it('décale d’autant de mois qu’il y en a d’offerts', () => {
    assert.equal(premiereEcheance('2026-03-15', 3), '2026-06-15');
  });

  it('ne déborde pas sur le mois suivant', () => {
    // `setMonth` rend le 3 mars pour « 31 janvier + 1 mois », parce que février
    // n'a pas de 31. Pour une échéance c'est faux de deux jours, et personne ne
    // le verrait — la date reste plausible.
    assert.equal(premiereEcheance('2026-01-31', 1), '2026-02-28');
  });

  it('tient compte des années bissextiles', () => {
    assert.equal(premiereEcheance('2028-01-31', 1), '2028-02-29');
  });

  it('passe l’année sans se tromper', () => {
    assert.equal(premiereEcheance('2026-11-10', 4), '2027-03-10');
  });

  it('ne rend rien sans date d’effet — un contrat pas encore daté', () => {
    assert.equal(premiereEcheance(null, 3), null);
    assert.equal(premiereEcheance('', 0), null);
  });

  it('ne rend rien pour une date illisible plutôt qu’une date fausse', () => {
    assert.equal(premiereEcheance('bientôt', 1), null);
  });
});

describe('le masque d’IBAN', () => {
  it('ne rend que les quatre derniers caractères', () => {
    assert.equal(finIban('BE68 5390 0754 7034'), '7034');
  });

  it('ignore les espaces, quelle que soit la saisie', () => {
    assert.equal(finIban('BE68539007547034'), '7034');
  });

  it('ne rend jamais le numéro entier', () => {
    const iban = 'BE68 5390 0754 7034';
    const rendu = finIban(iban);
    assert.equal(rendu.length, 4);
    assert.equal(iban.replace(/\s/g, '').includes(rendu), true);
    assert.notEqual(rendu, iban.replace(/\s/g, ''));
  });

  it('ne rend rien plutôt qu’un fragment quand le numéro est trop court', () => {
    assert.equal(finIban('BE6'), null);
    assert.equal(finIban(''), null);
    assert.equal(finIban(null), null);
  });
});
