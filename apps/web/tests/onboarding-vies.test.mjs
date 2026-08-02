/**
 * Les tests de la vérification TVA.
 *
 * VIES est injoignable depuis l'atelier — le pare-feu sortant ne laisse pas
 * passer `ec.europa.eu`. Ce n'est pas grave : ce qui casse dans ce module,
 * ce n'est pas l'appel, c'est **l'interprétation**. Un registre répond en
 * capitales, un autre sur une seule ligne, un troisième dit « je ne sais
 * pas » d'une façon qu'on prendrait pour un « non ».
 *
 * Les cas viennent de vraies réponses, dont celle de la société qui facture.
 */
import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';

import {
  decouperTva,
  lireReponse,
  nomLisible,
  rangerAdresse,
  serviceVies,
} from '../src/lib/onboarding/vies.mjs';

describe('découper un numéro de TVA', () => {
  it('accepte ce qu’un humain tape', () => {
    for (const saisie of ['PL8971903536', 'pl 897 190 35 36', 'PL-8971903536', ' PL8971903536 ']) {
      assert.deepEqual(decouperTva(saisie), {
        pays: 'PL', numero: '8971903536', complet: 'PL8971903536',
      }, saisie);
    }
  });

  it('retire le préfixe répété — le champ pays est déjà rempli à côté', () => {
    assert.equal(decouperTva('BEBE0123456789').numero, '0123456789');
    assert.equal(decouperTva('BE BE 0123456789').pays, 'BE');
  });

  it('complète avec le pays du formulaire quand la saisie n’en porte pas', () => {
    assert.deepEqual(decouperTva('8971903536', 'PL'), {
      pays: 'PL', numero: '8971903536', complet: 'PL8971903536',
    });
  });

  it('traduit GR en EL : la Grèce a deux codes, et VIES veut le second', () => {
    assert.equal(decouperTva('123456789', 'GR').pays, 'EL');
    assert.equal(decouperTva('EL123456789').pays, 'EL');
  });

  it('refuse ce qui n’est pas européen plutôt que d’inventer', () => {
    assert.equal(decouperTva('CH123456789'), null, 'la Suisse n’est pas dans VIES');
    assert.equal(decouperTva('US-12-3456789'), null);
    assert.equal(decouperTva(''), null);
    assert.equal(decouperTva(null), null);
    assert.equal(decouperTva('FR'), null, 'un pays sans numéro');
  });
});

describe('rendre un nom lisible', () => {
  it('repasse une raison sociale polonaise en casse de titre', () => {
    assert.equal(
      nomLisible('ASIMA SPÓŁKA Z OGRANICZONĄ ODPOWIEDZIALNOŚCIĄ'),
      'Asima Spółka Z Ograniczoną Odpowiedzialnością',
    );
  });

  it('garde les sigles qu’on n’écrit jamais autrement', () => {
    assert.equal(nomLisible('BOULANGERIE DUPONT SA'), 'Boulangerie Dupont SA');
    assert.equal(nomLisible('ASIMA SP. Z O.O.'), 'Asima SP. Z O.O.');
    assert.equal(nomLisible('MULLER GMBH'), 'Muller GMBH');
  });

  it('ne touche pas à ce qui est déjà en casse mixte : le registre a raison', () => {
    assert.equal(nomLisible('Le Pain Quotidien'), 'Le Pain Quotidien');
    assert.equal(nomLisible('eBay Europe S.à r.l.'), 'eBay Europe S.à r.l.');
  });

  it('supporte le vide', () => {
    assert.equal(nomLisible(''), '');
    assert.equal(nomLisible(null), '');
  });
});

describe('ranger une adresse', () => {
  it('sort le code postal et la ville d’une adresse polonaise', () => {
    const r = rangerAdresse('STANISŁAWA LESZCZYŃSKIEGO 4/29\n50-078 WROCŁAW');
    assert.equal(r.code_postal, '50-078');
    assert.equal(r.ville, 'Wrocław');
    // L'adresse aussi repasse en casse lisible : elle s'imprime sur une facture.
    assert.equal(r.adresse, 'Stanisława Leszczyńskiego 4/29\n50-078 Wrocław');
  });

  it('sort le code postal et la ville d’une adresse belge', () => {
    const r = rangerAdresse('RUE DE LA LOI 16\n1000 BRUXELLES');
    assert.equal(r.code_postal, '1000');
    assert.equal(r.ville, 'Bruxelles');
  });

  it('découpe une adresse rendue sur une seule ligne', () => {
    const r = rangerAdresse('Leszczyńskiego 4/29, 50-078 Wrocław');
    assert.equal(r.code_postal, '50-078');
    assert.equal(r.ville, 'Wrocław');
    assert.equal(r.adresse, 'Leszczyńskiego 4/29\n50-078 Wrocław');
  });

  it('rend le vide quand l’État membre ne publie pas l’adresse', () => {
    assert.deepEqual(rangerAdresse('---'), { adresse: '', code_postal: '', ville: '' });
    assert.deepEqual(rangerAdresse(''), { adresse: '', code_postal: '', ville: '' });
  });

  it('garde l’adresse même quand elle ne se laisse pas découper', () => {
    const r = rangerAdresse('BOÎTE POSTALE 12');
    assert.equal(r.adresse, 'Boîte Postale 12');
    assert.equal(r.code_postal, '');
  });
});

describe('lire une réponse de VIES', () => {
  it('remplit la fiche à partir d’une réponse valide', () => {
    const r = lireReponse({
      countryCode: 'PL',
      vatNumber: '8971903536',
      valid: true,
      name: 'ASIMA SPÓŁKA Z OGRANICZONĄ ODPOWIEDZIALNOŚCIĄ',
      address: 'STANISŁAWA LESZCZYŃSKIEGO 4/29\n50-078 WROCŁAW',
      requestIdentifier: 'WAPIAAAAX123',
    }, { pays: 'PL', numero: '8971903536' });

    assert.equal(r.ok, true);
    assert.equal(r.tva, 'PL8971903536');
    assert.equal(r.nom, 'Asima Spółka Z Ograniczoną Odpowiedzialnością');
    assert.equal(r.ville, 'Wrocław');
    assert.equal(r.code_postal, '50-078');
    assert.equal(r.reference, 'WAPIAAAAX123', 'la preuve qu’on a vérifié se garde');
  });

  it('dit « inconnu » quand le numéro n’existe pas', () => {
    const r = lireReponse({ valid: false }, { pays: 'FR', numero: '12345678901' });
    assert.equal(r.ok, false);
    assert.equal(r.code, 'NUMERO_INCONNU');
  });

  it('ne prétend pas qu’un numéro est faux quand le registre est en panne', () => {
    for (const souci of ['MS_UNAVAILABLE', 'TIMEOUT', 'SERVICE_UNAVAILABLE']) {
      const r = lireReponse({ userError: souci }, { pays: 'IT', numero: '1' });
      assert.equal(r.ok, false, souci);
      assert.equal(r.code, 'VIES_INDISPONIBLE', souci);
      assert.equal(r.indisponible, true, souci);
      assert.match(r.message, /pas invalide/, souci);
    }
  });

  it('distingue un refus franc d’une panne', () => {
    const r = lireReponse({ userError: 'INVALID_INPUT' }, { pays: 'FR', numero: 'x' });
    assert.equal(r.code, 'NUMERO_REFUSE');
    assert.notEqual(r.indisponible, true);
  });

  it('accepte un numéro valide dont l’État membre ne publie pas le nom', () => {
    const r = lireReponse({ valid: true, name: '---', address: '---' }, { pays: 'DE', numero: '111' });
    assert.equal(r.ok, true);
    assert.equal(r.nom, '');
    assert.equal(r.adresse, '');
  });

  it('ne s’effondre pas sur une réponse qui n’en est pas une', () => {
    assert.equal(lireReponse(null, {}).code, 'REPONSE_ILLISIBLE');
    assert.equal(lireReponse('<html>', {}).code, 'REPONSE_ILLISIBLE');
  });
});

describe('le service', () => {
  it('refuse un format impossible sans appeler qui que ce soit', async () => {
    // Une URL qui n'existe pas : si le service appelait, le test échouerait.
    const s = serviceVies({ VIES_URL: 'https://nulle-part.invalid' });
    const r = await s.verifier('bonjour');
    assert.equal(r.ok, false);
    assert.equal(r.code, 'FORMAT');
  });

  it('ne lève jamais, même quand le réseau est coupé', async () => {
    const s = serviceVies({ VIES_URL: 'https://nulle-part.invalid' });
    const r = await s.verifier('PL8971903536');
    assert.equal(r.ok, false);
    assert.equal(r.indisponible, true, 'injoignable n’est pas invalide');
  });
});
