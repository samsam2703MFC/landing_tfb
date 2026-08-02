/**
 * La respiration : tout ce qui se lit doit avoir de l'air autour.
 *
 * Deux mesures, sur tous les écrans de la console et à trois largeurs.
 *
 *   · **Contre un bord** — un texte, une étiquette, une saisie trop proche du
 *     bord de la surface qui le porte. Une surface, ici, est tout ce qui
 *     dessine quelque chose : un bloc, une vignette, un encadré.
 *   · **Contre un voisin** — deux éléments qui s'empilent sans intervalle.
 *     Une étiquette collée à la ligne du dessus se lit comme sa suite.
 *
 * Le seuil est bas exprès : on cherche ce qui manque d'air, pas ce qui en a
 * moins qu'ailleurs. Une console dense reste dense.
 *
 * CE QU'IL FAUT SAVOIR AVANT DE LE CROIRE — la mesure « contre un voisin »
 * compare le contenu le plus bas du premier au contenu le plus haut du
 * second. Quand un conteneur imbriqué déborde sa propre boîte — une aide
 * qui dépasse, un champ à cheval sur deux rangées de grille — elle annonce
 * un écart nul là où l'écran en montre trente. Vérifiez au pixel avant de
 * corriger : plusieurs signalements de cette liste sont des artefacts, et
 * modifier le CSS pour les faire taire abîmerait une mise en page correcte.
 *
 * La mesure « contre un bord », elle, est fiable : elle compare deux boîtes
 * dont l'une contient l'autre.
 */
import { chromium } from 'playwright';

const B = process.argv[2], MDP = process.argv[3];
const LARGEUR = Number(process.argv[4]) || 1600;

/** Ce qu'on exige, en pixels. */
const BORD_H = 12;
const BORD_V = 8;
const VOISIN = 12;

const PAGES = [
  '/admin', '/admin/modules', '/admin/composants', '/admin/leviers', '/admin/captures',
  '/admin/textes', '/admin/site', '/admin/questions', '/admin/langues',
  '/admin/traductions?langue=en&entite=site', '/admin/tarifs', '/admin/prestations',
  '/admin/etapes', '/admin/onboarding', '/admin/onboarding/1', '/admin/onboarding/1/fin', '/admin/onboarding/1/modules', '/admin/onboarding/1/prerequis', '/admin/onboarding/1/parc', '/admin/onboarding/1/configuration?connexion=4', '/admin/onboarding/1/mapping?connexion=4', '/admin/onboarding/1/boutiques?connexion=4', '/admin/onboarding/1/historique?connexion=4', '/admin/onboarding/1/coherence?connexion=4', '/admin/onboarding/1/synchro?connexion=4', '/admin/connexions', '/admin/connecteurs?editer=gopos', '/admin/contrats', '/admin/contrats/TFB-2026-0001-C', '/admin/prospects/1', '/admin/offres', '/admin/offres/nouvelle', '/admin/utilisateurs',
  '/admin/societe', '/admin/onboarding/4/entreprise', '/admin/offres/TFB-2026-9001', '/admin/clients', '/admin/leads', '/admin/sync', '/admin/reglages',
];

const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
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

const bords = new Map();
const voisins = new Map();
const noter = (carte, quoi, ou) => {
  if (!carte.has(quoi)) carte.set(quoi, new Set());
  carte.get(quoi).add(ou);
};

for (const chemin of [...PAGES, ...extras]) {
  const rep = await p.goto(`${B}${chemin}`, { waitUntil: 'domcontentloaded' });
  if (!rep || rep.status() >= 400) continue;

  const trouve = await p.evaluate(({ bordH, bordV, voisin }) => {
    const nom = (el) => {
      const c = [...el.classList].filter((x) => !/^astro-/.test(x)).join('.');
      return c ? `${el.tagName.toLowerCase()}.${c}` : el.tagName.toLowerCase();
    };
    const boite = (el) => el.getBoundingClientRect();
    const vu = (el) => {
      const r = boite(el);
      const s = getComputedStyle(el);
      if (r.width === 0 || r.height === 0) return false;
      if (s.visibility === 'hidden' || Number(s.opacity) === 0) return false;
      // Un dépli fermé garde ses enfants mesurables, mais hors de sa boîte :
      // les mesurer donnerait des distances négatives par centaines.
      const depli = el.closest('details');
      if (depli && !depli.open && !el.closest('summary')) return false;
      // `.invisible` est lu par les lecteurs d'écran et par eux seuls : sa
      // boîte d'un pixel n'a aucune distance à respecter.
      if (el.classList.contains('invisible') || el.closest('.invisible')) return false;
      if (typeof el.checkVisibility === 'function'
          && !el.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true })) return false;
      return true;
    };
    /** Une surface : ce qui dessine un fond ou une bordure. */
    const surface = (el) => {
      const s = getComputedStyle(el);
      return s.backgroundColor !== 'rgba(0, 0, 0, 0)'
        || parseFloat(s.borderLeftWidth) > 0 || parseFloat(s.borderTopWidth) > 0;
    };
    /** Ce qui porte du texte ou attend une saisie. */
    const CONTENU = 'label, .legende, .champ__aide, p, h1, h2, h3, strong, code, span.etat, '
      + 'input:not([type=hidden]), textarea, select, button, .bouton';

    const contreBord = [];
    const contreVoisin = [];

    // ── Contre le bord de sa surface ────────────────────────────────────
    for (const el of document.querySelectorAll(CONTENU)) {
      if (!vu(el)) continue;
      const s = getComputedStyle(el);
      if (s.position === 'absolute' || s.position === 'fixed') continue;
      // La surface la plus proche au-dessus de lui, en sautant les
      // conteneurs transparents qui n'ont pas de bord à respecter.
      let hote = el.parentElement;
      while (hote && hote !== document.body && !surface(hote)) hote = hote.parentElement;
      if (!hote || hote === document.body) continue;
      // Une table va d'un bord à l'autre : c'est sa cellule qui porte l'air.
      if (el.closest('table') && !hote.closest('table')) continue;

      const r = boite(el);
      const h = boite(hote);
      const gauche = Math.round(r.left - h.left);
      const droite = Math.round(h.right - r.right);
      const haut = Math.round(r.top - h.top);
      const bas = Math.round(h.bottom - r.bottom);
      const griefs = [];
      if (gauche < bordH) griefs.push(`gauche (${gauche})`);
      if (droite < bordH) griefs.push(`droite (${droite})`);
      if (haut < bordV) griefs.push(`haut (${haut})`);
      if (bas < bordV) griefs.push(`bas (${bas})`);
      if (griefs.length > 0) {
        contreBord.push(`${nom(el)} dans ${nom(hote)} — ${griefs.join(', ')}`);
      }
    }

    // ── Contre son voisin du dessus ─────────────────────────────────────
    //
    // On compare ce qui se **lit**, pas les boîtes : deux conteneurs collés
    // l'un à l'autre mais rembourrés chacun de quatorze pixels laissent
    // vingt-huit pixels entre leurs textes, et il n'y a rien à corriger.
    // La boîte de contenu : la boîte visible, rentrée de son propre padding.
    // Sans cela, un pied de bloc dont le texte est un simple nœud — sans
    // balise autour — se mesurerait à sa bordure et paraîtrait collé.
    const dedansDe = (el) => {
      const r = boite(el);
      const s = getComputedStyle(el);
      return {
        top: r.top + parseFloat(s.paddingTop || 0),
        bottom: r.bottom - parseFloat(s.paddingBottom || 0),
      };
    };
    const contenus = (el) => [...el.querySelectorAll(CONTENU)]
      .filter(vu)
      // Une cellule de table n'est pas du texte : sa boîte va d'un filet à
      // l'autre, et c'est ce qu'elle contient qui se lit.
      .filter((e) => e.tagName !== 'TD' && e.tagName !== 'TH');
    const finDe = (el) => {
      const l = contenus(el);
      return l.length ? Math.max(...l.map((e) => boite(e).bottom)) : dedansDe(el).bottom;
    };
    const debutDe = (el) => {
      const l = contenus(el);
      return l.length ? Math.min(...l.map((e) => boite(e).top)) : dedansDe(el).top;
    };

    for (const parent of document.querySelectorAll('.bloc, .bloc__corps, form, fieldset')) {
      const enfants = [...parent.children].filter(vu);
      for (let i = 1; i < enfants.length; i += 1) {
        const avant = boite(enfants[i - 1]);
        const apres = boite(enfants[i]);
        // Empilés, et non côte à côte.
        if (apres.top < avant.bottom - 1) continue;
        const ecart = Math.round(debutDe(enfants[i]) - finDe(enfants[i - 1]));
        if (ecart < voisin) {
          contreVoisin.push(
            `${nom(enfants[i])} suit ${nom(enfants[i - 1])} à ${ecart} px, dans ${nom(parent)}`,
          );
        }
      }
    }

    return { contreBord: [...new Set(contreBord)], contreVoisin: [...new Set(contreVoisin)] };
  }, { bordH: BORD_H, bordV: BORD_V, voisin: VOISIN });

  for (const l of trouve.contreBord) noter(bords, l, chemin);
  for (const l of trouve.contreVoisin) noter(voisins, l, chemin);
}
await b.close();

const dire = (titre, carte) => {
  if (carte.size === 0) return;
  console.log(`\n── ${titre} ──`);
  for (const [quoi, ou] of [...carte].sort((a, c) => c[1].size - a[1].size)) {
    const l = [...ou];
    console.log(`  ${quoi}\n      ${l.length} écran(s) : ${l.slice(0, 3).join(', ')}${l.length > 3 ? '…' : ''}`);
  }
};

if (bords.size === 0 && voisins.size === 0) {
  console.log(`✓ ${LARGEUR} px : tout ce qui se lit a de l'air autour.`);
} else {
  console.log(`── ${LARGEUR} px ──`);
  dire('Contre le bord de sa surface', bords);
  dire('Collé à son voisin du dessus', voisins);
}
