/**
 * Les tests du coffre.
 *
 * Ce qui compte ici n'est pas que le chiffrement « marche » — la bibliothèque
 * de Node s'en charge — mais que les trois promesses tiennent : une clé
 * modifiée ne se déchiffre pas en silence, une rotation ne rend pas les
 * anciennes lignes illisibles, et un secret ne se retrouve jamais dans une
 * trace.
 */
import { strict as assert } from 'node:assert';
import { randomBytes } from 'node:crypto';
import { describe, it } from 'node:test';

import {
  CoffreFerme,
  chiffrer,
  coffreOuvert,
  dechiffrer,
  masque,
  memeJeton,
  nettoyerPourJournal,
  versionActive,
} from '../src/lib/onboarding/coffre.mjs';

const CLE1 = randomBytes(32).toString('base64');
const CLE2 = randomBytes(32).toString('base64');
const ENV = { SECRETS_CLE_1: CLE1, SECRETS_VERSION: '1' };
const ENV2 = { SECRETS_CLE_1: CLE1, SECRETS_CLE_2: CLE2, SECRETS_VERSION: '2' };

describe('le coffre', () => {
  it('chiffre et rend la valeur d’origine', () => {
    const paquet = chiffrer('sk_live_9f3a2b7c4f2a', ENV);
    assert.equal(dechiffrer(paquet, ENV), 'sk_live_9f3a2b7c4f2a');
  });

  it('ne rend jamais deux fois le même chiffré', () => {
    // Vecteur d'initialisation tiré à chaque écriture : deux clients qui
    // saisissent la même clé ne doivent pas avoir la même ligne en base.
    const a = chiffrer('sk_live_identique', ENV);
    const b = chiffrer('sk_live_identique', ENV);
    assert.notEqual(a.chiffre.toString('hex'), b.chiffre.toString('hex'));
  });

  it('garde les quatre derniers caractères, et rien de plus', () => {
    const paquet = chiffrer('sk_live_9f3a2b7c4f2a', ENV);
    assert.equal(paquet.quatre, '4f2a');
    assert.equal(masque(paquet.quatre), '••••4f2a');
  });

  it('refuse de déchiffrer une ligne modifiée', () => {
    const paquet = chiffrer('sk_live_9f3a2b7c4f2a', ENV);
    paquet.chiffre[0] ^= 0xff;
    assert.throws(() => dechiffrer(paquet, ENV), CoffreFerme);
  });

  it('refuse de déchiffrer avec la mauvaise clé', () => {
    const paquet = chiffrer('sk_live_9f3a2b7c4f2a', ENV);
    assert.throws(() => dechiffrer(paquet, { SECRETS_CLE_1: CLE2 }), CoffreFerme);
  });

  it('refuse une clé qui n’a pas trente-deux octets', () => {
    const courte = { SECRETS_CLE_1: Buffer.from('trop courte').toString('base64') };
    assert.throws(() => chiffrer('x', courte), /32/);
  });

  it('dit clairement quand aucune clé n’est posée', () => {
    assert.equal(coffreOuvert({}), false);
    assert.throws(() => chiffrer('x', {}), /SECRETS_CLE_1/);
  });
});

describe('la rotation de clé', () => {
  it('chiffre avec la version active', () => {
    assert.equal(versionActive(ENV2), 2);
    assert.equal(chiffrer('nouvelle', ENV2).version, 2);
  });

  it('relit une ligne écrite avec l’ancienne version', () => {
    // Le cas de la rotation : la ligne d'hier porte la version 1, on chiffre
    // désormais en 2, et elle doit rester lisible pendant qu'on rechiffre.
    const ancienne = chiffrer('secret-d-hier', ENV);
    assert.equal(ancienne.version, 1);
    assert.equal(dechiffrer(ancienne, ENV2), 'secret-d-hier');
  });

  it('rechiffre d’une version à l’autre sans perdre la valeur', () => {
    const ancienne = chiffrer('secret-d-hier', ENV);
    const neuve = chiffrer(dechiffrer(ancienne, ENV2), ENV2);
    assert.equal(neuve.version, 2);
    assert.equal(dechiffrer(neuve, ENV2), 'secret-d-hier');
  });
});

describe('ce qui part au journal', () => {
  const CLE = 'sk_live_9f3a2b7c4f2a8e11';

  it('remplace le secret partout où il apparaît', () => {
    const trace = `GET https://api.pos.com/sales\nAuthorization: Bearer ${CLE}\n→ 200`;
    const propre = nettoyerPourJournal(trace, [CLE]);
    assert.equal(propre.includes(CLE), false, propre);
    assert.equal(propre.includes('••••'), true);
    // Le reste de la trace survit : masquer ne doit pas la rendre inutile.
    assert.equal(propre.includes('https://api.pos.com/sales'), true);
    assert.equal(propre.includes('200'), true);
  });

  it('attrape aussi la clé glissée dans l’adresse', () => {
    // Certaines caisses veulent la clé en paramètre de requête. L'adresse
    // complète finirait alors dans les logs d'accès.
    const trace = `GET https://api.pos.com/sales?api_key=${CLE}&page=1`;
    assert.equal(nettoyerPourJournal(trace, [CLE]).includes(CLE), false);
  });

  it('masque un en-tête d’authentification même sans connaître sa valeur', () => {
    const trace = 'Authorization: Bearer jeton-de-rafraichissement-inconnu';
    const propre = nettoyerPourJournal(trace, []);
    assert.equal(propre.includes('jeton-de-rafraichissement-inconnu'), false, propre);
  });

  it('ne massacre pas la trace pour un secret trop court', () => {
    // Remplacer « abc » partout rendrait la trace illisible et masquerait des
    // morceaux de mots au hasard.
    const trace = 'GET https://api.pos.com/abcdef';
    assert.equal(nettoyerPourJournal(trace, ['abc']), trace);
  });

  it('supporte une liste vide et une trace vide', () => {
    assert.equal(nettoyerPourJournal('', ['x']), '');
    assert.equal(nettoyerPourJournal(null, []), '');
  });
});

describe('la comparaison de jetons', () => {
  it('reconnaît deux jetons identiques', () => {
    assert.equal(memeJeton('abcdef', 'abcdef'), true);
  });

  it('refuse deux jetons différents, et deux longueurs différentes', () => {
    assert.equal(memeJeton('abcdef', 'abcdeg'), false);
    assert.equal(memeJeton('abcdef', 'abcde'), false);
    assert.equal(memeJeton(null, 'abcde'), false);
  });
});
