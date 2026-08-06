/**
 * Qui suit un client — et surtout, ce que cette réponse n'autorise pas.
 *
 * Deux colonnes portent un commercial, et rien dans les noms ne dit qu'elles
 * répondent à deux questions différentes :
 *
 *   · `prospects.commercial_id` — qui suit le client aujourd'hui ;
 *   · `offres.cree_par`         — qui a fait cette offre-là, et qui elle paie.
 *
 * Les confondre coûterait cher dans un sens précis : assigner un client à
 * quelqu'un reprendrait rétroactivement les commissions de ses prédécesseurs.
 * Ces tests tiennent la frontière, et tiennent aussi le fait que l'écran dit
 * toujours laquelle des deux sources a parlé — un nom deviné ne doit pas se
 * lire comme un nom décidé.
 */
import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';

import { commercialDuClient } from '../src/lib/admin/donnees.mjs';

const OFFRES = [
  { cree_le: '2026-06-01', auteur_nom: 'Nadia Bensalem' },
  { cree_le: '2026-01-04', auteur_nom: 'Marc Oliveira' },
];

describe('le commercial d’un client', () => {
  it('est celui que la fiche lui a assigné', () => {
    const q = commercialDuClient(
      { commercial_id: 7, commercial_nom: 'Marc Oliveira', commercial_actif: 1 },
      OFFRES,
    );
    assert.equal(q.nom, 'Marc Oliveira');
    assert.equal(q.origine, 'assigne');
  });

  it('l’emporte sur celui des offres, même plus récentes', () => {
    // Sans quoi une reprise de portefeuille se déferait à la première offre
    // que l'ancien commercial aurait laissée derrière lui.
    const q = commercialDuClient(
      { commercial_id: 7, commercial_nom: 'Marc Oliveira', commercial_actif: 1 },
      OFFRES,
    );
    assert.equal(q.nom, 'Marc Oliveira');
    assert.notEqual(q.nom, OFFRES[0].auteur_nom);
  });

  it('se déduit de la dernière offre quand personne n’est assigné', () => {
    const q = commercialDuClient({}, OFFRES);
    assert.equal(q.nom, 'Nadia Bensalem');
    assert.equal(q.origine, 'offres');
  });

  it('dit « déduit » et non « assigné » — l’écran doit pouvoir le nuancer', () => {
    assert.equal(commercialDuClient({}, OFFRES).origine, 'offres');
  });

  it('saute les offres sans auteur plutôt que de rendre un nom vide', () => {
    // Une offre créée par un compte depuis supprimé : la ligne existe, son
    // auteur non. Rendre `null` ici afficherait « Commercial · » suivi de rien.
    const q = commercialDuClient({}, [{ auteur_nom: null }, ...OFFRES]);
    assert.equal(q.nom, 'Nadia Bensalem');
  });

  it('n’invente personne quand il n’y a ni assignation ni offre', () => {
    const q = commercialDuClient({}, []);
    assert.equal(q.nom, null);
    assert.equal(q.origine, null);
  });

  it('ignore une assignation dont le compte a disparu', () => {
    // `commercial_id` pointe dans le vide : la jointure ne rend pas de nom.
    // Se rabattre sur les offres vaut mieux que d'afficher « Compte 12 ».
    const q = commercialDuClient({ commercial_id: 12 }, OFFRES);
    assert.equal(q.nom, 'Nadia Bensalem');
    assert.equal(q.origine, 'offres');
  });

  it('signale un compte assigné mais désactivé', () => {
    // Le client n'est suivi par personne, et rien ne le disait : le compte
    // existe toujours, il ne se connecte simplement plus.
    const q = commercialDuClient(
      { commercial_id: 7, commercial_nom: 'Marc Oliveira', commercial_actif: 0 },
      OFFRES,
    );
    assert.equal(q.nom, 'Marc Oliveira');
    assert.equal(q.inactif, true);
  });

  it('ne signale rien d’inactif pour un commercial déduit', () => {
    assert.equal(commercialDuClient({}, OFFRES).inactif, false);
  });

  it('se replie sur l’identifiant quand le compte n’a pas de nom', () => {
    const q = commercialDuClient({ commercial_id: 3, commercial_identifiant: 'moliveira', commercial_actif: 1 }, []);
    assert.equal(q.nom, 'moliveira');
    assert.equal(q.origine, 'assigne');
  });

  it('supporte un prospect absent — la fiche appelle avant de savoir s’il existe', () => {
    assert.equal(commercialDuClient().nom, null);
  });
});
