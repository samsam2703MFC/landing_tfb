/**
 * La nature d'un client, et ce que le registre européen rend.
 *
 * Deux règles courtes qui décident de ce qui s'imprime sur un contrat, et qui
 * se trompent sans bruit :
 *
 *   · une nature inconnue ne doit pas s'afficher telle quelle. « franchisee »
 *     mal orthographié dans une vieille ligne rendrait « franchisee » à
 *     l'écran, et personne ne saurait si c'est une valeur ou un bug ;
 *   · le numéro d'entreprise se tire du numéro de TVA en retirant le préfixe
 *     pays. Se tromper d'un caractère met un mauvais numéro sur un contrat.
 */
import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';

import { CHAMPS_PROSPECT, NATURES_CLIENT, natureDite } from '../src/lib/admin/donnees.mjs';

describe('la nature d’un client', () => {
  it('couvre les cas d’un réseau de franchise', () => {
    const cles = NATURES_CLIENT.map((n) => n.cle);
    for (const attendu of ['franchiseur', 'franchise', 'groupe', 'filiale']) {
      assert.ok(cles.includes(attendu), `${attendu} manque`);
    }
  });

  it('se dit en français', () => {
    assert.equal(natureDite('franchiseur'), 'Franchiseur');
    assert.equal(natureDite('franchise'), 'Franchisé');
    assert.equal(natureDite('groupe'), 'Groupe de sociétés');
  });

  it('ne rend rien pour une valeur inconnue, plutôt que la valeur brute', () => {
    // Une vieille ligne mal saisie afficherait « franchisee » à l'écran, et
    // personne ne saurait si c'est une valeur ou un défaut.
    assert.equal(natureDite('franchisee'), null);
    assert.equal(natureDite(''), null);
    assert.equal(natureDite(null), null);
  });

  it('est proposée en liste fermée sur la fiche', () => {
    // « franchisé », « franchisée » et « FR » sont la même chose écrite de
    // trois façons, et aucune ne se compte.
    const champ = CHAMPS_PROSPECT.find((c) => c.nom === 'nature');
    assert.ok(champ, 'le champ nature manque du formulaire');
    assert.equal(champ.choix.length, NATURES_CLIENT.length);
    assert.equal(champ.requis, undefined, 'la nature ne se devine pas toujours au premier rendez-vous');
  });

  it('n’est jamais obligatoire — on ne bloque pas un dossier pour ça', () => {
    assert.equal(CHAMPS_PROSPECT.find((c) => c.nom === 'nature').requis, undefined);
  });
});

describe('le numéro d’entreprise tiré de la TVA', () => {
  // La règle appliquée par `appliquerViesProspect` : le numéro de TVA sans son
  // préfixe pays. C'est la même immatriculation.
  const sansPrefixe = (tva) => String(tva || '').replace(/^[A-Z]{2}/, '');

  it('retire le préfixe pays', () => {
    assert.equal(sansPrefixe('BE0123456789'), '0123456789');
    assert.equal(sansPrefixe('PL5252345678'), '5252345678');
  });

  it('laisse intact un numéro déjà sans préfixe', () => {
    assert.equal(sansPrefixe('0123456789'), '0123456789');
  });

  it('ne retire que deux lettres, pas davantage', () => {
    // Un numéro dont le corps commence par des lettres ne doit pas se faire
    // tronquer au-delà du code pays.
    assert.equal(sansPrefixe('IEAB12345C'), 'AB12345C');
  });

  it('supporte l’absence de numéro', () => {
    assert.equal(sansPrefixe(null), '');
    assert.equal(sansPrefixe(''), '');
  });
});
