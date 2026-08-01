#!/usr/bin/env node
/**
 * Produit les captures d'écran d'un module depuis une instance qui tourne.
 *
 * La landing ne fabrique pas d'images : elle reprend ce que chaque dépôt
 * publie dans `docs/landing/*.png` (cf. sync-captures.mjs). Ce script sert à
 * fabriquer ces fichiers, correctement nommés, depuis l'application en
 * service — serveur de test ou poste local.
 *
 * Le nom du fichier fait le rattachement : `consultant-checklists.png` se
 * range sous la fonction dont la clé est « checklists ». C'est pour ça que le
 * plan ci-dessous reprend les clés exactes des fiches, et pas des libellés.
 *
 * Format tablette par défaut (1194 × 834, un iPad en paysage) : c'est le poste
 * réel du panel consultant et du kiosque cuisine. `--format=bureau` ou
 * `--format=mobile` pour les modules qui se regardent ailleurs.
 *
 * Usage :
 *   node capturer-ecrans.mjs --module=consultant --base=https://serveur/pwa_consultant
 *
 * Ces écrans demandent une session ouverte. Deux façons de la donner :
 *   · laisser le script se connecter — c'est le plus simple :
 *       CAPTURE_USER='0600000000' CAPTURE_PASS='…' node capturer-ecrans.mjs …
 *   · ou coller une session déjà ouverte :
 *       node capturer-ecrans.mjs … --cookie="PHPSESSID=…"
 *
 * Le mot de passe n'est ni écrit ni affiché : il passe par l'environnement et
 * ne sert qu'à remplir le formulaire de connexion de l'application.
 *
 * Le résultat est un dossier à copier tel quel dans `docs/landing/` du dépôt
 * du module, puis à committer. La landing les reprend au déploiement suivant.
 *
 * Aucun secret n'est écrit : l'adresse et le cookie de session passent en
 * argument ou par les variables CAPTURE_BASE / CAPTURE_COOKIE.
 */

import { existsSync, readdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ICI = dirname(fileURLToPath(import.meta.url));

/** Les formats d'écran. Le premier est celui du poste réel du module. */
const FORMATS = {
  tablette: { width: 1194, height: 834, deviceScaleFactor: 2 },
  bureau: { width: 1440, height: 900, deviceScaleFactor: 2 },
  mobile: { width: 430, height: 932, deviceScaleFactor: 3 },
};

/**
 * Le plan de capture de chaque module : clé de fonction → chemin de la page.
 * Les clés sont celles des fiches (`landing_fonctions.cle`) — les changer
 * détacherait la capture de sa fonction.
 */
const PLANS = {
  consultant: {
    format: 'tablette',
    connexion: { chemin: '/auth', identifiant: 'phone', motdepasse: 'password' },
    ecrans: {
      dashboard: '/dashboard',
      shops: '/shops',
      sixl: '/levers',
      agenda: '/agenda',
      checklists: '/checklists',
      targets: '/targets',
      trends: '/trends',
      notes: '/notes',
      rapports: '/reports',
      helpdesk: '/helpdesk',
      tasks: '/tasks',
      claims: '/claims',
    },
  },
  cuisine: {
    format: 'tablette',
    connexion: { chemin: '/auth', identifiant: 'phone', motdepasse: 'password' },
    ecrans: {
      dashboard: '/dashboard',
      checklists: '/checklists',
      produits: '/knowledge/products',
      commandes: '/orders',
      'nouvelle-commande': '/orders/new',
      reclamations: '/complaints',
    },
  },
};

/** Lit `--nom=valeur` sur la ligne de commande. */
function argument(nom, defaut = '') {
  const trouve = process.argv.find((a) => a.startsWith(`--${nom}=`));
  return trouve ? trouve.slice(nom.length + 3) : defaut;
}

const slug = argument('module');
const base = (argument('base') || process.env.CAPTURE_BASE || '').replace(/\/+$/, '');
const cookie = argument('cookie') || process.env.CAPTURE_COOKIE || '';
const attente = Number(argument('attente', '2500'));
const identifiant = argument('identifiant') || process.env.CAPTURE_USER || '';
const motDePasse = process.env.CAPTURE_PASS || '';

/**
 * Un plan improvisé, pour un module qui n'en a pas encore :
 *   --ecrans=dashboard=/tableau,stock=/stock
 * Les clés doivent être celles des fonctions de la fiche.
 */
const surMesure = argument('ecrans');
const ecransImprovises = surMesure
  ? Object.fromEntries(
      surMesure.split(',').map((p) => {
        const i = p.indexOf('=');
        return [p.slice(0, i).trim(), p.slice(i + 1).trim()];
      }),
    )
  : null;

if (!slug || (!PLANS[slug] && !ecransImprovises)) {
  console.error(`Module inconnu. Plans disponibles : ${Object.keys(PLANS).join(', ')}`);
  console.error("Sinon, décrire les écrans à la volée : --ecrans=cle=/chemin,cle2=/chemin2");
  process.exit(1);
}
if (!base) {
  console.error('Adresse de l\'instance manquante : --base=https://… ou CAPTURE_BASE.');
  process.exit(1);
}

const plan = ecransImprovises ? { format: 'tablette', ecrans: ecransImprovises } : PLANS[slug];
const format = FORMATS[argument('format', plan.format)] || FORMATS.tablette;
const sortie = resolve(argument('sortie') || resolve(ICI, '..', 'captures-a-publier', slug));

// Playwright n'est pas une dépendance du pipeline : il n'est utile que pour
// cette tâche, lancée à la main. Le message le dit plutôt que d'échouer sec.
let chromium;
{
  // playwright-core suffit quand un navigateur est déjà installé sur la machine.
  const essais = [];
  for (const paquet of ['playwright', 'playwright-core']) {
    try {
      ({ chromium } = await import(paquet));
      break;
    } catch (err) {
      essais.push(`  ${paquet} : ${err.code || err.message.split('\n')[0]}`);
    }
  }
  if (!chromium) {
    console.error(`Aucun module Playwright chargeable depuis ${ICI} :`);
    // La raison exacte compte : un paquet absent et un paquet cassé se
    // soignent différemment, et « manquant » les confondait.
    console.error(essais.join('\n'));
    console.error('');
    console.error('Installer, depuis la racine du dépôt :');
    console.error('  npm --prefix pipeline i playwright');
    console.error('  npx --prefix pipeline playwright install chromium');
    console.error('');
    console.error('À refaire après un déploiement : `npm ci` reconstruit');
    console.error('pipeline/node_modules à partir du verrou et emporte Playwright.');
    process.exit(1);
  }
}

await mkdir(sortie, { recursive: true });

/** Les chemins où un navigateur traîne d'habitude sur une machine Linux. */
const NAVIGATEURS = [
  '/usr/bin/chromium',
  '/usr/bin/chromium-browser',
  '/usr/lib/chromium/chromium',
  '/usr/bin/google-chrome',
  '/usr/bin/google-chrome-stable',
  '/opt/google/chrome/chrome',
  '/snap/bin/chromium',
];

/**
 * Les navigateurs que `playwright install` a déposés dans le cache. Ils
 * survivent aux `npm ci` du déploiement, contrairement à node_modules — c'est
 * donc là qu'il faut regarder en premier quand le module vient d'être
 * réinstallé.
 */
function navigateursDuCache() {
  const cache = process.env.PLAYWRIGHT_BROWSERS_PATH || resolve(homedir(), '.cache', 'ms-playwright');
  if (!existsSync(cache)) return [];
  const trouves = [];
  for (const dossier of readdirSync(cache)) {
    if (!dossier.startsWith('chromium')) continue;
    for (const suite of [
      ['chrome-linux', 'chrome'],
      ['chrome-linux64', 'chrome'],
      ['chrome-headless-shell-linux64', 'chrome-headless-shell'],
    ]) {
      const chemin = resolve(cache, dossier, ...suite);
      if (existsSync(chemin)) trouves.push(chemin);
    }
  }
  // Un vrai Chrome avant la coquille sans interface : les captures d'une
  // application qui dessine des graphiques y gagnent.
  return trouves.sort((a, b) => (a.includes('headless-shell') ? 1 : 0) - (b.includes('headless-shell') ? 1 : 0));
}

function aider() {
  console.error('');
  console.error('Aucun navigateur utilisable. Au choix, une seule fois :');
  console.error('  npx --prefix pipeline playwright install chromium');
  console.error('    (sans --with-deps : pas de dpkg, donc pas de conflit avec');
  console.error('     unattended-upgrades ; à relancer avec --with-deps si le');
  console.error('     lancement se plaint ensuite d\'une bibliothèque manquante)');
  console.error('  apt-get install -y chromium        puis relancer ce script');
  console.error('');
  console.error('Un navigateur déjà installé ailleurs se désigne par son chemin :');
  console.error('  PLAYWRIGHT_CHROMIUM=/chemin/vers/chrome node pipeline/capturer-ecrans.mjs …');
}

/**
 * Ouvre le navigateur : celui qu'on impose, sinon celui de Playwright, sinon
 * celui du système. Un chemin donné mais inexistant est une faute de frappe,
 * pas une invitation à chercher ailleurs — on le dit.
 */
async function ouvrirNavigateur() {
  const impose = process.env.PLAYWRIGHT_CHROMIUM;
  if (impose) {
    if (!existsSync(impose)) {
      console.error(`PLAYWRIGHT_CHROMIUM pointe sur ${impose}, qui n'existe pas.`);
      const trouves = [...NAVIGATEURS.filter((c) => existsSync(c)), ...navigateursDuCache()];
      if (trouves.length > 0) console.error(`Sur cette machine : ${trouves.join(', ')}`);
      else aider();
      process.exit(1);
    }
    return chromium.launch({ executablePath: impose });
  }
  try {
    return await chromium.launch();
  } catch (err) {
    const trouve = navigateursDuCache()[0] || NAVIGATEURS.find((c) => existsSync(c));
    if (!trouve) {
      console.error(err.message.split('\n')[0]);
      aider();
      process.exit(1);
    }
    console.log(`· navigateur du système : ${trouve}`);
    return chromium.launch({ executablePath: trouve });
  }
}

const navigateur = await ouvrirNavigateur();
const contexte = await navigateur.newContext({
  viewport: { width: format.width, height: format.height },
  deviceScaleFactor: format.deviceScaleFactor,
  // Le serveur de test présente un certificat auto-signé.
  ignoreHTTPSErrors: true,
});

if (cookie) {
  const hote = new URL(base).hostname;
  for (const paire of cookie.split(';')) {
    const [nom, ...reste] = paire.trim().split('=');
    if (!nom || reste.length === 0) continue;
    await contexte.addCookies([{ name: nom, value: reste.join('='), domain: hote, path: '/' }]);
  }
}

const page = await contexte.newPage();

// Se connecter une fois, puis toutes les pages suivent dans la même session.
if (identifiant && plan.connexion) {
  if (!motDePasse) {
    console.error('Mot de passe attendu dans CAPTURE_PASS (jamais en argument).');
    process.exit(1);
  }
  const ou = `${base}${plan.connexion.chemin}`;
  await page.goto(ou, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.fill(`[name="${plan.connexion.identifiant}"]`, identifiant);
  await page.fill(`[name="${plan.connexion.motdepasse}"]`, motDePasse);
  await page.click('button[type=submit], input[type=submit]');
  // Attendre d'avoir quitté la page de connexion, pas que le réseau se
  // taise : ces applications interrogent l'API en continu et `networkidle`
  // n'arrive jamais.
  await page
    .waitForURL((u) => !/login|auth|connexion/i.test(String(u)), { timeout: 12000 })
    .catch(() => {});
  await page.waitForTimeout(attente);
  if (/login|auth|connexion/i.test(page.url())) {
    console.error(`✗ connexion refusée sur ${ou} — identifiant ou mot de passe.`);
    await navigateur.close();
    process.exit(1);
  }
  console.log(`· session ouverte pour ${identifiant}`);
} else if (!identifiant && !cookie && plan.connexion) {
  console.log('· sans session : les écrans protégés vont renvoyer vers la connexion.');
  console.log('  CAPTURE_USER=… CAPTURE_PASS=… pour laisser le script se connecter.');
}

let faites = 0;
let ratees = 0;
let refusees = 0;

for (const [cle, chemin] of Object.entries(plan.ecrans)) {
  const url = `${base}${chemin}`;
  try {
    const reponse = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
    // Le silence réseau est un bonus, pas une condition : on lui laisse
    // quelques secondes et on continue s'il ne vient pas.
    await page.waitForLoadState('networkidle', { timeout: 5000 }).catch(() => {});
    const code = reponse?.status() ?? 0;
    // Une page de connexion renvoie 200 : on regarde aussi où l'on a atterri.
    const redirige = /login|auth|connexion/i.test(page.url()) && !/login|auth/i.test(chemin);
    if (code >= 400 || redirige) {
      console.error(`✗ ${cle.padEnd(18)} ${code}${redirige ? ' → renvoyé vers la connexion' : ''}  ${url}`);
      ratees += 1;
      if (redirige) refusees += 1;
      continue;
    }
    // Laisser les données arriver : ces écrans se remplissent en XHR.
    // --attente=5000 si les graphiques sont encore vides sur les captures.
    await page.waitForTimeout(attente);
    const fichier = resolve(sortie, `${slug}-${cle}.png`);
    await page.screenshot({ path: fichier, fullPage: false });
    console.log(`✓ ${cle.padEnd(18)} ${fichier.replace(`${process.cwd()}/`, '')}`);
    faites += 1;
  } catch (err) {
    console.error(`✗ ${cle.padEnd(18)} ${err.message.split('\n')[0]}`);
    ratees += 1;
  }
}

await navigateur.close();

console.log('');
console.log(`${faites} capture(s) dans ${sortie}${ratees ? ` — ${ratees} échec(s)` : ''}`);
if (faites > 0) {
  console.log('');
  console.log('Étape suivante, dans le dépôt du module :');
  console.log(`  cp ${sortie}/*.png docs/landing/`);
  console.log('  git add docs/landing && git commit -m "Publier les captures de la fiche landing"');
  console.log('La landing les reprend au déploiement suivant (sync-captures.mjs).');
}
if (refusees > 0) {
  console.log('');
  console.log('Des écrans renvoient vers la connexion. Ouvrir une session :');
  console.log('  CAPTURE_USER=… CAPTURE_PASS=… node capturer-ecrans.mjs …');
  console.log('  ou --cookie="PHPSESSID=…" si la session est déjà ouverte ailleurs.');
}

process.exit(ratees > 0 && faites === 0 ? 1 : 0);
