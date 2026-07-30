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
import { mkdtemp, readFile, rm } from 'node:fs/promises';
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
}

function parseArgs(argv: string[]): Args {
  const args: Args = { dryRun: false, activate: true, insecure: false };
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
  }
  return args;
}

const say = (m: string) => console.log(`\n\x1b[1m== ${m}\x1b[0m`);
const ok = (m: string) => console.log(`   \x1b[32m✓\x1b[0m ${m}`);
const warn = (m: string) => console.log(`   \x1b[33m!\x1b[0m ${m}`);

/**
 * Lit tfb-module.json : depuis un répertoire local s'il y en a un, sinon depuis
 * un clone superficiel. Le clone est supprimé dans tous les cas ; un répertoire
 * local n'est jamais touché.
 */
async function readManifest(repo: RepoRef): Promise<{ manifest: ModuleManifest; found: boolean }> {
  let dir = repo.localPath;
  let temporary: string | null = null;

  try {
    if (!dir) {
      temporary = await mkdtemp(path.join(tmpdir(), 'tfb-ingest-'));
      dir = temporary;
      await run('git', ['clone', '--depth', '1', '--quiet', repo.cloneUrl, dir], { timeout: 120_000 });
    }
    const raw = await readFile(path.join(dir, 'tfb-module.json'), 'utf8');
    const { manifest, issues } = validateManifest(JSON.parse(raw));
    for (const issue of issues) warn(`tfb-module.json — ${issue.message}`);
    return { manifest, found: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (/ENOENT/.test(message)) warn(`Pas de tfb-module.json dans ${repo.localPath ?? 'le dépôt'}.`);
    else warn(`Source illisible : ${message.split('\n')[0]}`);
    return { manifest: {}, found: false };
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
    console.error('        [--url <app>] [--routes /,/login] [--key k] [--group G] [--icon i] [--insecure] [--dry-run]');
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
  const { manifest, found } = await readManifest(repo);
  if (found) ok('tfb-module.json lu');

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
  const outDir = path.resolve(STORAGE_ROOT, 'screenshots');
  let results;
  try {
    results = await captureRoutes({
      baseUrl: args.url, routes, moduleKey: key, outDir,
      ignoreHttpsErrors: args.insecure,
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
    if (r.storagePath) ok(`${r.route} → ${r.storagePath}`);
    else warn(`${r.route} — échec : ${r.error}`);
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
