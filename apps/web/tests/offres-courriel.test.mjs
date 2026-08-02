/**
 * Les tests de la construction du courriel.
 *
 * Ce qui compte ici n'est pas la mise en forme mais le fait qu'aucun montant
 * ne se perde en route : le récapitulatif du courriel doit dire exactement ce
 * que l'écran affiche, sinon le client et le commercial lisent deux offres
 * différentes.
 */
import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';

import { calculerOffre, formater } from '../src/lib/offres/calcul.mjs';
import {
  CSS_COURRIEL,
  SERVICE_JOURNAL,
  construireCourriel,
  corpsHtml,
  recapHtml,
  recapTexte,
  remplacer,
  serviceCourriel,
} from '../src/lib/offres/courriel.mjs';

const TARIFS = {
  prix_par_vue_cents: 100_000,
  multiplicateur_achat: 24,
  taux_annuel: 500,
  prix_jour_formation_cents: 50_000,
};

/** Une offre complète, comme `chargerOffre` la rend. */
function offreExemple(surcharges = {}) {
  return {
    reference: 'TFB-2026-0001',
    version: 1,
    langue: 'fr',
    devise: 'EUR',
    valide_jusqu_au: '2026-08-31T00:00:00Z',
    tva_mention: null,
    prospect: {
      raison_sociale: 'Boulangerie du Coin SRL',
      contact_nom: 'Marie Delcourt',
      contact_email: 'marie@boulangerieducoin.be',
    },
    auteur: { nom: 'Léa Dubois' },
    ...surcharges,
  };
}

function chiffrage(config = {}) {
  return calculerOffre({
    prestations: [{ nom: 'Design', prix_cents: 50_000 }],
    jours_formation: 4,
    option_app: 'par_vue',
    vues: [{ nombre: 5, note: 'Tableau de bord' }],
    tarifs: TARIFS,
    remise: { type: 'pourcent', valeur: 0 },
    tva: { taux: 2100, exoneree: false },
    ...config,
  });
}

describe('le remplacement des jetons', () => {
  it('remplace ce qu’il connaît', () => {
    assert.equal(remplacer('Bonjour {contact},', { contact: 'Marie' }), 'Bonjour Marie,');
  });

  it('laisse un jeton inconnu tel quel plutôt que de le vider', () => {
    // Un « {clietn} » mal orthographié doit se voir dans l'aperçu, pas
    // disparaître en silence pour réapparaître comme un trou chez le client.
    assert.equal(remplacer('Bonjour {clietn},', { contact: 'Marie' }), 'Bonjour {clietn},');
  });

  it('remplace un jeton présent mais vide', () => {
    assert.equal(remplacer('Par {commercial}.', { commercial: '' }), 'Par .');
  });

  it('supporte un gabarit vide', () => {
    assert.equal(remplacer(null, {}), '');
  });
});

describe('le récapitulatif en texte', () => {
  it('reprend les mêmes montants que l’écran', () => {
    const resultat = chiffrage();
    const texte = recapTexte(offreExemple(), resultat, (c) => formater(c, 'fr'));
    // 500 € + 4 × 500 € = 2 500 € HT, 3 025 € TTC.
    assert.match(texte.replace(/\s/g, ' '), /3 025,00/);
    // 5 vues × 1 000 € = 5 000 € HT, 6 050 € TTC par mois.
    assert.match(texte.replace(/\s/g, ' '), /6 050,00/);
  });

  it('sépare les rythmes et tait ceux qui n’ont rien', () => {
    const texte = recapTexte(offreExemple(), chiffrage(), (c) => formater(c, 'fr'));
    assert.match(texte, /À LA SIGNATURE/);
    assert.match(texte, /PAR MOIS/);
    // Rien d'annuel en location : la section n'apparaît pas dans une lettre.
    assert.equal(/PAR AN/.test(texte), false);
  });

  it('fait apparaître la maintenance quand l’application est achetée', () => {
    const texte = recapTexte(
      offreExemple(),
      chiffrage({ option_app: 'achat' }),
      (c) => formater(c, 'fr'),
    );
    assert.match(texte, /PAR AN/);
    assert.equal(/PAR MOIS/.test(texte), false);
  });

  it('montre la remise quand il y en a une', () => {
    const texte = recapTexte(
      offreExemple(),
      chiffrage({ remise: { type: 'pourcent', valeur: 1000 } }),
      (c) => formater(c, 'fr'),
    );
    assert.match(texte, /Remise/);
  });

  it('tait la ligne de TVA en exonération, et porte la mention', () => {
    const offre = offreExemple({ tva_mention: 'Autoliquidation — TVA due par le preneur.' });
    const texte = recapTexte(
      offre,
      chiffrage({ tva: { taux: 2100, exoneree: true } }),
      (c) => formater(c, 'fr'),
    );
    assert.equal(/TVA {3}/.test(texte), false);
    assert.match(texte, /Autoliquidation/);
  });

  it('parle la langue de l’offre', () => {
    const texte = recapTexte(offreExemple({ langue: 'en' }), chiffrage(), (c) => formater(c, 'en'));
    assert.match(texte, /ON SIGNATURE/);
    assert.match(texte, /PER MONTH/);
  });
});

describe('le message complet', () => {
  const gabarits = {
    sujet: 'Votre offre {reference} — The Franchise Buddy',
    corps: 'Bonjour {contact},\n\nPour {client}, valable jusqu’au {valide_jusqu_au}.\n\n{recapitulatif}\n\n{commercial}',
  };

  it('s’adresse au contact du client', () => {
    const m = construireCourriel({
      offre: offreExemple(), resultat: chiffrage(), gabarits, formater: (c) => formater(c, 'fr'),
    });
    assert.equal(m.destinataire, 'marie@boulangerieducoin.be');
    assert.equal(m.sujet, 'Votre offre TFB-2026-0001 — The Franchise Buddy');
    assert.match(m.corps, /Bonjour Marie Delcourt,/);
    assert.match(m.corps, /Boulangerie du Coin SRL/);
    assert.match(m.corps, /Léa Dubois/);
  });

  it('écrit la date de validité en toutes lettres', () => {
    const m = construireCourriel({
      offre: offreExemple(), resultat: chiffrage(), gabarits, formater: (c) => formater(c, 'fr'),
    });
    assert.match(m.corps, /31 août 2026/);
  });

  it('rend les jetons, pour que l’aperçu puisse les lister', () => {
    const m = construireCourriel({
      offre: offreExemple(), resultat: chiffrage(), gabarits, formater: (c) => formater(c, 'fr'),
    });
    assert.equal(m.jetons.reference, 'TFB-2026-0001');
    assert.equal(m.jetons.client, 'Boulangerie du Coin SRL');
    assert.match(m.jetons.recapitulatif, /À LA SIGNATURE/);
  });

  it('ne casse pas sur une offre sans client ni auteur', () => {
    const m = construireCourriel({
      offre: offreExemple({ prospect: null, auteur: null }),
      resultat: chiffrage(), gabarits, formater: (c) => formater(c, 'fr'),
    });
    assert.equal(m.destinataire, '');
    assert.match(m.corps, /Bonjour ,/);
  });
});

describe("le service d'envoi", () => {
  it('annonce franchement qu’il n’expédie rien', () => {
    const service = serviceCourriel();
    assert.equal(service.expedie, false);
    assert.equal(service, SERVICE_JOURNAL);
  });

  it('rend une trace qui contient le message entier', async () => {
    const { trace } = await SERVICE_JOURNAL.envoyer({
      destinataire: 'marie@exemple.be', sujet: 'Sujet', corps: 'Le corps du message.',
    });
    assert.match(trace, /NON EXPÉDIÉ/);
    assert.match(trace, /marie@exemple\.be/);
    assert.match(trace, /Le corps du message\./);
  });
});

describe('la lettre mise en page', () => {
  const offre = offreExemple({
    prestations: [{ nom: 'Design', prix_cents: 50_000 }],
    packs: [{ cle: 'franchise', nom: 'Pack franchisé', prix_cents: 9_900, unite: 'poste_mois', avec_caisse: true }],
    nombre_postes: 3,
    socle_pos: 'api',
  });
  const resultat = calculerOffre({ ...offre, tarifs: TARIFS });
  const sou = (c) => formater(c, 'fr');

  const message = () => construireCourriel({
    offre,
    resultat,
    gabarits: {
      sujet: 'Votre offre {reference}',
      corps: 'Bonjour {contact},\n\n{recapitulatif}\n\nÀ bientôt.',
      css: CSS_COURRIEL,
    },
    formater: sou,
  });

  it('dit les mêmes montants que la version texte', () => {
    const m = message();
    // Le total TTC doit figurer dans les deux, au centime près : le client
    // lit l'un, le commercial relit l'autre.
    const total = sou(resultat.seaux.mensuel.ttc);
    assert.ok(m.corps.includes(total), 'absent de la version texte');
    assert.ok(m.corps_html.includes(total), 'absent de la version HTML');
  });

  it('ne laisse aucun repère de gabarit dans la lettre', () => {
    const m = message();
    assert.ok(!m.corps_html.includes('{{RECAP}}'));
    assert.ok(!m.corps_html.includes('{recapitulatif}'));
  });

  it('place le récapitulatif même au milieu d’une phrase', () => {
    // Rien n'oblige le gabarit à réserver un paragraphe au tableau.
    const m = construireCourriel({
      offre,
      resultat,
      gabarits: { sujet: 'x', corps: 'Voici : {recapitulatif} — voilà.', css: '' },
      formater: sou,
    });
    assert.ok(!m.corps_html.includes('{{RECAP}}'));
    assert.ok(m.corps_html.includes('tfb-seau'));
  });

  it('échappe ce qui vient de la console', () => {
    // « Dupont & Fils » ou un chevron dans une ligne libre casseraient le
    // document s'ils partaient tels quels.
    const html = recapHtml(
      { langue: 'fr', tva_mention: null },
      calculerOffre({
        ...offre,
        prestations: [{ nom: 'Reprise <b>& audit</b>', prix_cents: 10_000 }],
        packs: [],
        tarifs: TARIFS,
      }),
      sou,
    );
    assert.ok(html.includes('Reprise &lt;b&gt;&amp; audit&lt;/b&gt;'));
    assert.ok(!html.includes('<b>& audit'));
  });

  it('embarque la feuille de style qu’on lui donne', () => {
    const m = message();
    assert.ok(m.corps_html.includes('.tfb-entete'));
    // …et se passe d'elle sans casser : la mise en page tient en ligne.
    const nu = corpsHtml({ texte: 'Bonjour.', recap: '', css: '', titre: 'x' });
    assert.ok(nu.includes('<style>'));
    assert.ok(nu.includes('The Franchise Buddy'));
  });

  it('dit la caisse retenue sur la ligne du pack', () => {
    assert.ok(message().corps_html.includes('Intégration API'));
  });
});
