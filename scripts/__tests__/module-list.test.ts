import { parseModuleList, toArgv } from '../lib/module-list';

let fail = 0;
const eq = (label: string, got: unknown, want: unknown) => {
  const g = JSON.stringify(got), w = JSON.stringify(want);
  if (g !== w) { console.log(`  ✗ ${label}\n      obtenu ${g}\n      attendu ${w}`); fail++; }
  else console.log(`  ✓ ${label}`);
};

console.log('parseModuleList — refus');
eq('tableau nu',    parseModuleList([]).issues[0]?.level, 'error');
eq('null',          parseModuleList(null).issues[0]?.level, 'error');
eq('modules absent', parseModuleList({}).issues[0]?.message.includes('modules'), true);
eq('entrée non-objet', parseModuleList({ modules: ['x'] }).modules.length, 0);
eq('ni repo ni path', parseModuleList({ modules: [{ url: 'https://x' }] }).modules.length, 0);
eq('motif donné',   parseModuleList({ modules: [{ url: 'https://x' }] }).issues[0]?.message.includes('ni « repo » ni « path »'), true);

console.log('parseModuleList — le cookie en clair est refusé');
{
  const r = parseModuleList({ modules: [{ repo: 'o/n', cookie: 'jeton=abc' }] });
  eq('entrée écartée', r.modules.length, 0);
  eq('erreur, pas avertissement', r.issues[0]?.level, 'error');
  eq('oriente vers cookieEnv', r.issues[0]?.message.includes('cookieEnv'), true);
}

console.log('parseModuleList — acceptation');
{
  const r = parseModuleList({
    defaults: { insecure: true },
    modules: [
      { repo: 'o/a', path: '/srv/a', url: 'https://a', routes: ['/x', 42, '/y'], cookieEnv: 'C_A' },
      { repo: 'o/b' },
      { repo: 'o/c', enabled: false },
      { repo: 'o/a' },
    ],
  });
  eq('désactivé exclu',   r.modules.map((m) => m.repo), ['o/a', 'o/b']);
  eq('routes nettoyées',  r.modules[0]?.routes, ['/x', '/y']);
  eq('cookieEnv gardé',   r.modules[0]?.cookieEnv, 'C_A');
  eq('defaults appliqué', r.modules[1]?.insecure, true);
  eq('doublon signalé',   r.issues.some((i) => i.message.includes('deux fois')), true);
}
eq('insecure explicite gagne', parseModuleList({ defaults: { insecure: true }, modules: [{ repo: 'o/a', insecure: false }] }).modules[0]?.insecure, false);
eq('routes sans url avertit', parseModuleList({ modules: [{ repo: 'o/a', routes: ['/x'] }] }).issues.some((i) => i.message.includes('sans « url »')), true);
eq('liste vide avertit', parseModuleList({ modules: [] }).issues[0]?.level, 'warning');

console.log('toArgv');
eq('local complet', toArgv({ repo: 'o/n', path: '/srv/n', url: 'https://n', routes: ['/a', '/b'], insecure: true }, false),
   ['--path', '/srv/n', '--repo', 'o/n', '--url', 'https://n', '--routes', '/a,/b', '--insecure']);
eq('minimal',       toArgv({ repo: 'o/n' }, false), ['--repo', 'o/n']);
eq('dry-run',       toArgv({ repo: 'o/n' }, true), ['--repo', 'o/n', '--dry-run']);
eq('overrides',     toArgv({ repo: 'o/n', key: 'k', group: 'Terrain', icon: 'i' }, false),
   ['--repo', 'o/n', '--key', 'k', '--group', 'Terrain', '--icon', 'i']);
eq('cookie jamais en argument', toArgv({ repo: 'o/n', cookieEnv: 'C' }, false).includes('--cookie'), false);

console.log(fail === 0 ? '\nTous les tests passent.' : `\n${fail} échec(s).`);
process.exit(fail === 0 ? 0 : 1);
