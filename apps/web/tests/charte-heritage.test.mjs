/**
 * Les trois niveaux d'une charte : maison → marque → client.
 *
 * Une marque habille **tous ses clients** : un réseau de franchise a une
 * identité, pas trente. C'est la règle qui décide de ce que trente
 * applications affichent, et elle se trompe sans bruit dans les deux sens :
 *
 *   · trop d'héritage, et un franchisé perd la couleur qu'il a choisie ;
 *   · pas assez, et une refonte d'enseigne n'atteint personne.
 *
 * Le test porte sur la superposition clé par clé, pas sur des objets entiers :
 * c'est précisément le point où un `Object.assign` mal ordonné écrase tout un
 * niveau au lieu d'une valeur.
 */
import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';

import { valeursResolues } from '../src/lib/charte/registre.mjs';

const MAISON = { marque_fond: '#0c1329', marque_texte: '#ffffff', marque_accent: '#7b4488' };
const ENSEIGNE = { marque_fond: '#f0912a', marque_accent: '#0c6a66' };
const CLIENT = { marque_accent: '#c0304a' };

describe('la superposition des chartes', () => {
  it('donne la main au client sur tout le monde', () => {
    const r = valeursResolues(CLIENT, MAISON, ENSEIGNE);
    assert.equal(r.marque_accent, '#c0304a');
  });

  it('donne la main à l’enseigne sur la maison', () => {
    const r = valeursResolues(CLIENT, MAISON, ENSEIGNE);
    assert.equal(r.marque_fond, '#f0912a');
  });

  it('retombe sur la maison pour ce que personne n’a fixé', () => {
    const r = valeursResolues(CLIENT, MAISON, ENSEIGNE);
    assert.equal(r.marque_texte, '#ffffff');
  });

  it('superpose clé par clé, jamais niveau par niveau', () => {
    // Le défaut classique : l'enseigne fixe deux clés sur trois, et un
    // remplacement d'objet entier ferait perdre la troisième.
    const r = valeursResolues({}, MAISON, ENSEIGNE);
    assert.equal(r.marque_fond, '#f0912a', 'de l’enseigne');
    assert.equal(r.marque_accent, '#0c6a66', 'de l’enseigne');
    assert.equal(r.marque_texte, '#ffffff', 'de la maison, que l’enseigne n’a pas fixée');
  });

  it('sert la charte de l’enseigne à un client qui n’a rien surchargé', () => {
    // Le cas normal d'un réseau : trente franchisés, une identité.
    const r = valeursResolues({}, MAISON, ENSEIGNE);
    const sansClient = valeursResolues({}, MAISON, ENSEIGNE);
    assert.deepEqual(r, sansClient);
    assert.equal(r.marque_fond, ENSEIGNE.marque_fond);
  });

  it('sert la maison à un client sans enseigne', () => {
    const r = valeursResolues({}, MAISON, {});
    assert.equal(r.marque_fond, MAISON.marque_fond);
  });

  it('garde les défauts du registre sous les trois niveaux', () => {
    // Une clé qu'aucun des trois ne fixe doit rester peuplée : une variable
    // CSS absente casse la page qui la lit, elle ne la laisse pas « par
    // défaut ».
    const r = valeursResolues({}, {}, {});
    assert.ok(Object.keys(r).length > 20);
    for (const [cle, valeur] of Object.entries(r)) {
      assert.notEqual(valeur, undefined, `${cle} est vide`);
    }
  });

  it('supporte l’absence des trois — la maison n’est pas encore publiée', () => {
    assert.doesNotThrow(() => valeursResolues());
  });

  it('n’efface pas une valeur du dessous avec une clé absente du dessus', () => {
    // Une charte d'enseigne vide ne doit pas blanchir la maison : c'est ce qui
    // arriverait si l'absence était stockée comme une chaîne vide plutôt que
    // comme une clé manquante.
    const r = valeursResolues({}, MAISON, {});
    assert.equal(r.marque_accent, MAISON.marque_accent);
  });
});
