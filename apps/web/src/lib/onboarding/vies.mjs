/**
 * VIES : la vérification d'un numéro de TVA intracommunautaire.
 *
 * Le service de la Commission européenne dit trois choses : si le numéro
 * existe, à quel nom, et à quelle adresse. C'est assez pour remplir la fiche
 * d'un client sans ressaisie — et surtout pour **attraper une faute de frappe
 * avant qu'elle ne finisse sur une facture**, où elle coûte une régularisation.
 *
 * Deux parties, séparées à dessein :
 *
 *   · ce qui **nettoie et interprète** — pur, testé, sans réseau. C'est là que
 *     vivent les pièges : le préfixe pays répété, l'adresse polonaise sur une
 *     seule ligne, le nom en capitales qu'on ne veut pas garder tel quel ;
 *   · ce qui **appelle** — un adaptateur, comme pour le courriel et la
 *     signature. Quand VIES est injoignable, on le dit ; on ne prétend jamais
 *     qu'un numéro est valide parce qu'on n'a pas pu le vérifier.
 *
 * VIES tombe régulièrement, et certains États membres répondent « service
 * indisponible » pour eux seuls. Un numéro non vérifié n'est donc pas un
 * numéro invalide : la console laisse passer, en le disant.
 */

/** Les 27 États membres, plus l'Irlande du Nord. Le reste n'est pas VIES. */
const PAYS = new Set([
  'AT', 'BE', 'BG', 'CY', 'CZ', 'DE', 'DK', 'EE', 'EL', 'ES', 'FI', 'FR', 'HR',
  'HU', 'IE', 'IT', 'LT', 'LU', 'LV', 'MT', 'NL', 'PL', 'PT', 'RO', 'SE', 'SI',
  'SK', 'XI',
]);

/**
 * Découpe un numéro en pays + numéro.
 *
 * Accepte tout ce qu'un humain tape : espaces, points, tirets, minuscules, et
 * le préfixe répété — « BE BE0123456789 » arrive plus souvent qu'on ne croit
 * quand le champ pays est déjà rempli à côté.
 *
 * La Grèce est le piège classique : son code ISO est GR, son code TVA est EL.
 */
export function decouperTva(saisie, paysParDefaut = null) {
  const brut = String(saisie || '').toUpperCase().replace(/[\s.\-/]/g, '');
  if (!brut) return null;

  let reste = brut;
  let pays = null;
  // On retire les préfixes tant qu'on en trouve : « BEBE0123 » → « 0123 ».
  while (reste.length > 2 && PAYS.has(reste.slice(0, 2))) {
    pays = reste.slice(0, 2);
    reste = reste.slice(2);
  }
  if (!pays && paysParDefaut) {
    const p = String(paysParDefaut).toUpperCase();
    pays = p === 'GR' ? 'EL' : p;
  }
  if (!pays || !PAYS.has(pays) || !reste) return null;
  return { pays, numero: reste, complet: `${pays}${reste}` };
}

/**
 * Remet un nom en capitales dans une casse lisible.
 *
 * Les registres polonais et tchèques répondent tout en majuscules :
 * « ASIMA SPÓŁKA Z OGRANICZONĄ ODPOWIEDZIALNOŚCIĄ ». Le recopier tel quel sur
 * un contrat donne l'air d'un cri. On repasse en casse de titre, en gardant
 * les sigles courts — SA, SRL, BV, GMBH, SP, ZOO — et les formes juridiques
 * que personne n'écrit autrement.
 */
export function nomLisible(brut) {
  const texte = String(brut || '').trim();
  if (!texte) return '';
  // Déjà en casse mixte : on n'y touche pas, c'est le registre qui a raison.
  if (texte !== texte.toUpperCase()) return texte;

  const SIGLES = new Set(['SA', 'SRL', 'SPRL', 'BV', 'BVBA', 'NV', 'GMBH', 'AG', 'SAS',
    'SARL', 'SL', 'SP', 'ZOO', 'OOD', 'LTD', 'PLC', 'AB', 'AS', 'OY', 'KG', 'SE']);
  // « O.O. », « S.A. », « N.V. » : une suite de lettres seules ponctuées est un
  // sigle, quel que soit le pays. La règle vaut mieux qu'une liste — on ne
  // devinera jamais toutes les formes juridiques des vingt-sept.
  const SIGLE_POINTE = /^(?:\p{L}\.){2,}[.,]?$/u;
  return texte
    .toLocaleLowerCase('fr')
    .split(/(\s+)/)
    .map((mot) => {
      if (/^\s+$/.test(mot)) return mot;
      const nu = mot.replace(/[.,]/g, '').toUpperCase();
      if (SIGLES.has(nu) || SIGLE_POINTE.test(mot)) return mot.toLocaleUpperCase('fr');
      return mot.charAt(0).toLocaleUpperCase('fr') + mot.slice(1);
    })
    .join('');
}

/**
 * Range l'adresse rendue par VIES.
 *
 * Chaque pays répond à sa façon : la Belgique sur trois lignes séparées par
 * des retours, la Pologne sur une seule avec des virgules, l'Allemagne avec le
 * code postal devant la ville. On ne cherche pas à tout démêler — on rend une
 * adresse propre et, quand on la reconnaît, le code postal et la ville à part.
 */
export function rangerAdresse(brut) {
  const texte = String(brut || '').replace(/\r/g, '').trim();
  if (!texte || texte === '---') return { adresse: '', code_postal: '', ville: '' };

  // Repassées en casse lisible comme les noms, et pour la même raison : cette
  // adresse s'imprime sur une facture, et un registre qui répond en capitales
  // n'est pas une raison d'écrire au client en criant.
  const lignes = texte.split(/\n|,(?=\s)/).map((l) => nomLisible(l.trim())).filter(Boolean);
  const propre = lignes.join('\n');

  // Deux formes couvrent presque tout : « 1000 Bruxelles » et « 50-078 Wrocław ».
  for (const ligne of [...lignes].reverse()) {
    const m = ligne.match(/^([0-9][0-9-\s]{2,9})\s+(.+)$/);
    if (m) {
      return {
        adresse: propre,
        code_postal: m[1].trim(),
        ville: m[2].replace(/,.*$/, '').trim(),
      };
    }
  }
  return { adresse: propre, code_postal: '', ville: '' };
}

/**
 * Ce que la console fait d'une réponse VIES.
 *
 * Pur : on lui donne la réponse brute du service, elle rend de quoi remplir un
 * formulaire. Testable sans réseau, et c'est ce qui compte — le réseau, lui,
 * ne tombera jamais en panne d'une façon intéressante.
 */
export function lireReponse(brut, { pays, numero } = {}) {
  if (!brut || typeof brut !== 'object') {
    return { ok: false, code: 'REPONSE_ILLISIBLE', message: 'VIES a répondu quelque chose d’incompréhensible.' };
  }
  // La réponse porte parfois `userError` : « INVALID_INPUT », « MS_UNAVAILABLE ».
  const souci = String(brut.userError || '').toUpperCase();
  if (souci && souci !== 'VALID') {
    if (souci === 'MS_UNAVAILABLE' || souci === 'TIMEOUT' || souci === 'SERVICE_UNAVAILABLE') {
      return {
        ok: false, code: 'VIES_INDISPONIBLE', indisponible: true,
        message: `Le registre de ${pays || 'ce pays'} ne répond pas en ce moment. `
          + 'Le numéro n’est pas invalide pour autant — il n’a simplement pas pu être vérifié.',
      };
    }
    return { ok: false, code: 'NUMERO_REFUSE', message: `VIES refuse ce numéro (${souci}).` };
  }

  if (brut.valid === false || brut.isValid === false) {
    return {
      ok: false, code: 'NUMERO_INCONNU',
      message: `Le numéro ${pays || ''}${numero || ''} n’existe pas au registre européen.`,
    };
  }

  const nom = nomLisible(brut.name || brut.traderName || '');
  const adresse = rangerAdresse(brut.address || brut.traderAddress || '');
  return {
    ok: true,
    tva: `${pays || brut.countryCode || ''}${numero || brut.vatNumber || ''}`,
    pays: pays || brut.countryCode || '',
    // VIES rend « --- » quand l'État membre ne publie pas le nom. Ce n'est pas
    // une erreur : le numéro est valide, on n'apprend simplement rien de plus.
    nom: nom === '---' ? '' : nom,
    ...adresse,
    consulte_le: new Date().toISOString(),
    // Certains États rendent un identifiant de consultation : c'est la preuve
    // qu'on a vérifié, et elle vaut d'être gardée pour un contrôle fiscal.
    reference: brut.requestIdentifier || null,
  };
}

/**
 * Le service en vigueur.
 *
 * Même patron que le courriel et la signature : on demande, on reçoit, et l'on
 * regarde `ok` avant de promettre quoi que ce soit. Rien ne lève.
 *
 * `VIES_URL` permet de viser un miroir ou un bouchon d'essai ; sans elle, le
 * service officiel.
 */
export function serviceVies(env = process.env) {
  const racine = String(env.VIES_URL || 'https://ec.europa.eu/taxation_customs/vies/rest-api')
    .replace(/\/+$/, '');
  return {
    nom: 'VIES',
    async verifier(saisie, paysParDefaut = null) {
      const decoupe = decouperTva(saisie, paysParDefaut);
      if (!decoupe) {
        return {
          ok: false, code: 'FORMAT',
          message: 'Ce numéro n’a pas la forme d’une TVA européenne : deux lettres de pays, puis des chiffres.',
        };
      }
      try {
        const rep = await fetch(`${racine}/check-vat-number`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
          body: JSON.stringify({ countryCode: decoupe.pays, vatNumber: decoupe.numero }),
          // Quinze secondes : VIES est lent, mais un formulaire qui attend une
          // minute se fait fermer.
          signal: AbortSignal.timeout(15000),
        });
        if (!rep.ok) {
          return {
            ok: false, code: 'VIES_INDISPONIBLE', indisponible: true,
            message: `VIES a répondu ${rep.status}. Le numéro n’a pas pu être vérifié — réessayez plus tard.`,
          };
        }
        return lireReponse(await rep.json(), decoupe);
      } catch (err) {
        return {
          ok: false, code: 'VIES_INJOIGNABLE', indisponible: true,
          message: err.name === 'TimeoutError'
            ? 'VIES n’a pas répondu en quinze secondes. Le numéro n’a pas pu être vérifié.'
            : `VIES est injoignable depuis ce serveur (${err.message}).`,
        };
      }
    },
  };
}
