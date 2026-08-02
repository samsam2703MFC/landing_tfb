/**
 * Le moteur du parcours : modules → capacités → étapes.
 *
 * Rien ici ne touche à la base. C'est la partie qui décide ce qu'un client
 * aura à faire, et cette décision doit pouvoir se vérifier en une ligne.
 *
 * Le raisonnement tient en trois temps :
 *
 *   1. les modules choisis déclarent chacun leurs **capacités** — une brique
 *      de donnée dont ils ont besoin : les ventes, le catalogue produits ;
 *   2. on en prend l'**union dédouble**. Quatre modules qui demandent tous les
 *      ventes ne font qu'une chose à faire, pas quatre ;
 *   3. chaque **groupe de boutiques** — c'est-à-dire chaque caisse — porte la
 *      série d'étapes techniques. Un réseau à trois caisses répète la
 *      configuration trois fois ; il ne la répète pas par boutique.
 *
 * La conséquence contre-intuitive, et c'est ce qui rend l'écran de prérequis
 * honnête : **décocher un module ne retire pas forcément une étape.** Si
 * « Reporting » demande déjà le catalogue produits, retirer « Food cost » ne
 * change rien à ce qu'on aura à brancher.
 */

/** Les étapes qui ne concernent que le client, une seule fois. */
export const ETAPES_CLIENT = [
  { cle: 'entreprise', libelle: 'Votre entreprise', ordre: 10 },
  { cle: 'modules', libelle: 'Ce que vous voulez piloter', ordre: 20 },
  { cle: 'prerequis', libelle: 'Ce que nous allons lire', ordre: 30 },
  { cle: 'parc', libelle: 'Vos boutiques et leurs caisses', ordre: 40 },
];

/**
 * Les étapes qui se répètent pour chaque caisse.
 *
 * `capacites` dit de quelles capacités une étape dépend : l'étape de
 * rapprochement des boutiques n'a de sens que si l'on sait lire la liste des
 * boutiques du POS, et le mapping n'existe que s'il y a des ventes à mapper.
 */
export const ETAPES_CONNEXION = [
  { cle: 'configuration', libelle: 'Connexion à la caisse', ordre: 100 },
  { cle: 'test', libelle: 'Test de connexion', ordre: 110 },
  { cle: 'mapping', libelle: 'Ce que nous avons compris', ordre: 120, capacites: ['ventes'] },
  { cle: 'boutiques', libelle: 'Rapprochement des boutiques', ordre: 130, capacites: ['boutiques'] },
  { cle: 'historique', libelle: "Import de l'historique", ordre: 140, capacites: ['ventes'] },
  { cle: 'coherence', libelle: 'Contrôle de cohérence', ordre: 150, capacites: ['ventes'] },
  { cle: 'synchro', libelle: 'Synchronisation', ordre: 160, capacites: ['ventes'] },
];

/** L'étape finale, une fois toutes les caisses en place. */
export const ETAPE_FIN = { cle: 'fin', libelle: 'Tout est en place', ordre: 900 };

/**
 * Les capacités dont un ensemble de modules a besoin.
 *
 * Rend `requises` et `optionnelles` séparément : une capacité optionnelle ne
 * bloque rien, mais l'écran de prérequis doit pouvoir dire ce qu'on perd sans
 * elle. Une capacité à la fois requise par un module et optionnelle pour un
 * autre est **requise** — le plus exigeant l'emporte.
 */
export function capacitesRequises(modules = []) {
  const requises = new Map();
  const optionnelles = new Map();

  for (const m of modules) {
    for (const b of m.besoins || []) {
      const carte = b.requis ? requises : optionnelles;
      if (!carte.has(b.capacite)) {
        carte.set(b.capacite, { capacite: b.capacite, modules: [], note_degradee: b.note_degradee || null });
      }
      carte.get(b.capacite).modules.push(m.nom || m.slug);
    }
  }
  // Le plus exigeant l'emporte : une capacité requise quelque part n'est plus
  // optionnelle nulle part.
  for (const cle of requises.keys()) optionnelles.delete(cle);

  return {
    requises: [...requises.values()],
    optionnelles: [...optionnelles.values()],
    toutes: [...requises.keys(), ...optionnelles.keys()],
  };
}

/**
 * Les connecteurs capables de fournir ce dont on a besoin.
 *
 * `manquantes` dit ce qu'un connecteur ne couvre pas : on ne l'écarte pas
 * pour autant. Une caisse qui donne les ventes mais pas les boutiques reste
 * utilisable — on rapprochera les boutiques à la main.
 */
export function connecteursPossibles(connecteurs = [], capacites = []) {
  const voulues = new Set(capacites);
  return connecteurs
    .filter((c) => c.actif !== false)
    .map((c) => {
      const offertes = new Set(c.capacites || []);
      const manquantes = [...voulues].filter((x) => !offertes.has(x));
      return { ...c, manquantes, couvre: voulues.size - manquantes.length };
    })
    // Le plus couvrant d'abord, puis l'ordre du catalogue.
    .sort((a, b) => b.couvre - a.couvre || (a.ordre || 100) - (b.ordre || 100));
}

/**
 * Les étapes d'une connexion, compte tenu de ce qu'elle doit fournir.
 *
 * Une caisse qui ne sert qu'à lire un catalogue n'a pas d'étape de cohérence :
 * il n'y a pas de chiffre d'affaires à comparer.
 */
export function etapesDeConnexion(capacites = []) {
  const a = new Set(capacites);
  return ETAPES_CONNEXION.filter((e) => !e.capacites || e.capacites.some((c) => a.has(c)));
}

/**
 * Le parcours complet : les étapes du client, puis celles de chaque caisse.
 *
 * `groupes` est la liste des groupes de boutiques, un par caisse. Sans aucun
 * groupe, on rend les seules étapes du client — c'est l'état d'un parcours
 * qui vient de commencer et n'a pas encore décrit son parc.
 */
export function construireParcours({ modules = [], groupes = [] } = {}) {
  const { requises, optionnelles, toutes } = capacitesRequises(modules);
  const etapes = ETAPES_CLIENT.map((e) => ({ ...e, connexion: null }));

  for (const [i, g] of groupes.entries()) {
    // Ce que cette caisse doit fournir : ce dont on a besoin, dans la limite
    // de ce qu'elle sait faire. Une caisse qui ne donne pas les boutiques ne
    // porte pas l'étape de rapprochement.
    const offertes = new Set(g.capacites || toutes);
    const aFournir = toutes.filter((c) => offertes.has(c));
    for (const e of etapesDeConnexion(aFournir)) {
      etapes.push({
        ...e,
        // Un rang par groupe, pour que les étapes d'une même caisse se suivent
        // sans se mélanger à celles de la suivante.
        ordre: e.ordre + i * 1000,
        connexion: g.cle || g.id || `groupe-${i + 1}`,
        connexion_nom: g.nom || g.connecteur || null,
      });
    }
  }

  if (groupes.length > 0) etapes.push({ ...ETAPE_FIN, connexion: null });

  return {
    capacites: { requises, optionnelles },
    etapes: etapes.sort((a, b) => a.ordre - b.ordre),
    // Le chiffre qui rassure à l'écran des modules : combien de fois il
    // faudra brancher quelque chose.
    connexions: groupes.length,
  };
}

/**
 * Ce qui reste à faire, et où.
 *
 * Le parcours n'est pas une ligne mais une colonne par caisse : on peut en
 * terminer une et laisser la suivante en attente d'une clé d'API. C'est cette
 * fonction qui dit au client ce qu'il peut avancer tout de suite.
 */
export function avancement(etapes = [], faites = []) {
  const faite = new Set(faites);
  const parConnexion = new Map();

  for (const e of etapes) {
    const cle = e.connexion || '__client';
    if (!parConnexion.has(cle)) {
      parConnexion.set(cle, { connexion: e.connexion, nom: e.connexion_nom, etapes: [], faites: 0 });
    }
    const groupe = parConnexion.get(cle);
    const estFaite = faite.has(`${cle}:${e.cle}`) || faite.has(e.cle);
    groupe.etapes.push({ ...e, faite: estFaite });
    if (estFaite) groupe.faites += 1;
  }

  const colonnes = [...parConnexion.values()].map((g) => ({
    ...g,
    total: g.etapes.length,
    // La première non faite : c'est là qu'on reprend.
    courante: g.etapes.find((e) => !e.faite) || null,
    terminee: g.etapes.every((e) => e.faite),
  }));

  return {
    colonnes,
    terminees: colonnes.filter((c) => c.terminee).length,
    total: colonnes.length,
    // Le parcours entier est fini quand chaque colonne l'est.
    fini: colonnes.length > 0 && colonnes.every((c) => c.terminee),
  };
}
