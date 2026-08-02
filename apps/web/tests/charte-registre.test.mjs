/**
 * Les tests de la charte par client — `node --test`, aucune dépendance.
 *
 * Deux choses s'y jouent. La résolution, parce qu'une variable héritée qu'on
 * croit surchargée fait livrer au client une charte qui n'est pas la sienne. Et
 * le contraste, parce que c'est le seul contrôle qui empêche de publier un écran
 * illisible chez quelqu'un qui paie.
 */
import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';

import {
  REGISTRE,
  contraste,
  controler,
  controlerCharte,
  defauts,
  groupes,
  resoudre,
  valeursResolues,
  variable,
} from '../src/lib/charte/registre.mjs';
import { cssCharte, logoCharte } from '../src/lib/charte/theme.mjs';
import { clesModifiees } from '../src/lib/admin/charte.mjs';
import { cleCharte, cleCharteValide } from '../src/lib/admin/session.mjs';

// Les clés de partage sont signées avec le secret de la console : sans mot de
// passe configuré, elles ne prouveraient rien.
process.env.ADMIN_PASSWORD = 'mot-de-passe-de-test-suffisamment-long';

describe('registre', () => {
  it('déclare des clés uniques et groupées', () => {
    const cles = REGISTRE.map((v) => v.cle);
    assert.equal(new Set(cles).size, cles.length);
    assert.ok(groupes().length >= 3);
  });

  it('chaque défaut passe son propre contrôle', () => {
    for (const v of REGISTRE) {
      assert.equal(controler(v.cle, v.defaut), null, `défaut refusé pour ${v.cle}`);
    }
  });

  it('la charte par défaut ne se contredit pas', () => {
    assert.deepEqual(controlerCharte({}), {});
  });

  it('retrouve une variable et ignore l’inconnue', () => {
    assert.equal(variable('theme.primaire').type, 'couleur');
    assert.equal(variable('rien.du.tout'), null);
  });
});

describe('contrôle d’une valeur', () => {
  it('accepte une couleur bien formée', () => {
    assert.equal(controler('theme.primaire', '#0f766e'), null);
  });

  it('refuse ce qui n’est pas #RRGGBB', () => {
    assert.equal(typeof controler('theme.primaire', 'teal'), 'string');
    assert.equal(typeof controler('theme.primaire', '#fff'), 'string');
  });

  it('refuse une valeur hors de la liste déclarée', () => {
    assert.equal(typeof controler('theme.densite', 'énorme'), 'string');
    assert.equal(controler('theme.densite', 'compacte'), null);
  });

  it('refuse un texte trop long', () => {
    assert.equal(typeof controler('app.nom', 'x'.repeat(61)), 'string');
    assert.equal(controler('app.nom', 'Belleville'), null);
  });

  it('refuse un logo hors du site, accepte un chemin servi', () => {
    assert.equal(typeof controler('theme.logo', 'https://ailleurs.example/l.svg'), 'string');
    assert.equal(typeof controler('theme.logo', '/media/../../etc/passwd'), 'string');
    assert.equal(controler('theme.logo', '/media/logos/belleville.svg'), null);
  });

  it('refuse une variable absente du registre', () => {
    assert.equal(typeof controler('nawak', 1), 'string');
  });
});

describe('contraste', () => {
  it('mesure les extrêmes connus', () => {
    assert.equal(Math.round(contraste('#ffffff', '#000000')), 21);
    assert.equal(contraste('#123456', '#123456'), 1);
  });

  it('refuse une primaire claire sous encre blanche', () => {
    const erreurs = controlerCharte({ 'theme.primaire': '#ffe9b0', 'theme.encre_primaire': 'blanc' });
    assert.ok(erreurs['theme.primaire']);
  });

  it('accepte la même primaire une fois l’encre foncée choisie', () => {
    const erreurs = controlerCharte({ 'theme.primaire': '#ffe9b0', 'theme.encre_primaire': 'fonce' });
    assert.equal(erreurs['theme.primaire'], undefined);
  });

  it('voit un texte illisible sur son fond de carte', () => {
    const erreurs = controlerCharte({ 'theme.texte': '#eeeeee', 'theme.fond_carte': '#ffffff' });
    assert.ok(erreurs['theme.texte']);
  });
});

describe('résolution', () => {
  const client = { 'theme.primaire': '#0f766e' };
  const maison = { 'theme.primaire': '#334155', 'app.support': 'aide@tfb.eu' };

  it('le client l’emporte', () => {
    const r = resoudre('theme.primaire', client, maison);
    assert.equal(r.depuis, 'client');
    assert.equal(r.valeur, '#0f766e');
  });

  it('la maison prend le relais', () => {
    assert.equal(resoudre('app.support', client, maison).depuis, 'maison');
  });

  it('le registre ferme la marche', () => {
    assert.equal(resoudre('app.nom', client, maison).depuis, 'registre');
    assert.equal(resoudre('app.nom', {}, {}).valeur, defauts()['app.nom']);
  });

  it('la chaîne compte toujours trois maillons', () => {
    assert.equal(resoudre('theme.primaire', client, maison).chaine.length, 3);
  });

  it('une clé retirée retombe sur la couche du dessous', () => {
    assert.equal(valeursResolues({}, maison)['theme.primaire'], '#334155');
  });
});

describe('feuille de style', () => {
  const css = cssCharte({ 'theme.primaire': '#0f766e', 'theme.arrondi': '16', 'theme.densite': 'confortable' });

  it('reprend les valeurs du client', () => {
    assert.ok(css.includes('--brand: #0f766e;'));
    assert.ok(css.includes('--radius-card: 16px;'));
    assert.ok(css.includes('--space-4: 20px;'), 'densité confortable : 16 × 1,25');
  });

  it('dérive les états sans les demander', () => {
    assert.ok(/--brand-hover: #[0-9a-f]{6};/.test(css));
    assert.ok(/--surface-brand-subtle: rgba\(/.test(css));
  });

  // Le point qui compte : rien d'autre que des valeurs contrôlées n'entre dans
  // une balise <style>. Une accolade ou un point-virgule injecté permettrait de
  // fermer la règle et d'en écrire une autre.
  it('neutralise une valeur hostile plutôt que de l’écrire', () => {
    const sale = cssCharte({ 'theme.primaire': '#000; } body { display:none } .x {' });
    assert.ok(!sale.includes('display:none'));
    assert.ok(sale.includes('--brand: #7b4488;'), 'retombe sur le défaut du registre');
  });

  it('ignore une densité inventée', () => {
    assert.ok(cssCharte({ 'theme.densite': 'gigantesque' }).includes('--space-4: 16px;'));
  });
});

describe('journal de publication', () => {
  it('ne retient que ce qui a bougé', () => {
    const avant = { 'theme.primaire': '#111111', 'app.nom': 'Avant' };
    const apres = { 'theme.primaire': '#111111', 'app.nom': 'Après' };
    assert.deepEqual(clesModifiees(avant, apres), ['app.nom']);
  });

  it('compte une surcharge retirée comme une modification', () => {
    // Sans ça, « Réinitialiser » puis publier laisserait un journal vide alors
    // que l'écran du client change.
    assert.deepEqual(clesModifiees({ 'theme.accent': '#f0912a' }, {}), ['theme.accent']);
  });

  it('ne se plaint pas d’une première publication', () => {
    assert.deepEqual(clesModifiees({}, {}), []);
  });
});

describe('lien remis au client', () => {
  it('n’ouvre que la charte qu’il désigne', () => {
    assert.equal(cleCharteValide(12, cleCharte(12)), true);
    assert.equal(cleCharteValide(13, cleCharte(12)), false);
  });

  it('refuse une clé absente ou vide', () => {
    assert.equal(cleCharteValide(12, null), false);
    assert.equal(cleCharteValide(12, ''), false);
  });

  // Le lien est remis une fois : le lier à la version obligerait à le renvoyer
  // à chaque changement de couleur, et personne ne le ferait.
  it('survit aux publications', () => {
    assert.equal(cleCharte(12), cleCharte(12));
  });
});

describe('logo', () => {
  it('accepte un chemin du site, refuse le reste', () => {
    assert.equal(logoCharte({ 'theme.logo': '/media/logos/a.svg' }), '/media/logos/a.svg');
    assert.equal(logoCharte({ 'theme.logo': 'https://ailleurs.example/a.svg' }), null);
    assert.equal(logoCharte({ 'theme.logo': '/media/../secret' }), null);
    assert.equal(logoCharte({}), null);
  });
});
