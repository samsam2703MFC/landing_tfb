#!/usr/bin/env node
/**
 * Exporte le contenu réel du site en Markdown lisible.
 *
 * Sert à donner les vrais textes à quelqu'un qui ne lira pas du JavaScript —
 * un maquettiste, un traducteur, un relecteur. Le fichier produit est un
 * artefact : il se régénère, il ne se modifie pas à la main.
 *
 * Usage :
 *   node exporter-contenu.mjs            depuis contenu-initial.mjs
 *   node exporter-contenu.mjs --base     depuis la base, donc avec les
 *                                        retouches faites dans la console
 */

import { writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { MODULES, SITE } from './contenu-initial.mjs';
import { LEVIERS, lireJson, ouvrir, table } from './lib/db.mjs';

const ICI = dirname(fileURLToPath(import.meta.url));
const CIBLE = resolve(ICI, '..', 'docs', 'contenu-reel.md');

/** La lettre d'un levier à partir de sa clé. */
function lettre(cle) {
  return LEVIERS.find((l) => l.cle === cle)?.lettre || '?';
}

/** « T Trafic · E Expérience », ou un tiret. */
function leviersLisibles(cles) {
  if (!cles || cles.length === 0) return '—';
  return cles.map((c) => `${lettre(c)} ${LEVIERS.find((l) => l.cle === c)?.nom || c}`).join(' · ');
}

/** Relit le contenu depuis la base plutôt que depuis le fichier de départ. */
async function depuisBase() {
  const db = await ouvrir();
  try {
    const modules = await db.requete(`SELECT * FROM ${table('modules')} ORDER BY ordre, nom`);
    const fonctions = await db.requete(`SELECT * FROM ${table('fonctions')} ORDER BY module_id, ordre`);
    const sites = await db.requete(`SELECT * FROM ${table('site')} ORDER BY id LIMIT 1`);

    const parModule = new Map();
    for (const f of fonctions) {
      if (!parModule.has(f.module_id)) parModule.set(f.module_id, []);
      parModule.get(f.module_id).push({ ...f, leviers: lireJson(f.leviers, []) });
    }

    return {
      MODULES: modules.map((m) => ({
        ...m,
        problemes: lireJson(m.problemes, []),
        benefices: lireJson(m.benefices, []),
        stack: lireJson(m.stack, []),
        mots_cles: lireJson(m.mots_cles, []),
        leviers: lireJson(m.leviers, []),
        liens: lireJson(m.liens, []),
        fonctions: parModule.get(m.id) || [],
      })),
      SITE: sites[0]
        ? { ...sites[0], problemes: lireJson(sites[0].problemes, []), reponses: lireJson(sites[0].reponses, []) }
        : SITE,
    };
  } finally {
    await db.fermer();
  }
}

function rendre({ MODULES: modules, SITE: site }) {
  const l = [];

  l.push('# Contenu réel de la landing');
  l.push('');
  l.push('> Fichier **généré** par `pipeline/exporter-contenu.mjs`. Ne pas le modifier :');
  l.push('> la source est `pipeline/contenu-initial.mjs`, ou la console `/admin`.');
  l.push('');

  // ── Les six leviers ──────────────────────────────────────────────────────
  l.push('## Les 6 leviers de gestion');
  l.push('');
  l.push('| Lettre | Clé | Nom | La question |');
  l.push('| --- | --- | --- | --- |');
  for (const lev of LEVIERS) l.push(`| ${lev.lettre} | \`${lev.cle}\` | ${lev.nom} | ${lev.question} |`);
  l.push('');

  // ── Page d'accueil ───────────────────────────────────────────────────────
  l.push('---');
  l.push('');
  l.push("## Page d'accueil");
  l.push('');
  l.push(`**Titre** — ${site.titre}`);
  l.push('');
  l.push(`**Sous-titre** — ${site.sous_titre}`);
  l.push('');
  l.push('**Accroche**');
  l.push('');
  for (const p of String(site.accroche || '').split('\n').filter(Boolean)) l.push(`${p}\n`);
  l.push(`**Bouton** — « ${site.cta_texte} » vers \`${site.cta_url}\``);
  l.push('');
  l.push('### Les problèmes du franchiseur');
  l.push('');
  for (const p of site.problemes || []) l.push(`- **${p.titre}** — ${p.texte}`);
  l.push('');
  l.push('### Nos réponses');
  l.push('');
  for (const r of site.reponses || []) l.push(`- **${r.titre}** — ${r.texte}`);
  l.push('');
  if (site.mermaid) {
    l.push("### Schéma d'ensemble");
    l.push('');
    l.push('```mermaid');
    l.push(site.mermaid);
    l.push('```');
    l.push('');
  }

  // ── Un chapitre par module ───────────────────────────────────────────────
  for (const m of modules) {
    l.push('---');
    l.push('');
    l.push(`## ${m.nom}`);
    l.push('');
    l.push(`\`${m.slug}\` · famille **${m.groupe}** · ordre ${m.ordre} · ${m.fonctions.length} fonctions`);
    l.push('');
    l.push(`**Leviers** — ${leviersLisibles(m.leviers)}`);
    l.push('');
    l.push(`**Public visé** — ${m.public_cible}`);
    l.push('');
    l.push(`**Accroche** (${m.accroche.length} car.) — ${m.accroche}`);
    l.push('');
    l.push(`**Résumé** (${m.resume.length} car.)`);
    l.push('');
    l.push(m.resume);
    l.push('');
    if (m.onboarding) {
      l.push("**Phrase d'onboarding** — " + m.onboarding);
      l.push('');
    }

    l.push('### Ce que ce module fait disparaître');
    l.push('');
    for (const p of m.problemes || []) l.push(`- **${p.titre}** — ${p.texte}`);
    l.push('');

    l.push("### Ce qu'il apporte");
    l.push('');
    for (const b of m.benefices || []) l.push(`- **${b.titre}** — ${b.texte}`);
    l.push('');

    l.push(`### Le menu, entrée par entrée (${m.fonctions.length})`);
    l.push('');
    l.push('| Entrée | Leviers | À quoi elle sert | Le gain |');
    l.push('| --- | --- | --- | --- |');
    for (const f of m.fonctions) {
      const echapper = (t) => String(t || '').replace(/\|/g, '\\|');
      l.push(
        `| **${echapper(f.nom)}**<br>\`${f.cle}\` | ${(f.leviers || []).map(lettre).join(' ') || '—'} | ${echapper(f.description)} | ${echapper(f.benefice)} |`,
      );
    }
    l.push('');

    if ((m.liens || []).length > 0) {
      l.push("### Ce qu'il échange avec les autres modules");
      l.push('');
      for (const lien of m.liens) {
        l.push(`- ${lien.sens === 'envoie' ? 'envoie vers' : 'reçoit de'} **${lien.slug}** : ${lien.quoi}`);
      }
      l.push('');
    }

    l.push('### Description longue');
    l.push('');
    l.push(m.description);
    l.push('');

    if (m.mermaid) {
      l.push('### Schéma');
      l.push('');
      l.push('```mermaid');
      l.push(m.mermaid);
      l.push('```');
      l.push('');
    }
  }

  // ── Les volumes, pour dimensionner une maquette ──────────────────────────
  const nb = (t) => (t || []).length;
  const bornes = (valeurs) => `${Math.min(...valeurs)} à ${Math.max(...valeurs)}`;
  const toutesFonctions = modules.flatMap((m) => m.fonctions);

  l.push('---');
  l.push('');
  l.push('## Volumes — ce qu\'une mise en page doit encaisser');
  l.push('');
  l.push('| Élément | Étendue |');
  l.push('| --- | --- |');
  l.push(`| Modules | ${modules.length} |`);
  l.push(`| Familles | ${[...new Set(modules.map((m) => m.groupe))].join(', ')} |`);
  l.push(`| Fonctions par module | ${bornes(modules.map((m) => m.fonctions.length))} |`);
  l.push(`| Leviers par module | ${bornes(modules.map((m) => nb(m.leviers)))} |`);
  l.push(`| Liens par module | ${bornes(modules.map((m) => nb(m.liens)))} |`);
  l.push(`| Problèmes par module | ${bornes(modules.map((m) => nb(m.problemes)))} |`);
  l.push(`| Bénéfices par module | ${bornes(modules.map((m) => nb(m.benefices)))} |`);
  l.push(`| Accroche (caractères) | ${bornes(modules.map((m) => m.accroche.length))} |`);
  l.push(`| Résumé (caractères) | ${bornes(modules.map((m) => m.resume.length))} |`);
  l.push(`| Description (caractères) | ${bornes(modules.map((m) => m.description.length))} |`);
  l.push(`| Nom de fonction (caractères) | ${bornes(toutesFonctions.map((f) => f.nom.length))} |`);
  l.push(`| Description de fonction (caractères) | ${bornes(toutesFonctions.map((f) => (f.description || '').length))} |`);
  l.push('');
  const plusLong = [...modules].sort((a, b) => b.fonctions.length - a.fonctions.length)[0];
  const plusCourt = [...modules].sort((a, b) => a.fonctions.length - b.fonctions.length)[0];
  l.push(
    `Le cas de test d'une maquette : **${plusLong.nom}** et ses ${plusLong.fonctions.length} entrées de menu, ` +
      `à côté de **${plusCourt.nom}** qui en a ${plusCourt.fonctions.length}. Les deux dans la même mise en page.`,
  );
  l.push('');

  return l.join('\n');
}

async function principal() {
  const source = process.argv.includes('--base') ? await depuisBase() : { MODULES, SITE };
  await writeFile(CIBLE, rendre(source), 'utf8');
  const total = source.MODULES.reduce((n, m) => n + m.fonctions.length, 0);
  console.log(`✓ ${CIBLE} écrit — ${source.MODULES.length} modules, ${total} fonctions.`);
}

principal().catch((err) => {
  console.error(`\n✗ Export interrompu : ${err.message}`);
  process.exit(1);
});
