/**
 * Routine matinale — prompt_technique_tfb.md §6.
 *
 * Ingère un dépôt comme module de la landing : ligne tfb_modules, traductions,
 * captures d'écran, tfb_module_screenshots. La landing l'affiche ensuite sans
 * autre intervention.
 *
 *   npm run ingest -- --repo owner/nom
 *   npm run ingest -- --repo owner/nom --url https://atelier.tfbuddy.com
 *   npm run ingest -- --repo owner/nom --url http://localhost:3001 --routes /,/login
 *   npm run ingest -- --repo owner/nom --dry-run
 *
 * Idempotent : relancé sur le même dépôt, il met à jour au lieu de dupliquer.
 * Les captures précédentes sont remplacées, pas empilées.
 *
 * Le contenu éditorial vient de `tfb-module.json` à la racine du dépôt (voir
 * docs/tfb-module.schema.md). Sans lui, le module est créé en brouillon : il
 * n'apparaît pas sur la landing tant qu'un nom français n'existe pas, plutôt que
 * d'y afficher une clé technique.
 */
import { PrismaClient } from '@prisma/client';
import { mkdtemp, readFile, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import {
  parseRepo, localRepo, toModuleKey, validateManifest, DEFAULT_ICON,
  type ModuleManifest, type RepoRef,
} from './lib/module-meta';
import { captureRoutes, PlaywrightMissing } from './lib/capture';
import { deleteUpload } from '../src/lib/storage';

const run = promisify(execFile);
const prisma = new PrismaClient();

const DEFAULT_LOCALE = process.env.DEFAULT_LOCALE || 'fr';
const STORAGE_ROOT = process.env.STORAGE_PATH || './storage';
const LIST_SEPARATOR = '|';

interface Args {
  repo?: string;
  path?: string;
  url?: string;
  routes?: string;
  key?: string;
  group?: string;
  icon?: string;
  dryRun: boolean;
  activate: boolean;
  insecure: boolean;
  cookies: { name: string; value: string }[];
}

/**
 * `nom=valeur`, séparés par des points-virgules — la forme d'un en-tête Cookie,
 * pour qu'on puisse copier celui du navigateur tel quel.
 */
function parseCookies(raw: string): { name: string; value: string }[] {
  return raw.split(';').map((pair) => {
    const eq = pair.indexOf('=');
    if (eq < 1) return null;
    return { name: pair.slice(0, eq).trim(), value: pair.slice(eq + 1).trim() };
  }).filter((c): c is { name: string; value: string } => c !== null && c.name.length > 0);
}

function parseArgs(argv: string[]): Args {
  // Un jeton de session passé en argument est lisible dans `ps` par n'importe
  // quel utilisateur de la machine. La variable d'environnement ne l'est pas :
  // c'est la voie recommandée, le drapeau reste là pour le dépannage.
  const args: Args = {
    dryRun: false, activate: true, insecure: false,
    cookies: process.env.TFB_CAPTURE_COOKIE ? parseCookies(process.env.TFB_CAPTURE_COOKIE) : [],
  };
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    const next = () => argv[++i];
    if (a === '--repo') args.repo = next();
    else if (a === '--path') args.path = next();
    else if (a === '--url') args.url = next();
    else if (a === '--routes') args.routes = next();
    else if (a === '--key') args.key = next();
    else if (a === '--group') args.group = next();
    else if (a === '--icon') args.icon = next();
    else if (a === '--dry-run') args.dryRun = true;
    else if (a === '--no-activate') args.activate = false;
    else if (a === '--insecure') args.insecure = true;
    else if (a === '--cookie') args.cookies = parseCookies(next() ?? '');
  }
  return args;
}

const say = (m: string) => console.log(`\n\x1b[1m== ${m}\x1b[0m`);
const ok = (m: string) => console.log(`   \x1b[32m✓\x1b[0m ${m}`);
const warn = (m: string) => console.log(`   \x1b[33m!\x1b[0m ${m}`);
const bad = (m: string) => console.log(`   \x1b[31m\u2717\x1b[0m ${m}`);

/**
 * Lit tfb-module.json : depuis un répertoire local s'il y en a un, sinon depuis
 * un clone superficiel. Le clone est supprimé dans tous les cas ; un répertoire
 * local n'est jamais touché.
 */
type SourceStatus = 'ok' | 'no-manifest' | 'unreadable';

async function readManifest(repo: RepoRef): Promise<{ manifest: ModuleManifest; status: SourceStatus }> {
  let dir = repo.localPath;
  let temporary: string | null = null;

  try {
    // 1. Atteindre la source. Un échec ici est une panne — dépôt renommé,
    //    droits perdus, répertoire disparu — jamais un état publiable.
    if (dir) {
      const info = await stat(dir).catch(() => null);
      if (!info?.isDirectory()) {
        bad(`Répertoire introuvable : ${dir}`);
        return { manifest: {}, status: 'unreadable' };
      }
    } else {
      temporary = await mkdtemp(path.join(tmpdir(), 'tfb-ingest-'));
      dir = temporary;
      try {
        await run('git', ['clone', '--depth', '1', '--quiet', repo.cloneUrl, dir], { timeout: 120_000 });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        bad(`Dépôt injoignable : ${message.split('\n')[0]}`);
        return { manifest: {}, status: 'unreadable' };
      }
    }

    // 2. Lire le manifeste. Son absence est légitime : le dépôt existe, il n'a
    //    simplement pas encore déclaré sa fiche.
    let raw: string;
    try {
      raw = await readFile(path.join(dir, 'tfb-module.json'), 'utf8');
    } catch {
      warn(`Pas de tfb-module.json dans ${repo.localPath ?? 'le dépôt'}.`);
      return { manifest: {}, status: 'no-manifest' };
    }

    // 3. Un manifeste présent mais illisible est une faute à corriger, pas un
    //    brouillon à publier.
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch (error) {
      bad(`tfb-module.json illisible : ${error instanceof Error ? error.message : String(error)}`);
      return { manifest: {}, status: 'unreadable' };
    }

    const { manifest, issues } = validateManifest(parsed);
    for (const issue of issues) warn(`tfb-module.json — ${issue.message}`);
    return { manifest, status: 'ok' };
  } finally {
    if (temporary) await rm(temporary, { recursive: true, force: true });
  }
}

/** Écrit les traductions d'un module, une locale à la fois. */
async function writeTranslations(moduleId: number, manifest: ModuleManifest): Promise<number> {
  if (!manifest.content) return 0;
  let written = 0;

  for (const [locale, copy] of Object.entries(manifest.content)) {
    const fields: [string, string | undefined][] = [
      ['name', copy.name],
      ['description', copy.description],
      ['bullets', copy.bullets?.join(LIST_SEPARATOR)],
      ['metric_value', copy.metricValue],
      ['metric_label', copy.metricLabel],
    ];
    for (const [field, value] of fields) {
      if (!value) continue;
      await prisma.translation.upsert({
        where: { entityType_entityId_field_languageCode: { entityType: 'module', entityId: moduleId, field, languageCode: locale } },
        create: { entityType: 'module', entityId: moduleId, field, languageCode: locale, value },
        update: { value },
      });
      written += 1;
    }
  }
  return written;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  if (!args.repo && !args.path) {
    console.error('Usage : npm run ingest -- --repo <owner/nom|url> | --path <répertoire>');
    console.error('        [--url <app>] [--routes /,/login] [--key k] [--group G] [--icon i]');
    console.error('        [--insecure] [--cookie "nom=valeur"] [--dry-run]');
    process.exit(2);
  }

  let repo: RepoRef | null;
  if (args.path) {
    // Le code est déjà sur la machine : pas de clone, pas d'identifiants.
    repo = localRepo(args.path, args.repo);
  } else {
    repo = parseRepo(args.repo!);
    if (!repo) {
      console.error(`Dépôt non reconnu : « ${args.repo} ». Attendu : owner/nom, une URL https, ou git@host:owner/nom.`);
      process.exit(2);
    }
  }

  say('Source');
  ok(repo.localPath ? `${repo.localPath} (répertoire local)` : repo.slugPath);

  say('Manifeste');
  const { manifest, status } = await readManifest(repo);
  if (status === 'ok') ok('tfb-module.json lu');
  // Rien n'est écrit sur une source qu'on n'a pas pu lire. Sur une tournée de
  // quinze dépôts, l'inverse créerait une ligne fantôme par dépôt renommé — et
  // le rapport annoncerait tout vert.
  if (status === 'unreadable') {
    console.error('\nAucune écriture : la source n\'a pas pu être lue.');
    process.exit(1);
  }

  const key = args.key || manifest.key || toModuleKey(repo.name);
  const slug = manifest.slug || key;
  const group = args.group || manifest.group || null;
  const icon = args.icon || manifest.icon || DEFAULT_ICON;
  const frName = manifest.content?.[DEFAULT_LOCALE]?.name;

  ok(`clé « ${key} », slug « ${slug} », groupe ${group ?? '—'}, icône ${icon}`);
  if (!frName) warn(`Aucun nom ${DEFAULT_LOCALE.toUpperCase()} : le module restera en brouillon.`);

  if (args.dryRun) {
    say('Simulation');
    console.log(JSON.stringify({ key, slug, group, icon, repo: repo.slugPath, content: manifest.content, routes: manifest.routes }, null, 2));
    ok('Rien n’a été écrit (--dry-run).');
    return;
  }

  say('tfb_modules');
  const existing = await prisma.module.findUnique({ where: { key } });
  const last = await prisma.module.findFirst({ orderBy: { sortOrder: 'desc' } });

  const moduleRow = await prisma.module.upsert({
    where: { key },
    create: {
      key, slug, icon, moduleGroup: group, repo: repo.slugPath,
      redirectUrl: manifest.redirectUrl || `/modules/${slug}`,
      isNew: true,
      // Un module sans nom traduit afficherait sa clé technique sur la landing.
      isActive: args.activate && Boolean(frName),
      sortOrder: (last?.sortOrder ?? 0) + 1,
    },
    update: {
      slug, icon, moduleGroup: group, repo: repo.slugPath,
      redirectUrl: manifest.redirectUrl || `/modules/${slug}`,
      ...(args.activate && frName ? { isActive: true } : {}),
    },
  });
  ok(existing ? `mis à jour (id ${moduleRow.id})` : `créé (id ${moduleRow.id})`);
  if (!moduleRow.isActive) warn('Inactif : invisible sur la landing tant qu’un nom FR manque.');

  say('tfb_translations');
  const written = await writeTranslations(moduleRow.id, manifest);
  ok(`${written} valeur(s) écrite(s)`);

  const routes = args.routes ? args.routes.split(',').map((r) => r.trim()).filter(Boolean) : manifest.routes;
  if (!args.url || !routes?.length) {
    say('Captures');
    warn(args.url ? 'Aucune route à capturer (--routes ou "routes" dans le manifeste).' : 'Pas d’--url : captures ignorées.');
    ok('Terminé.');
    return;
  }

  say('Captures');
  if (args.insecure) warn('--insecure : certificat TLS non vérifié. Réservé aux captures internes.');
  if (args.cookies.length) ok(`session : ${args.cookies.map((c) => c.name).join(', ')}`);
  const outDir = path.resolve(STORAGE_ROOT, 'screenshots');
  let results;
  try {
    results = await captureRoutes({
      baseUrl: args.url, routes, moduleKey: key, outDir,
      ignoreHttpsErrors: args.insecure, cookies: args.cookies,
    });
    // PLAYWRIGHT_CHROMIUM_PATH est lu par captureRoutes si défini.
  } catch (error) {
    if (error instanceof PlaywrightMissing) {
      warn(error.message);
      ok('Module ingéré sans captures.');
      return;
    }
    throw error;
  }

  for (const r of results) {
    if (!r.storagePath) { warn(`${r.route} — échec : ${r.error}`); continue; }
    ok(`${r.route} → ${r.storagePath}`);
    // Redirigé veut presque toujours dire « pas de session » : la capture est
    // techniquement réussie et montre un écran de connexion.
    if (r.redirectedTo) warn(`  redirigé vers ${r.redirectedTo} — session absente ou expirée ?`);
  }

  const captured = results.filter((r) => r.storagePath);
  if (captured.length === 0) {
    warn('Aucune capture réussie — les lignes existantes sont conservées.');
    return;
  }

  say('tfb_module_screenshots');
  // On remplace le carrousel plutôt que d'y empiler : relancer la routine doit
  // rafraîchir les captures, pas allonger la liste indéfiniment.
  const previous = await prisma.moduleScreenshot.findMany({ where: { moduleId: moduleRow.id } });
  const previousIds = previous.map((p) => p.id);
  await prisma.$transaction([
    prisma.translation.deleteMany({ where: { entityType: 'screenshot', entityId: { in: previousIds } } }),
    prisma.moduleScreenshot.deleteMany({ where: { moduleId: moduleRow.id } }),
  ]);
  // Les fichiers désormais orphelins : seuls ceux qu'on ne vient pas de réécrire.
  const fresh = new Set(captured.map((c) => c.storagePath));
  await Promise.all(previous.filter((p) => !fresh.has(p.filePath)).map((p) => deleteUpload(p.filePath)));

  for (const [i, c] of captured.entries()) {
    const shot = await prisma.moduleScreenshot.create({
      data: { moduleId: moduleRow.id, filePath: c.storagePath!, sortOrder: i + 1 },
    });
    // Alt traduit : obligatoire pour l'accessibilité, et le carrousel l'affiche
    // dans son emplacement quand le fichier manque.
    for (const [locale, copy] of Object.entries(manifest.content ?? { [DEFAULT_LOCALE]: {} })) {
      const label = copy.name || key;
      await prisma.translation.upsert({
        where: { entityType_entityId_field_languageCode: { entityType: 'screenshot', entityId: shot.id, field: 'alt', languageCode: locale } },
        create: { entityType: 'screenshot', entityId: shot.id, field: 'alt', languageCode: locale, value: `${label} — ${i + 1}` },
        update: { value: `${label} — ${i + 1}` },
      });
    }
  }
  ok(`${captured.length} capture(s) enregistrée(s)`);

  say('Terminé');
  console.log(`   La landing affiche le module à la prochaine revalidation (60 s).`);
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
