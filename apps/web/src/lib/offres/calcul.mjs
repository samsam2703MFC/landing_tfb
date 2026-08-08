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
 * Ce qu'une remise retire à un montant, en centimes.
 *
 * Plafonnée à ce qu'elle réduit, toujours : une remise ne fabrique pas
 * d'avoir. Sur une ligne, la règle est plus simple que sur les totaux — un
 * module est une ligne mensuelle et rien d'autre, donc le montant fixe y
 * signifie sans ambiguïté « tant de moins par mois sur celui-là ». C'est aux
 * totaux, où les trois rythmes cohabitent, que la question se pose.
 *
 * @param {number} brutCents
 * @param {{type?: string, valeur?: number}|null|undefined} remise
 */
function retirer(brutCents, remise) {
  const valeur = entier(remise?.valeur);
  if (valeur === 0) return 0;
  const demandee = remise.type === 'fixe' ? valeur : part(brutCents, valeur);
  return Math.min(demandee, brutCents);
}

/**
 * Les lignes du devis, dans l'ordre du document.
 *
 * @param {object} offre
 * @param {Array<{nom: string, prix_cents: number, quantite?: number}>} offre.prestations
 *   Les modules d'onboarding retenus.
 * @param {number} offre.jours_formation Nombre de jours vendus.
 * @param {number} offre.nombre_postes Points de vente — la quantité du socle franchisé.
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
 * @param {Array<{cle, nom, prix_cents, unite, avec_caisse?}>} offre.packs
 *   Les packs retenus, avec leur prix et leur unité du jour.
 * @param {'pos'|'api'} offre.socle_pos Notre caisse, ou l'intégration de la leur.
 * @param {number} offre.tarifs.prix_poste_cents D'avant les packs — zéro aujourd'hui.
 * @param {number} offre.tarifs.prix_poste_franchiseur_cents D'avant les packs.
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

  // Les packs retenus, au mois.
  //
  // Un pack facturé `poste_mois` suit la taille du réseau : sa quantité est
  // le nombre de points de vente, et elle augmente quand le client ouvre une
  // boutique sans qu'on renégocie l'offre. Un pack facturé `mois` est une
  // ligne unique pour tout le réseau — le siège n'est pas multiple.
  //
  // Les modules qu'un pack comprend ne produisent pas de ligne : leur prix
  // est dans celui du pack. Les facturer en plus reviendrait à les vendre
  // deux fois, et le client le verrait sur le devis.
  const pointsDeVente = entier(offre.nombre_postes);
  for (const p of offre.packs || []) {
    const auPoste = p.unite === 'poste_mois';
    const quantite = auPoste ? pointsDeVente : 1;
    if (quantite === 0) continue;
    lignes.push({
      type: 'pack',
      libelle: p.nom,
      // La caisse retenue ne concerne que le pack qui en contient une : c'est
      // ce que le client regarde en premier sur cette ligne-là.
      note: p.avec_caisse ? (offre.socle_pos === 'api' ? 'Intégration API' : 'Caisse POS') : null,
      quantite,
      prix_unitaire_cents: entier(p.prix_cents),
      recurrence: 'mensuel',
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
      // La seule ligne qui porte sa propre remise. On ne négocie pas un pack
      // à la découpe — son prix EST la négociation — ni une prestation
      // d'onboarding, qui se retire de l'offre quand elle ne se vend pas. Un
      // module, si : c'est le geste qu'on fait pour en faire passer un
      // sixième, sans toucher au prix des cinq autres ni au catalogue.
      remise: m.remise || null,
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

  // Les postes d'avant les socles. Une offre chiffrée à l'époque porte le
  // tarif dans sa copie ; une offre d'aujourd'hui l'a à zéro et passe par le
  // socle franchisé, qui utilise la même quantité. Les deux ne peuvent donc
  // pas se cumuler — sans quoi le point de vente serait facturé deux fois.
  const auPointDeVente = (offre.packs || []).some((p) => p.unite === 'poste_mois');
  const postes = entier(offre.nombre_postes);
  if (postes > 0 && !auPointDeVente && entier(t.prix_poste_cents) > 0) {
    lignes.push({
      type: 'poste',
      libelle: 'Postes en magasin',
      note: null,
      quantite: postes,
      prix_unitaire_cents: entier(t.prix_poste_cents),
      recurrence: 'mensuel',
    });
  }

  // Le poste du siège, même histoire : remplacé par un pack, et conservé
  // pour les offres qui le portaient déjà.
  const siege = entier(offre.postes_franchiseur);
  if (siege > 0 && (offre.packs || []).length === 0 && entier(t.prix_poste_franchiseur_cents) > 0) {
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

  return lignes.map(({ remise, ...ligne }, i) => {
    const brut = ligne.quantite * ligne.prix_unitaire_cents;
    const remiseCents = retirer(brut, remise);
    return {
      ...ligne,
      ordre: (i + 1) * 10,
      // Les trois sont gardés séparément parce que le document les montre
      // séparément : « 240,00 € − 48,00 € = 192,00 € ». Ne stocker que le net
      // reviendrait à cacher au client la remise qu'on vient de lui accorder,
      // ce qui est exactement l'inverse du but.
      brut_cents: brut,
      remise_cents: remiseCents,
      total_cents: brut - remiseCents,
    };
  });
}

/**
 * Les lignes à moitié remplies.
 *
 * Une ligne entièrement vide est un reliquat du formulaire : elle ne dit rien
 * et disparaît à l'enregistrement. Une ligne à moitié remplie, elle, ment
 * — une vue décrite mais comptée zéro ne s'imprime nulle part, une vue comptée
 * mais sans description s'imprime « Vue », une ligne libre sans intitulé
 * s'imprime sans nom. Rien à l'écran ne le signalerait : le total, lui, est
 * juste. C'est donc ce qu'il faut voir avant d'envoyer, pas après.
 *
 * @returns {Array<{ou: 'vue'|'libre'|'prestation', rang: number, nom: string|null, manque: string}>}
 *   `rang` est le numéro de la ligne dans sa propre liste, tel qu'il se compte
 *   à l'écran — c'est ce qui permet de la désigner du doigt.
 */
export function lignesIncompletes(offre) {
  const manques = [];

  (offre.vues || []).forEach((v, i) => {
    const nombre = entier(v.nombre);
    const note = String(v.note || '').trim();
    if (!nombre && !note) return;
    if (!note) manques.push({ ou: 'vue', rang: i + 1, nom: null, manque: 'description' });
    else if (!nombre) manques.push({ ou: 'vue', rang: i + 1, nom: note, manque: 'nombre' });
  });

  // Une prestation du catalogue a toujours un nom : en pratique, seule une
  // ligne libre peut arriver ici sans intitulé. On la numérote parmi les
  // lignes libres, puisque c'est ainsi qu'elle s'affiche.
  let rangLibre = 0;
  (offre.prestations || []).forEach((p) => {
    if (p.libre) rangLibre += 1;
    if (String(p.nom || '').trim()) return;
    manques.push({
      ou: p.libre ? 'libre' : 'prestation',
      rang: p.libre ? rangLibre : 0,
      nom: null,
      manque: 'intitulé',
    });
  });

  return manques;
}

/**
 * Le chiffrage complet.
 *
 * DEUX ÉTAGES DE REMISE, et ils ne se confondent pas.
 *
 * En bas, la remise d'un **module** : elle appartient à la ligne, elle est
 * déjà déduite de son `total_cents`, et elle s'imprime en face du module
 * qu'elle concerne. C'est le geste qu'on fait pour placer un module de plus
 * sans brader les autres ni retoucher le catalogue.
 *
 * Au-dessus, la remise de **l'offre**, qui porte sur ce qui reste une fois
 * les lignes remisées. Deux règles, et elles ne sont pas symétriques :
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
    // `total_cents` est déjà net des remises de ligne : le sous-total part
    // donc de ce qui reste après elles, et la remise générale s'applique
    // par-dessus. L'ordre inverse ferait payer la remise générale sur un
    // montant qu'on ne facture pas.
    const sousTotal = dedans.reduce((n, l) => n + l.total_cents, 0);
    const remisesLignes = dedans.reduce((n, l) => n + (l.remise_cents || 0), 0);

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
      // Ce qui a été retiré ligne à ligne, pour que le récapitulatif puisse le
      // dire d'un mot. Ce n'est pas déduit du sous-total : ça l'a déjà été.
      remisesLignes,
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
