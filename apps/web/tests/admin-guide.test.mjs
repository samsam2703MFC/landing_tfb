/**
 * Les tests du découpage du guide.
 *
 * Ce qui compte : qu'un guide réécrit sans respecter la convention rende
 * quelque chose de lisible plutôt qu'une page cassée.
 */
import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';

import { sectionsDuGuide } from '../src/lib/admin/guide.mjs';

describe('le découpage du guide', () => {
  it('coupe sur les lignes en capitales', () => {
    const s = sectionsDuGuide('AVANT DE DÉCROCHER\nLire sa demande.\n\nFERMER L’APPEL\nDonner une date.');
    assert.equal(s.length, 2);
    assert.equal(s[0].titre, 'AVANT DE DÉCROCHER');
    assert.equal(s[0].corps, 'Lire sa demande.');
    assert.equal(s[1].titre, 'FERMER L’APPEL');
  });

  it('garde ce qui précède le premier titre', () => {
    const s = sectionsDuGuide('Une phrase d’introduction.\n\nLES QUESTIONS\n1. Combien ?');
    assert.equal(s.length, 2);
    assert.equal(s[0].titre, '');
    assert.equal(s[0].corps, 'Une phrase d’introduction.');
  });

  it('rend une seule fiche quand personne n’a mis de titre', () => {
    const s = sectionsDuGuide('On appelle, on écoute,\net on note ce qui bloque.');
    assert.equal(s.length, 1);
    assert.equal(s[0].titre, '');
  });

  it('ne prend pas une phrase ponctuée pour un titre, même en capitales', () => {
    const s = sectionsDuGuide('NE JAMAIS DONNER UN PRIX FERME.');
    assert.equal(s.length, 1);
    assert.equal(s[0].titre, '');
  });

  it('ne prend pas une ligne de chiffres ou de tirets pour un titre', () => {
    const s = sectionsDuGuide('----------\n1. 2. 3.');
    assert.equal(s.length, 1);
    assert.equal(s[0].titre, '');
  });

  it('accepte une précision en minuscules après le tiret cadratin', () => {
    // C'est la forme du guide semé : la rater ferait perdre deux sections.
    const s = sectionsDuGuide('AVANT DE DÉCROCHER — deux minutes\nLire sa demande.');
    assert.equal(s[0].titre, 'AVANT DE DÉCROCHER — deux minutes');
    assert.equal(s[0].corps, 'Lire sa demande.');
  });

  it('découpe le guide semé en ses six sections', () => {
    const seme = [
      'AVANT DE DÉCROCHER — deux minutes', 'Lire sa demande.', '',
      'LES DIX PREMIÈRES SECONDES', '« Bonjour »', '',
      "CE QU'IL FAUT SAVOIR EN SORTANT — six questions", '1. Combien ?', '',
      "CE QU'ON NE FAIT PAS AU PREMIER APPEL", 'Donner un prix ferme.', '',
      "FERMER L'APPEL", 'Une date de retour.', '',
      "APRÈS L'APPEL", 'Noter ce qui bloque.',
    ].join('\n');
    assert.equal(sectionsDuGuide(seme).length, 6);
  });

  it('ne rend rien pour un guide vide', () => {
    assert.deepEqual(sectionsDuGuide(''), []);
    assert.deepEqual(sectionsDuGuide(null), []);
    assert.deepEqual(sectionsDuGuide('\n\n  \n'), []);
  });
});
