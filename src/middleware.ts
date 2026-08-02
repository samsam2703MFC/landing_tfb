import { NextResponse, type NextRequest } from 'next/server';
import { LOCALES, DEFAULT_LOCALE, isLocale } from '@/lib/i18n/config';

/**
 * The landing lives under /<locale>. This sends bare paths to a locale, preferring
 * the visitor's Accept-Language when it names one we serve, and French otherwise
 * (tfb_languages.is_default).
 *
 * /api and /admin are untouched — the console is French-only and the API takes its
 * locale from ?lang=.
 */
function pickLocale(request: NextRequest): string {
  const cookie = request.cookies.get('tfb_locale')?.value;
  if (cookie && isLocale(cookie)) return cookie;

  const header = request.headers.get('accept-language');
  if (header) {
    // "fr-BE,fr;q=0.9,en;q=0.8" → ["fr-be", "fr", "en"] in weight order.
    const tags = header
      .split(',')
      .map((part) => {
        const [tag, q] = part.trim().split(';q=');
        return { tag: tag.trim().toLowerCase(), q: q ? Number(q) : 1 };
      })
      .sort((a, b) => b.q - a.q);
    for (const { tag } of tags) {
      const base = tag.split('-')[0]!;
      if (isLocale(base)) return base;
    }
  }
  return DEFAULT_LOCALE;
}

/**
 * Paths that must never be sent to a locale: the API, the console, the per-tenant
 * theme page and Next's own assets.
 *
 * Checked here rather than in the matcher because the matcher is evaluated against
 * the FULL path, basePath included. Under NEXT_PUBLIC_BASE_PATH=/landing_tfb its
 * negative lookahead reads « landing_tfb/… », never recognises « api », and lets
 * everything through — which redirected /landing_tfb/api/health to
 * /landing_tfb/fr/api/health, an address that does not exist. Inside the function
 * `pathname` has already had basePath stripped, so the test is reliable.
 */
const NEVER_LOCALISED = ['/api', '/admin', '/preview', '/_next', '/icons', '/brand', '/favicon.ico'];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (NEVER_LOCALISED.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`))) {
    return NextResponse.next();
  }

  const hasLocale = LOCALES.some((l) => pathname === `/${l}` || pathname.startsWith(`/${l}/`));
  if (hasLocale) return NextResponse.next();

  const locale = pickLocale(request);
  const url = request.nextUrl.clone();
  url.pathname = pathname === '/' ? `/${locale}` : `/${locale}${pathname}`;
  return NextResponse.redirect(url);
}

export const config = {
  // Deliberately broad: the exclusions live in NEVER_LOCALISED above, where the
  // path is free of basePath. Keeping them here as well would look like a second
  // safeguard while being the one that does not work under a sub-path.
  matcher: ['/((?!_next/static|_next/image).*)'],
};
