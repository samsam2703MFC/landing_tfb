/**
 * Dérivation et validation des métadonnées d'un module, à partir d'un dépôt.
 *
 * Fonctions pures, sans base ni réseau : c'est la partie testable de la routine
 * matinale (prompt_technique_tfb.md §6).
 */

/** Groupes d'affichage — doivent correspondre aux clés `group.*` de tfb_translations. */
export const MODULE_GROUPS = ['Ventes', 'Finance', 'Marketing', 'Logistique', 'Assistance', 'Terrain'] as const;
export type ModuleGroup = (typeof MODULE_GROUPS)[number];

/** Icônes disponibles dans public/icons, par usage typique de module. */
export const DEFAULT_ICON = 'layers';

export interface RepoRef {
  /** `owner/name`, tel que stocké dans tfb_modules.repo. */
  slugPath: string;
  /** Nom du dépôt seul. */
  name: string;
  owner: string;
  cloneUrl: string;
  /**
   * Répertoire déjà présent sur la machine, à lire au lieu de cloner. Le code
   * d'un module tourne souvent déjà sur le serveur : inutile d'exiger un accès
   * distant et des identifiants pour lire un fichier qui est là.
   */
  localPath?: string;
}

/** Source locale : le dépôt est un répertoire, pas une URL. */
export function localRepo(dir: string, repoLabel?: string): RepoRef {
  const name = dir.replace(/\/+$/, '').split('/').pop() || 'module';
  const label = repoLabel || name;
  return {
    owner: label.includes('/') ? label.split('/')[0]! : 'local',
    name,
    slugPath: label,
    cloneUrl: dir,
    localPath: dir,
  };
}

/**
 * Accepte les formes usuelles : URL https, URL ssh, ou simplement `owner/name`.
 * Renvoie null si rien d'exploitable — l'appelant décide quoi en faire.
 */
export function parseRepo(input: string): RepoRef | null {
  const trimmed = input.trim().replace(/\.git$/, '').replace(/\/+$/, '');
  if (!trimmed) return null;

  // git@github.com:owner/name
  const ssh = /^git@([^:]+):([^/]+)\/(.+)$/.exec(trimmed);
  if (ssh) {
    const [, host, owner, name] = ssh;
    return { owner: owner!, name: name!, slugPath: `${owner}/${name}`, cloneUrl: `https://${host}/${owner}/${name}.git` };
  }

  // https://github.com/owner/name
  if (/^https?:\/\//.test(trimmed)) {
    try {
      const url = new URL(trimmed);
      const parts = url.pathname.split('/').filter(Boolean);
      if (parts.length < 2) return null;
      const [owner, name] = parts;
      return { owner: owner!, name: name!, slugPath: `${owner}/${name}`, cloneUrl: `${url.origin}/${owner}/${name}.git` };
    } catch {
      return null;
    }
  }

  // owner/name
  const short = /^([^/\s]+)\/([^/\s]+)$/.exec(trimmed);
  if (short) {
    const [, owner, name] = short;
    return { owner: owner!, name: name!, slugPath: `${owner}/${name}`, cloneUrl: `https://github.com/${owner}/${name}.git` };
  }

  return null;
}

/**
 * Clé de module : minuscules, alphanumérique et tirets. C'est l'identifiant sur
 * lequel s'appuient tfb_translations et la routine, donc il doit être stable et
 * immuable une fois publié.
 */
export function toModuleKey(name: string): string {
  const key = name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/^(tfb|module)[-_]/, '')
    .replace(/[-_]?(module|service|app|api)$/, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
  return key || 'module';
}

/** Contenu que le dépôt peut déclarer lui-même, dans un `tfb-module.json` à sa racine. */
export interface ModuleManifest {
  key?: string;
  slug?: string;
  group?: string;
  icon?: string;
  redirectUrl?: string;
  /** Routes à capturer, relatives à l'URL de l'application. */
  routes?: string[];
  /** Contenu par locale. `fr` est obligatoire : c'est le repli. */
  content?: Record<string, {
    name?: string;
    description?: string;
    bullets?: string[];
    metricValue?: string;
    metricLabel?: string;
  }>;
}

export interface ManifestIssue {
  level: 'error' | 'warning';
  message: string;
}

/**
 * Valide un manifeste sans jamais lever : un dépôt tiers peut contenir n'importe
 * quoi, et la routine doit signaler plutôt que planter au milieu d'un cron.
 */
export function validateManifest(raw: unknown): { manifest: ModuleManifest; issues: ManifestIssue[] } {
  const issues: ManifestIssue[] = [];
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) {
    return { manifest: {}, issues: [{ level: 'error', message: 'tfb-module.json doit contenir un objet JSON.' }] };
  }
  const input = raw as Record<string, unknown>;
  const manifest: ModuleManifest = {};

  const str = (field: string): string | undefined => {
    const v = input[field];
    if (v === undefined) return undefined;
    if (typeof v !== 'string') { issues.push({ level: 'warning', message: `${field} ignoré : une chaîne était attendue.` }); return undefined; }
    return v;
  };

  manifest.key = str('key');
  manifest.slug = str('slug');
  manifest.icon = str('icon');
  manifest.redirectUrl = str('redirectUrl');

  const group = str('group');
  if (group) {
    if ((MODULE_GROUPS as readonly string[]).includes(group)) manifest.group = group as ModuleGroup;
    else issues.push({ level: 'warning', message: `group « ${group} » inconnu — attendu : ${MODULE_GROUPS.join(', ')}.` });
  }

  if (input.routes !== undefined) {
    if (Array.isArray(input.routes)) {
      manifest.routes = input.routes.filter((r): r is string => typeof r === 'string');
      if (manifest.routes.length !== input.routes.length) {
        issues.push({ level: 'warning', message: 'routes : les entrées non textuelles ont été ignorées.' });
      }
    } else {
      issues.push({ level: 'warning', message: 'routes ignoré : un tableau était attendu.' });
    }
  }

  if (input.content !== undefined) {
    if (typeof input.content !== 'object' || input.content === null || Array.isArray(input.content)) {
      issues.push({ level: 'warning', message: 'content ignoré : un objet par locale était attendu.' });
    } else {
      manifest.content = {};
      for (const [locale, value] of Object.entries(input.content as Record<string, unknown>)) {
        if (typeof value !== 'object' || value === null || Array.isArray(value)) {
          issues.push({ level: 'warning', message: `content.${locale} ignoré : objet attendu.` });
          continue;
        }
        const v = value as Record<string, unknown>;
        const bullets = Array.isArray(v.bullets) ? v.bullets.filter((b): b is string => typeof b === 'string') : undefined;
        manifest.content[locale] = {
          name: typeof v.name === 'string' ? v.name : undefined,
          description: typeof v.description === 'string' ? v.description : undefined,
          bullets,
          metricValue: typeof v.metricValue === 'string' ? v.metricValue : undefined,
          metricLabel: typeof v.metricLabel === 'string' ? v.metricLabel : undefined,
        };
      }
      if (!manifest.content.fr) {
        issues.push({ level: 'warning', message: 'content.fr absent : la landing affichera la clé du module tant qu\'il manque.' });
      }
    }
  }

  return { manifest, issues };
}

/** Nom de fichier de capture, stable et trié : `<key>-01.png`. */
export function screenshotName(key: string, index: number): string {
  return `${key}-${String(index).padStart(2, '0')}.png`;
}

/**
 * Colle une route sur une URL de base, **en gardant le préfixe de chemin**.
 *
 * `new URL('/dashboard', 'https://host/pwa_consultant')` donne
 * `https://host/dashboard` : une route absolue écrase tout le chemin. C'est la
 * règle des URL, et c'est faux ici — une application servie dans un
 * sous-répertoire verrait chacune de ses routes pointer à côté, et le rapport
 * annoncerait des captures réussies de pages qui ne sont pas les siennes.
 */
export function joinUrl(baseUrl: string, route: string): string {
  const base = new URL(baseUrl);
  if (!base.pathname.endsWith('/')) base.pathname += '/';
  return new URL(route.replace(/^\/+/, ''), base).toString();
}
