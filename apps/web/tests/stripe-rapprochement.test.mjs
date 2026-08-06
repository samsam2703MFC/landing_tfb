/**
 * Les tests du rapprochement entre les packs et le catalogue Stripe.
 *
 * Ce fichier existe pour un cas précis : un pack qui revendique un `prod_…`
 * que Stripe ne connaît pas. Rien ne le distingue à l'écran d'un pack en bon
 * état — il a un produit, il a des modules, il s'affiche comme vendable. On
 * l'apprend au premier paiement, du côté du client.
 */
import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';

import { modeStripe, rapprocherPacks } from '../src/lib/facturation/stripe.mjs';

const PRODUITS = [
  { id: 'prod_essentiel', nom: 'Essentiel' },
  { id: 'prod_business', nom: 'Business' },
  { id: 'prod_orphelin_chez_nous', nom: 'Vendu sans pack' },
];

describe('le mode de la clé', () => {
  it('se lit sur le préfixe, pas en interrogeant Stripe', () => {
    assert.equal(modeStripe({ STRIPE_CLE: 'sk_test_abc' }), 'essai');
    assert.equal(modeStripe({ STRIPE_CLE: 'sk_live_abc' }), 'reel');
    assert.equal(modeStripe({ STRIPE_CLE: 'rk_live_abc' }), 'reel');
  });

  it('distingue « absente » de « illisible »', () => {
    assert.equal(modeStripe({}), 'absent');
    assert.equal(modeStripe({ STRIPE_CLE: '   ' }), 'absent');
    assert.equal(modeStripe({ STRIPE_CLE: 'collé-de-travers' }), 'inconnu');
  });
});

describe('le rapprochement', () => {
  it('apparie un pack au produit qu’il revendique', () => {
    const r = rapprocherPacks([{ cle: 'essentiel', stripe_product_id: 'prod_essentiel' }], PRODUITS);
    assert.equal(r.rapproches.length, 1);
    assert.equal(r.rapproches[0].produit.nom, 'Essentiel');
    assert.equal(r.orphelins.length, 0);
  });

  it('signale un pack dont le produit n’existe pas chez Stripe', () => {
    const r = rapprocherPacks([{ cle: 'signage', stripe_product_id: 'prod_archive' }], PRODUITS);
    assert.deepEqual(r.orphelins.map((p) => p.cle), ['signage']);
    assert.equal(r.rapproches.length, 0, 'le pack a l’air vendable, et ne l’est pas');
  });

  it('range à part les packs qui ne revendiquent rien', () => {
    const r = rapprocherPacks([{ cle: 'reprise', stripe_product_id: null }], PRODUITS);
    assert.deepEqual(r.sansProduit.map((p) => p.cle), ['reprise']);
    assert.equal(r.orphelins.length, 0, 'ne rien revendiquer n’est pas revendiquer à tort');
  });

  it('liste ce que Stripe vend et qu’aucun pack n’ouvre', () => {
    const r = rapprocherPacks(
      [{ cle: 'essentiel', stripe_product_id: 'prod_essentiel' }],
      PRODUITS,
    );
    assert.deepEqual(r.nonRattaches.map((p) => p.id), ['prod_business', 'prod_orphelin_chez_nous']);
  });

  it('supporte une liste de produits vide sans tout déclarer orphelin par erreur', () => {
    // Stripe injoignable rend `produits` vide : l'écran doit alors ne PAS
    // afficher un catalogue entier en orphelin. C'est à l'appelant de ne pas
    // rapprocher quand la lecture a échoué — ce test fige le comportement brut.
    const r = rapprocherPacks([{ cle: 'essentiel', stripe_product_id: 'prod_essentiel' }], []);
    assert.equal(r.orphelins.length, 1);
    assert.equal(r.nonRattaches.length, 0);
  });

  it('ne bronche pas sur des entrées absentes', () => {
    const r = rapprocherPacks(null, null);
    assert.deepEqual(r, { rapproches: [], orphelins: [], sansProduit: [], nonRattaches: [] });
  });
});
