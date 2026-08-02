/**
 * Les tests du garde-fou des appels sortants.
 *
 * C'est un client qui saisit l'adresse. Sans ce contrôle, il pourrait nous
 * faire interroger notre propre base, le service de métadonnées de
 * l'hébergeur, ou l'API d'un autre client. Chaque test correspond à un chemin
 * réellement utilisé pour ça.
 */
import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';

import {
  AdresseRefusee,
  aReessayer,
  attente,
  ipInterne,
  verifierAdresse,
} from '../src/lib/onboarding/reseau.mjs';

/** Un résolveur de test : il dit ce qu'on lui a demandé de dire. */
const resolveurQuiRend = (adresses) => async () => adresses.map((address) => ({ address }));

describe('les adresses internes', () => {
  it('reconnaît le loopback et les plages privées', () => {
    for (const ip of ['127.0.0.1', '10.1.2.3', '192.168.1.1', '172.16.0.1', '172.31.255.255', '0.0.0.0']) {
      assert.equal(ipInterne(ip), true, ip);
    }
  });

  it('reconnaît le lien-local — c’est là que vivent les métadonnées d’AWS', () => {
    assert.equal(ipInterne('169.254.169.254'), true);
  });

  it('reconnaît le CGNAT, que certains hébergeurs utilisent', () => {
    assert.equal(ipInterne('100.64.0.1'), true);
  });

  it('reconnaît le loopback IPv6, y compris encapsulé', () => {
    assert.equal(ipInterne('::1'), true);
    assert.equal(ipInterne('::ffff:127.0.0.1'), true);
    assert.equal(ipInterne('fd00::1'), true);
    assert.equal(ipInterne('fe80::1'), true);
  });

  it('laisse passer une adresse publique', () => {
    assert.equal(ipInterne('93.184.216.34'), false);
    assert.equal(ipInterne('2606:2800:220:1:248:1893:25c8:1946'), false);
  });

  it('refuse ce qui n’est pas une adresse plutôt que de l’autoriser', () => {
    assert.equal(ipInterne('pas.une.ip'), true);
    assert.equal(ipInterne('999.1.1.1'), true);
  });
});

describe('la vérification d’une adresse', () => {
  it('accepte une adresse publique en https', async () => {
    const u = await verifierAdresse('https://api.gopos.pl/v3', { resoudre: resolveurQuiRend(['93.184.216.34']) });
    assert.equal(u.hostname, 'api.gopos.pl');
  });

  it('refuse le http simple — la clé voyagerait en clair', async () => {
    await assert.rejects(
      () => verifierAdresse('http://api.gopos.pl/v3', { resoudre: resolveurQuiRend(['93.184.216.34']) }),
      (e) => e instanceof AdresseRefusee && e.code === 'HTTPS_REQUIS',
    );
  });

  it('refuse une IP privée écrite en clair', async () => {
    await assert.rejects(() => verifierAdresse('https://192.168.1.10/api'),
      (e) => e.code === 'HOTE_INTERDIT');
  });

  it('refuse un nom PUBLIC qui pointe vers le loopback', async () => {
    // Le cas qui rend le contrôle sur le seul nom inutile : rien n'empêche
    // quelqu'un de faire pointer son domaine vers 127.0.0.1.
    await assert.rejects(
      () => verifierAdresse('https://caisse-du-client.example', { resoudre: resolveurQuiRend(['127.0.0.1']) }),
      (e) => e.code === 'HOTE_INTERDIT',
    );
  });

  it('refuse dès qu’UNE des adresses résolues est interne', async () => {
    // Un nom peut résoudre vers plusieurs adresses : il suffit d'une mauvaise.
    await assert.rejects(
      () => verifierAdresse('https://double.example', { resoudre: resolveurQuiRend(['93.184.216.34', '10.0.0.5']) }),
      (e) => e.code === 'HOTE_INTERDIT',
    );
  });

  it('refuse le service de métadonnées, cible classique', async () => {
    await assert.rejects(() => verifierAdresse('https://169.254.169.254/latest/meta-data/'),
      (e) => e.code === 'HOTE_INTERDIT');
  });

  it('dit clairement qu’un nom ne se résout pas', async () => {
    const resoudre = async () => { throw new Error('ENOTFOUND'); };
    await assert.rejects(() => verifierAdresse('https://nexiste.example', { resoudre }),
      (e) => e.code === 'HOTE_INTROUVABLE');
  });

  it('refuse ce qui n’est pas une adresse', async () => {
    await assert.rejects(() => verifierAdresse('bonjour'), (e) => e.code === 'ADRESSE_INVALIDE');
  });

  it('tolère le local quand on le demande explicitement', async () => {
    const u = await verifierAdresse('http://127.0.0.1:9000/api', { autoriserLocal: true });
    assert.equal(u.port, '9000');
  });
});

describe('la reprise après échec', () => {
  it('croît d’un essai à l’autre', () => {
    const petit = attente(1);
    const grand = attente(4);
    assert.equal(grand > petit, true, `${petit} → ${grand}`);
  });

  it('reste sous le plafond', () => {
    assert.equal(attente(20, { plafond: 30000 }) <= 30000, true);
  });

  it('ne rend jamais deux fois la même attente — c’est le rôle du hasard', () => {
    // Sans hasard, cinquante connexions réveillées par la même panne
    // réessaient à la même seconde et refont tomber le service.
    const tirages = new Set(Array.from({ length: 40 }, () => attente(5)));
    assert.equal(tirages.size > 1, true);
  });

  it('réessaie sur ce qui est passager, pas sur ce qui est définitif', () => {
    assert.equal(aReessayer(429), true);
    assert.equal(aReessayer(503), true);
    assert.equal(aReessayer(401), false);
    assert.equal(aReessayer(404), false);
  });
});
