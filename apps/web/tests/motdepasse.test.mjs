/**
 * Le changement de son propre code.
 *
 * L'écran manquait entièrement : `/admin/motdepasse` figurait dans la liste
 * blanche de `session.mjs`, ouvert à tous les rôles, sans page derrière. Ces
 * tests tiennent les deux bouts — que l'écran existe et soit atteignable, et
 * que l'ordre de ses contrôles reste celui qu'on a voulu.
 *
 * L'ORDRE EST LE SUJET. Vérifier le code actuel coûte un essai au verrou ;
 * constater que les deux nouveaux codes diffèrent n'en coûte aucun. Inverser
 * les deux ferait de trois fautes de frappe un blocage d'une demi-heure, et le
 * blocage tomberait sur la seule personne qui n'a rien fait de mal.
 */
import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

process.env.ADMIN_PASSWORD = 'mot-de-passe-de-secours-long';

import { soucisDeForme } from '../src/lib/admin/motdepasse.mjs';
import { CHEMINS_PERMIS, ROLES, cheminAutorise } from '../src/lib/admin/session.mjs';

const ICI = dirname(fileURLToPath(import.meta.url));
const ECRAN = join(ICI, '..', 'src', 'pages', 'admin', 'motdepasse.astro');
const source = readFileSync(ECRAN, 'utf8');

describe('l’écran existe et s’atteint', () => {
  it('répond au chemin que les droits ouvrent', () => {
    // C'est exactement ce qui manquait : le droit sans la page.
    assert.ok(source.length > 0);
    for (const role of ROLES) {
      assert.equal(cheminAutorise('/admin/motdepasse', role), true, role);
    }
  });

  it('est ouvert à tous les rôles, et pas seulement à l’administrateur', () => {
    // `cheminAutorise` dit « oui » à tout pour un admin : ça ne prouverait
    // rien. On lit donc la liste blanche elle-même.
    for (const [role, chemins] of Object.entries(CHEMINS_PERMIS)) {
      assert.ok(
        chemins.some((c) => c.chemin === '/admin/motdepasse'),
        `${role} n’a pas de quoi changer son code`,
      );
    }
  });

  it('a son entrée dans le bas du rail', () => {
    const console = readFileSync(join(ICI, '..', 'src', 'components', 'Console.astro'), 'utf8');
    const bas = console.slice(console.indexOf('rail__bas'));
    assert.match(bas, /\/admin\/motdepasse/);
    // Et pas pour la clé de secours, qui n'a pas de compte derrière.
    assert.match(bas, /!session\.secours/);
  });
});

describe('l’ordre des refus', () => {
  it('laisse passer un changement propre', () => {
    assert.equal(soucisDeForme({ actuel: '407392', nouveau: '583014', encore: '583014' }), null);
  });

  it('voit d’abord la confirmation qui diffère — c’est le refus gratuit', () => {
    const dit = soucisDeForme({ actuel: '407392', nouveau: '583014', encore: '583015' });
    assert.match(dit, /diffèrent/);
  });

  it('préfère « ils diffèrent » à « il est trop simple » quand les deux sont vrais', () => {
    // Sinon on refuse un code faible que la personne n'a peut-être jamais
    // voulu : c'est le second champ qui portait la faute de frappe.
    const dit = soucisDeForme({ actuel: '407392', nouveau: '111111', encore: '111112' });
    assert.match(dit, /diffèrent/);
  });

  it('refuse un code trop simple, avec la raison de `codeTropSimple`', () => {
    const dit = soucisDeForme({ actuel: '407392', nouveau: '123456', encore: '123456' });
    assert.equal(typeof dit, 'string');
    assert.doesNotMatch(dit, /diffèrent/);
  });

  it('refuse de « changer » pour le même code', () => {
    const dit = soucisDeForme({ actuel: '407392', nouveau: '407392', encore: '407392' });
    assert.match(dit, /l’ancien/);
  });

  it('ne dit pas « c’est l’ancien » sur un formulaire vide', () => {
    // Deux champs vides sont égaux : sans l'ordre voulu, le message serait
    // « le nouveau code est l'ancien », ce qui n'aide personne.
    const dit = soucisDeForme({ actuel: '', nouveau: '', encore: '' });
    assert.doesNotMatch(dit, /l’ancien/);
  });

  it('tient sans argument plutôt que d’exploser', () => {
    assert.equal(typeof soucisDeForme(), 'string');
  });
});

describe('ce que l’écran ne fait jamais', () => {
  // Les `import` du haut citent les mêmes noms dans l'ordre des fichiers :
  // c'est le corps du POST qu'on lit, pas la page entière.
  const traitement = source.slice(source.indexOf("Astro.request.method === 'POST'"));

  it('ne consomme un essai qu’après les refus gratuits', () => {
    const forme = traitement.indexOf('soucisDeForme');
    const echec = traitement.indexOf('noterEchec');
    assert.ok(forme > 0, 'le contrôle de forme n’est pas dans le traitement');
    assert.ok(echec > forme, 'un essai se consomme avant le contrôle de forme');
  });

  it('vérifie le verrou avant tout le reste', () => {
    const verrou = traitement.indexOf('peutEssayer');
    assert.ok(verrou > 0 && verrou < traitement.indexOf('soucisDeForme'));
  });

  it('confirme le code actuel contre le compte de la session, jamais un id du formulaire', () => {
    // Un identifiant lu dans le formulaire laisserait changer le code d'autrui.
    assert.match(source, /codeConfirme\(session\.id, actuel\)/);
    assert.match(source, /changerCode\(session\.id, nouveau\)/);
  });

  it('ne remet jamais un code dans l’URL ni dans un message', () => {
    const redirection = source.slice(source.indexOf('Astro.redirect'), source.indexOf('Astro.redirect') + 400);
    assert.ok(redirection.includes('ok='), 'la redirection de succès n’a pas été trouvée');
    assert.doesNotMatch(redirection, /\bnouveau\b/);
    assert.doesNotMatch(redirection, /\bactuel\b/);
  });

  it('propose à la clé de secours de la changer sur le serveur, et pas ici', () => {
    assert.match(source, /session\.secours/);
    assert.match(source, /ADMIN_PASSWORD/);
    assert.match(source, /infra\/\.env/);
  });
});

describe('la porte d’entrée', () => {
  const connexion = readFileSync(join(ICI, '..', 'src', 'pages', 'admin', 'connexion.astro'), 'utf8');

  it('laisse le trousseau enregistrer le code', () => {
    // `one-time-code` dit au navigateur de chercher un SMS et de ne rien
    // retenir. Le code de la console n'est pas jetable : il vit jusqu'à ce
    // qu'on le change, sur l'écran d'à côté.
    assert.doesNotMatch(connexion, /autocomplete="one-time-code"/);
    assert.match(connexion, /autocomplete="current-password"/);
  });
});
