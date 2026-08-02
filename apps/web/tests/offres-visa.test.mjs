/**
 * Les tests du bon pour accord sur les vues.
 *
 * Un visa ne vaut que par ce qu'il pointe. Tout ce qui est vérifié ici tourne
 * autour d'une seule question : **est-ce qu'on peut changer ce qui a été
 * signé sans que cela se voie ?** La réponse doit rester non, y compris pour
 * les changements de bonne foi — une capture « mise à jour », une vue
 * ajoutée après coup.
 */
import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';

import {
  empechementsVisa,
  empreinteDuFlux,
  empreinteImage,
  nomDeSignataire,
  texteAValider,
  visaAJour,
  vuesSansMaquette,
} from '../src/lib/offres/visa.mjs';

const VUES = [
  { nombre: 1, note: 'Tableau des marges par boutique', interne: 'demandé par le DAF' },
  { nombre: 2, note: 'Fiche produit avec le food cost' },
];
const MAQUETTES = [
  { rang: 0, empreinte: 'aaa' },
  { rang: 1, empreinte: 'bbb' },
];

describe('le texte soumis à l’accord', () => {
  it('se lit — c’est ce qui permet de le remettre sous les yeux du client', () => {
    const texte = texteAValider(VUES, MAQUETTES);
    assert.equal(texte, '1. 1 × Tableau des marges par boutique — aaa\n2. 2 × Fiche produit avec le food cost — bbb');
  });

  it('n’emporte pas la note interne : le client ne l’a jamais vue', () => {
    assert.ok(!texteAValider(VUES, MAQUETTES).includes('DAF'));
  });

  it('dit quand une vue n’a pas de capture, plutôt que de faire comme si', () => {
    assert.match(texteAValider(VUES, [MAQUETTES[0]]), /2\. 2 × Fiche produit.*sans capture/);
  });

  it('nomme « Vue » ce qui n’a pas de description, comme l’offre imprimée', () => {
    assert.match(texteAValider([{ nombre: 1, note: '   ' }], []), /1 × Vue —/);
  });
});

describe('l’empreinte', () => {
  it('est stable : deux calculs sur la même chose donnent la même', () => {
    assert.equal(empreinteDuFlux(VUES, MAQUETTES), empreinteDuFlux(VUES, MAQUETTES));
  });

  it('change quand une capture est remplacée', () => {
    const autre = [{ rang: 0, empreinte: 'aaa' }, { rang: 1, empreinte: 'CHANGÉE' }];
    assert.notEqual(empreinteDuFlux(VUES, MAQUETTES), empreinteDuFlux(VUES, autre));
  });

  it('change quand une vue est ajoutée', () => {
    const plus = [...VUES, { nombre: 1, note: 'Une vue de plus' }];
    assert.notEqual(empreinteDuFlux(VUES, MAQUETTES), empreinteDuFlux(plus, MAQUETTES));
  });

  it('change quand une description est retouchée', () => {
    const retouche = [{ ...VUES[0], note: 'Tableau des marges par boutique et par mois' }, VUES[1]];
    assert.notEqual(empreinteDuFlux(VUES, MAQUETTES), empreinteDuFlux(retouche, MAQUETTES));
  });

  it('change quand les vues sont réordonnées — les maquettes suivent le rang', () => {
    assert.notEqual(empreinteDuFlux(VUES, MAQUETTES), empreinteDuFlux([VUES[1], VUES[0]], MAQUETTES));
  });

  it('ne change pas quand seule la note interne bouge', () => {
    const interne = [{ ...VUES[0], interne: 'autre chose' }, VUES[1]];
    assert.equal(empreinteDuFlux(VUES, MAQUETTES), empreinteDuFlux(interne, MAQUETTES));
  });

  it('se calcule depuis le contenu quand la maquette n’en porte pas', () => {
    const brute = [{ rang: 0, contenu: 'AAAA' }];
    assert.equal(
      texteAValider([VUES[0]], brute).split('— ')[1],
      empreinteImage('AAAA'),
    );
  });
});

describe('un visa face au flux d’aujourd’hui', () => {
  it('reste à jour tant que rien ne bouge', () => {
    const visa = { empreinte: empreinteDuFlux(VUES, MAQUETTES) };
    const r = visaAJour(visa, VUES, MAQUETTES);
    assert.equal(r.signe, true);
    assert.equal(r.perime, false);
  });

  it('devient périmé dès qu’une capture est redéposée', () => {
    const visa = { empreinte: empreinteDuFlux(VUES, MAQUETTES) };
    const apres = [{ rang: 0, empreinte: 'aaa' }, { rang: 1, empreinte: 'nouvelle' }];
    assert.equal(visaAJour(visa, VUES, apres).perime, true);
  });

  it('sans visa, ne prétend pas qu’il y en a un', () => {
    assert.deepEqual(visaAJour(null, VUES, MAQUETTES), { signe: false, perime: false });
  });
});

describe('ce qui empêche de demander l’accord', () => {
  it('refuse un flux sans vue', () => {
    assert.equal(empechementsVisa([], []).length, 1);
    assert.match(empechementsVisa([{ nombre: 0, note: '' }], [])[0], /Aucune vue/);
  });

  it('refuse un flux dont aucune vue n’est montrée', () => {
    assert.match(empechementsVisa(VUES, [])[0], /Aucune capture/);
  });

  it('laisse passer un flux partiellement illustré, et le signale ailleurs', () => {
    assert.deepEqual(empechementsVisa(VUES, [MAQUETTES[0]]), []);
    assert.deepEqual(vuesSansMaquette(VUES, [MAQUETTES[0]]), [
      { rang: 1, note: 'Fiche produit avec le food cost' },
    ]);
  });
});

describe('le nom du signataire', () => {
  it('accepte un nom, et le range', () => {
    assert.equal(nomDeSignataire('  Jean   Dupont '), 'Jean Dupont');
  });

  it('refuse ce qui ne servirait à rien le jour d’un litige', () => {
    for (const saisie of ['x', 'ok', '  ', '...', '123', null]) {
      assert.equal(nomDeSignataire(saisie), null, String(saisie));
    }
  });
});
