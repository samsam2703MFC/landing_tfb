/**
 * L'air entre un formulaire et le bouton qui le referme.
 *
 * Collé au dernier champ, un bouton d'enregistrement se lit comme une case
 * de plus du formulaire. On mesure l'écart vertical entre le haut de la
 * barre d'actions et le bas de ce qui la précède.
 */
import { chromium } from 'playwright';

const B = process.argv[2], MDP = process.argv[3];
const MINIMUM = 12;
const PAGES = [
  '/admin', '/admin/modules', '/admin/composants', '/admin/leviers', '/admin/captures',
  '/admin/textes', '/admin/site', '/admin/questions', '/admin/langues',
  '/admin/traductions?langue=en&entite=site', '/admin/etapes', '/admin/onboarding', '/admin/onboarding/1', '/admin/onboarding/1/modules', '/admin/onboarding/1/prerequis', '/admin/onboarding/1/parc', '/admin/onboarding/1/configuration?connexion=4', '/admin/onboarding/1/mapping?connexion=4', '/admin/onboarding/1/boutiques?connexion=4', '/admin/onboarding/1/historique?connexion=4', '/admin/onboarding/1/coherence?connexion=4', '/admin/onboarding/1/synchro?connexion=4', '/admin/connexions', '/admin/connecteurs?editer=gopos', '/admin/contrats', '/admin/contrats/TFB-2026-0001-C', '/admin/prospects/1', '/admin/tarifs', '/admin/prestations',
  '/admin/offres', '/admin/offres/nouvelle', '/admin/utilisateurs', '/admin/societe', '/admin/onboarding/4/entreprise', '/admin/offres/TFB-2026-9001', '/admin/clients',
  '/admin/leads', '/admin/sync', '/admin/reglages', '/admin/prospects',
];

const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const ctx = await b.newContext({ viewport: { width: 1440, height: 1000 } });
// Les polices Google ne sortent pas d'ici : sans ce filtre, chaque page
// attend son timeout réseau.
await ctx.route('**://fonts.googleapis.com/**', (r) => r.abort());
await ctx.route('**://fonts.gstatic.com/**', (r) => r.abort());
const p = await ctx.newPage();
p.setDefaultTimeout(15000);
p.setDefaultNavigationTimeout(15000);
await p.goto(`${B}/admin/connexion`, { waitUntil: 'load' });
await p.fill('input[name="mot_de_passe"]', MDP);
await p.click('button[type="submit"]');
await p.waitForLoadState('load');

// Une fiche de module et une fiche d'offre : les plus longs formulaires.
const liens = await p.evaluate(() => [...document.querySelectorAll('a[href]')].map((a) => a.getAttribute('href')));
const extras = [];
for (const motif of ['/admin/modules/', '/admin/offres/', '/admin/prospects/']) {
  const trouve = liens.find((h) => h && h.includes(motif) && !h.endsWith(motif) && !h.includes('nouvelle'));
  if (trouve) extras.push(trouve.replace(B, '').replace('/landing_tfb', ''));
}

const soucis = [];
for (const chemin of [...PAGES, ...extras]) {
  process.stderr.write(`→ ${chemin}\n`);
  let rep;
  try { rep = await p.goto(`${B}${chemin}`, { waitUntil: 'load' }); } catch { continue; }
  if (!rep || rep.status() >= 400) continue;
  await p.waitForFunction(() => document.readyState === 'complete');

  for (const s of await p.evaluate((min) => {
    const out = [];
    for (const zone of document.querySelectorAll('.actions')) {
      // Une case de rangée n'a pas à s'écarter de ses voisines.
      if (zone.closest('td, summary, .bloc__tete') || zone.classList.contains('actions--case')) continue;
      const r = zone.getBoundingClientRect();
      if (!r.height) continue;

      // Le voisin visible juste au-dessus, dans le même parent.
      let avant = zone.previousElementSibling;
      while (avant && !avant.getBoundingClientRect().height) avant = avant.previousElementSibling;
      if (!avant) continue;
      const ra = avant.getBoundingClientRect();
      const air = Math.round(r.top - ra.bottom);
      if (air >= min) continue;
      out.push(`${air} px sous <${avant.tagName.toLowerCase()}> — « ${zone.textContent.trim().slice(0, 30)} »`);
    }
    return out;
  }, MINIMUM)) {
    soucis.push(`${chemin.padEnd(42)} ${s}`);
  }
}
await b.close();

if (soucis.length === 0) console.log(`✓ partout au moins ${MINIMUM} px entre le formulaire et son bouton.`);
else {
  console.log('── Bouton collé au formulaire ──');
  for (const s of soucis) console.log(`  ${s}`);
}
