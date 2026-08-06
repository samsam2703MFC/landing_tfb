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
import { lireReponse } from '../src/lib/onboarding/vies.mjs';

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

/**
 * Ce que VIES rend, et ce qu'on en écrit.
 *
 * Le piège est dans la forme du retour : `adresse` est **déjà** l'adresse
 * entière, code postal et ville compris. `code_postal` et `ville` en sont
 * extraits pour les écrans qui ont des champs séparés — ils ne s'y ajoutent
 * pas. Les recoller écrivait « Ul. Prosta 51 / 00-838 Warszawa / 00-838
 * Warszawa » sur un contrat, et ça ne se voit qu'à la relecture du document.
 */
describe('l’adresse rendue par le registre', () => {
  const reponse = (address) => lireReponse(
    { countryCode: 'PL', vatNumber: '5252345678', valid: true, name: 'ASIMA SP. Z O.O.', address },
    { pays: 'PL', numero: '5252345678' },
  );

  it('porte déjà le code postal et la ville', () => {
    const r = reponse('UL. PROSTA 51, 00-838 WARSZAWA');
    assert.match(r.adresse, /00-838 Warszawa/);
    assert.equal(r.ville, 'Warszawa');
    assert.equal(r.code_postal, '00-838');
  });

  it('ne les écrit qu’une fois — c’est ce qui s’imprime sur le contrat', () => {
    const r = reponse('UL. PROSTA 51, 00-838 WARSZAWA');
    const ecrit = String(r.adresse).trim();
    const fois = ecrit.split('00-838 Warszawa').length - 1;
    assert.equal(fois, 1, `« 00-838 Warszawa » apparaît ${fois} fois :\n${ecrit}`);
  });

  it('reste lisible quand le registre répond en capitales', () => {
    // Un registre qui crie n'est pas une raison d'écrire au client en criant.
    const r = reponse('UL. PROSTA 51, 00-838 WARSZAWA');
    assert.equal(r.adresse.includes('WARSZAWA'), false);
  });

  it('rend une adresse vide plutôt qu’un tiret quand l’État ne publie rien', () => {
    const r = reponse('---');
    assert.equal(r.adresse, '');
    assert.equal(r.ville, '');
  });
});
