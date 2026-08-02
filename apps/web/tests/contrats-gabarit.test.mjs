/**
 * Les tests du contrat.
 *
 * Deux choses seulement, mais ce sont celles qui se paient cher : un contrat
 * édité sur un dossier incomplet, et un jeton effacé en silence.
 */
import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';

import {
  CHAMPS_DOSSIER,
  contexteContrat,
  dossierComplet,
  jourFr,
  remplirGabarit,
  TYPES_PIECE,
} from '../src/lib/contrats/gabarit.mjs';

/** Un dossier qui passe, pour n'en retirer qu'une pièce à la fois. */
function dossierPlein(sauf = {}) {
  const p = {
    raison_sociale: 'Boulangerie du Coin SRL',
    contact_email: 'marie@boulangerie.be',
    forme_juridique: 'SRL',
    numero_registre: 'BE 0123.456.789',
    adresse_siege: 'Rue du Four 12, 1000 Bruxelles',
    signataire_nom: 'Marie Delcourt',
    signataire_role: 'Gérante',
    signataire_email: 'marie@boulangerie.be',
    iban: 'BE68 5390 0754 7034',
  };
  return { ...p, ...sauf };
}

const PIECES_REQUISES = TYPES_PIECE.filter((t) => t.requise).map((t) => ({ type: t.cle }));

describe('le dossier client', () => {
  it('est complet quand tous les champs requis et les pièces requises sont là', () => {
    const r = dossierComplet(dossierPlein(), { pieces: PIECES_REQUISES });
    assert.equal(r.complet, true, JSON.stringify(r.manque));
    assert.deepEqual(r.manque, []);
  });

  it('rend tous les manques d’un coup, et non le premier', () => {
    const r = dossierComplet({ raison_sociale: 'X' }, { pieces: [] });
    assert.equal(r.complet, false);
    // Neuf champs requis moins la raison sociale, plus deux pièces.
    const requis = CHAMPS_DOSSIER.filter((c) => c.requis).length;
    assert.equal(r.manque.length, requis + 1 + PIECES_REQUISES.length);
  });

  it('nomme le champ qui manque en clair, pas par sa colonne', () => {
    const r = dossierComplet(dossierPlein({ iban: '' }), { pieces: PIECES_REQUISES });
    assert.equal(r.complet, false);
    assert.deepEqual(r.manque, [{ quoi: 'champ', nom: 'iban', libelle: 'IBAN' }]);
  });

  it('refuse un dossier sans pièce d’identité, même parfaitement rempli', () => {
    const r = dossierComplet(dossierPlein(), { pieces: [{ type: 'registre' }] });
    assert.equal(r.complet, false);
    assert.equal(r.manque.length, 1);
    assert.equal(r.manque[0].quoi, 'piece');
    assert.equal(r.manque[0].nom, 'identite');
  });

  it('accepte un zéro : un délai de paiement comptant n’est pas un champ vide', () => {
    // Le délai n'est pas requis, mais la règle de remplissage vaut pour tous.
    const r = dossierComplet(dossierPlein({ delai_paiement_jours: 0 }), { pieces: PIECES_REQUISES });
    assert.equal(r.complet, true);
  });

  it('ne prend pas un espace pour une valeur', () => {
    const r = dossierComplet(dossierPlein({ signataire_role: '   ' }), { pieces: PIECES_REQUISES });
    assert.equal(r.complet, false);
    assert.equal(r.manque[0].nom, 'signataire_role');
  });
});

describe('le remplissage du gabarit', () => {
  const contexte = contexteContrat({
    offre: { reference: 'TFB-2026-0001' },
    prospect: dossierPlein(),
    conditions: { date_effet: new Date('2026-09-01T00:00:00Z'), duree_mois: 12, preavis_jours: 90, reconduction: 'Tacite.' },
    recapitulatif: 'Pack franchisé — 1 188,00 €',
    aujourdhui: new Date('2026-08-02T00:00:00Z'),
  });

  it('remplace les jetons connus', () => {
    const r = remplirGabarit('Contrat {reference} avec {client}.', contexte);
    assert.equal(r.texte, 'Contrat TFB-2026-0001 avec Boulangerie du Coin SRL.');
    assert.deepEqual(r.inconnus, []);
    assert.deepEqual(r.vides, []);
  });

  it('laisse un jeton inconnu visible plutôt que de l’effacer', () => {
    const r = remplirGabarit('Payable par {carte_bleue}.', contexte);
    assert.equal(r.texte, 'Payable par {carte_bleue}.');
    assert.deepEqual(r.inconnus, ['carte_bleue']);
  });

  it('laisse un jeton connu mais vide visible, et le signale', () => {
    const creux = contexteContrat({ offre: { reference: 'R' }, prospect: {} });
    const r = remplirGabarit('Compte : {iban}.', creux);
    assert.equal(r.texte, 'Compte : {iban}.');
    assert.deepEqual(r.vides, ['iban']);
  });

  it('remplace toutes les occurrences d’un même jeton', () => {
    const r = remplirGabarit('{reference} — {reference}', contexte);
    assert.equal(r.texte, 'TFB-2026-0001 — TFB-2026-0001');
  });

  it('date en jours-mois-année, et ne date rien qui n’existe pas', () => {
    assert.equal(contexte.date_effet, '01/09/2026');
    assert.equal(contexte.date_du_jour, '02/08/2026');
    assert.equal(jourFr(null), '');
    assert.equal(jourFr('pas une date'), '');
  });

  it('retombe sur le siège quand l’adresse de facturation manque', () => {
    assert.equal(contexte.facturation_adresse, 'Rue du Four 12, 1000 Bruxelles');
    assert.equal(contexte.facturation_email, 'marie@boulangerie.be');
  });

  it('garde une adresse de facturation propre quand elle existe', () => {
    const c = contexteContrat({ prospect: dossierPlein({ facturation_adresse: 'Chez le comptable, 4000 Liège' }) });
    assert.equal(c.facturation_adresse, 'Chez le comptable, 4000 Liège');
  });

  it('donne trente jours de paiement par défaut, mais respecte un zéro', () => {
    assert.equal(contexteContrat({ prospect: {} }).delai_paiement_jours, '30');
    assert.equal(contexteContrat({ prospect: { delai_paiement_jours: 0 } }).delai_paiement_jours, '0');
  });
});
