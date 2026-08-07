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

import { REGISTRE, valeursResolues } from '../src/lib/charte/registre.mjs';

// De vraies clés du registre, pas des noms inventés : un test sur des clés
// qui n'existent pas passe pour de mauvaises raisons — `valeursResolues` les
// laisse traverser sans rien en faire.
const MAISON = { 'theme.primaire': '#0c1329', 'theme.fond_page': '#ffffff', 'theme.accent': '#7b4488' };
const ENSEIGNE = { 'theme.primaire': '#f0912a', 'theme.accent': '#0c6a66' };
const CLIENT = { 'theme.accent': '#c0304a' };

describe('la superposition des chartes', () => {
  it('donne la main au client sur tout le monde', () => {
    const r = valeursResolues(CLIENT, MAISON, ENSEIGNE);
    assert.equal(r['theme.accent'], '#c0304a');
  });

  it('donne la main à l’enseigne sur la maison', () => {
    const r = valeursResolues(CLIENT, MAISON, ENSEIGNE);
    assert.equal(r['theme.primaire'], '#f0912a');
  });

  it('retombe sur la maison pour ce que personne n’a fixé', () => {
    const r = valeursResolues(CLIENT, MAISON, ENSEIGNE);
    assert.equal(r['theme.fond_page'], '#ffffff');
  });

  it('superpose clé par clé, jamais niveau par niveau', () => {
    // Le défaut classique : l'enseigne fixe deux clés sur trois, et un
    // remplacement d'objet entier ferait perdre la troisième.
    const r = valeursResolues({}, MAISON, ENSEIGNE);
    assert.equal(r['theme.primaire'], '#f0912a', 'de l’enseigne');
    assert.equal(r['theme.accent'], '#0c6a66', 'de l’enseigne');
    assert.equal(r['theme.fond_page'], '#ffffff', 'de la maison, que l’enseigne n’a pas fixée');
  });

  it('sert la charte de l’enseigne à un client qui n’a rien surchargé', () => {
    // Le cas normal d'un réseau : trente franchisés, une identité.
    const r = valeursResolues({}, MAISON, ENSEIGNE);
    const sansClient = valeursResolues({}, MAISON, ENSEIGNE);
    assert.deepEqual(r, sansClient);
    assert.equal(r['theme.primaire'], ENSEIGNE['theme.primaire']);
  });

  it('sert la maison à un client sans enseigne', () => {
    const r = valeursResolues({}, MAISON, {});
    assert.equal(r['theme.primaire'], MAISON['theme.primaire']);
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
    assert.equal(r['theme.accent'], MAISON['theme.accent']);
  });
});

/**
 * « Rendre à l'enseigne » — retirer toutes les surcharges d'un coup.
 *
 * Un client déjà charté ne voit rien changer quand on le rattache à une
 * enseigne : ses surcharges l'emportent, une par une. Les retirer à la main
 * demandait autant de clics qu'il y a de variables, et on en oubliait une —
 * celle-là restant la seule à ne pas suivre l'enseigne, sans que rien ne le
 * dise.
 *
 * Ce que le test tient : le lot de `null` couvre bien TOUT le registre. Une
 * clé oubliée est exactement le défaut que le bouton doit supprimer, et il le
 * reproduirait en silence.
 */
describe('rendre une charte à ce qu’il y a dessous', () => {
  // Ce que la page envoie à `modifierBrouillon` : chaque clé du registre à null.
  const lot = () => Object.fromEntries(REGISTRE.map((r) => [r.cle, null]));
  // Ce que `modifierBrouillon` en fait : null supprime, le reste écrase.
  const appliquer = (donnees, valeurs) => {
    const suite = { ...donnees };
    for (const [cle, v] of Object.entries(valeurs)) {
      if (v === null) delete suite[cle];
      else suite[cle] = v;
    }
    return suite;
  };

  it('couvre toutes les clés du registre, sans exception', () => {
    assert.equal(Object.keys(lot()).length, REGISTRE.length);
    for (const r of REGISTRE) assert.equal(lot()[r.cle], null, `${r.cle} n’est pas rendue`);
  });

  it('ne laisse aucune surcharge derrière lui', () => {
    const charge = Object.fromEntries(REGISTRE.map((r) => [r.cle, r.defaut]));
    assert.deepEqual(appliquer(charge, lot()), {});
  });

  it('rend le client à sa marque, clé par clé', () => {
    const avant = valeursResolues({ 'theme.primaire': '#111111' }, MAISON, ENSEIGNE);
    assert.equal(avant['theme.primaire'], '#111111');
    const apres = valeursResolues(appliquer({ 'theme.primaire': '#111111' }, lot()), MAISON, ENSEIGNE);
    assert.equal(apres['theme.primaire'], ENSEIGNE['theme.primaire']);
  });

  it('rend à la maison ce que l’enseigne n’a pas fixé', () => {
    const apres = valeursResolues(appliquer({ 'theme.fond_page': '#111111' }, lot()), MAISON, ENSEIGNE);
    assert.equal(apres['theme.fond_page'], MAISON['theme.fond_page']);
  });

  it('ne touche pas aux autres niveaux', () => {
    // Le geste est sur le brouillon du client : la marque et la maison
    // gardent exactement ce qu'elles portaient.
    const enseigneAvant = { ...ENSEIGNE };
    valeursResolues(appliquer({ 'theme.primaire': '#111' }, lot()), MAISON, ENSEIGNE);
    assert.deepEqual(ENSEIGNE, enseigneAvant);
  });
});
