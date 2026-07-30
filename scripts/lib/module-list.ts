/**
 * Lecture et validation de config/modules.json — la liste des dépôts que la
 * routine matinale parcourt.
 *
 * Comme validateManifest, ces fonctions ne lèvent jamais sur un contenu
 * douteux : une tournée de quinze dépôts qui meurt sur une virgule du
 * quatrième n'ingère rien du tout. On accumule les reproches et on continue.
 */

export interface ModuleEntry {
  /** `owner/nom` — provenance écrite en base, et source du clone si `path` est absent. */
  repo: string;
  /** Répertoire déjà présent sur la machine. Lu en lecture seule, jamais supprimé. */
  path?: string;
  /** Application à photographier. Sans elle, le contenu est ingéré sans captures. */
  url?: string;
  /** Routes explicites, sinon celles du manifeste. */
  routes?: string[];
  key?: string;
  group?: string;
  icon?: string;
  /** Certificat TLS non vérifié. Captures internes uniquement. */
  insecure?: boolean;
  /**
   * NOM de la variable d'environnement qui porte le cookie de session — pas sa
   * valeur. Le fichier de configuration est lisible ; un jeton ne doit pas y être.
   */
  cookieEnv?: string;
  /** `false` sort le dépôt de la tournée sans l'effacer de la liste. */
  enabled?: boolean;
}

export interface ListIssue {
  level: 'error' | 'warning';
  message: string;
}

export interface ParsedList {
  modules: ModuleEntry[];
  issues: ListIssue[];
}

const str = (v: unknown): string | undefined => (typeof v === 'string' && v.trim() ? v.trim() : undefined);

/**
 * Valide la liste. Une entrée invalide est écartée avec son motif ; les autres
 * passent. Renvoyer une liste vide et un motif vaut mieux qu'une exception au
 * milieu d'un cron.
 */
export function parseModuleList(raw: unknown): ParsedList {
  const issues: ListIssue[] = [];
  const modules: ModuleEntry[] = [];

  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    issues.push({ level: 'error', message: 'Le fichier doit contenir un objet JSON.' });
    return { modules, issues };
  }

  const root = raw as Record<string, unknown>;
  const defaults = (typeof root.defaults === 'object' && root.defaults !== null ? root.defaults : {}) as Record<string, unknown>;
  const list = root.modules;

  if (!Array.isArray(list)) {
    issues.push({ level: 'error', message: '« modules » est absent ou n\'est pas un tableau.' });
    return { modules, issues };
  }

  const seen = new Set<string>();

  for (const [i, item] of list.entries()) {
    const where = `modules[${i}]`;
    if (typeof item !== 'object' || item === null || Array.isArray(item)) {
      issues.push({ level: 'error', message: `${where} n'est pas un objet — ignoré.` });
      continue;
    }
    const e = item as Record<string, unknown>;

    const repo = str(e.repo);
    const path = str(e.path);
    if (!repo && !path) {
      issues.push({ level: 'error', message: `${where} n'a ni « repo » ni « path » — ignoré.` });
      continue;
    }

    const label = repo || path!;
    if (seen.has(label)) {
      issues.push({ level: 'warning', message: `${label} apparaît deux fois — la seconde entrée est ignorée.` });
      continue;
    }
    seen.add(label);

    if (e.enabled === false) continue;

    // Un cookie écrit en clair dans la liste finirait dans une sauvegarde, un
    // dépôt, ou le presse-papier de quelqu'un. On refuse l'entrée plutôt que de
    // s'en servir.
    if (typeof e.cookie === 'string') {
      issues.push({ level: 'error', message: `${label} : « cookie » en clair — utilisez « cookieEnv » et une variable d'environnement. Entrée ignorée.` });
      continue;
    }

    const routes = Array.isArray(e.routes)
      ? e.routes.filter((r): r is string => typeof r === 'string' && r.trim() !== '')
      : undefined;

    if (e.url === undefined && routes?.length) {
      issues.push({ level: 'warning', message: `${label} déclare des routes sans « url » — aucune capture ne sera prise.` });
    }

    modules.push({
      repo: repo || label,
      path,
      url: str(e.url),
      routes: routes?.length ? routes : undefined,
      key: str(e.key),
      group: str(e.group),
      icon: str(e.icon),
      insecure: typeof e.insecure === 'boolean' ? e.insecure : defaults.insecure === true,
      cookieEnv: str(e.cookieEnv),
    });
  }

  if (modules.length === 0 && issues.length === 0) {
    issues.push({ level: 'warning', message: 'Aucun dépôt actif dans la liste.' });
  }

  return { modules, issues };
}

/** Les arguments à passer au CLI d'ingestion pour une entrée. */
export function toArgv(entry: ModuleEntry, dryRun: boolean): string[] {
  const argv: string[] = [];
  if (entry.path) argv.push('--path', entry.path);
  if (entry.repo) argv.push('--repo', entry.repo);
  if (entry.url) argv.push('--url', entry.url);
  if (entry.routes?.length) argv.push('--routes', entry.routes.join(','));
  if (entry.key) argv.push('--key', entry.key);
  if (entry.group) argv.push('--group', entry.group);
  if (entry.icon) argv.push('--icon', entry.icon);
  if (entry.insecure) argv.push('--insecure');
  if (dryRun) argv.push('--dry-run');
  return argv;
}
