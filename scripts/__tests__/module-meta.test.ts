import { parseRepo, localRepo, toModuleKey, validateManifest, screenshotName } from '../lib/module-meta';
let fail = 0;
const eq = (label: string, got: unknown, want: unknown) => {
  const g = JSON.stringify(got), w = JSON.stringify(want);
  if (g !== w) { console.log(`  ✗ ${label}\n      obtenu ${g}\n      attendu ${w}`); fail++; }
  else console.log(`  ✓ ${label}`);
};

console.log('parseRepo');
eq('url https',   parseRepo('https://github.com/samsam2703MFC/landing_tfb')?.slugPath, 'samsam2703MFC/landing_tfb');
eq('url .git',    parseRepo('https://github.com/o/n.git')?.cloneUrl, 'https://github.com/o/n.git');
eq('ssh',         parseRepo('git@github.com:o/n.git')?.slugPath, 'o/n');
eq('court',       parseRepo('o/n')?.cloneUrl, 'https://github.com/o/n.git');
eq('vide',        parseRepo('   '), null);
eq('incomplet',   parseRepo('https://github.com/seul'), null);

console.log('localRepo');
eq('nom déduit',    localRepo('/var/www/app/pwa_consultant').name, 'pwa_consultant');
eq('slash final',   localRepo('/var/www/app/pwa_consultant/').name, 'pwa_consultant');
eq('sans étiquette', localRepo('/srv/x').slugPath, 'x');
eq('propriétaire par défaut', localRepo('/srv/x').owner, 'local');
eq('étiquette owner/nom', localRepo('/srv/x', 'o/n').slugPath, 'o/n');
eq('owner extrait',  localRepo('/srv/x', 'o/n').owner, 'o');
eq('chemin conservé', localRepo('/srv/x').localPath, '/srv/x');
eq('clé depuis le nom', toModuleKey(localRepo('/var/www/app/pwa_consultant').name), 'pwa-consultant');

console.log('toModuleKey');
eq('simple',      toModuleKey('scan'), 'scan');
eq('préfixe tfb', toModuleKey('tfb-invoicing'), 'invoicing');
eq('suffixe',     toModuleKey('marketing-service'), 'marketing');
eq('accents',     toModuleKey('Réceptions Été'), 'receptions-ete');
eq('bruit',       toModuleKey('__Shop!! v2__'), 'shop-v2');
eq('vide',        toModuleKey('---'), 'module');

console.log('validateManifest');
eq('non-objet',   validateManifest([]).issues[0]?.level, 'error');
eq('groupe ok',   validateManifest({ group: 'Finance' }).manifest.group, 'Finance');
eq('groupe faux', validateManifest({ group: 'Nope' }).manifest.group, undefined);
eq('avertit',     validateManifest({ group: 'Nope' }).issues.length, 1);
eq('routes sale', validateManifest({ routes: ['/a', 42, '/b'] }).manifest.routes, ['/a', '/b']);
eq('fr manquant', validateManifest({ content: { en: { name: 'X' } } }).issues.some(i => i.message.includes('content.fr')), true);
eq('bullets',     validateManifest({ content: { fr: { bullets: ['a', 1, 'b'] } } }).manifest.content?.fr?.bullets, ['a', 'b']);

console.log('screenshotName');
eq('padding',     screenshotName('scan', 3), 'scan-03.png');
eq('deux chiffres', screenshotName('scan', 12), 'scan-12.png');

console.log(fail === 0 ? '\nTous les tests passent.' : `\n${fail} échec(s).`);
process.exit(fail === 0 ? 0 : 1);
