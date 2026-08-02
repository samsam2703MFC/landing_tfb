/**
 * Le contenu qui touche le bord de son bloc.
 *
 * Un bloc pose son padding sur son en-tête et son pied, mais pas sur ce qu'on
 * met entre les deux : un champ déposé directement dans `.bloc` se colle
 * contre la bordure. C'est ce qu'on voit sur un formulaire qui « n'a pas de
 * padding ».
 */
import { chromium } from 'playwright';

const B = process.argv[2], MDP = process.argv[3];
const PAGES = [
  '/admin', '/admin/modules', '/admin/composants', '/admin/leviers', '/admin/captures',
  '/admin/textes', '/admin/site', '/admin/questions', '/admin/langues',
  '/admin/traductions?langue=en&entite=site', '/admin/etapes', '/admin/onboarding', '/admin/onboarding/1', '/admin/onboarding/1/modules', '/admin/onboarding/1/prerequis', '/admin/onboarding/1/parc', '/admin/onboarding/1/configuration?connexion=4', '/admin/onboarding/1/mapping?connexion=4', '/admin/onboarding/1/boutiques?connexion=4', '/admin/onboarding/1/historique?connexion=4', '/admin/onboarding/1/coherence?connexion=4', '/admin/onboarding/1/synchro?connexion=4', '/admin/connexions', '/admin/connecteurs?editer=gopos', '/admin/contrats', '/admin/contrats/TFB-2026-0001-C', '/admin/prospects/1', '/admin/tarifs', '/admin/prestations',
  '/admin/offres', '/admin/offres/nouvelle', '/admin/utilisateurs', '/admin/societe', '/admin/onboarding/4/entreprise', '/admin/offres/TFB-2026-9001', '/admin/clients',
  '/admin/leads', '/admin/sync', '/admin/reglages',
];

const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const ctx = await b.newContext({ viewport: { width: 1440, height: 1000 } });
await ctx.route('**://fonts.googleapis.com/**', (r) => r.abort());
await ctx.route('**://fonts.gstatic.com/**', (r) => r.abort());
const p = await ctx.newPage();
await p.goto(`${B}/admin/connexion`, { waitUntil: 'load' });
await p.fill('input[name="mot_de_passe"]', MDP);
await p.click('button[type="submit"]');
await p.waitForLoadState('load');

const trouves = new Map();
for (const chemin of PAGES) {
  const rep = await p.goto(`${B}${chemin}`, { waitUntil: 'load' });
  if (rep.status() >= 400) continue;
  await p.waitForFunction(() => document.readyState === 'complete');

  for (const s of await p.evaluate(() => {
    const out = [];
    for (const bloc of document.querySelectorAll('.bloc')) {
      const cadre = bloc.getBoundingClientRect();
      const padBloc = parseFloat(getComputedStyle(bloc).paddingLeft) || 0;
      // On mesure ce qui se voit — un champ, un bouton, une étiquette — et
      // non la boîte qui le porte : un padding posé sur le conteneur ne
      // déplace pas sa bordure, seulement son contenu.
      // Deux familles à surveiller, et la seconde manquait :
      //   · ce qui se voit — un champ, un bouton, une étiquette ;
      //   · ce qui **dessine une surface** — une bande, un encadré, une
      //     vignette. Son padding intérieur ne déplace pas sa bordure : elle
      //     vient buter contre celle du bloc, et rien ne le signalait.
      const visibles = 'input:not([type=hidden]), textarea, select, .bouton, button, label, p, h2, h3';
      const candidats = new Set(bloc.querySelectorAll(visibles));
      for (const el of bloc.querySelectorAll('*')) {
        const s = getComputedStyle(el);
        const bordee = parseFloat(s.borderLeftWidth) > 0 || parseFloat(s.borderTopWidth) > 0;
        const fond = s.backgroundColor !== 'rgba(0, 0, 0, 0)' && s.backgroundColor !== 'transparent';
        if (bordee || fond) candidats.add(el);
      }

      for (const el of candidats) {
        const r = el.getBoundingClientRect();
        if (r.width === 0 || r.height === 0) continue;
        if (el.closest('.roule')) continue;
        if (el.classList.contains('bloc')) continue;
        // L'en-tête, le pied et le corps d'un bloc vont d'une bordure à
        // l'autre par construction : ils portent leur propre padding.
        if (el.closest('.bloc__tete, .bloc__pied, .bloc__corps')) continue;
        const ecart = Math.round(r.left - cadre.left - padBloc);
        if (ecart > 1) continue;
        const porteur = el.parentElement;
        out.push(`${el.tagName.toLowerCase()} dans .${[...porteur.classList].filter((c) => !/^astro-/.test(c)).join('.') || porteur.tagName.toLowerCase()}`);
      }
    }
    return [...new Set(out)];
  })) {
    if (!trouves.has(s)) trouves.set(s, []);
    trouves.get(s).push(chemin);
  }
}
await b.close();

if (trouves.size === 0) console.log('✓ rien ne touche le bord de son bloc.');
else {
  console.log('── Contenu collé au bord de son bloc ──');
  for (const [quoi, ou] of [...trouves].sort((a, b) => b[1].length - a[1].length)) {
    const u = [...new Set(ou)];
    console.log(`  ${quoi.padEnd(34)} ${u.length} écran(s) : ${u.slice(0, 4).join(', ')}${u.length > 4 ? '…' : ''}`);
  }
}
