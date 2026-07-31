/**
 * Lecture d'un dépôt GitHub : métadonnées, README et extraits de code source.
 *
 * Le but n'est pas de tout lire — c'est de constituer un « digest » compact et
 * représentatif que l'IA pourra transformer en contenu éditorial. On privilégie
 * donc les fichiers qui décrivent les fonctionnalités (pages, routes, écrans,
 * contrôleurs, modèles) plutôt que la plomberie.
 */

const API = 'https://api.github.com';

/** Extensions de fichiers considérées comme du code utile. */
const EXTENSIONS = new Set([
  '.js', '.mjs', '.cjs', '.jsx', '.ts', '.tsx', '.vue', '.svelte',
  '.php', '.py', '.go', '.rb', '.java', '.kt', '.cs', '.sql', '.md',
]);

/** Chemins ignorés : dépendances, artefacts de build, fichiers générés. */
const CHEMINS_IGNORES = [
  'node_modules/', 'vendor/', 'dist/', 'build/', '.next/', '.nuxt/', 'out/',
  'coverage/', '.git/', 'storage/framework/', 'public/build/', 'assets/vendor/',
];

/** Fichiers ignorés par nom. */
const FICHIERS_IGNORES = [
  'package-lock.json', 'composer.lock', 'yarn.lock', 'pnpm-lock.yaml',
  'LICENSE', 'LICENSE.md', 'CHANGELOG.md',
];

/** Segments de chemin qui signalent un fichier « métier », donc prioritaire. */
const SEGMENTS_PRIORITAIRES = [
  'pages', 'page', 'routes', 'route', 'views', 'view', 'screens', 'screen',
  'controllers', 'controller', 'models', 'model', 'modules', 'features',
  'components', 'services', 'api', 'app', 'src',
];

const TAILLE_MAX_FICHIER = 200 * 1024; // on ne télécharge pas les gros blobs
const EXTRAIT_MAX = 6000;              // caractères conservés par fichier
const DIGEST_MAX = 140000;             // budget total d'extraits de code
const README_MAX = 20000;
const NB_FICHIERS_MAX = 40;

/** Erreur d'ingestion portant un code exploitable par l'appelant. */
export class ErreurDepot extends Error {
  constructor(code, message) {
    super(message);
    this.code = code;
  }
}

/** Appel à l'API GitHub, avec jeton optionnel. */
async function appelGithub(chemin, token) {
  const reponse = await fetch(`${API}${chemin}`, {
    headers: {
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'landing-tfb-pipeline',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });

  if (reponse.status === 404) return { absent: true };
  if (reponse.status === 409) throw new ErreurDepot('depot_vide', 'Dépôt vide (aucun commit).');
  if (reponse.status === 403 || reponse.status === 429) {
    const reste = reponse.headers.get('x-ratelimit-remaining');
    throw new ErreurDepot(
      'quota',
      `Accès refusé par GitHub (${reponse.status}${reste !== null ? `, quota restant ${reste}` : ''}). Jeton absent ou insuffisant ?`,
    );
  }
  if (!reponse.ok) {
    throw new ErreurDepot('github', `GitHub ${chemin} → ${reponse.status}`);
  }
  return reponse.json();
}

/** Score de pertinence d'un chemin : plus c'est haut, plus on le garde. */
function scoreChemin(chemin) {
  const bas = chemin.toLowerCase();
  let score = 0;
  const segments = bas.split('/');

  for (const segment of segments) {
    const nu = segment.replace(/\.[^.]+$/, '');
    if (SEGMENTS_PRIORITAIRES.includes(nu)) score += 3;
  }
  if (bas.endsWith('readme.md')) score += 6;
  if (bas.endsWith('package.json') || bas.endsWith('composer.json')) score += 4;
  if (/docs?\//.test(bas) && bas.endsWith('.md')) score += 3;
  if (bas.endsWith('.sql')) score += 2;

  // Un fichier près de la racine décrit plus souvent l'ensemble qu'une feuille.
  score -= Math.max(0, segments.length - 3);
  return score;
}

/** Filtre + tri de l'arbre Git pour ne garder que les fichiers intéressants. */
function selectionnerFichiers(arbre) {
  return arbre
    .filter((entree) => entree.type === 'blob')
    .filter((entree) => (entree.size || 0) <= TAILLE_MAX_FICHIER)
    .filter((entree) => !CHEMINS_IGNORES.some((prefixe) => entree.path.includes(prefixe)))
    .filter((entree) => !FICHIERS_IGNORES.includes(entree.path.split('/').pop()))
    .filter((entree) => !/\.min\.(js|css)$/.test(entree.path))
    .filter((entree) => {
      const nom = entree.path.split('/').pop();
      const point = nom.lastIndexOf('.');
      if (point < 0) return false;
      const ext = nom.slice(point);
      if (ext === '.json') return nom === 'package.json' || nom === 'composer.json';
      return EXTENSIONS.has(ext);
    })
    .map((entree) => ({ ...entree, score: scoreChemin(entree.path) }))
    .sort((a, b) => b.score - a.score || a.path.localeCompare(b.path));
}

/** Télécharge le contenu d'un blob (base64 → utf8). */
async function lireBlob(repo, sha, token) {
  const blob = await appelGithub(`/repos/${repo}/git/blobs/${sha}`, token);
  if (!blob || blob.absent || blob.encoding !== 'base64') return null;
  return Buffer.from(blob.content, 'base64').toString('utf8');
}

/** Exécute `taches` par lots pour ne pas saturer l'API GitHub. */
async function parLots(elements, taille, traiter) {
  const resultats = [];
  for (let i = 0; i < elements.length; i += taille) {
    const lot = elements.slice(i, i + taille);
    resultats.push(...(await Promise.all(lot.map(traiter))));
  }
  return resultats;
}

/**
 * Charge tout ce qu'il faut savoir d'un dépôt.
 * @param {{repo: string, ref?: string, token?: string}} options
 * @returns {Promise<{repo,ref,sha,description,topics,langages,readme,arbre,extraits,digest}>}
 */
export async function chargerDepot({ repo, ref, token }) {
  const meta = await appelGithub(`/repos/${repo}`, token);
  if (meta.absent) {
    throw new ErreurDepot('introuvable', `Dépôt ${repo} introuvable (ou jeton sans accès).`);
  }

  const branche = ref || meta.default_branch || 'main';

  const commit = await appelGithub(`/repos/${repo}/commits/${branche}`, token);
  if (commit.absent) {
    throw new ErreurDepot('ref_introuvable', `Référence « ${branche} » introuvable sur ${repo}.`);
  }
  const sha = commit.sha;

  // README : facultatif, un dépôt sans README reste ingérable.
  let readme = null;
  const fiche = await appelGithub(`/repos/${repo}/readme?ref=${encodeURIComponent(branche)}`, token);
  if (fiche && !fiche.absent && fiche.content) {
    readme = Buffer.from(fiche.content, 'base64').toString('utf8').slice(0, README_MAX);
  }

  const langagesBruts = await appelGithub(`/repos/${repo}/languages`, token);
  const langages = langagesBruts && !langagesBruts.absent ? Object.keys(langagesBruts) : [];

  const arbreBrut = await appelGithub(`/repos/${repo}/git/trees/${sha}?recursive=1`, token);
  const arbre = arbreBrut && !arbreBrut.absent ? arbreBrut.tree || [] : [];
  if (arbre.length === 0) {
    throw new ErreurDepot('depot_vide', `Dépôt ${repo} vide sur ${branche}.`);
  }

  const candidats = selectionnerFichiers(arbre).slice(0, NB_FICHIERS_MAX);
  const contenus = await parLots(candidats, 5, async (entree) => {
    try {
      const contenu = await lireBlob(repo, entree.sha, token);
      return contenu ? { chemin: entree.path, contenu: contenu.slice(0, EXTRAIT_MAX) } : null;
    } catch {
      return null; // un fichier illisible ne doit pas casser l'ingestion
    }
  });

  // On empile les extraits jusqu'au budget de caractères.
  const extraits = [];
  let total = 0;
  for (const extrait of contenus.filter(Boolean)) {
    if (total + extrait.contenu.length > DIGEST_MAX) break;
    extraits.push(extrait);
    total += extrait.contenu.length;
  }

  const chemins = arbre.filter((e) => e.type === 'blob').map((e) => e.path);

  return {
    repo,
    ref: branche,
    sha,
    description: meta.description || '',
    topics: meta.topics || [],
    langages,
    readme,
    arbre: chemins,
    extraits,
    digest: construireDigest({
      repo,
      description: meta.description || '',
      topics: meta.topics || [],
      langages,
      readme,
      chemins,
      extraits,
    }),
  };
}

/** Assemble le texte envoyé à l'IA. */
function construireDigest({ repo, description, topics, langages, readme, chemins, extraits }) {
  const morceaux = [];

  morceaux.push(`# Dépôt : ${repo}`);
  if (description) morceaux.push(`Description GitHub : ${description}`);
  if (topics.length) morceaux.push(`Topics : ${topics.join(', ')}`);
  if (langages.length) morceaux.push(`Langages : ${langages.join(', ')}`);

  morceaux.push('\n## README\n');
  morceaux.push(readme || '(aucun README dans ce dépôt)');

  morceaux.push('\n## Arborescence (extrait)\n');
  morceaux.push(chemins.slice(0, 400).join('\n'));
  if (chemins.length > 400) morceaux.push(`... et ${chemins.length - 400} autres fichiers`);

  morceaux.push('\n## Extraits de code\n');
  for (const extrait of extraits) {
    morceaux.push(`\n----- ${extrait.chemin} -----\n${extrait.contenu}`);
  }

  return morceaux.join('\n');
}
