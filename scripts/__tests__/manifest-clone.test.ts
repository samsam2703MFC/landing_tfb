import { validateManifest, localRepo } from '../lib/module-meta';
import { mkdtemp, readFile, rm, writeFile, mkdir, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
const run = promisify(execFile);

// Reproduit readManifest() du CLI, pour l'exercer sans base de données.
// `localPath` court-circuite le clone : on lit le répertoire tel quel, et on ne
// le supprime pas — c'est du code de production sur la machine, pas un temporaire.
async function readManifest(source: { cloneUrl: string; localPath?: string }) {
  let dir = source.localPath;
  let temporary: string | null = null;
  try {
    if (!dir) {
      temporary = await mkdtemp(path.join(tmpdir(), 'tfb-ingest-'));
      dir = temporary;
      await run('git', ['clone', '--depth', '1', '--quiet', source.cloneUrl, dir], { timeout: 120_000 });
    }
    const raw = await readFile(path.join(dir, 'tfb-module.json'), 'utf8');
    const { manifest, issues } = validateManifest(JSON.parse(raw));
    return { ok: true, manifest, issues };
  } catch (e) {
    const m = e instanceof Error ? e.message : String(e);
    return { ok: false, reason: /ENOENT/.test(m) ? 'pas de tfb-module.json' : m.split('\n')[0] };
  } finally {
    if (temporary) await rm(temporary, { recursive: true, force: true });
  }
}

async function main() {
  // 1. Dépôt local avec manifeste.
  const src = await mkdtemp(path.join(tmpdir(), 'tfb-src-'));
  await mkdir(src, { recursive: true });
  await writeFile(path.join(src, 'tfb-module.json'), JSON.stringify({
    key: 'scan', group: 'Logistique', icon: 'qr-code', routes: ['/', '/inventaire'],
    content: { fr: { name: 'Scan', description: 'Inventaires au QR code.', bullets: ['A', 'B'], metricValue: '12 min', metricLabel: 'par inventaire' } },
  }, null, 2));
  await run('git', ['-C', src, 'init', '-q']);
  await run('git', ['-C', src, 'add', '-A']);
  await run('git', ['-C', src, '-c', 'user.email=t@t', '-c', 'user.name=t', 'commit', '-qm', 'init']);
  let fail = 0;
  const check = (label: string, cond: boolean) => {
    console.log(cond ? `  ✓ ${label}` : `  ✗ ${label}`);
    if (!cond) fail += 1;
  };

  const withManifest = await readManifest({ cloneUrl: src });
  check('manifeste lu', withManifest.ok === true);
  check('clé extraite', withManifest.manifest?.key === 'scan');
  check('groupe validé', withManifest.manifest?.group === 'Logistique');
  check('routes lues', JSON.stringify(withManifest.manifest?.routes) === '["/","/inventaire"]');
  check('bullets lues', JSON.stringify(withManifest.manifest?.content?.fr?.bullets) === '["A","B"]');
  check('aucun avertissement', withManifest.issues?.length === 0);

  // 2. Dépôt local sans manifeste.
  const bare = await mkdtemp(path.join(tmpdir(), 'tfb-bare-'));
  await writeFile(path.join(bare, 'README.md'), '# rien');
  await run('git', ['-C', bare, 'init', '-q']);
  await run('git', ['-C', bare, 'add', '-A']);
  await run('git', ['-C', bare, '-c', 'user.email=t@t', '-c', 'user.name=t', 'commit', '-qm', 'init']);
  const without = await readManifest({ cloneUrl: bare });
  check('absence détectée', without.ok === false && without.reason === 'pas de tfb-module.json');

  // 3. Dépôt inexistant.
  const missing = await readManifest({ cloneUrl: '/tmp/nexiste-pas-du-tout' });
  check('dépôt injoignable signalé', missing.ok === false && /git clone/.test(String(missing.reason)));

  // 4. Répertoire local — ni clone, ni identifiants, et le répertoire survit.
  //    C'est le cas d'un module dont le code tourne déjà sur le serveur.
  const live = await mkdtemp(path.join(tmpdir(), 'tfb-live-'));
  await writeFile(path.join(live, 'tfb-module.json'), JSON.stringify({
    content: { fr: { name: 'Consultant', description: 'Une PWA.' } },
  }));
  const ref = localRepo(live, 'owner/pwa_consultant');
  const fromDir = await readManifest(ref);
  check('lu sans cloner', fromDir.ok === true && fromDir.manifest?.content?.fr?.name === 'Consultant');
  check('dépôt étiqueté', ref.slugPath === 'owner/pwa_consultant');
  check('répertoire intact', (await stat(path.join(live, 'tfb-module.json'))).isFile());

  // 5. Répertoire local sans manifeste : signalé, pas fatal.
  const liveBare = await mkdtemp(path.join(tmpdir(), 'tfb-livebare-'));
  const dirWithout = await readManifest(localRepo(liveBare));
  check('absence détectée en local', dirWithout.ok === false && dirWithout.reason === 'pas de tfb-module.json');

  await rm(live, { recursive: true, force: true });
  await rm(liveBare, { recursive: true, force: true });
  await rm(src, { recursive: true, force: true });
  await rm(bare, { recursive: true, force: true });

  console.log(fail === 0 ? '\nTous les tests passent.' : `\n${fail} échec(s).`);
  process.exit(fail === 0 ? 0 : 1);
}
main();
