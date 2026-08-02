/**
 * Les tests de la normalisation.
 *
 * Chacun correspond à une façon connue de se tromper d'un facteur cent, de
 * perdre une journée, ou de gonfler un chiffre d'affaires — les trois erreurs
 * qui ne se voient pas à l'œil et se découvrent six semaines plus tard.
 */
import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';

import {
  LigneRefusee,
  journeeExploitation,
  mappingIncomplet,
  normaliser,
  parChemin,
  sansDonneesPersonnelles,
  transformer,
} from '../src/lib/onboarding/normalisation.mjs';

/** Une ligne GoPOS telle qu'elle arrive, prix en centimes. */
const BRUTE = {
  id: 'L-88213-4',
  receipt_id: 'R-88213',
  location_id: 'go_13410_01',
  closed_at: '2026-08-01T20:47:11+02:00',
  item_id: 'P-2277',
  name: 'Pain au chocolat',
  group_id: 'C-14',
  category: 'Viennoiserie',
  quantity: 2,
  price: 160,
  total: 320,
  vat: 6,
  currency: 'EUR',
  order_type: 'takeaway',
};

const MAP = {
  externe_id: { source: 'id' },
  commande_externe_id: { source: 'receipt_id' },
  boutique_externe_id: { source: 'location_id' },
  vendu_le: { source: 'closed_at' },
  produit_externe_id: { source: 'item_id' },
  produit_libelle: { source: 'name' },
  categorie_externe_id: { source: 'group_id' },
  categorie_libelle: { source: 'category' },
  quantite: { source: 'quantity' },
  prix_unitaire_ttc: { source: 'price', transform: { type: 'diviser', par: 100 } },
  total_ttc: { source: 'total', transform: { type: 'diviser', par: 100 } },
  taux_tva: { source: 'vat' },
  devise: { source: 'currency' },
  canal: { source: 'order_type' },
};

describe('la lecture par chemin', () => {
  it('descend dans les objets imbriqués', () => {
    assert.equal(parChemin({ a: { b: { c: 3 } } }, 'a.b.c'), 3);
  });
  it('rend indéfini plutôt que de lever sur un chemin absent', () => {
    assert.equal(parChemin({ a: 1 }, 'a.b.c'), undefined);
    assert.equal(parChemin(null, 'a'), undefined);
    assert.equal(parChemin({ a: 1 }, ''), undefined);
  });
});

describe('les transformations', () => {
  it('divise — le cas des centimes', () => {
    assert.equal(transformer(160, { type: 'diviser', par: 100 }), 1.6);
  });
  it('multiplie', () => {
    assert.equal(transformer(1.6, { type: 'multiplier', par: 100 }), 160);
  });
  it('pose une constante, même sur une valeur absente', () => {
    assert.equal(transformer(undefined, { type: 'constante', valeur: 'EUR' }), 'EUR');
  });
  it('traduit par table, et laisse passer l’inconnu', () => {
    const t = { type: 'table', table: { takeaway: 'emporter' } };
    assert.equal(transformer('takeaway', t), 'emporter');
    assert.equal(transformer('drive', t), 'drive');
  });
  it('ne transforme pas une valeur absente, sauf constante', () => {
    assert.equal(transformer(null, { type: 'diviser', par: 100 }), null);
  });
  it('laisse la valeur telle quelle sans transformation', () => {
    assert.equal(transformer(42, null), 42);
    assert.equal(transformer(42, { type: 'inconnu' }), 42);
  });
});

describe('la journée d’exploitation', () => {
  it('une vente à 01h30 compte pour la veille', () => {
    const j = journeeExploitation('2026-08-02T01:30:00+02:00', { coupure: 4 });
    assert.equal(j.date, '2026-08-01');
    assert.equal(j.heure, 1);
  });

  it('une vente à 05h00 compte pour le jour même', () => {
    assert.equal(journeeExploitation('2026-08-02T05:00:00+02:00', { coupure: 4 }).date, '2026-08-02');
  });

  it('la coupure se règle par boutique', () => {
    // Un glacier ferme tôt : 01h30 est déjà le lendemain pour lui.
    assert.equal(journeeExploitation('2026-08-02T01:30:00+02:00', { coupure: 0 }).date, '2026-08-02');
    // Un bar ferme tard : 05h00 appartient encore à la veille.
    assert.equal(journeeExploitation('2026-08-02T05:00:00+02:00', { coupure: 6 }).date, '2026-08-01');
  });

  it('calcule dans le fuseau de la boutique, pas dans celui du serveur', () => {
    // 23h30 à Bruxelles, soit 21h30 UTC : le jour ne doit pas changer.
    const j = journeeExploitation('2026-08-01T21:30:00Z', { fuseau: 'Europe/Brussels', coupure: 4 });
    assert.equal(j.date, '2026-08-01');
    assert.equal(j.heure, 23);
  });

  it('tient compte de l’heure d’été', () => {
    // 00h30 UTC le 1er août = 02h30 à Bruxelles (UTC+2) → veille avec coupure 4.
    assert.equal(journeeExploitation('2026-08-01T00:30:00Z', { fuseau: 'Europe/Brussels', coupure: 4 }).date, '2026-07-31');
    // 00h30 UTC le 1er janvier = 01h30 à Bruxelles (UTC+1) → veille aussi.
    assert.equal(journeeExploitation('2026-01-01T00:30:00Z', { fuseau: 'Europe/Brussels', coupure: 4 }).date, '2025-12-31');
  });

  it('ne date rien qui n’est pas une date', () => {
    assert.equal(journeeExploitation('pas une date'), null);
    assert.equal(journeeExploitation(null), null);
  });
});

describe('une ligne normalisée', () => {
  const ligne = normaliser(BRUTE, {
    correspondances: MAP,
    boutique: { fuseau: 'Europe/Brussels', coupure_jour: 4 },
    devise: 'EUR',
    connecteur: 'gopos',
  });

  it('rend les montants en euros, pas en centimes', () => {
    assert.equal(ligne.prix_unitaire_ttc, 1.6);
    assert.equal(ligne.total_ttc, 3.2);
  });

  it('déduit le hors-taxes du taux de TVA', () => {
    // 3,20 € TTC à 6 % → 3,0189 € HT.
    assert.equal(Math.round(ligne.total_ht * 10000) / 10000, 3.0189);
  });

  it('range le canal dans un vocabulaire connu', () => {
    assert.equal(ligne.canal, 'emporter');
  });

  it('classe un canal inconnu en « autre » plutôt que de le perdre', () => {
    const l = normaliser({ ...BRUTE, order_type: 'drive-piéton' }, { correspondances: MAP });
    assert.equal(l.canal, 'autre');
  });

  it('pose la journée d’exploitation et l’heure', () => {
    assert.equal(ligne.jour_exploitation, '2026-08-01');
    assert.equal(ligne.heure, 20);
  });

  it('garde une quantité négative — c’est un remboursement', () => {
    const l = normaliser({ ...BRUTE, quantity: -2, total: -320 }, { correspondances: MAP });
    assert.equal(l.quantite, -2);
    assert.equal(l.total_ttc, -3.2);
  });

  it('laisse à null ce qui n’est pas fourni, sans inventer de zéro', () => {
    assert.equal(ligne.moyen_paiement, null);
    assert.equal(ligne.remise, null);
  });
});

describe('ce qu’une ligne ne peut pas se permettre', () => {
  it('refuse une ligne sans identifiant : on ne saurait pas la dédoublonner', () => {
    assert.throws(() => normaliser({ ...BRUTE, id: null }, { correspondances: MAP }),
      (e) => e instanceof LigneRefusee && e.code === 'CHAMP_REQUIS_ABSENT');
  });

  it('refuse une date illisible', () => {
    assert.throws(() => normaliser({ ...BRUTE, closed_at: 'hier' }, { correspondances: MAP }),
      (e) => e.code === 'DATE_ILLISIBLE');
  });

  it('refuse une devise étrangère plutôt que de l’additionner', () => {
    assert.throws(() => normaliser({ ...BRUTE, currency: 'USD' }, { correspondances: MAP, devise: 'EUR' }),
      (e) => e.code === 'DEVISE_ETRANGERE');
  });

  it('accepte l’absence de devise et prend celle du réseau', () => {
    const l = normaliser({ ...BRUTE, currency: null }, { correspondances: MAP, devise: 'EUR' });
    assert.equal(l.devise, 'EUR');
  });
});

describe('les données personnelles', () => {
  it('retire un nom, un courriel, un téléphone', () => {
    const propre = sansDonneesPersonnelles({
      id: 'L-1', customer_name: 'Marie Delcourt', customer_email: 'marie@x.be',
      phone: '+32 2 123', total: 320,
    });
    assert.deepEqual(propre, { id: 'L-1', total: 320 });
  });

  it('retire un objet client entier, quel que soit son contenu', () => {
    const propre = sansDonneesPersonnelles({ id: 'L-1', customer: { anything: 'x', loyalty: 42 } });
    assert.deepEqual(propre, { id: 'L-1' });
  });

  it('descend dans les tableaux', () => {
    const propre = sansDonneesPersonnelles({ lignes: [{ id: 1, client_nom: 'X' }] });
    assert.deepEqual(propre, { lignes: [{ id: 1 }] });
  });

  it('ne touche pas à ce qui n’est pas personnel', () => {
    const brute = { id: 'L-1', product_name: 'Pain', total: 320, vat: 6 };
    assert.deepEqual(sansDonneesPersonnelles(brute), brute);
  });

  it('garde « name » tout court : c’est le nom du produit', () => {
    // Le retirer vidait la colonne produit de chaque ligne, en silence, et le
    // mapping se plaignait ensuite d'un champ introuvable.
    const brute = { id: 'L-1', name: 'Pain au chocolat', label: 'Viennoiserie', title: 'x' };
    assert.deepEqual(sansDonneesPersonnelles(brute), brute);
  });

  it('retire un courriel ou un téléphone, même sans préfixe', () => {
    const propre = sansDonneesPersonnelles({ id: 'L-1', email: 'x@y.be', phone: '+32', name: 'Pain' });
    assert.deepEqual(propre, { id: 'L-1', name: 'Pain' });
  });
});

describe('le mapping incomplet', () => {
  it('nomme ce qui manque, en clair', () => {
    const manque = mappingIncomplet({ externe_id: { source: 'id' } });
    assert.equal(manque.some((m) => m.cle === 'quantite'), true);
    assert.equal(manque.find((m) => m.cle === 'quantite').libelle, 'Quantité');
    assert.equal(manque.some((m) => m.cle === 'externe_id'), false);
  });

  it('accepte une constante comme source valable', () => {
    // Une caisse mono-boutique ne renvoie pas d'identifiant de boutique : on
    // en pose un en dur plutôt que de refuser la connexion.
    const manque = mappingIncomplet({
      boutique_externe_id: { transform: { type: 'constante', valeur: 'unique' } },
    });
    assert.equal(manque.some((m) => m.cle === 'boutique_externe_id'), false);
  });

  it('ne réclame rien quand tout est là', () => {
    assert.deepEqual(mappingIncomplet(MAP), []);
  });
});
