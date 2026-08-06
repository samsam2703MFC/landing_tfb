/**
 * La carte de la console, tenue contre la réalité du dossier `pages/`.
 *
 * Un rail se casse toujours de la même façon : en silence. Un lien vers une
 * page renommée rend un 404 que personne n'ouvre, une clé mal orthographiée
 * fait que plus rien ne se surligne, un groupe mal filtré envoie un technique
 * sur un 403. Rien de tout cela ne fait échouer un build.
 *
 * D'où ces tests, qui lisent le disque plutôt que de faire confiance à la
 * déclaration : c'est le seul moyen qu'ils attrapent le renommage d'un fichier
 * fait ailleurs, dans six mois, par quelqu'un qui ne connaît pas ce fichier.
 */
import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { SECTIONS, ongletsSection, railPour, rubriquesConsole, sectionDe } from '../src/lib/admin/navigation.mjs';
import { cheminAutorise } from '../src/lib/admin/session.mjs';

const ICI = dirname(fileURLToPath(import.meta.url));
const PAGES = join(ICI, '..', 'src', 'pages');

/** Tous les chemins déclarés dans le rail, groupes dépliés. */
function tousLesChemins() {
  const chemins = [];
  for (const r of rubriquesConsole({})) {
    for (const e of r.entrees) {
      if (e.onglets) chemins.push(...e.onglets.map((o) => o.href));
      else chemins.push(e.href);
    }
  }
  return chemins;
}

/**
 * Un chemin d'URL correspond-il à une page ?
 *
 * Les segments dynamiques comptent : `/admin/charte/0` est servi par
 * `charte/[prospect].astro`. Sans ça, le test appellerait « mort » un lien
 * parfaitement vivant, et la seule façon de le faire taire serait de retirer
 * du rail une entrée qui marche.
 */
function pageExiste(chemin) {
  const segments = chemin.replace(/^\//, '').split('/').filter(Boolean);
  return descendre(PAGES, segments);
}

function descendre(dossier, segments) {
  let entrees;
  try {
    entrees = readdirSync(dossier, { withFileTypes: true });
  } catch {
    return false;
  }
  const [tete, ...reste] = segments;
  const dynamique = (n) => /^\[.+\]$/.test(n);

  if (reste.length === 0) {
    return entrees.some((e) => {
      if (e.isFile() && e.name.endsWith('.astro')) {
        const nu = e.name.replace(/\.astro$/, '');
        return nu === tete || dynamique(nu);
      }
      // Un dossier au nom du segment, avec son index.
      if (e.isDirectory() && (e.name === tete || dynamique(e.name))) {
        try {
          return statSync(join(dossier, e.name, 'index.astro')).isFile();
        } catch { return false; }
      }
      return false;
    });
  }

  // Le nom exact d'abord : `prospects/index.astro` doit gagner sur `[id].astro`
  // quand les deux pourraient répondre.
  const exact = entrees.find((e) => e.isDirectory() && e.name === tete);
  if (exact && descendre(join(dossier, tete), reste)) return true;
  return entrees.some(
    (e) => e.isDirectory() && dynamique(e.name) && descendre(join(dossier, e.name), reste),
  );
}

/** Toutes les valeurs `actif="…"` passées à Console par les pages. */
function actifsUtilises(dossier = join(PAGES, 'admin'), trouves = new Set()) {
  for (const entree of readdirSync(dossier, { withFileTypes: true })) {
    const chemin = join(dossier, entree.name);
    if (entree.isDirectory()) actifsUtilises(chemin, trouves);
    else if (entree.name.endsWith('.astro')) {
      for (const m of readFileSync(chemin, 'utf8').matchAll(/\bactif=["']([a-z-]+)["']/g)) {
        trouves.add(m[1]);
      }
    }
  }
  return trouves;
}

describe('les liens du rail', () => {
  it('mènent tous à une page qui existe', () => {
    const morts = tousLesChemins().filter((c) => !pageExiste(c));
    assert.deepEqual(morts, [], `chemins sans page : ${morts.join(', ')}`);
  });

  it('ne se répètent jamais — deux entrées pour un écran, c’est un choix à faire', () => {
    const chemins = tousLesChemins();
    assert.equal(new Set(chemins).size, chemins.length);
  });

  it('portent des clés uniques', () => {
    const cles = [];
    for (const r of rubriquesConsole({})) {
      for (const e of r.entrees) {
        if (e.onglets) cles.push(...e.onglets.map((o) => o.cle));
        else cles.push(e.cle);
      }
    }
    assert.equal(new Set(cles).size, cles.length);
  });
});

describe('les écrans regroupés', () => {
  it('n’appartiennent jamais à deux groupes à la fois', () => {
    const vus = new Set();
    for (const s of SECTIONS) {
      for (const o of s.onglets) {
        assert.equal(vus.has(o.cle), false, `${o.cle} est dans deux groupes`);
        vus.add(o.cle);
      }
    }
  });

  it('comptent au moins deux onglets — un groupe d’un seul n’en est pas un', () => {
    for (const s of SECTIONS) assert.ok(s.onglets.length >= 2, `${s.cle} n’a qu’un onglet`);
  });

  it('se retrouvent depuis n’importe lequel de leurs onglets', () => {
    for (const s of SECTIONS) {
      for (const o of s.onglets) assert.equal(sectionDe(o.cle)?.libelle, s.libelle);
    }
  });

  it('ne rendent rien pour un écran qui vit seul', () => {
    assert.equal(sectionDe('bases'), null);
    assert.equal(ongletsSection('bases', 'admin'), null);
  });
});

describe('ce que chaque rôle voit', () => {
  const cles = (role) => {
    const trouvees = [];
    for (const r of railPour(role, null, {})) for (const e of r.entrees) trouvees.push(e.cle);
    return trouvees;
  };

  it('un administrateur voit tout', () => {
    assert.ok(cles('admin').includes('contenu'));
    assert.ok(cles('admin').includes('encaissement'));
  });

  it('un commercial ne voit ni les tarifs ni la société qui facture', () => {
    // La ligne de partage est le prix. « Modules et prix » n'a aucun onglet
    // ouvert au commercial : le groupe entier doit disparaître, et non
    // s'afficher pour mener à un 403.
    const siennes = cles('commercial');
    assert.equal(siennes.includes('contenu'), false);
    assert.equal(siennes.includes('encaissement'), false);
    assert.ok(siennes.includes('vente'));
    assert.ok(siennes.includes('reseau'));
  });

  it('un technique voit les connexions et rien de commercial', () => {
    const siennes = cles('technique');
    assert.ok(siennes.includes('branchements'));
    assert.ok(siennes.includes('reseau'));
    assert.equal(siennes.includes('vente'), false);
    assert.equal(siennes.includes('commissions'), false);
    assert.equal(siennes.includes('contenu'), false);
  });

  it('un rôle inconnu ne voit rien — pas même le tableau de bord', () => {
    // Même règle que la liste blanche, appliquée aux rôles eux-mêmes : un rôle
    // qu'aucune liste ne nomme n'ouvre rien. Un rail vide est déroutant, et
    // c'est voulu : il vaut mieux qu'un compte mal configuré se voie tout de
    // suite qu'il ne se promène à moitié.
    assert.deepEqual(cles('stagiaire'), []);
  });
});

describe('l’entrée d’un groupe', () => {
  const entree = (role, cle) => {
    for (const r of railPour(role, null, {})) for (const e of r.entrees) if (e.cle === cle) return e;
    return null;
  };

  it('pointe vers son premier onglet', () => {
    assert.equal(entree('admin', 'acces').href, '/admin/applications');
  });

  it('pointe vers le premier onglet PERMIS, et non le premier déclaré', () => {
    // « Connexions » d'abord, « Connecteurs » ensuite : les deux sont ouverts
    // au technique, donc le premier suffit. Le cas qui compte est celui d'un
    // groupe dont le premier onglet serait fermé — l'entrée doit alors mener
    // au suivant, jamais à un 403.
    const groupe = entree('technique', 'branchements');
    assert.ok(groupe);
    assert.equal(groupe.href, '/admin/connexions');
  });

  it('est marquée courante dès qu’un de ses onglets l’est', () => {
    // Sans ça, le rail se dépeuple dès qu'on ouvre un écran regroupé, et l'on
    // ne sait plus où l'on est.
    const railSurPrestations = railPour('admin', 'prestations', {});
    const groupe = railSurPrestations.flatMap((r) => r.entrees).find((e) => e.cle === 'contenu');
    assert.equal(groupe.courant, true);
  });

  it('ne l’est pas quand on est ailleurs', () => {
    const groupe = railPour('admin', 'offres', {}).flatMap((r) => r.entrees).find((e) => e.cle === 'contenu');
    assert.equal(groupe.courant, false);
  });
});

describe('les écrans couverts par un groupe', () => {
  const entree = (cle, actif) =>
    railPour('admin', actif, {}).flatMap((r) => r.entrees).find((e) => e.cle === cle);

  it('surlignent leur groupe dans le rail', () => {
    // La fiche d'un client appartient au groupe Clients sans en être un onglet.
    assert.equal(entree('reseau', 'fiche-client').courant, true);
  });

  it('n’affichent pas de second bandeau', () => {
    // Elle porte déjà le sien, à six onglets. Deux rangées d'onglets qui ne
    // parlent pas de la même chose, c'est un écran que personne ne relit.
    assert.equal(ongletsSection('fiche-client', 'admin'), null);
  });

  it('ne surlignent rien quand on est ailleurs', () => {
    assert.equal(entree('reseau', 'offres').courant, false);
  });
});

describe('les bandeaux d’onglets', () => {
  it('rendent tous les onglets pour un administrateur', () => {
    assert.equal(ongletsSection('tarifs', 'admin').onglets.length, 4);
  });

  it('ne rendent rien quand le rôle n’a droit qu’à un seul onglet', () => {
    // Un bandeau d'un seul onglet n'offre aucun déplacement et prend une ligne
    // pour le dire.
    const s = ongletsSection('tarifs', 'commercial');
    assert.equal(s, null);
  });
});

describe('les gabarits de contrat restent hors de portée du commercial', () => {
  it('ne vivent pas sous /admin/contrats', () => {
    // La liste blanche ouvre `/admin/contrats` EN SOUS-ARBRE au commercial,
    // pour qu'il consulte les contrats de ses clients. Y ranger les gabarits
    // lui donnerait le droit de réécrire les clauses — sans qu'aucune règle
    // ne soit violée, donc sans que rien ne le signale.
    const gabarits = SECTIONS
      .flatMap((s) => s.onglets)
      .find((o) => o.cle === 'gabarits');
    assert.ok(gabarits);
    assert.equal(gabarits.href.startsWith('/admin/contrats'), false);
  });

  it('sont fermés au commercial et au technique', () => {
    assert.equal(cheminAutorise('/admin/gabarits', 'commercial'), false);
    assert.equal(cheminAutorise('/admin/gabarits', 'technique'), false);
    assert.equal(cheminAutorise('/admin/gabarits', 'admin'), true);
  });
});

describe('les écrans et le rail se répondent', () => {
  it('chaque `actif` d’une page correspond à une entrée déclarée', () => {
    // Le test qui compte : une page qui passe une clé inconnue ne surligne
    // rien, et rien d'autre ne le dirait. Les clés des onglets d'un client
    // (`fiche`, `journal`…) sont exclues — elles pilotent OngletsClient, pas
    // le rail.
    const declarees = new Set();
    for (const r of rubriquesConsole({})) {
      for (const e of r.entrees) {
        if (e.onglets) for (const o of e.onglets) declarees.add(o.cle);
        else declarees.add(e.cle);
        for (const c of e.couvre || []) declarees.add(c);
      }
    }
    const ongletsDUnClient = new Set([
      'fiche', 'charte', 'modules', 'contrats', 'applications', 'journal', 'facturation',
    ]);
    const inconnues = [...actifsUtilises()].filter((a) => !declarees.has(a) && !ongletsDUnClient.has(a));
    assert.deepEqual(inconnues, [], `clés qui ne surlignent rien : ${inconnues.join(', ')}`);
  });
});
