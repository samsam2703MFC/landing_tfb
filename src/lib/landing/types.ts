/**
 * The shape of `GET /api/landing?lang=…` — everything the landing needs, already
 * resolved into one language with the default locale filled in behind it.
 */

export interface LandingLanguage {
  code: string;
  name: string;
  rtl: boolean;
}

export interface LandingBrand {
  slug: string;
  name: string;
  logoPath: string | null;
  websiteUrl: string | null;
}

export interface LandingScreenshot {
  /** Public URL for the file, or null while tfb_module_screenshots is empty. */
  src: string | null;
  alt: string;
}

export interface LandingModule {
  id: number;
  key: string;
  slug: string;
  icon: string;
  /** Translated tfb_modules.module_group caption. */
  group: string;
  /** Raw module_group value — the filter chips key off this, not the translation. */
  groupKey: string;
  name: string;
  description: string;
  isNew: boolean;
  redirectUrl: string | null;
  repo: string | null;
  screenshots: LandingScreenshot[];
  /** Explanation bullets (tfb_translations field 'bullets', pipe-joined). */
  bullets: string[];
  /** Headline gain: ["12 min", "par inventaire"]. */
  metric: [string, string];
}

export interface LandingPlan {
  id: number;
  key: string;
  name: string;
  description: string;
  features: string[];
  /** Formatted for the locale, or null when amount is NULL ("sur devis"). */
  priceLabel: string | null;
  amount: number | null;
  currency: string;
  interval: string;
  featured: boolean;
  stripePriceId: string | null;
}

export interface LandingSection {
  key: string;
  type: string;
  sortOrder: number;
}

export interface LandingPayload {
  locale: string;
  dir: 'ltr' | 'rtl';
  languages: LandingLanguage[];
  /** Active tfb_sections in sort_order — the front renders these and nothing else. */
  sections: LandingSection[];
  brands: LandingBrand[];
  modules: LandingModule[];
  plans: LandingPlan[];
  /** Resolved `ui` strings, keyed by dotted field name. */
  strings: Record<string, string>;
}
