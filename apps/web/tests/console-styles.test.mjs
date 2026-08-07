/**
 * Les tests de la feuille de style de la console.
 *
 * Trois défauts se sont produits, chacun deux ou trois fois, et aucun ne se
 * voit en relisant le diff — il faut avoir la page sous les yeux :
 *
 *  · une classe du gabarit redéfinie dans le `is:global` d'un écran. Astro
 *    empaquette les styles globaux par page : la redéfinition ne casse que
 *    les écrans où elle voyage, donc jamais celui qu'on regarde en la
 *    écrivant. `.filtres`, `.cartouches`, `.puce` y sont passés ;
 *
 *  · une variable inventée. `var(--blanc)` sans repli ne dessine pas du
 *    blanc : la déclaration est invalide, le fond disparaît. Avec un repli,
 *    c'est plus sournois encore — la couleur est juste, mais elle ne suit
 *    plus la marque ;
 *
 *  · une table de cinq colonnes sans conteneur qui roule. Au bureau on ne
 *    voit rien ; sur un téléphone, les colonnes s'écrasent les unes contre
 *    les autres.
 *
 * Ces trois-là se lisent sur le disque, donc ils se testent.
 */
import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const RACINE = join(dirname(fileURLToPath(import.meta.url)), '..');
const SRC = join(RACINE, 'src');
const ADMIN = join(SRC, 'pages', 'admin');

/** Tous les fichiers d'une extension sous un dossier. */
function fichiers(dossier, ext) {
  const trouves = [];
  for (const nom of readdirSync(dossier)) {
    const chemin = join(dossier, nom);
    if (statSync(chemin).isDirectory()) trouves.push(...fichiers(chemin, ext));
    else if (nom.endsWith(ext)) trouves.push(chemin);
  }
  return trouves;
}

const dit = (chemin) => relative(SRC, chemin);

/** Les blocs `<style>` d'un fichier, globaux seulement ou tous. */
function blocsStyle(source, globauxSeulement) {
  const blocs = [];
  for (const m of source.matchAll(/<style([^>]*)>([\s\S]*?)<\/style>/g)) {
    if (globauxSeulement && !m[1].includes('is:global')) continue;
    blocs.push(m[2]);
  }
  return blocs;
}

/** Le même bloc sans ses commentaires : on ne cite pas une classe, on la pose. */
const sansCommentaires = (bloc) => bloc.replace(/\/\*[\s\S]*?\*\//g, '');

/**
 * Les classes qu'un bloc définit *à la racine d'un sélecteur*, c'est-à-dire
 * celles dont il fixe l'apparence de base. `.bloc__tete .actions { … }` ne
 * compte pas : c'est un ajustement de contexte, il ne voyage pas.
 */
function classesDeBase(bloc) {
  const trouvees = new Set();
  for (const m of sansCommentaires(bloc).matchAll(/(^|[{}]|,)\s*\.([a-zA-Z_][\w-]*)((::?[a-zA-Z-]+(\([^)]*\))?)*)\s*(?=[,{])/g)) {
    trouvees.add(m[2]);
  }
  return trouvees;
}

const CONSOLE = readFileSync(join(SRC, 'components', 'Console.astro'), 'utf8');
const CLASSES_CONSOLE = blocsStyle(CONSOLE, true).reduce(
  (acc, b) => new Set([...acc, ...classesDeBase(b)]),
  new Set(),
);

/** Les écrans de la console, qui portent tous le gabarit `Console.astro`. */
const ECRANS = fichiers(ADMIN, '.astro');

describe('la feuille de style de la console', () => {
  it('a bien été trouvée, sinon les tests suivants ne prouvent rien', () => {
    assert.ok(CLASSES_CONSOLE.size > 100, `${CLASSES_CONSOLE.size} classes seulement`);
    assert.ok(CLASSES_CONSOLE.has('etat'));
    assert.ok(CLASSES_CONSOLE.has('bouton'));
    assert.ok(ECRANS.length > 30, `${ECRANS.length} écrans seulement`);
  });

  it('n’est jamais redéfinie à la racine par le `is:global` d’un écran', () => {
    // L'impression fait exception : masquer le rail et les boutons pour ne
    // laisser que le contrat sur le papier est précisément ce qu'on veut, et
    // ça n'a lieu que sous `@media print`.
    const fautes = [];
    for (const f of ECRANS) {
      for (const bloc of blocsStyle(readFileSync(f, 'utf8'), true)) {
        const horsImpression = bloc.replace(/@media\s+print\s*\{[\s\S]*?\n\s*\}/g, '');
        for (const c of classesDeBase(horsImpression)) {
          if (CLASSES_CONSOLE.has(c)) fautes.push(`${dit(f)} → .${c}`);
        }
      }
    }
    assert.deepEqual(fautes, [], `à déplacer dans Console.astro, ou à renommer :\n  ${fautes.join('\n  ')}`);
  });

  it('n’appelle que des variables qui existent', () => {
    // Y compris avec un repli : le repli sauve la couleur du jour, pas la
    // marque du lendemain.
    const declarees = new Set();
    const sources = [...fichiers(SRC, '.astro'), ...fichiers(SRC, '.css')];
    for (const f of sources) {
      for (const m of readFileSync(f, 'utf8').matchAll(/(?:^|[;{"`])\s*(--[a-z0-9-]+)\s*:/gm)) declarees.add(m[1]);
    }

    const fautes = new Map();
    for (const f of sources) {
      for (const m of readFileSync(f, 'utf8').matchAll(/var\(\s*(--[a-z0-9-]+)/g)) {
        if (!declarees.has(m[1])) fautes.set(m[1], (fautes.get(m[1]) || new Set()).add(dit(f)));
      }
    }
    const dites = [...fautes].map(([v, fs]) => `${v} (${[...fs].join(', ')})`);
    assert.deepEqual(dites, [], `variables citées et jamais déclarées :\n  ${dites.join('\n  ')}`);
  });

  it('ne pose une pastille d’état que dans le vocabulaire défini', () => {
    // Cinq écrans s'étaient fabriqué un rouge chacun — `--ko`, `--rouge` —,
    // sur des variables parfois inexistantes.
    const fautes = [];
    for (const f of ECRANS) {
      const source = readFileSync(f, 'utf8');
      const locales = blocsStyle(source, false).reduce(
        (acc, b) => new Set([...acc, ...classesDeBase(b)]),
        new Set(),
      );
      for (const m of source.matchAll(/class(?::list)?=[{"'[\s]*[^>]*?\betat--([a-z]+)/g)) {
        const nom = `etat--${m[1]}`;
        if (!CLASSES_CONSOLE.has(nom) && !locales.has(nom)) fautes.push(`${dit(f)} → .${nom}`);
      }
    }
    assert.deepEqual(fautes, [], `pastilles employées et jamais définies :\n  ${fautes.join('\n  ')}`);
  });

  it('fait rouler toutes ses tables plutôt que de les écraser', () => {
    const fautes = [];
    for (const f of ECRANS) {
      const source = readFileSync(f, 'utf8');
      for (const m of source.matchAll(/<table/g)) {
        // Le conteneur s'écrit `class="roule"` et rien d'autre — la console
        // n'en connaît pas d'autre orthographe. On cherche la classe entière :
        // `pas-roule` contient « roule » sans rien faire rouler du tout.
        const avant = source.slice(Math.max(0, m.index - 400), m.index);
        if (!/class="(?:[^"]*\s)?roule(?:\s[^"]*)?"/.test(avant)) {
          fautes.push(`${dit(f)}:${source.slice(0, m.index).split('\n').length}`);
        }
      }
    }
    assert.deepEqual(fautes, [], `tables à entourer d'un <div class="roule"> :\n  ${fautes.join('\n  ')}`);
  });
});
