/**
 * La vérification des jetons d'un gabarit de contrat.
 *
 * C'est la règle qui décide si un client reçoit un contrat lisible ou un
 * document qui écrit « {signatiare_nom} » en toutes lettres. Elle se trompe en
 * silence dans les deux sens, et les deux coûtent :
 *
 *   · trop laxiste, un jeton fautif part chez le client ;
 *   · trop stricte, un gabarit parfaitement valable est refusé, et personne ne
 *     comprend pourquoi puisque le texte a l'air juste.
 *
 * Les jetons ne sont jamais listés en dur ici : ils viennent de
 * `contexteContrat()`, comme dans le code. Une liste recopiée dans un test
 * passerait au vert le jour où le contexte change — c'est-à-dire exactement
 * le jour où elle devrait rougir.
 */
import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';

import { jetonsConnus, verifierGabarit } from '../src/lib/admin/gabarits.mjs';

describe('les jetons disponibles', () => {
  it('viennent du contexte réel, et non d’une liste recopiée', () => {
    const jetons = jetonsConnus();
    assert.ok(jetons.includes('client'));
    assert.ok(jetons.includes('signataire_nom'));
    assert.ok(jetons.includes('recapitulatif'));
    assert.ok(jetons.length > 10);
  });

  it('sont tous acceptés par la vérification', () => {
    // La boucle qui compte : l'écran d'aide propose ces jetons-là, et
    // l'enregistrement doit les accepter tous. Sans ce test, il suffit qu'un
    // champ change de nom pour que l'aide propose ce que le contrôle refuse.
    const corps = jetonsConnus().map((j) => `{${j}}`).join(' ');
    assert.deepEqual(verifierGabarit(corps).inconnus, []);
  });
});

describe('la vérification d’un gabarit', () => {
  it('accepte un texte qui n’emploie que des jetons connus', () => {
    const r = verifierGabarit('Entre {client}, représenté par {signataire_nom}, le {date_du_jour}.');
    assert.deepEqual(r.inconnus, []);
    assert.deepEqual(r.employes.sort(), ['client', 'date_du_jour', 'signataire_nom']);
  });

  it('refuse une faute de frappe dans un jeton', () => {
    // Le cas réel : une lettre inversée dans un contrat de six pages.
    const r = verifierGabarit('Représenté par {signatiare_nom}.');
    assert.deepEqual(r.inconnus, ['signatiare_nom']);
  });

  it('ne signale qu’une fois un jeton fautif employé dix fois', () => {
    const r = verifierGabarit('{inexistant} {inexistant} {inexistant}');
    assert.deepEqual(r.inconnus, ['inexistant']);
  });

  it('sépare les fautifs des valables dans le même texte', () => {
    const r = verifierGabarit('{client} et {nawak}');
    assert.deepEqual(r.inconnus, ['nawak']);
    assert.deepEqual(r.employes, ['client']);
  });

  it('laisse passer un texte fixe, en le signalant', () => {
    // Un avenant peut n'employer aucun jeton. Ce n'est pas une faute — mais
    // c'est assez inhabituel pour valoir un mot à l'écran.
    const r = verifierGabarit('Le présent avenant proroge le contrat de six mois.');
    assert.deepEqual(r.inconnus, []);
    assert.equal(r.sans_jeton, true);
  });

  it('ne dit pas « texte fixe » d’un gabarit dont tous les jetons sont faux', () => {
    // Sinon l'écran affiche « aucun jeton — texte fixe » à côté de l'alerte
    // qui dit l'inverse, et l'une des deux se lit comme un bug.
    const r = verifierGabarit('{nawak}');
    assert.equal(r.sans_jeton, false);
  });

  it('supporte un gabarit vide', () => {
    const r = verifierGabarit('');
    assert.deepEqual(r.inconnus, []);
    assert.equal(r.sans_jeton, true);
  });

  it('supporte l’absence de texte', () => {
    assert.deepEqual(verifierGabarit(null).inconnus, []);
    assert.deepEqual(verifierGabarit(undefined).inconnus, []);
  });

  it('ignore une accolade qui n’est pas un jeton', () => {
    // Du JSON ou du code cité dans un contrat ne doit pas se faire prendre
    // pour un jeton mal écrit. Seul `{minuscules_et_tirets_bas}` en est un.
    const r = verifierGabarit('Le format attendu est {"cle": 1} et {Client}.');
    assert.deepEqual(r.inconnus, []);
  });
});
