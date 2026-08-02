/**
 * Audit UX des formulaires du back office.
 *
 * On ne juge pas le goût : on mesure ce qui est vérifiable et qui gêne
 * vraiment — un champ sans étiquette, un identifiant en double, un bouton
 * dont on ne sait pas s'il enregistre ou détruit, une saisie perdue.
 */
import { chromium } from 'playwright';

const B = process.argv[2], MDP = process.argv[3];
const PAGES = [
  '/admin', '/admin/modules', '/admin/composants', '/admin/leviers', '/admin/captures',
  '/admin/textes', '/admin/site', '/admin/questions', '/admin/langues',
  '/admin/traductions?langue=en&entite=site', '/admin/etapes', '/admin/onboarding', '/admin/onboarding/1', '/admin/onboarding/1/modules', '/admin/onboarding/1/prerequis', '/admin/onboarding/1/parc', '/admin/onboarding/1/configuration?connexion=4', '/admin/onboarding/1/mapping?connexion=4', '/admin/onboarding/1/boutiques?connexion=4', '/admin/onboarding/1/historique?connexion=4', '/admin/onboarding/1/coherence?connexion=4', '/admin/onboarding/1/synchro?connexion=4', '/admin/connexions', '/admin/connecteurs?editer=gopos', '/admin/contrats', '/admin/contrats/TFB-2026-0001-C', '/admin/prospects/1', '/admin/tarifs', '/admin/prestations',
  '/admin/offres', '/admin/offres/nouvelle', '/admin/utilisateurs', '/admin/clients',
  '/admin/leads', '/admin/sync', '/admin/reglages',
];

const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const ctx = await b.newContext({ viewport: { width: 1280, height: 900 } });
await ctx.route('**://fonts.googleapis.com/**', (r) => r.abort());
await ctx.route('**://fonts.gstatic.com/**', (r) => r.abort());
const p = await ctx.newPage();
await p.goto(`${B}/admin/connexion`, { waitUntil: 'load' });
await p.fill('input[name="mot_de_passe"]', MDP);
await p.click('button[type="submit"]');
await p.waitForLoadState('load');

const soucis = [];
for (const chemin of PAGES) {
  const rep = await p.goto(`${B}${chemin}`, { waitUntil: 'load' });
  if (rep.status() >= 400) { soucis.push({ chemin, quoi: `réponse ${rep.status()}` }); continue; }
  await p.waitForFunction(() => document.readyState === 'complete');

  for (const s of await p.evaluate(() => {
    const out = [];
    const nom = (el) => el.name || el.id || el.getAttribute('aria-label') || `<${el.tagName.toLowerCase()}>`;

    // Un champ sans étiquette ni aria-label : on ne sait pas ce qu'on tape.
    for (const el of document.querySelectorAll('input, select, textarea')) {
      if (['hidden', 'submit', 'button'].includes(el.type)) continue;
      const parLabel = el.id && document.querySelector(`label[for="${CSS.escape(el.id)}"]`);
      if (!parLabel && !el.closest('label') && !el.getAttribute('aria-label')) {
        out.push(`champ sans étiquette : ${nom(el)}`);
      }
    }

    // Un id en double casse `label[for]` et le lien clavier.
    const vus = new Map();
    for (const el of document.querySelectorAll('[id]')) vus.set(el.id, (vus.get(el.id) || 0) + 1);
    for (const [id, n] of vus) if (n > 1) out.push(`id en double : ${id} (${n}×)`);

    // Un bouton sans `type` dans un formulaire vaut `submit` : un bouton
    // « Annuler » écrit ainsi enregistre.
    for (const el of document.querySelectorAll('form button:not([type])')) {
      out.push(`bouton sans type : « ${(el.textContent || '').trim().slice(0, 30)} »`);
    }

    // Un formulaire sans moyen de le soumettre. Le bouton peut vivre hors du
    // formulaire et le désigner par `form=` — c'est la seule façon de
    // soumettre une ligne de table, dont les cellules ne peuvent pas être
    // enveloppées dans un <form>.
    for (const f of document.querySelectorAll('form')) {
      const dehors = f.id
        ? document.querySelector(`button[form="${f.id}"], input[type="submit"][form="${f.id}"]`)
        : null;
      if (!dehors && !f.querySelector('button, input[type="submit"]')) {
        out.push(`formulaire sans bouton : ${f.getAttribute('action') || f.method}`);
      }
    }

    // Une action destructrice sans confirmation.
    for (const el of document.querySelectorAll('button, a')) {
      const t = (el.textContent || '').trim().toLowerCase();
      if (!/supprim|effacer/.test(t)) continue;
      const f = el.closest('form');
      if (f && !f.getAttribute('onsubmit') && !el.getAttribute('onclick')) {
        out.push(`destruction sans confirmation : « ${(el.textContent || '').trim().slice(0, 30)} »`);
      }
    }

    // Un champ obligatoire qui ne le dit qu'au navigateur.
    const requis = [...document.querySelectorAll('[required]')];
    const marques = document.querySelectorAll('.champ__requis').length;
    if (requis.length > 0 && marques === 0) out.push(`${requis.length} champ(s) requis, aucun marqué à l'œil`);

    return out;
  })) soucis.push({ chemin, quoi: s });
}
await b.close();

if (soucis.length === 0) console.log(`✓ ${PAGES.length} écrans : rien à signaler.`);
else {
  const par = new Map();
  for (const s of soucis) {
    if (!par.has(s.chemin)) par.set(s.chemin, []);
    par.get(s.chemin).push(s.quoi);
  }
  for (const [chemin, liste] of par) {
    console.log(`\n✗ ${chemin}`);
    for (const q of [...new Set(liste)]) console.log(`   ${q}`);
  }
  console.log(`\n${soucis.length} point(s) sur ${par.size} écran(s).`);
}
