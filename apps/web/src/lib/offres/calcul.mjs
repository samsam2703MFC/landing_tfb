/**
 * Le calcul d'une offre — fonction pure, sans base ni requête.
 *
 * Tout est en **entiers, en centimes**. Un prix en flottant finit par
 * facturer 119,99999 € ; sur un document commercial signé ce n'est pas une
 * coquille d'affichage, c'est un litige. Les taux suivent la même règle et
 * s'expriment en **centièmes de point** : 21 % = 2100, 7,5 % = 750, 5 % = 500.
 *
 * Trois seaux, pas deux. Le brief d'origine séparait « une fois » et
 * « récurrent annuel », mais le prix par vue est mensuel : mettre 5 000 €/mois
 * dans la même colonne que 120 000 € payés une fois est exactement la façon
 * de vendre à perte. On tient donc `unique`, `mensuel` et `annuel` côte à
 * côte, et chacun porte son propre sous-total, sa remise, sa TVA et son TTC.
 *
 * Le calcul ne décide de rien : il reçoit les tarifs qu'on lui donne. C'est
 * volontaire — une offre garde une copie des tarifs du jour où elle a été
 * faite, et se recalcule des mois plus tard avec ces valeurs-là.
 */

/** Les trois rythmes de paiement, dans l'ordre où on les lit. */
export const RECURRENCES = ['unique', 'mensuel', 'annuel'];

/** Un pourcentage en centièmes de point, appliqué à un montant en centimes. */
function part(montantCents, points) {
  return Math.round((montantCents * points) / 10000);
}

/** Un entier positif, quoi qu'on nous passe. */
function entier(valeur) {
  const n = Number(valeur);
  return Number.isFinite(n) && n > 0 ? Math.trunc(n) : 0;
}

/**
 * Les lignes du devis, dans l'ordre du document.
 *
 * @param {object} offre
 * @param {Array<{nom: string, prix_cents: number, quantite?: number}>} offre.prestations
 *   Les modules d'onboarding retenus.
 * @param {number} offre.jours_formation Nombre de jours vendus.
 * @param {number} offre.nombre_postes Magasins ouverts, équipés au mois.
 * @param {number} offre.postes_franchiseur Postes du siège, au mois.
 * @param {number} offre.postes_onboardes Postes à onboarder, une seule fois.
 * @param {Array<{slug, nom, prix_cents, pourquoi?, apporte?}>} offre.modules
 *   Les modules de l'ERP retenus, facturés au mois.
 * @param {'aucune'|'par_vue'|'achat'} offre.option_app
 * @param {Array<{nombre: number, note?: string}>} offre.vues
 *   Les vues de l'application, chacune avec son compte et sa description.
 * @param {object} offre.tarifs
 * @param {number} offre.tarifs.prix_par_vue_cents Prix **mensuel** d'une vue.
 * @param {number} offre.tarifs.multiplicateur_achat Nombre de mois rachetés.
 * @param {number} offre.tarifs.taux_annuel Maintenance annuelle, en points.
 * @param {number} offre.tarifs.prix_jour_formation_cents
 * @param {number} offre.tarifs.prix_poste_cents Prix **mensuel** d'un poste magasin.
 * @param {number} offre.tarifs.prix_poste_franchiseur_cents Prix **mensuel** du poste siège.
 * @param {number} offre.tarifs.prix_onboarding_poste_cents Onboarding d'un poste, **une fois**.
 * @returns {Array<{type, libelle, note, quantite, prix_unitaire_cents, recurrence, total_cents}>}
 */
export function lignesDe(offre) {
  const t = offre.tarifs || {};
  const lignes = [];

  for (const p of offre.prestations || []) {
    const quantite = entier(p.quantite ?? 1) || 1;
    lignes.push({
      type: 'prestation',
      libelle: p.nom,
      note: p.description || null,
      quantite,
      prix_unitaire_cents: entier(p.prix_cents),
      recurrence: 'unique',
    });
  }

  const jours = entier(offre.jours_formation);
  if (jours > 0) {
    lignes.push({
      type: 'formation',
      libelle: 'Formation',
      note: null,
      quantite: jours,
      prix_unitaire_cents: entier(t.prix_jour_formation_cents),
      recurrence: 'unique',
    });
  }

  // Les modules de l'ERP, au mois. Chacun porte le prix qu'il avait le jour
  // où il a été mis dans l'offre : la grille peut bouger ensuite.
  for (const m of offre.modules || []) {
    const prix = entier(m.prix_cents);
    if (prix === 0) continue;
    lignes.push({
      type: 'module',
      libelle: m.nom,
      note: m.apporte || null,
      quantite: 1,
      prix_unitaire_cents: prix,
      recurrence: 'mensuel',
    });
  }

  // L'onboarding des postes se facture une fois, avant tout ce qui est
  // mensuel : c'est de l'installation, pas de l'abonnement. Il peut ne porter
  // que sur une partie du réseau — on n'onboarde pas trente magasins le même
  // jour.
  const onboardes = entier(offre.postes_onboardes);
  if (onboardes > 0) {
    lignes.push({
      type: 'onboarding_poste',
      libelle: 'Onboarding des postes',
      note: null,
      quantite: onboardes,
      prix_unitaire_cents: entier(t.prix_onboarding_poste_cents),
      recurrence: 'unique',
    });
  }

  // Un poste par magasin ouvert, facturé au mois. C'est la quantité qui suit
  // la taille du réseau : elle augmente quand le client ouvre une boutique,
  // sans qu'on renégocie l'offre.
  const postes = entier(offre.nombre_postes);
  if (postes > 0) {
    lignes.push({
      type: 'poste',
      libelle: 'Postes en magasin',
      note: null,
      quantite: postes,
      prix_unitaire_cents: entier(t.prix_poste_cents),
      recurrence: 'mensuel',
    });
  }

  // Le siège a son propre poste, à son propre prix : il ne fait pas le même
  // métier qu'un magasin et ne se compte pas avec eux.
  const siege = entier(offre.postes_franchiseur);
  if (siege > 0) {
    lignes.push({
      type: 'poste_franchiseur',
      libelle: 'Poste franchiseur',
      note: null,
      quantite: siege,
      prix_unitaire_cents: entier(t.prix_poste_franchiseur_cents),
      recurrence: 'mensuel',
    });
  }

  // Le nombre de vues sert aux deux options : loué, il se paie au mois ;
  // acheté, il donne le coût de construction qu'on multiplie.
  const vues = (offre.vues || []).reduce((n, v) => n + entier(v.nombre), 0);
  const construction = vues * entier(t.prix_par_vue_cents);

  if (offre.option_app === 'par_vue' && vues > 0) {
    // Une ligne par vue : le client doit voir ce qu'il loue, pas un total.
    for (const v of offre.vues || []) {
      const nombre = entier(v.nombre);
      if (nombre === 0) continue;
      lignes.push({
        type: 'vue',
        libelle: v.note || 'Vue',
        note: null,
        quantite: nombre,
        prix_unitaire_cents: entier(t.prix_par_vue_cents),
        recurrence: 'mensuel',
      });
    }
  }

  if (offre.option_app === 'achat' && construction > 0) {
    const multiplicateur = entier(t.multiplicateur_achat);
    const achat = construction * multiplicateur;
    lignes.push({
      type: 'achat',
      libelle: "Achat de l'application",
      note: `${vues} vue(s) × ${multiplicateur} mois`,
      quantite: 1,
      prix_unitaire_cents: achat,
      recurrence: 'unique',
    });
    const maintenance = part(achat, entier(t.taux_annuel));
    if (maintenance > 0) {
      lignes.push({
        type: 'maintenance',
        libelle: 'Maintenance annuelle',
        note: null,
        quantite: 1,
        prix_unitaire_cents: maintenance,
        recurrence: 'annuel',
      });
    }
  }

  return lignes.map((l, i) => ({
    ...l,
    ordre: (i + 1) * 10,
    total_cents: l.quantite * l.prix_unitaire_cents,
  }));
}

/**
 * Le chiffrage complet.
 *
 * Deux règles de remise, et elles ne sont pas symétriques :
 *
 *   · en pourcentage, elle s'applique aux trois rythmes — c'est ce qu'un
 *     client comprend par « 10 % de remise » ;
 *   · en montant fixe, elle ne s'applique qu'au **paiement unique**. Retirer
 *     500 € d'un abonnement mensuel voudrait dire 500 € tous les mois, à vie,
 *     ce que personne n'a l'intention d'accorder. Elle est plafonnée au
 *     sous-total : une remise ne fabrique pas d'avoir.
 *
 * @returns {{lignes: Array, seaux: object, remiseIgnoree: number}}
 *   `remiseIgnoree` est la part de remise fixe qui dépassait le sous-total —
 *   l'écran la signale plutôt que de la faire disparaître en silence.
 */
export function calculerOffre(offre) {
  const lignes = lignesDe(offre);
  const remise = offre.remise || { type: 'pourcent', valeur: 0 };
  const tva = offre.tva || { taux: 0, exoneree: false };
  const tauxTva = tva.exoneree ? 0 : entier(tva.taux);

  const seaux = {};
  let remiseIgnoree = 0;

  for (const recurrence of RECURRENCES) {
    const dedans = lignes.filter((l) => l.recurrence === recurrence);
    const sousTotal = dedans.reduce((n, l) => n + l.total_cents, 0);

    let montantRemise = 0;
    if (remise.type === 'pourcent') {
      montantRemise = part(sousTotal, entier(remise.valeur));
    } else if (recurrence === 'unique') {
      const demandee = entier(remise.valeur);
      montantRemise = Math.min(demandee, sousTotal);
      remiseIgnoree = demandee - montantRemise;
    }

    const ht = sousTotal - montantRemise;
    const montantTva = part(ht, tauxTva);
    seaux[recurrence] = {
      lignes: dedans,
      sousTotal,
      remise: montantRemise,
      ht,
      tva: montantTva,
      ttc: ht + montantTva,
    };
  }

  // Les mois offerts ne sont pas une remise : le prix mensuel ne bouge pas,
  // on renonce seulement aux N premières échéances. Les mêler à la remise
  // ferait apparaître un abonnement moins cher qu'il ne l'est, et le client
  // s'en apercevrait à la première facture pleine.
  const mois = entier(offre.mois_offerts);
  const offert = mois > 0
    ? {
        mois,
        ht: seaux.mensuel.ht * mois,
        tva: seaux.mensuel.tva * mois,
        ttc: seaux.mensuel.ttc * mois,
      }
    : null;

  return { lignes, seaux, offert, remiseIgnoree, tauxTva, exoneree: Boolean(tva.exoneree) };
}

/**
 * Un montant en centimes, écrit comme sur une facture.
 *
 * `Intl` est dans Node depuis longtemps : pas de dépendance, et la langue de
 * l'offre décide du séparateur — un client néerlandophone lit « € 1.234,56 ».
 */
export function formater(cents, langue = 'fr', devise = 'EUR') {
  return new Intl.NumberFormat(locale(langue), { style: 'currency', currency: devise })
    .format((Number(cents) || 0) / 100);
}

/**
 * La locale d'affichage d'une langue.
 *
 * On vise la Belgique quand elle a un sens — un client belge lit « 1.234,56 »
 * en néerlandais et « 1 234,56 » en français, et se méfierait de l'inverse.
 * Une langue inconnue retombe sur le français plutôt que sur l'anglais : le
 * séparateur anglo-saxon (1,234.56) est celui qui fait le plus de dégâts sur
 * un devis lu en Europe continentale.
 */
export function locale(langue) {
  return {
    fr: 'fr-BE', nl: 'nl-BE', en: 'en-IE', de: 'de-DE', it: 'it-IT',
    es: 'es-ES', pl: 'pl-PL', uk: 'uk-UA', ru: 'ru-RU', ar: 'ar-EG',
  }[langue] || 'fr-BE';
}

/** Un taux en centièmes de point, écrit en pourcentage lisible. */
export function formaterTaux(points) {
  const n = (Number(points) || 0) / 100;
  return `${Number.isInteger(n) ? n : n.toFixed(2).replace(/0$/, '')} %`;
}
