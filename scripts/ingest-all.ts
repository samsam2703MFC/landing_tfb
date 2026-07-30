/**
 * La tournée : ingère tous les dépôts déclarés dans config/modules.json.
 *
 *   npm run ingest:all -- --dry-run
 *   npm run ingest:all
 *   npm run ingest:all -- --only samsam2703MFC/pwa_consultant
 *
 * Chaque dépôt est traité par un processus séparé — le même CLI que
 * `npm run ingest`. C'est délibéré : sur quinze dépôts, un manifeste illisible,
 * un Chromium qui meurt ou un serveur qui ne répond pas ne doit pas emporter la
 * tournée. Le sous-processus tombe, la tournée continue, le rapport final nomme
 * le fautif.
 *
 * Séquentiel, et pas en parallèle : chaque dépôt ouvre un navigateur et
 * photographie une application de production. Quinze d'un coup, c'est une petite
 * attaque par déni de service sur son propre serveur.
 */
import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { parseModuleList, toArgv, type ModuleEntry } from './lib/module-list';

// argv[1] est ce fichier, tel que tsx l'a résolu — tout le reste s'y raccroche.
const HERE = path.dirname(path.resolve(process.argv[1] ?? 'scripts/ingest-all.ts'));
const ROOT = path.resolve(HERE, '..');
const DEFAULT_CONFIG = path.join(ROOT, 'config', 'modules.json');
const CLI = path.join(HERE, 'ingest-module.ts');
const TSX = path.join(ROOT, 'node_modules', '.bin', 'tsx');

const say = (m: string) => console.log(`\n\x1b[1m${m}\x1b[0m`);
const ok = (m: string) => console.log(`   \x1b[32m✓\x1b[0m ${m}`);
const warn = (m: string) => console.log(`   \x1b[33m!\x1b[0m ${m}`);
const bad = (m: string) => console.log(`   \x1b[31m✗\x1b[0m ${m}`);

interface Args { config: string; only?: string; dryRun: boolean; }

function parseArgs(argv: string[]): Args {
  const args: Args = { config: DEFAULT_CONFIG, dryRun: false };
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    const next = () => argv[++i];
    if (a === '--config') args.config = path.resolve(next() ?? '');
    else if (a === '--only') args.only = next();
    else if (a === '--dry-run') args.dryRun = true;
  }
  return args;
}

interface Outcome { label: string; code: number; skipped?: string; }

/**
 * Lance le CLI d'ingestion pour une entrée. Le cookie de session passe par
 * l'environnement du fils, jamais par ses arguments : `ps` montre les arguments
 * de tout le monde, pas l'environnement.
 */
function runOne(entry: ModuleEntry, dryRun: boolean): Promise<number> {
  const argv = toArgv(entry, dryRun);
  const env = { ...process.env };

  if (entry.cookieEnv) {
    const value = process.env[entry.cookieEnv];
    if (value) env.TFB_CAPTURE_COOKIE = value;
    else warn(`${entry.cookieEnv} n'est pas défini — captures sans session.`);
  } else {
    // Sans quoi le cookie d'un dépôt fuiterait vers le suivant.
    delete env.TFB_CAPTURE_COOKIE;
  }

  return new Promise((resolve) => {
    const child = spawn(TSX, [CLI, ...argv], { stdio: 'inherit', env });
    child.on('error', () => resolve(1));
    child.on('close', (code) => resolve(code ?? 1));
  });
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  if (!existsSync(TSX)) {
    console.error(`tsx est introuvable (${TSX}).`);
    console.error('  La tournée lance le CLI d\'ingestion en sous-processus. Installez les');
    console.error('  dépendances de développement : npm ci  (et non npm ci --omit=dev).');
    process.exit(2);
  }

  let raw: unknown;
  try {
    raw = JSON.parse(await readFile(args.config, 'utf8'));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`Liste illisible : ${args.config}`);
    console.error(/ENOENT/.test(message)
      ? '  Copiez config/modules.example.json en config/modules.json.'
      : `  ${message.split('\n')[0]}`);
    process.exit(2);
  }

  const { modules, issues } = parseModuleList(raw);
  for (const issue of issues) (issue.level === 'error' ? bad : warn)(issue.message);

  const tour = args.only ? modules.filter((m) => m.repo === args.only || m.path === args.only) : modules;

  if (args.only && tour.length === 0) {
    console.error(`\n« ${args.only} » n'est pas dans la liste (ou y est désactivé).`);
    process.exit(2);
  }
  if (tour.length === 0) {
    console.error('\nRien à ingérer.');
    process.exit(issues.some((i) => i.level === 'error') ? 1 : 0);
  }

  say(`Tournée — ${tour.length} dépôt(s)${args.dryRun ? ' (simulation)' : ''}`);

  const outcomes: Outcome[] = [];
  for (const [i, entry] of tour.entries()) {
    const label = entry.repo || entry.path!;
    say(`[${i + 1}/${tour.length}] ${label}`);
    const code = await runOne(entry, args.dryRun);
    outcomes.push({ label, code });
  }

  const failed = outcomes.filter((o) => o.code !== 0);
  say('Rapport');
  for (const o of outcomes) (o.code === 0 ? ok : bad)(`${o.label}${o.code === 0 ? '' : ` — code ${o.code}`}`);

  if (failed.length) {
    // Sortie non nulle : c'est ce qui fait qu'un cron silencieux, une action
    // GitHub ou un timer systemd signalent la panne au lieu de la garder pour eux.
    console.log(`\n\x1b[31m${failed.length} échec(s) sur ${outcomes.length}.\x1b[0m`);
    process.exit(1);
  }
  console.log(`\n\x1b[32m${outcomes.length} dépôt(s) ingéré(s).\x1b[0m`);
}

main().catch((e) => { console.error(e); process.exit(1); });
