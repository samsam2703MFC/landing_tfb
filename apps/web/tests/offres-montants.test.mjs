/**
 * Les tests de la saisie des montants.
 *
 * C'est le seul point d'entrée par lequel une erreur humaine devient un
 * chiffre en base : un « 1 000 » collé depuis un tableur, une virgule à la
 * place d'un point, un taux tapé en points au lieu de pourcents.
 */
import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';

import {
  SaisieInvalide,
  afficherTarif,
  depuisCents,
  depuisPoints,
  enCents,
  enEntier,
  enPoints,
  lireTarif,
  saisirTarif,
} from '../src/lib/offres/montants.mjs';

describe('la saisie d’un montant', () => {
  it('lit un entier simple', () => {
    assert.equal(enCents('1000'), 100_000);
  });

  it('lit la virgule comme séparateur décimal', () => {
    assert.equal(enCents('1000,50'), 100_050);
    assert.equal(enCents('1000.50'), 100_050);
  });

  it('supporte le copier-coller depuis un tableur', () => {
    // Espace ordinaire, insécable (U+00A0) et fin (U+202F), plus le symbole.
    assert.equal(enCents('1 000'), 100_000);
    assert.equal(enCents('1 000,50'), 100_050);
    assert.equal(enCents('1 000'), 100_000);
    assert.equal(enCents('€ 1 000,50'), 100_050);
  });

  it('tranche au centime plutôt que de traîner une fraction', () => {
    assert.equal(enCents('10,005'), 1_001);
    assert.equal(enCents('10,004'), 1_000);
  });

  it('refuse le vide, le négatif et le texte', () => {
    for (const mauvais of ['', '   ', '-100', 'environ 1000', 'mille', '1e3']) {
      assert.throws(() => enCents(mauvais, 'Prix'), SaisieInvalide, `« ${mauvais} » aurait dû être refusé`);
    }
  });

  it('nomme le champ fautif dans le message', () => {
    assert.throws(() => enCents('abc', 'Prix par vue'), /Prix par vue/);
  });

  it('fait l’aller-retour sans perte', () => {
    assert.equal(depuisCents(100_050), '1000.50');
    assert.equal(enCents(depuisCents(100_050)), 100_050);
  });
});

describe('la saisie d’un taux', () => {
  it('lit un pourcentage entier ou décimal', () => {
    assert.equal(enPoints('21'), 2100);
    assert.equal(enPoints('7,5'), 750);
    assert.equal(enPoints('5'), 500);
  });

  it('refuse un taux au-delà de 100, qui est toujours une confusion d’unité', () => {
    // Taper « 2100 » en croyant saisir des points facturerait 2 100 % de TVA.
    assert.throws(() => enPoints('2100', 'TVA'), /ne dépasse pas 100/);
  });

  it('fait l’aller-retour', () => {
    assert.equal(depuisPoints(2100), '21');
    assert.equal(depuisPoints(750), '7.5');
    assert.equal(enPoints(depuisPoints(750)), 750);
  });
});

describe('la saisie d’un compte', () => {
  it('accepte un entier', () => {
    assert.equal(enEntier('24'), 24);
    assert.equal(enEntier('0'), 0);
  });

  it('refuse un décimal — on ne vend pas 2,5 jours de formation par erreur', () => {
    assert.throws(() => enEntier('2,5', 'Jours'), /nombre entier/);
  });
});

describe('les tarifs, selon leur type déclaré', () => {
  const prix = { cle: 'prix_par_vue', type: 'cents', valeur: '100000', libelle: 'Prix par vue' };
  const taux = { cle: 'taux_annuel', type: 'points', valeur: '500', libelle: 'Maintenance' };
  const mois = { cle: 'multiplicateur_achat', type: 'entier', valeur: '24', libelle: 'Multiplicateur' };
  const note = { cle: 'mention', type: 'texte', valeur: 'Autoliquidation', libelle: 'Mention' };

  it('se lisent en entier, sauf le texte', () => {
    assert.equal(lireTarif(prix), 100_000);
    assert.equal(lireTarif(taux), 500);
    assert.equal(lireTarif(mois), 24);
    assert.equal(lireTarif(note), 'Autoliquidation');
  });

  it('s’affichent dans l’unité de l’humain', () => {
    assert.equal(afficherTarif(prix), '1000.00');
    assert.equal(afficherTarif(taux), '5');
    assert.equal(afficherTarif(mois), '24');
    assert.equal(afficherTarif(note), 'Autoliquidation');
  });

  it('reviennent en base dans l’unité de la machine', () => {
    assert.equal(saisirTarif(prix, '1 200,50'), '120050');
    assert.equal(saisirTarif(taux, '7,5'), '750');
    assert.equal(saisirTarif(mois, '36'), '36');
    assert.equal(saisirTarif(note, 'Texte libre'), 'Texte libre');
  });

  it('refusent une saisie invalide en nommant le libellé', () => {
    assert.throws(() => saisirTarif(prix, 'gratuit'), /Prix par vue/);
  });
});

describe('les fins de ligne des tarifs texte', () => {
  // Une `<textarea>` soumet ses retours en CRLF : la norme HTML l'exige.
  // Sans normalisation, un gabarit de contrat ressort avec un `\r` par ligne
  // dans le document envoyé en signature.
  const ligne = { cle: 'contrat_gabarit', type: 'texte', valeur: 'a\r\nb\r\nc' };

  it('normalise à l’enregistrement', () => {
    assert.equal(saisirTarif(ligne, 'x\r\ny'), 'x\ny');
  });

  it('normalise aussi à la lecture, pour les valeurs déjà en base', () => {
    assert.equal(lireTarif(ligne), 'a\nb\nc');
    assert.equal(afficherTarif(ligne), 'a\nb\nc');
  });

  it('laisse un texte déjà propre intact', () => {
    assert.equal(saisirTarif(ligne, 'x\ny'), 'x\ny');
  });

  it('ne touche pas aux nombres', () => {
    assert.equal(saisirTarif({ cle: 'tva', type: 'points', libelle: 'TVA' }, '21'), '2100');
  });
});
