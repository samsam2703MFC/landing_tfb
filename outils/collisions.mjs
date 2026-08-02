/**
 * Deux contrôles de rangée, sur tous les écrans de la console.
 *
 *   · **Collision** — deux cellules voisines qui se chevauchent. Une grille
 *     dont une colonne est trop étroite laisse son contenu déborder sur la
 *     suivante : rien ne casse, mais deux choses se lisent l'une sur l'autre.
 *   · **Désalignement** — dans une rangée de champs, les saisies qui ne
 *     partent pas du même trait. L'œil suit une ligne ; quand elle ondule, la
 *     rangée se lit de travers.
 */
import { chromium } from 'playwright';

const B = process.argv[2], MDP = process.argv[3];
const PAGES = [
  '/admin', '/admin/modules', '/admin/composants', '/admin/leviers', '/admin/captures',
  '/admin/textes', '/admin/site', '/admin/questions', '/admin/langues',
  '/admin/traductions?langue=en&entite=site', '/admin/tarifs', '/admin/prestations',
  '/admin/etapes', '/admin/offres', '/admin/offres/nouvelle', '/admin/utilisateurs',
  '/admin/clients', '/admin/leads', '/admin/sync', '/admin/reglages',
];

const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const LARGEUR = Number(process.argv[4]) || 1600;
const ctx = await b.newContext({ viewport: { width: LARGEUR, height: 1000 } });
await ctx.route('**://fonts.g*.com/**', (r) => r.abort());
const p = await ctx.newPage();
p.setDefaultNavigationTimeout(20000);
await p.goto(`${B}/admin/connexion`, { waitUntil: 'domcontentloaded' });
await p.fill('input[name="mot_de_passe"]', MDP);
await p.click('button[type="submit"]');
await p.waitForLoadState('domcontentloaded');

const liens = await p.evaluate(() =>
  [...document.querySelectorAll('a[href]')].map((a) => a.getAttribute('href')));
const extras = [];
for (const motif of ['/admin/modules/', '/admin/offres/']) {
  const t = liens.find((h) => h && h.includes(motif) && !h.includes('nouvelle') && !h.includes('annexe'));
  if (t) extras.push(t.replace('/landing_tfb', ''));
}

const chevauchements = [];
const desalignements = [];

for (const chemin of [...PAGES, ...extras]) {
  const rep = await p.goto(`${B}${chemin}`, { waitUntil: 'domcontentloaded' });
  if (!rep || rep.status() >= 400) continue;

  const trouve = await p.evaluate(() => {
    const nom = (el) => {
      const c = [...el.classList].filter((x) => !/^astro-/.test(x)).join('.');
      return c ? `.${c}` : el.tagName.toLowerCase();
    };
    const visible = (el) => {
      const r = el.getBoundingClientRect();
      return r.width > 0 && r.height > 0;
    };
    const chevauche = [];
    const desaligne = [];

    // ── Chevauchements dans une rangée ────────────────────────────────────
    // On compare les enfants directs d'une grille ou d'une rangée souple :
    // deux boîtes de la même rangée qui se recouvrent de plus d'un pixel se
    // marchent dessus.
    for (const parent of document.querySelectorAll('*')) {
      const s = getComputedStyle(parent);
      if (s.display !== 'grid' && s.display !== 'flex') continue;
      if (s.flexWrap === 'wrap' && s.display === 'flex') continue;
      // Une case à cocher posée **sous** son décor — la pastille de levier, la
      // loupe d'un champ de recherche — recouvre volontairement son voisin.
      const superpose = (el) => {
        const st = getComputedStyle(el);
        return st.position === 'absolute' || st.position === 'fixed'
          || Number(st.opacity) === 0 || st.pointerEvents === 'none';
      };
      const enfants = [...parent.children].filter(visible).filter((e) => !superpose(e));
      if (enfants.length < 2) continue;

      for (let i = 0; i < enfants.length - 1; i += 1) {
        for (let j = i + 1; j < enfants.length; j += 1) {
          const a = enfants[i].getBoundingClientRect();
          const c = enfants[j].getBoundingClientRect();
          // Même rangée ? Leurs bandes verticales doivent se croiser.
          const memeRangee = a.top < c.bottom - 2 && c.top < a.bottom - 2;
          if (!memeRangee) continue;
          const recouvrement = Math.min(a.right, c.right) - Math.max(a.left, c.left);
          if (recouvrement > 1) {
            chevauche.push(
              `${nom(parent)} : ${nom(enfants[i])} et ${nom(enfants[j])} se recouvrent de ${Math.round(recouvrement)} px`,
            );
          }
        }
      }
    }

    // ── Saisies désalignées dans une rangée de champs ─────────────────────
    for (const duo of document.querySelectorAll('.duo, .filtres')) {
      const champs = [...duo.children].filter((e) => e.classList.contains('champ')).filter(visible);
      const rangees = new Map();
      for (const champ of champs) {
        const y = Math.round(champ.getBoundingClientRect().top);
        if (!rangees.has(y)) rangees.set(y, []);
        rangees.get(y).push(champ);
      }
      for (const [, groupe] of rangees) {
        if (groupe.length < 2) continue;
        const hauts = groupe.map((champ) => {
          const saisie = champ.querySelector('input:not([type=hidden]), textarea, select, .case');
          return saisie ? Math.round(saisie.getBoundingClientRect().top) : null;
        }).filter((v) => v !== null);
        if (hauts.length < 2) continue;
        const ecart = Math.max(...hauts) - Math.min(...hauts);
        if (ecart > 2) {
          desaligne.push(
            `${groupe.map((c) => (c.querySelector('label, .legende')?.textContent || '?').trim().slice(0, 22)).join(' | ')} — ${ecart} px d'écart`,
          );
        }
      }
    }

    return { chevauche: [...new Set(chevauche)], desaligne: [...new Set(desaligne)] };
  });

  for (const c of trouve.chevauche) chevauchements.push(`${chemin.padEnd(34)} ${c}`);
  for (const d of trouve.desaligne) desalignements.push(`${chemin.padEnd(34)} ${d}`);
}
await b.close();

if (chevauchements.length === 0) console.log('✓ aucune colonne ne déborde sur sa voisine.');
else {
  console.log('── Cellules qui se marchent dessus ──');
  for (const l of chevauchements) console.log(`  ${l}`);
}

if (desalignements.length === 0) console.log('✓ dans chaque rangée, les saisies partent du même trait.');
else {
  console.log('\n── Saisies désalignées ──');
  for (const l of desalignements) console.log(`  ${l}`);
}
