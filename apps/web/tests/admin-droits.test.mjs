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

import { ROLES, cheminAutorise, creerJeton, empreinteValide, hacherCode, lireJeton } from '../src/lib/admin/session.mjs';

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
      // Les commissions montrent ce que TOUS les commerciaux ont projeté.
      // Ouvrir cet écran à l'un d'eux, c'est lui montrer la rémunération de
      // ses collègues — et le taux que chacun a négocié.
      '/admin/commissions',
      // Stripe montre le mode de la clé et tout le catalogue facturé.
      '/admin/stripe',
    ]) {
      assert.equal(cheminAutorise(chemin, 'commercial'), false, chemin);
    }
  });

  it('ferme les commissions au technique aussi', () => {
    assert.equal(cheminAutorise('/admin/commissions', 'technique'), false);
    assert.equal(cheminAutorise('/admin/commissions', 'admin'), true);
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

  it('ne connaît que trois rôles', () => {
    assert.deepEqual(ROLES, ['admin', 'commercial', 'technique']);
    // Un rôle inventé retombe sur le plus étroit plutôt que d'ouvrir.
    assert.equal(lireJeton(creerJeton({ id: 7, role: 'superadmin' })).role, 'commercial');
  });
});

describe('les empreintes', () => {
  it('ne laissent pas retrouver le secret', () => {
    const empreinte = hacherCode('407392');
    assert.equal(empreinte.includes('407392'), false);
    assert.match(empreinte, /^scrypt\$[\w-]+\$[\w-]+$/);
  });

  it('diffèrent à chaque fois — le sel change', () => {
    assert.notEqual(hacherCode('407392'), hacherCode('407392'));
  });

  it('se vérifient', () => {
    const empreinte = hacherCode('407392');
    assert.equal(empreinteValide('407392', empreinte), true);
    assert.equal(empreinteValide('407393', empreinte), false);
    assert.equal(empreinteValide('', empreinte), false);
  });

  it('refusent une empreinte malformée sans lever', () => {
    for (const mauvaise of ['', 'nimporte quoi', 'scrypt$abc', 'md5$sel$empreinte', null]) {
      assert.equal(empreinteValide('407392', mauvaise), false);
    }
  });
});

describe('le profil technique', () => {
  it('ouvre l’onboarding, les connexions et les connecteurs', () => {
    // Les boutiques d'un client se règlent en `/admin/onboarding/<id>/boutiques`
    // et nulle part ailleurs. La liste blanche portait aussi un
    // `/admin/boutiques` de premier niveau, sous lequel rien n'a jamais été
    // servi : ce test l'exigeait ouvert, ce qui ne prouvait qu'une chose,
    // qu'on avait le droit d'ouvrir un 404.
    for (const chemin of ['/admin/onboarding', '/admin/onboarding/12/mapping',
      '/admin/onboarding/12/boutiques', '/admin/connexions', '/admin/connecteurs']) {
      assert.equal(cheminAutorise(chemin, 'technique'), true, chemin);
    }
  });

  it('n’ouvre rien de ce qui touche au prix', () => {
    // C'est la raison d'être du rôle : brancher une caisse sans donner accès
    // à toute la grille tarifaire et à tous les contrats.
    for (const chemin of ['/admin/tarifs', '/admin/offres', '/admin/offres/TFB-2026-0001',
      '/admin/contrats', '/admin/prestations', '/admin/leads']) {
      assert.equal(cheminAutorise(chemin, 'technique'), false, chemin);
    }
  });

  it('ouvre la fiche d’un client, parce qu’il dépanne n’importe lequel', () => {
    assert.equal(cheminAutorise('/admin/prospects/7', 'technique'), true);
  });

  it('ouvre le tableau de bord, mais pas la console entière', () => {
    assert.equal(cheminAutorise('/admin', 'technique'), true);
    assert.equal(cheminAutorise('/admin/reglages', 'technique'), false);
  });

  it('le commercial ne voit toujours pas les connexions techniques', () => {
    assert.equal(cheminAutorise('/admin/connexions', 'commercial'), false);
    assert.equal(cheminAutorise('/admin/connecteurs', 'commercial'), false);
    assert.equal(cheminAutorise('/admin/onboarding', 'commercial'), false);
  });

  it('un rôle inconnu n’ouvre rien du tout', () => {
    assert.equal(cheminAutorise('/admin', 'bricoleur'), false);
    assert.equal(cheminAutorise('/admin/tarifs', 'bricoleur'), false);
  });

  it('survit à un aller-retour par le jeton', () => {
    assert.equal(lireJeton(creerJeton({ id: 9, role: 'technique' })).role, 'technique');
  });
});
