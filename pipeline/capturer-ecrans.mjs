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
 *   node capturer-ecrans.mjs --module=consultant --base=... --cookie="PHPSESSID=..."
 *   node capturer-ecrans.mjs --module=consultant --base=... --sortie=/tmp/captures
 *
 * Le résultat est un dossier à copier tel quel dans `docs/landing/` du dépôt
 * du module, puis à committer. La landing les reprend au déploiement suivant.
 *
 * Aucun secret n'est écrit : l'adresse et le cookie de session passent en
 * argument ou par les variables CAPTURE_BASE / CAPTURE_COOKIE.
 */

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
const attente = Number(argument('attente', '1200'));

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
try {
  ({ chromium } = await import('playwright'));
} catch {
  console.error('Playwright est nécessaire pour ce script : npm i -D playwright');
  process.exit(1);
}

await mkdir(sortie, { recursive: true });

const navigateur = await chromium.launch({
  executablePath: process.env.PLAYWRIGHT_CHROMIUM || undefined,
});
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
let faites = 0;
let ratees = 0;
let refusees = 0;

for (const [cle, chemin] of Object.entries(plan.ecrans)) {
  const url = `${base}${chemin}`;
  try {
    const reponse = await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });
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
  console.log('Des écrans renvoient vers la connexion : passer une session ouverte avec');
  console.log('  --cookie="PHPSESSID=…"   (ou la variable CAPTURE_COOKIE)');
}

process.exit(ratees > 0 && faites === 0 ? 1 : 0);
