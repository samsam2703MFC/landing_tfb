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
import { cssCharte, facesCharte, logoCharte } from '../src/lib/charte/theme.mjs';
import { arrondiNormalise, lireFeuille, tailleFeuille } from '../src/lib/charte/import.mjs';
import { familleSaine, reconnaitre } from '../src/lib/charte/polices.mjs';
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

/**
 * L'import d'une charte existante.
 *
 * Le fichier est lu, jamais servi — le CSS n'est pas inerte, et un `url()` dans
 * un sélecteur d'attribut exfiltre ce qu'un utilisateur tape. Ces tests portent
 * donc sur la seule chose qui traverse : les valeurs extraites, qui repassent
 * par le contrôle du registre comme si elles avaient été saisies à la main.
 */
describe('import d’une feuille', () => {
  const FEUILLE = `
    /* --brand: #000000; commenté, donc ignoré */
    :root {
      --brand: #0F766E;
      --accent: rgb(240, 145, 42);
      --body-bg: #fff;
      --text: #123;
      --radius-card: 0.875rem;
      --shadow-lg: 0 2px 4px rgba(0,0,0,.2);
      --font-family-base: Comic Sans;
    }
  `;

  it('reprend les couleurs quelle qu’en soit l’écriture', () => {
    const { valeurs } = lireFeuille(FEUILLE);
    assert.equal(valeurs['theme.primaire'], '#0f766e');
    assert.equal(valeurs['theme.accent'], '#f0912a', 'rgb() converti');
    assert.equal(valeurs['theme.fond_page'], '#ffffff', 'hexa court étendu');
    assert.equal(valeurs['theme.texte'], '#112233');
  });

  it('ramène un arrondi à une valeur que le registre déclare', () => {
    assert.equal(lireFeuille(FEUILLE).valeurs['theme.arrondi'], '12', '0,875 rem = 14 px, à égalité on descend');
    assert.equal(arrondiNormalise('5px'), '4');
    assert.equal(arrondiNormalise('énorme'), null);
  });

  // Une variable commentée n'est pas une variable : la reprendre ferait livrer
  // au client une couleur que son auteur avait justement retirée.
  it('ignore ce qui est en commentaire', () => {
    assert.notEqual(lireFeuille(FEUILLE).valeurs['theme.primaire'], '#000000');
  });

  // Ce qui n'est pas repris doit se voir. Sans cela on croirait la charte
  // complète alors qu'il en manque la moitié.
  it('dit ce qu’il a vu et laissé', () => {
    const { ignores } = lireFeuille(FEUILLE);
    assert.ok(ignores.some((v) => v.nom === '--shadow-lg'));
    assert.ok(ignores.some((v) => v.nom === '--font-family-base'));
  });

  it('ne laisse pas passer une valeur que le registre refuserait', () => {
    const { valeurs } = lireFeuille(':root { --brand: linear-gradient(red, blue); }');
    assert.equal(valeurs['theme.primaire'], undefined);
  });

  it('compte les règles qu’il n’a pas lues', () => {
    const t = tailleFeuille('@import url(x); @font-face { font-family: A; } a { color: red }');
    assert.equal(t.imports, 1);
    assert.equal(t.fontFaces, 1);
    assert.equal(t.blocs, 2);
  });

  it('ne rapporte rien d’une feuille sans variable', () => {
    const { valeurs, repris } = lireFeuille('body { color: #0f766e }');
    assert.deepEqual(valeurs, {});
    assert.equal(repris.length, 0);
  });
});

describe('polices importées', () => {
  const POLICE = { id: 7, famille: 'Belleville Sans', role: 'les_deux', graisse: '600',
                   style: 'normal', format: 'woff2' };

  it('reconnaît un format aux premiers octets, pas à l’extension', () => {
    assert.equal(reconnaitre(Buffer.from([0x77, 0x4f, 0x46, 0x32]))?.format, 'woff2');
    assert.equal(reconnaitre(Buffer.from([0x4f, 0x54, 0x54, 0x4f]))?.format, 'opentype');
    assert.equal(reconnaitre(Buffer.from('<?php echo 1;')), null);
  });

  // Le nom finit entre guillemets dans `font-family` : une apostrophe y
  // refermerait la déclaration et ouvrirait la suivante.
  it('restreint le nom de famille au lieu de l’échapper', () => {
    assert.equal(familleSaine('Belleville Sans'), 'Belleville Sans');
    const propre = familleSaine('a"; } body { display:none } .x {');
    // Ce qui compte n'est pas la chaîne exacte mais ce qui n'y est plus : rien
    // qui puisse refermer la déclaration `font-family: "…"`.
    assert.ok(!/["'{};:]/.test(propre), propre);
    assert.equal(propre, 'a body display none x');
    assert.equal(familleSaine('   '), null);
  });

  it('fabrique le @font-face depuis la déclaration, pas depuis le fichier', () => {
    const face = facesCharte([POLICE], '/landing_tfb');
    assert.match(face, /font-family: "Belleville Sans";/);
    assert.match(face, /url\("\/landing_tfb\/polices\/7"\) format\("woff2"\)/);
    assert.match(face, /font-weight: 600;/);
    assert.match(face, /font-display: swap;/);
  });

  it('écarte une famille qui aurait échappé au contrôle en amont', () => {
    assert.equal(facesCharte([{ ...POLICE, famille: 'a"; }' }]), '');
  });

  it('sert la police du client quand elle est choisie', () => {
    const css = cssCharte({ 'theme.police_titres': 'client' }, [POLICE]);
    assert.match(css, /--font-display: "Belleville Sans", "Manrope"/);
  });

  // Une police manquante — réseau coupé, format refusé — ne doit pas laisser
  // une caisse sans texte.
  it('retombe sur la pile par défaut quand rien n’a été importé', () => {
    const css = cssCharte({ 'theme.police_titres': 'client' }, []);
    assert.match(css, /--font-display: "Manrope"/);
    assert.ok(!css.includes('undefined'));
  });
});
