/**
 * Stripe Connect : l'encaissement, et le service qui le porte.
 *
 * Troisième fois le même patron — courriel, signature, VIES — et c'est
 * voulu : un service qui n'est pas branché doit se comporter partout de la
 * même façon, sinon chaque écran invente sa propre manière de mentir.
 *
 *   **rien ne dit « encaissé » qui ne l'est pas.**
 *
 * Ce qui se pose sur le serveur, et nulle part ailleurs :
 *
 *   STRIPE_CLE         la clé secrète de la plateforme — « sk_live_… »
 *   STRIPE_API         facultatif, pour viser un bouchon d'essai
 *   STRIPE_VERSION     facultatif, la version d'API à figer
 *
 * L'identifiant du compte connecté — « acct_… » — n'est **pas** un secret et
 * vit en base, sur la société qui facture : il ne permet rien sans la clé.
 * C'est aussi pourquoi il s'édite dans la console et pas la clé.
 *
 * Pourquoi Connect plutôt qu'un compte simple : le jour où une entité belge
 * facturera les clients belges pendant que l'entité polonaise facture les
 * autres, deux comptes connectés sous la même plateforme évitent de tenir
 * deux jeux de clés. Tant qu'il n'y a qu'une société, `acct_…` est vide et
 * l'appel part sur le compte de la plateforme — c'est le même code.
 */

/** Ce qu'on sait dire d'un compte connecté, dans nos mots. */
export const ETATS_COMPTE = {
  complet: 'Le compte encaisse et reçoit ses virements.',
  paiements_bloques: "Le compte existe mais n'encaisse pas encore : Stripe attend des pièces.",
  virements_bloques: 'Le compte encaisse, mais Stripe retient les virements.',
  a_completer: 'Le compte est ouvert et le dossier n’est pas terminé.',
  inconnu: 'Stripe n’a rien dit d’exploitable.',
};

/**
 * Traduit la réponse de Stripe en un seul mot.
 *
 * Stripe rend trois booléens qui ne disent pas la même chose, et l'ordre des
 * questions compte : un compte qui n'encaisse pas est un problème aujourd'hui,
 * un compte qui n'est pas viré est un problème à la fin du mois.
 */
export function etatDuCompte(brut) {
  if (!brut || typeof brut !== 'object') return 'inconnu';
  const paie = brut.charges_enabled === true;
  const vire = brut.payouts_enabled === true;
  const fini = brut.details_submitted === true;
  if (paie && vire) return 'complet';
  if (!paie) return 'paiements_bloques';
  if (!vire) return 'virements_bloques';
  return fini ? 'complet' : 'a_completer';
}

/**
 * Ce que Stripe demande encore.
 *
 * `requirements.currently_due` est la seule partie de la réponse qu'un humain
 * peut suivre : ce sont les cases qu'il reste à cocher. On les rend telles
 * quelles, sans traduction — les libellés Stripe sont techniques mais exacts,
 * et une traduction approximative enverrait chercher la mauvaise pièce.
 */
export function ceQuiManque(brut) {
  const r = (brut && brut.requirements) || {};
  const dues = [...(r.currently_due || []), ...(r.past_due || [])];
  return [...new Set(dues.map(String))];
}

/** Le service qui ne fait rien, et le dit. */
export const STRIPE_JOURNAL = {
  nom: 'aucun (STRIPE_CLE absente)',
  branche: false,
  async etatCompte(compte) {
    console.log(
      `─── STRIPE NON INTERROGÉ (aucune clé configurée) ───\n`
      + `Compte demandé : ${compte || '(plateforme)'}\n`
      + 'Posez STRIPE_CLE sur le serveur pour que la console sache où en est ce compte.',
    );
    return {
      ok: false,
      code: 'STRIPE_ABSENT',
      message: 'Aucune clé Stripe sur ce serveur : impossible de dire où en est ce compte.',
    };
  },
  async lienDeReprise() {
    return {
      ok: false,
      code: 'STRIPE_ABSENT',
      message: 'Aucune clé Stripe sur ce serveur : le lien d’ouverture de compte ne peut pas être fabriqué.',
    };
  },
  async produits() {
    return {
      ok: false,
      code: 'STRIPE_ABSENT',
      message: 'Aucune clé Stripe sur ce serveur : les produits ne peuvent pas être relus.',
    };
  },
};

/**
 * Le mode de la clé posée sur ce serveur, lu sur son préfixe.
 *
 * `sk_test_` et `sk_live_` sont la seule façon honnête de répondre : demander à
 * Stripe reviendrait à croire la réponse d'une clé dont on cherche justement à
 * savoir laquelle elle est. Un écran qui affiche des produits sans dire dans
 * quel monde il les a lus est un écran qui fera vendre un produit d'essai.
 */
export function modeStripe(env = process.env) {
  const cle = String(env.STRIPE_CLE || '').trim();
  if (!cle) return 'absent';
  if (cle.startsWith('sk_test_') || cle.startsWith('rk_test_')) return 'essai';
  if (cle.startsWith('sk_live_') || cle.startsWith('rk_live_')) return 'reel';
  return 'inconnu';
}

/**
 * Rapproche les packs des produits que Stripe a réellement rendus.
 *
 * Trois cas, et le deuxième est celui qui fait mal : un pack qui revendique un
 * `prod_…` que Stripe ne connaît pas s'affiche comme parfaitement vendable, et
 * ne le découvre qu'au premier paiement. Le produit a pu être archivé, ou
 * l'identifiant a été copié depuis l'autre mode.
 *
 * Le pack n'est jamais désactivé sur la foi d'une seule lecture — une liste
 * filtrée ou tronquée suffirait à débrancher un catalogue entier. Il est
 * signalé, et c'est un humain qui tranche.
 */
export function rapprocherPacks(packs, produits) {
  const parId = new Map((produits || []).map((p) => [p.id, p]));
  const revendiques = new Set();
  const rapproches = [];
  const orphelins = [];
  const sansProduit = [];

  for (const pack of packs || []) {
    if (!pack.stripe_product_id) {
      sansProduit.push(pack);
      continue;
    }
    revendiques.add(pack.stripe_product_id);
    const produit = parId.get(pack.stripe_product_id);
    if (produit) rapproches.push({ pack, produit });
    else orphelins.push(pack);
  }

  // Ce que Stripe vend et qu'aucun pack n'ouvre : pas une faute, mais la
  // question mérite d'être posée une fois.
  const nonRattaches = (produits || []).filter((p) => !revendiques.has(p.id));
  return { rapproches, orphelins, sansProduit, nonRattaches };
}

/**
 * Le service en vigueur.
 *
 * Deux appels seulement, et ce sont les deux qui servent depuis une console
 * d'administration : dire où en est un compte, et fabriquer le lien qui permet
 * d'en finir l'ouverture. Encaisser ne se fait pas d'ici.
 */
export function serviceStripe(env = process.env) {
  const cle = String(env.STRIPE_CLE || '').trim();
  if (!cle) return STRIPE_JOURNAL;

  const racine = String(env.STRIPE_API || 'https://api.stripe.com/v1').replace(/\/+$/, '');
  const entetes = () => {
    const e = {
      Authorization: `Bearer ${cle}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    };
    if (env.STRIPE_VERSION) e['Stripe-Version'] = String(env.STRIPE_VERSION);
    return e;
  };

  /** Un appel, et la même façon d'échouer partout. */
  async function appeler(chemin, options = {}) {
    try {
      const rep = await fetch(`${racine}${chemin}`, {
        ...options,
        headers: entetes(),
        signal: AbortSignal.timeout(15000),
      });
      const corps = await rep.json().catch(() => null);
      if (!rep.ok) {
        // Stripe met toujours un message lisible dans `error.message`. Le
        // recopier vaut mieux que « erreur 402 » : il dit quoi faire.
        const dit = corps?.error?.message || `Stripe a répondu ${rep.status}.`;
        return { ok: false, code: corps?.error?.code || 'STRIPE_REFUS', message: dit };
      }
      return { ok: true, corps };
    } catch (err) {
      return {
        ok: false,
        code: 'STRIPE_INJOIGNABLE',
        message: err.name === 'TimeoutError'
          ? 'Stripe n’a pas répondu en quinze secondes.'
          : `Stripe est injoignable depuis ce serveur (${err.message}).`,
      };
    }
  }

  return {
    nom: 'Stripe',
    branche: true,

    /** Où en est le compte connecté. */
    async etatCompte(compte) {
      const id = String(compte || '').trim();
      if (!id) {
        return {
          ok: false, code: 'SANS_COMPTE',
          message: 'Aucun compte Stripe n’est renseigné sur cette société.',
        };
      }
      const r = await appeler(`/accounts/${encodeURIComponent(id)}`);
      if (!r.ok) return r;
      const etat = etatDuCompte(r.corps);
      return {
        ok: true,
        etat,
        dit: ETATS_COMPTE[etat],
        manque: ceQuiManque(r.corps),
        pays: r.corps?.country || null,
        devise: (r.corps?.default_currency || '').toUpperCase() || null,
      };
    },

    /**
     * Le lien qui mène le titulaire du compte chez Stripe pour finir son
     * dossier. Il expire en quelques minutes et ne s'ouvre qu'une fois :
     * l'enregistrer quelque part n'aurait aucun sens, on le regénère.
     */
    async lienDeReprise(compte, { retour, rafraichir }) {
      const id = String(compte || '').trim();
      if (!id) {
        return { ok: false, code: 'SANS_COMPTE', message: 'Aucun compte Stripe n’est renseigné.' };
      }
      const corps = new URLSearchParams({
        account: id,
        type: 'account_onboarding',
        return_url: retour,
        refresh_url: rafraichir || retour,
      });
      const r = await appeler('/account_links', { method: 'POST', body: corps });
      if (!r.ok) return r;
      return { ok: true, url: r.corps?.url || null };
    },

    /**
     * Les produits actifs du catalogue Stripe, avec leur prix par défaut.
     *
     * Lecture seule, et c'est tout ce qu'il faut : la console rapproche, elle
     * ne crée rien chez Stripe. Un produit se crée là-bas, par quelqu'un qui
     * sait ce qu'il facture.
     *
     * Cent au maximum. Au-delà, la page dirait « et d'autres » plutôt que de
     * paginer en silence — un rapprochement fait sur une liste tronquée
     * déclarerait orphelins des packs qui ne le sont pas.
     */
    async produits() {
      const r = await appeler('/products?active=true&limit=100&expand[]=data.default_price');
      if (!r.ok) return r;
      const data = Array.isArray(r.corps?.data) ? r.corps.data : [];
      return {
        ok: true,
        tronque: Boolean(r.corps?.has_more),
        produits: data.map((p) => ({
          id: p.id,
          nom: p.name || p.id,
          prix_id: typeof p.default_price === 'object' ? p.default_price?.id || null : p.default_price || null,
          montant_cents: typeof p.default_price === 'object' ? p.default_price?.unit_amount ?? null : null,
          devise: typeof p.default_price === 'object' ? (p.default_price?.currency || '').toUpperCase() || null : null,
          recurrence: typeof p.default_price === 'object' ? p.default_price?.recurring?.interval || 'unique' : null,
        })),
      };
    },
  };
}
