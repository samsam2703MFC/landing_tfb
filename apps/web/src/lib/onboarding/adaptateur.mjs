/**
 * L'adaptateur REST générique, et le contrat que tous les autres suivent.
 *
 * L'idée directrice : **ajouter une caisse ne doit pas demander de code.** Le
 * manifest décrit ses champs, ses adresses, sa pagination et son
 * authentification ; cet adaptateur les lit et sait dialoguer avec elle.
 *
 * On n'écrira un adaptateur dédié que pour une API vraiment exotique — un
 * OAuth à trois temps, une pagination par curseur opaque signé. Il implémentera
 * la même interface, et tout ce qui est en aval l'ignorera.
 *
 * Cinq règles, toutes vérifiables :
 *
 *   · aucun appel ne part du navigateur — tout passe par le serveur ;
 *   · aucune méthode ne lève sur un échec réseau : elle rend un résultat typé,
 *     avec un code d'erreur qui a un message et un bouton à l'écran ;
 *   · les ventes se lisent en flux, page par page — un an d'historique ne
 *     tient pas en mémoire ;
 *   · tout ce qui part au journal passe par le nettoyage des secrets ;
 *   · les données personnelles du client final sont retirées **avant**
 *     l'écriture, pas après.
 */

import { nettoyerPourJournal } from './coffre.mjs';
import { sansDonneesPersonnelles, parChemin } from './normalisation.mjs';
import { AdresseRefusee, aReessayer, attente, verifierAdresse } from './reseau.mjs';

/** Le temps qu'on laisse à une caisse pour répondre, avant de conclure. */
const DELAI_REQUETE = 20000;
const DELAI_TEST = 60000;

/**
 * Les codes d'erreur, et ce qu'on en dit au client.
 *
 * Jamais le message brut de l'API : « 401 Unauthorized » ne dit rien à un
 * franchisé. Chaque code a une phrase et une suite — la règle est que toute
 * erreur affichée mène quelque part.
 */
export const ERREURS = {
  AUTH_REFUSEE: { message: 'La clé API a été refusée par votre caisse.', suite: 'cle' },
  AUTH_EXPIREE: { message: 'Votre accès a expiré.', suite: 'cle' },
  ADRESSE_INTROUVABLE: { message: "L'adresse indiquée est introuvable sur votre caisse.", suite: 'adresses' },
  HOTE_INJOIGNABLE: { message: 'Impossible de joindre votre caisse.', suite: 'reessayer' },
  TROP_DAPPELS: { message: 'Votre caisse limite le nombre d’appels : l’import prendra un peu plus longtemps.', suite: null },
  FORMAT_INCONNU: { message: 'Nous ne reconnaissons pas le format de vos données.', suite: 'mapping' },
  PERIODE_VIDE: { message: 'Aucune vente trouvée sur la période.', suite: 'periode' },
  HOTE_INTERDIT: { message: 'Cette adresse mène à un service interne, nous ne l’appelons pas.', suite: 'adresses' },
  HTTPS_REQUIS: { message: 'L’adresse doit commencer par https://.', suite: 'adresses' },
  ADRESSE_INVALIDE: { message: 'Cette adresse n’est pas valide.', suite: 'adresses' },
  HOTE_INTROUVABLE: { message: 'Ce nom de domaine ne se résout pas.', suite: 'adresses' },
  INTERNE: { message: 'Un incident technique est survenu, notre équipe est prévenue.', suite: null },
};

/** Un échec, dit dans nos mots. */
function echec(code, technique) {
  return { ok: false, code, message: (ERREURS[code] || ERREURS.INTERNE).message, technique };
}

/** Le statut HTTP, traduit en code qui a un sens pour un commercial. */
function codeDuStatut(statut) {
  if (statut === 401) return 'AUTH_REFUSEE';
  if (statut === 403) return 'AUTH_EXPIREE';
  if (statut === 404) return 'ADRESSE_INTROUVABLE';
  if (statut === 429) return 'TROP_DAPPELS';
  return 'HOTE_INJOIGNABLE';
}

/**
 * Les en-têtes d'authentification, selon le mode déclaré au manifest.
 *
 * Quatre modes couvrent l'immense majorité des caisses. Ce qui n'est pas ici
 * — OAuth à trois temps, signature HMAC — demandera un adaptateur dédié, et
 * c'est le bon endroit pour tracer la limite.
 */
export function entetesAuth(manifest, config, secrets) {
  const mode = manifest?.auth?.mode || 'bearer';
  const clef = secrets.api_key || secrets.cle_api || '';
  if (mode === 'bearer') return { Authorization: `Bearer ${clef}` };
  if (mode === 'entete') {
    const nom = config.auth_header_name || manifest?.auth?.header || 'X-API-Key';
    return { [nom]: clef };
  }
  if (mode === 'basic') {
    const paire = Buffer.from(`${config.login || ''}:${clef}`).toString('base64');
    return { Authorization: `Basic ${paire}` };
  }
  if (mode === 'aucun') return {};
  return { Authorization: `Bearer ${clef}` };
}

/**
 * Remplace les jetons d'un gabarit d'adresse.
 *
 * Les valeurs sont encodées : une clé d'organisation contenant une esperluette
 * casserait sinon la requête, et un client saisissant `../admin` sortirait du
 * chemin prévu.
 */
export function remplirGabarit(gabarit, valeurs = {}) {
  return String(gabarit || '').replace(/\{(\w+)\}/g, (tout, cle) => (
    Object.prototype.hasOwnProperty.call(valeurs, cle)
      ? encodeURIComponent(String(valeurs[cle] ?? ''))
      : tout
  ));
}

/**
 * Un appel, avec ses reprises.
 *
 * `journaliser` reçoit une trace **déjà nettoyée** : c'est le seul endroit qui
 * connaît les secrets, et donc le seul qui peut garantir qu'ils n'en sortent
 * pas.
 */
async function appeler(url, { entetes = {}, methode = 'GET', secrets = [], delai = DELAI_REQUETE,
  essais = 4, journaliser = null, autoriserLocal = false, resoudre } = {}) {
  let dernier = null;

  for (let essai = 1; essai <= essais; essai += 1) {
    let u;
    try {
      // Revérifié à chaque essai, et non une seule fois : une redirection a pu
      // nous emmener ailleurs entre-temps.
      u = await verifierAdresse(url, { autoriserLocal, resoudre });
    } catch (err) {
      if (err instanceof AdresseRefusee) return echec(err.code, err.message);
      return echec('INTERNE', err.message);
    }

    const chrono = AbortSignal.timeout(delai);
    try {
      const rep = await fetch(u, {
        method: methode,
        headers: { Accept: 'application/json', ...entetes },
        signal: chrono,
        // Suivre une redirection à l'aveugle contournerait le contrôle
        // d'adresse : on la suit à la main, en revérifiant à chaque saut.
        redirect: 'manual',
      });
      if (journaliser) journaliser(nettoyerPourJournal(`${methode} ${u} → ${rep.status}`, secrets));

      if (rep.status >= 300 && rep.status < 400) {
        const suivante = rep.headers.get('location');
        if (!suivante) return echec('HOTE_INJOIGNABLE', `Redirection ${rep.status} sans destination.`);
        return appeler(new URL(suivante, u).toString(), {
          entetes, methode, secrets, delai, essais: essais - essai, journaliser, autoriserLocal, resoudre,
        });
      }

      if (rep.ok) {
        const texte = await rep.text();
        try {
          return { ok: true, corps: texte ? JSON.parse(texte) : null, statut: rep.status };
        } catch {
          return echec('FORMAT_INCONNU', `Réponse non-JSON (${texte.slice(0, 120)})`);
        }
      }

      dernier = echec(codeDuStatut(rep.status), `HTTP ${rep.status}`);
      if (!aReessayer(rep.status)) return dernier;
    } catch (err) {
      // Un abandon de délai ou une panne réseau : les deux se réessaient.
      dernier = echec('HOTE_INJOIGNABLE', err.name === 'TimeoutError'
        ? `Pas de réponse en ${delai / 1000} s`
        : String(err.message || err));
    }

    if (essai < essais) {
      const ms = attente(essai);
      if (journaliser) journaliser(`… nouvel essai dans ${ms} ms (${essai}/${essais})`);
      await new Promise((r) => setTimeout(r, ms));
    }
  }
  return dernier || echec('HOTE_INJOIGNABLE', 'Aucune réponse.');
}

/**
 * Extrait les éléments d'une réponse, selon la pagination déclarée.
 *
 * Trois modes suffisent en pratique : par numéro de page, par curseur rendu
 * dans la réponse, ou pas de pagination du tout. Le chemin des éléments est
 * dans le manifest — beaucoup d'API les enveloppent dans `data` ou `results`.
 */
export function elementsDe(corps, pagination = {}) {
  const chemin = pagination.items_path || pagination.chemin_items;
  const items = chemin ? parChemin(corps, chemin) : corps;
  if (Array.isArray(items)) return items;
  // Certaines caisses rendent un objet unique quand il n'y a qu'un élément.
  if (items && typeof items === 'object') return [items];
  return [];
}

/** Le curseur de la page suivante, ou null s'il n'y en a pas. */
export function curseurSuivant(corps, pagination = {}, pageCourante = 1, recus = 0) {
  const mode = pagination.mode || 'aucune';
  if (mode === 'curseur') {
    const suite = parChemin(corps, pagination.next_path || pagination.chemin_suite);
    return suite ? String(suite) : null;
  }
  if (mode === 'page') {
    const total = Number(parChemin(corps, pagination.total_path || pagination.chemin_total));
    const taille = Number(pagination.size_default || pagination.taille || 200);
    if (Number.isFinite(total) && total > 0) return recus < total ? String(pageCourante + 1) : null;
    // Sans total annoncé, on continue tant qu'une page est pleine.
    const derniers = elementsDe(corps, pagination).length;
    return derniers >= taille ? String(pageCourante + 1) : null;
  }
  return null;
}

/**
 * L'adaptateur générique.
 *
 * `options` sert aux tests : on y injecte un `fetch` ou un résolveur DNS. En
 * production, rien n'est injecté.
 */
export function adaptateurGenerique(manifest, options = {}) {
  const points = new Map((manifest.endpoints || []).map((e) => [e.kind || e.genre, e]));

  /** L'adresse d'un genre de point, gabarit rempli. */
  const adresse = (genre, config, valeurs) => {
    const p = points.get(genre);
    if (!p) return null;
    const base = String(config.base_url || '').replace(/\/+$/, '');
    return `${base}${remplirGabarit(p.path_template || p.gabarit, valeurs)}`;
  };

  const commun = (config, secrets, journaliser) => ({
    entetes: entetesAuth(manifest, config, secrets),
    secrets: Object.values(secrets),
    journaliser,
    autoriserLocal: options.autoriserLocal,
    resoudre: options.resoudre,
  });

  return {
    cle: manifest.code || manifest.cle || 'generic_rest',
    nom: manifest.name || manifest.nom || 'API REST générique',

    /** Une liste simple : boutiques, produits, catégories. */
    async lister(genre, { config, secrets = {}, journaliser } = {}) {
      const p = points.get(genre);
      if (!p) return { ok: true, elements: [] };
      const url = adresse(genre, config, { page: 1, ...config });
      const rep = await appeler(url, commun(config, secrets, journaliser));
      if (!rep.ok) return rep;
      return { ok: true, elements: elementsDe(rep.corps, p.pagination || {}) };
    },

    /**
     * Le test de connexion.
     *
     * Ne lève jamais : rend de quoi écrire l'écran, succès comme échec. Et il
     * dit des nombres — trois boutiques, 412 produits — parce qu'un « ✓ OK »
     * ne prouve rien à un client qui doute.
     */
    async tester({ config, secrets = {}, journaliser, depuis, jusqua } = {}) {
      const debut = Date.now();
      const compte = async (genre) => {
        if (Date.now() - debut > DELAI_TEST) return { ok: false, code: 'HOTE_INJOIGNABLE' };
        return this.lister(genre, { config, secrets, journaliser });
      };

      const boutiques = await compte('boutiques');
      if (!boutiques.ok && boutiques.code !== 'ADRESSE_INTROUVABLE') return boutiques;
      const produits = await compte('produits');
      if (!produits.ok) return produits;
      const categories = await compte('categories');
      if (!categories.ok) return categories;

      const a = jusqua || new Date();
      const de = depuis || new Date(a.getTime() - 30 * 24 * 3600 * 1000);
      const ventes = await this.echantillon({ config, secrets, journaliser, depuis: de, jusqua: a, maximum: 200 });
      if (!ventes.ok) return ventes;

      return {
        ok: true,
        detail: {
          boutiques: (boutiques.elements || []).length,
          produits: (produits.elements || []).length,
          categories: (categories.elements || []).length,
          lignes: ventes.lignes.length,
          periode: { de: de.toISOString().slice(0, 10), a: a.toISOString().slice(0, 10) },
        },
      };
    },

    /** Un échantillon de ventes, pour l'écran de mapping. */
    async echantillon({ config, secrets = {}, journaliser, depuis, jusqua, maximum = 20 } = {}) {
      const p = points.get('ventes');
      if (!p) return echec('ADRESSE_INTROUVABLE', 'Aucune adresse de ventes au manifest.');
      const url = adresse('ventes', config, {
        ...config,
        page: 1,
        from: (depuis || new Date(Date.now() - 30 * 86400000)).toISOString(),
        to: (jusqua || new Date()).toISOString(),
      });
      const rep = await appeler(url, commun(config, secrets, journaliser));
      if (!rep.ok) return rep;
      const lignes = elementsDe(rep.corps, p.pagination || {})
        .slice(0, maximum)
        // Les données personnelles ne franchissent pas cette ligne, même pour
        // un aperçu affiché trois secondes à l'écran.
        .map(sansDonneesPersonnelles);
      return { ok: true, lignes };
    },

    /**
     * Les ventes d'une période, page par page.
     *
     * Un générateur asynchrone : l'appelant écrit chaque page en base avant de
     * demander la suivante, et douze mois d'historique ne tiennent jamais en
     * mémoire d'un coup. Le curseur rendu avec chaque page permet de reprendre
     * exactement où l'on s'est arrêté.
     */
    async *ventes({ config, secrets = {}, journaliser, depuis, jusqua, curseur = null } = {}) {
      const p = points.get('ventes');
      if (!p) {
        yield { ok: false, ...echec('ADRESSE_INTROUVABLE', 'Aucune adresse de ventes au manifest.') };
        return;
      }
      const pagination = p.pagination || {};
      let page = Number(curseur) || 1;
      let recus = 0;
      // Un plafond dur : une pagination mal déclarée qui rend toujours la même
      // page tournerait sans fin, et l'on ne s'en apercevrait qu'à la facture.
      for (let tour = 0; tour < 5000; tour += 1) {
        const url = adresse('ventes', config, {
          ...config,
          page,
          cursor: curseur || '',
          from: (depuis || new Date(0)).toISOString(),
          to: (jusqua || new Date()).toISOString(),
        });
        const rep = await appeler(url, commun(config, secrets, journaliser));
        if (!rep.ok) { yield { ok: false, ...rep }; return; }

        const lignes = elementsDe(rep.corps, pagination).map(sansDonneesPersonnelles);

        // Une page vide met fin à la lecture, et ne se rend pas.
        //
        // Quoi qu'annonce le total : reprendre à la page trois d'un jeu de
        // cinq ventes ne fait compter qu'une ligne, et comparer ce compte au
        // total ferait redemander des pages à vide jusqu'au plafond. C'est la
        // page qui dit la fin, pas l'arithmétique. Aucune page n'est rendue
        // quand la période est vide : l'appelant le voit à ce qu'il n'a rien
        // reçu.
        if (lignes.length === 0) return;

        recus += lignes.length;
        yield { ok: true, lignes, curseur: String(page) };

        const suite = curseurSuivant(rep.corps, pagination, page, recus);
        if (!suite) return;
        page = Number(suite) || page + 1;
      }
    },
  };
}
