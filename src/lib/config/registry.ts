/**
 * The variable registry — the ONLY thing about per-tenant configuration that is
 * hard-coded.
 *
 * The back office never knows any variable in particular: it reads this registry
 * through GET /api/app-config/schema and generates its own form. Adding a variable
 * is one entry here — no admin screen, no migration, no table column.
 *
 * A variable can parameterise an existing behaviour. It cannot create one. The
 * moment a value would need to carry logic ({"if": "stock < x"}), that is a plugin,
 * not a variable.
 */

import { CATALOGUE, type ResourceKey } from '@/lib/data/catalogue';

export type VariableType = 'color' | 'text' | 'number' | 'bool' | 'select' | 'list' | 'file' | 'source';

interface BaseVariable {
  /** Dotted key. The first segment is the group the back office renders under. */
  key: string;
  /** Sentence-case label shown in the console. */
  label: string;
  type: VariableType;
  /** One line telling the admin what the value actually changes. */
  hint?: string;
}

export type Variable =
  | (BaseVariable & { type: 'color'; default: string })
  | (BaseVariable & { type: 'text'; default: string; maxLength?: number })
  | (BaseVariable & { type: 'number'; default: number; min?: number; max?: number; unit?: string })
  | (BaseVariable & { type: 'bool'; default: boolean })
  | (BaseVariable & { type: 'select'; default: string; options: { value: string; label: string }[] })
  | (BaseVariable & { type: 'list'; default: string[]; of?: 'module' | 'text' })
  | (BaseVariable & { type: 'file'; default: string | null; accept?: string })
  /** Picks one entry of the data catalogue. Never a raw URL — see catalogue.ts. */
  | (BaseVariable & { type: 'source'; default: ResourceKey; allowed: ResourceKey[] });

export const REGISTRY: readonly Variable[] = [
  {
    key: 'theme.primary',
    label: 'Couleur primaire',
    type: 'color',
    default: '#7b4488',
    hint: 'Appliquée en custom property — aucun CSS n’est buildé par client.',
  },
  {
    key: 'theme.logo',
    label: 'Logo de l’enseigne',
    type: 'file',
    default: null,
    accept: 'image/png,image/svg+xml',
    hint: 'Chemin relatif servi par /api/storage. La base ne stocke jamais le binaire.',
  },
  {
    key: 'theme.radius',
    label: 'Arrondi des cartes',
    type: 'select',
    default: '12',
    options: [
      { value: '4', label: 'Net — 4px' },
      { value: '8', label: 'Modéré — 8px' },
      { value: '12', label: 'Doux — 12px' },
      { value: '16', label: 'Très doux — 16px' },
    ],
  },
  {
    key: 'nav.modules',
    label: 'Modules dans la barre',
    type: 'list',
    of: 'module',
    default: [],
    hint: 'Ordre d’affichage. Un module non couvert par une licence est retiré à la résolution.',
  },
  {
    key: 'stock.threshold',
    label: 'Seuil d’alerte stock',
    type: 'number',
    default: 10,
    min: 0,
    max: 100_000,
    unit: 'unités',
  },
  {
    key: 'stock.source',
    label: 'Source du widget stock',
    type: 'source',
    default: 'stock.low_items',
    allowed: ['stock.low_items'],
    hint: 'Sélectionne une entrée du catalogue. Les paramètres sont alimentés par les autres variables.',
  },
  {
    key: 'feature.loyalty',
    label: 'Programme de fidélité',
    type: 'bool',
    default: false,
  },
  {
    key: 'feature.offline_mode',
    label: 'Mode hors-ligne étendu',
    type: 'bool',
    default: false,
    hint: 'Étend la durée de cache du service worker. Coûte de l’espace sur l’appareil.',
  },
  {
    key: 'support.email',
    label: 'E-mail de support affiché',
    type: 'text',
    default: 'support@franchisebuddy.eu',
    maxLength: 150,
  },
  {
    key: 'pwa.name',
    label: 'Nom de l’app installée',
    type: 'text',
    default: 'The Franchise Buddy',
    maxLength: 60,
    hint: 'Alimente le manifest — c’est le nom sous l’icône sur le téléphone.',
  },
  {
    key: 'format.currency',
    label: 'Devise affichée',
    type: 'select',
    default: 'EUR',
    options: [
      { value: 'EUR', label: 'EUR — euro' },
      { value: 'CHF', label: 'CHF — franc suisse' },
      { value: 'GBP', label: 'GBP — livre sterling' },
    ],
  },
];

const BY_KEY = new Map(REGISTRY.map((v) => [v.key, v]));

export function variable(key: string): Variable | undefined {
  return BY_KEY.get(key);
}

/** Group name = the key's first segment, which is how the console sections the form. */
export function groupOf(key: string): string {
  return key.split('.')[0] ?? '';
}

export function registryGroups(): { group: string; variables: Variable[] }[] {
  const groups = new Map<string, Variable[]>();
  for (const v of REGISTRY) {
    const g = groupOf(v.key);
    const bucket = groups.get(g);
    if (bucket) bucket.push(v);
    else groups.set(g, [v]);
  }
  return [...groups.entries()].map(([group, variables]) => ({ group, variables }));
}

export type ConfigValue = string | number | boolean | string[] | null;
export type ConfigValues = Record<string, ConfigValue>;

/** Every declared default, i.e. the bottom of the resolution chain. */
export function registryDefaults(): ConfigValues {
  const out: ConfigValues = {};
  for (const v of REGISTRY) out[v.key] = v.default as ConfigValue;
  return out;
}

/**
 * Validates one value against its declaration. Validation happens on write, in the
 * back office — never on read in the PWA. An invalid colour must be refused in the
 * console, not discovered by a paying customer's phone.
 */
export function validate(key: string, value: ConfigValue): string | null {
  const v = variable(key);
  if (!v) return `Variable inconnue : ${key}.`;
  if (value === null) return v.type === 'file' ? null : 'Valeur vide — supprimez la surcharge pour hériter.';

  switch (v.type) {
    case 'color': {
      if (typeof value !== 'string' || !/^#[0-9a-fA-F]{6}$/.test(value)) return 'Attendu : #RRGGBB.';
      // The design system pins white on brand fills (--brand-on: var(--slate-0)), so
      // that is what a primary has to be legible against. Checking it against the
      // navy ink instead would reject the house plum itself.
      const ratio = contrastWith(value, '#ffffff');
      if (ratio < 4.5) return `Contraste ${ratio.toFixed(1)}:1 avec le blanc posé dessus — sous AA (4.5:1).`;
      return null;
    }
    case 'text': {
      if (typeof value !== 'string') return 'Attendu : du texte.';
      if (v.maxLength && value.length > v.maxLength) return `${value.length} caractères — maximum ${v.maxLength}.`;
      return null;
    }
    case 'number': {
      if (typeof value !== 'number' || !Number.isFinite(value)) return 'Attendu : un nombre.';
      if (v.min != null && value < v.min) return `Minimum ${v.min}.`;
      if (v.max != null && value > v.max) return `Maximum ${v.max}.`;
      return null;
    }
    case 'bool':
      return typeof value === 'boolean' ? null : 'Attendu : vrai ou faux.';
    case 'select':
      return v.options.some((o) => o.value === value) ? null : `Valeur hors de la liste déclarée.`;
    case 'list':
      if (!Array.isArray(value) || value.some((item) => typeof item !== 'string')) return 'Attendu : une liste de clés.';
      return null;
    case 'file':
      if (typeof value !== 'string') return 'Attendu : un chemin de fichier.';
      // Only paths this app served itself; an absolute URL here would let the console
      // point a client's logo at somebody else's host.
      return value.startsWith('/storage/') ? null : 'Attendu : un chemin sous /storage/.';
    case 'source':
      if (typeof value !== 'string') return 'Attendu : une clé du catalogue.';
      if (!v.allowed.includes(value as ResourceKey)) return 'Ressource hors de la liste autorisée pour cette variable.';
      if (!(value in CATALOGUE)) return 'Ressource absente du catalogue.';
      return null;
  }
}

/** Contrast ratio per WCAG 2.1 between two #RRGGBB colours. */
function contrastWith(hex: string, against: string): number {
  const lum = (value: string) => {
    const channel = (pair: string) => {
      const c = parseInt(pair, 16) / 255;
      return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
    };
    return 0.2126 * channel(value.slice(1, 3)) + 0.7152 * channel(value.slice(3, 5)) + 0.0722 * channel(value.slice(5, 7));
  };
  const a = lum(hex);
  const b = lum(against);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}
