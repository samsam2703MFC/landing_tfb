/**
 * Les tests des droits d'accès à la console.
 *
 * Ce fichier existe à cause d'une vraie faute : `/admin` figurait dans la
 * liste des chemins ouverts au commercial, et comme la comparaison se faisait
 * par préfixe, `/admin/tarifs` commençait par `/admin/` — donc toute la
 * console était ouverte, grille tarifaire comprise. Rien ne le signalait :
 * l'écran s'affichait normalement.
 *
 * D'où la règle vérifiée ici : le tableau de bord est un chemin **exact**, et
 * un écran inconnu est fermé par défaut.
 */
import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';

import { ROLES, cheminAutorise, creerJeton, empreinteValide, hacher, lireJeton } from '../src/lib/admin/session.mjs';

// `consoleActive()` exige un mot de passe d'au moins dix caractères : sans lui,
// les jetons sont refusés d'office et les tests ne prouveraient rien.
process.env.ADMIN_PASSWORD = 'mot-de-passe-de-test-suffisamment-long';

describe('le pipeline reste un réglage', () => {
  it("n'ouvre pas les étapes au commercial", () => {
    // Un commercial travaille dans le pipeline ; il ne le redéfinit pas, pas
    // plus qu'il ne fixe les tarifs.
    assert.equal(cheminAutorise('/admin/etapes', 'commercial'), false);
    assert.equal(cheminAutorise('/admin/etapes', 'admin'), true);
  });
});

describe("les droits de l'administrateur", () => {
  it('ouvrent tout, y compris ce qui n’existe pas encore', () => {
    for (const chemin of ['/admin', '/admin/tarifs', '/admin/utilisateurs', '/admin/ecran-de-demain']) {
      assert.equal(cheminAutorise(chemin, 'admin'), true, chemin);
    }
  });
});

describe('les droits du commercial', () => {
  it('ouvrent son travail : tableau de bord, prospects, offres, demandes', () => {
    for (const chemin of [
      '/admin',
      '/admin/',
      '/admin/offres',
      '/admin/offres/nouvelle',
      '/admin/offres/TFB-2026-0001',
      '/admin/prospects',
      '/admin/prospects/12',
      '/admin/leads',
      '/admin/deconnexion',
      '/admin/motdepasse',
    ]) {
      assert.equal(cheminAutorise(chemin, 'commercial'), true, chemin);
    }
  });

  it('ferment la grille tarifaire et le contenu de la landing', () => {
    for (const chemin of [
      '/admin/tarifs',
      '/admin/prestations',
      '/admin/utilisateurs',
      '/admin/modules',
      '/admin/composants',
      '/admin/textes',
      '/admin/traductions',
      '/admin/langues',
      '/admin/site',
      '/admin/captures',
      '/admin/questions',
      '/admin/leviers',
      '/admin/clients',
      '/admin/sync',
      '/admin/reglages',
    ]) {
      assert.equal(cheminAutorise(chemin, 'commercial'), false, chemin);
    }
  });

  it('ferment un écran ajouté demain — la liste dit le permis, pas l’interdit', () => {
    assert.equal(cheminAutorise('/admin/ecran-de-demain', 'commercial'), false);
    assert.equal(cheminAutorise('/admin/facturation/export', 'commercial'), false);
  });

  it('ne se laissent pas ouvrir par un chemin qui ressemble', () => {
    // « /admin/offresXYZ » n'est pas sous « /admin/offres ».
    assert.equal(cheminAutorise('/admin/offresecretes', 'commercial'), false);
    assert.equal(cheminAutorise('/admin/tarifs?retour=/admin/offres', 'commercial'), false);
  });
});

describe('le jeton de session', () => {
  it('transporte le compte et le rôle, signés', () => {
    const session = lireJeton(creerJeton({ id: 7, role: 'commercial' }));
    assert.deepEqual(session, { id: 7, role: 'commercial', secours: false });
  });

  it('marque la clé de secours, qui n’a pas de compte derrière', () => {
    const session = lireJeton(creerJeton({ id: 0, role: 'admin' }));
    assert.equal(session.secours, true);
    assert.equal(session.role, 'admin');
  });

  it('refuse un rôle réécrit à la main', () => {
    const jeton = creerJeton({ id: 7, role: 'commercial' });
    const truque = jeton.replace('.commercial.', '.admin.');
    assert.notEqual(truque, jeton);
    assert.equal(lireJeton(truque), null);
  });

  it('refuse une expiration repoussée à la main', () => {
    const jeton = creerJeton({ id: 7, role: 'commercial' });
    const [expiration, ...reste] = jeton.split('.');
    assert.equal(lireJeton([Number(expiration) + 86_400_000, ...reste].join('.')), null);
  });

  it('refuse un jeton expiré, un jeton vide et une forme inconnue', () => {
    assert.equal(lireJeton(''), null);
    assert.equal(lireJeton('nimporte.quoi'), null);
    // L'ancienne forme à trois morceaux, d'avant les comptes.
    assert.equal(lireJeton('9999999999999.abc.signature'), null);
  });

  it('ne connaît que deux rôles', () => {
    assert.deepEqual(ROLES, ['admin', 'commercial']);
    // Un rôle inventé retombe sur le plus étroit plutôt que d'ouvrir.
    assert.equal(lireJeton(creerJeton({ id: 7, role: 'superadmin' })).role, 'commercial');
  });
});

describe('les mots de passe', () => {
  it('ne se retrouvent pas dans leur empreinte', () => {
    const empreinte = hacher('un-mot-de-passe-long');
    assert.equal(empreinte.includes('un-mot-de-passe-long'), false);
    assert.match(empreinte, /^scrypt\$[\w-]+\$[\w-]+$/);
  });

  it('donnent une empreinte différente à chaque fois — le sel change', () => {
    assert.notEqual(hacher('un-mot-de-passe-long'), hacher('un-mot-de-passe-long'));
  });

  it('se vérifient', () => {
    const empreinte = hacher('un-mot-de-passe-long');
    assert.equal(empreinteValide('un-mot-de-passe-long', empreinte), true);
    assert.equal(empreinteValide('un-mot-de-passe-lonG', empreinte), false);
    assert.equal(empreinteValide('', empreinte), false);
  });

  it('refusent un mot de passe trop court plutôt que de le hacher', () => {
    assert.throws(() => hacher('court'), /au moins 10 caractères/);
  });

  it('refusent une empreinte malformée sans lever', () => {
    for (const mauvaise of ['', 'nimporte quoi', 'scrypt$abc', 'md5$sel$empreinte', null]) {
      assert.equal(empreinteValide('un-mot-de-passe-long', mauvaise), false);
    }
  });
});
