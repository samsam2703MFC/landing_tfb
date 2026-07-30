# The Franchise Buddy — landing + back office

ERP SaaS for franchise networks and store chains in food service and retail. Two
surfaces in one Next.js app:

- **`/[locale]`** — the commercial landing. 8 locales (FR default, AR right-to-left),
  entirely driven by the `tfb_` tables: sections, modules with screenshot carousels,
  Stripe-backed pricing, contact form.
- **`/admin`** — the back office. Two domains side by side: **billing** (multi-tenant
  licences, Stripe invoices, price tiers, sync queue) and **landing content**
  (sections, modules, brands, plans, translations, contact inbox).

Built from the Claude Design handoff *The Franchise Buddy Design System*, plus
`prompt_design_tfb.md`, `prompt_technique_tfb.md` and `billing_service_db.sql`.

## Stack

| Piece | Choice |
| --- | --- |
| Framework | Next.js 15 (App Router) + React 19 + TypeScript |
| Styling | The design system's CSS custom properties, plus Tailwind wired to the same tokens |
| Database | **MySQL** via Prisma — the `tfb_landing` schema |
| Payments | Stripe — **stubbed** in this cut, see [Stripe](#stripe) |
| Auth | Signed JWT session cookie (`jose`), scrypt password hashes |
| File storage | Server filesystem under `STORAGE_PATH`; the DB stores only relative paths |

**On the database engine:** `prompt_technique_tfb.md` §1 suggested PostgreSQL but marked
the stack *« à adapter »*. The live database is MySQL (`tfb_landing`), and the billing
service is MySQL too, so the schema targets MySQL.

## Getting started

```bash
npm install
cp .env.example .env        # then fill in DATABASE_URL and ADMIN_SESSION_SECRET
npx prisma migrate deploy   # creates every tfb_ table
npm run seed                # 8 languages, 8 sections, 6 brands, 8 modules, 3 plans, FR/EN/AR copy
npm run dev
```

- Landing: http://localhost:3000 (redirects to your best matching locale)
- Back office: http://localhost:3000/admin
- Seeded account: `admin@franchisebuddy.eu` / `changeme` — **change it.** Override with
  `SEED_ADMIN_EMAIL` and `SEED_ADMIN_PASSWORD` before seeding.

Generate a session secret with:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### Environment

See `.env.example`. `DATABASE_URL` and `ADMIN_SESSION_SECRET` are required; everything
else has a working default or degrades explicitly.

## How the data model works

Every table is `tfb_`-prefixed, `snake_case`, per `prompt_technique_tfb.md` §2. Two rules
run through the whole app:

**No copy in the code.** Every string the landing renders is a `tfb_translations` row.
Chrome and section copy live under a single pseudo-entity — `entity_type = 'ui'`,
`entity_id = 0`, and `field` is a dotted key (`hero.title`, `nav.modules`,
`group.finance`). Module, plan, brand and screenshot copy hang off their own rows.
Multi-value fields (feature lists, explanation bullets) are pipe-joined.

**No media in the database.** Uploads are written to `<STORAGE_PATH>/<category>/` and
the DB keeps the relative path (`/storage/screenshots/scan-a1b2c3.png`). They are served
back through `GET /api/storage/[...path]`, which refuses anything escaping the storage
root and sends uploaded SVGs under a restrictive CSP.

## Rester à jour — les modules viennent des dépôts

La landing n'écrit pas la fiche de ses modules : **chaque dépôt module publie la
sienne**, dans `.tfb/module.json`, et la landing la récupère.

```bash
npm run sync:modules                              # lit les manifestes sur GitHub, écrit en base
npm run sync:modules -- --dry-run                 # valide et rapporte, sans rien écrire
npm run sync:modules -- --from-disk /chemin       # lit des clones locaux au lieu de GitHub
npm run sync:modules -- --only signage,delivery   # se limite à quelques dépôts
npm run sync:modules -- --retire-unlisted         # désactive les modules sans manifeste
```

Le manifeste décrit le module, ses **fonctions** et les **captures** qui les
illustrent — le contrat complet est dans `src/lib/sync/manifest.ts` :

```json
{
  "key": "signage", "slug": "signage", "group": "Marketing", "icon": "panels-top-left",
  "name":        { "fr": "Régie d'affichage", "en": "Digital signage" },
  "description": { "fr": "Les écrans du magasin pilotés depuis un seul back office." },
  "overview":    { "fr": "Un magasin affiche des prix, des promos et des menus…" },
  "metric": { "value": "0", "label": { "fr": "clé USB en magasin" } },
  "screenshots": [{ "file": "docs/landing/signage-accueil.png", "alt": { "fr": "Accueil de la régie" } }],
  "features": [
    { "key": "compositeur", "icon": "layers",
      "name": { "fr": "Compositeur de film" },
      "description": { "fr": "La bibliothèque d'éléments et la playlist qui en fait un film…" },
      "screenshots": [{ "file": "docs/landing/signage-compositeur.png" }] }
  ]
}
```

Ce que la sync écrit : `tfb_modules` (upsert sur `key`), `tfb_module_features`
(upsert sur `module_id` + `key`), `tfb_module_screenshots` (réécrites, fichiers
copiés sous `STORAGE_PATH`) et les `tfb_translations` correspondantes. `fr` est
obligatoire dans chaque bloc de copie — c'est la locale de repli.

Trois garde-fous : une fonction retirée d'un manifeste est **désactivée**, jamais
supprimée, donc ses traductions survivent à un mauvais manifeste ; un module sans
manifeste n'est touché que si vous passez `--retire-unlisted`, et seulement quand
tous les dépôts ont répondu ; un groupe sans traduction `group.<valeur>` est
signalé dans le rapport.

La liste des dépôts interrogés est `content/modules.repos.json`. Le workflow
`.github/workflows/sync-modules.yml` valide les manifestes à chaque nuit (et écrit
en base si le secret `DATABASE_URL` existe). Pour qu'un dépôt module déclenche la
mise à jour sans attendre la nuit, ajoutez-y ce pas :

```yaml
- name: Prévenir la landing
  run: |
    curl -sf -X POST -H "Authorization: Bearer ${{ secrets.LANDING_SYNC_TOKEN }}" \
      https://api.github.com/repos/samsam2703MFC/landing_tfb/dispatches \
      -d '{"event_type":"module-manifest-updated"}'
```

### Fallback

FR is `tfb_languages.is_default`. A missing or empty translation resolves to FR — so all
8 locales are routable, and the 5 unauthored ones (NL, DE, PL, UK, RU) render French
until a translator fills them in. The editor shows those cells as
« Vide — fallback FR », and clearing a cell **deletes** the row rather than storing `''`,
because an absent row is what the fallback keys off.

### RTL

Arabic is a full mirror driven by one attribute: `dir="rtl"` on `<html>`. Everything
downstream uses logical properties only (`margin-inline-*`, `inset-inline-start`,
`text-align: start`) — never `left`/`right`. Directional glyphs carry `.fb-flip`; figures
and IDs carry `.fb-num`, which pins them LTR inside Arabic text.

## Public API

| Route | Purpose |
| --- | --- |
| `GET /api/landing?lang=fr` | The whole landing payload, resolved into one locale |
| `GET /api/languages` | Active locales with their RTL flag |
| `POST /api/contact` | Writes `tfb_contact_messages`. Honeypot + per-IP rate limit |
| `POST /api/checkout` | Stripe Checkout session from the plan's `stripe_price_id` |
| `POST /api/stripe/webhook` | Keeps `tfb_subscriptions` in step. Signature verified first |
| `GET /api/billing/portal` | Stripe customer portal link (session required) |
| `GET /api/storage/[...path]` | Serves uploaded files |

The admin API lives under `/api/admin/*` and is gated by `withAdmin` — brands, sections,
modules (+ screenshots), plans, subscriptions, contact messages, translations, uploads,
and two billing actions that delegate to the billing service.

## The two external services

### Stripe

**Stubbed.** No keys were available for this cut, so the `stripe` package is not a
dependency yet. Everything Stripe-shaped funnels through `src/lib/stripe.ts`; going live
is `npm i stripe` plus three call sites, documented in that file's header. Until then:

- `POST /api/checkout` answers `200 { status: 'stub', reason }` and the pricing UI reports
  it honestly rather than pretending to redirect.
- `POST /api/stripe/webhook` **rejects every call** while `STRIPE_WEBHOOK_SECRET` is unset.
  An unverified webhook must never write to the database.
- A plan with `amount = NULL` is "sur devis" and routes to the contact form, never to
  Checkout.

### Billing service

`billing_service_db.sql` is a **separate Laravel/MySQL service** that owns `tenants`,
`stores`, `licenses`, `invoices`, `packages`, `pricing_tiers`, `license_events` and
`sync_queue`. Those tables are deliberately **not** in this app's Prisma schema —
duplicating another service's database is how the two drift apart. The console reads them
through `src/lib/billing/client.ts`.

With `BILLING_SERVICE_URL` unset, every billing screen renders the fixture snapshot in
`src/lib/billing/fixtures.ts` and shows a banner saying so. Destructive actions (block a
licence, replay a sync row) are **refused** in that mode rather than faking success. Set
the env var and the same screens hit the real endpoints — expected shapes are in
`src/lib/billing/types.ts`, whose field names are copied verbatim from the SQL dump.

## Layout

```
prisma/
  schema.prisma            every tfb_ table
  seed.ts, seed-content.ts the seed and its FR/EN/AR copy
content/
  modules.repos.json       the module repositories sync:modules polls
scripts/
  sync-modules.ts          pulls every .tfb/module.json into the database
src/
  design-system/           the handoff, ported
    tokens/*.css           colours, type, spacing, radius, elevation, motion, fonts, base
    tokens/tailwind.preset.js  the same values as a Tailwind preset
    components/            26 components in 6 groups (core, forms, navigation, content, data, feedback)
  lib/
    i18n/                  locales + the translation resolver
    landing/               the GET /api/landing payload builder
    billing/               the billing-service client, types and fixtures
    auth/                  session (JWT cookie) and scrypt passwords
    storage.ts             uploads, path safety
  components/
    landing/               header, hero, brand strip, module grid, module page, steps, differentiators, pricing, contact, footer
    admin/                 shell, billing tables, content screens, translation editor, module editor
  app/
    (site)/[locale]/       the landing — root layout #1, lang + dir per locale
    (admin)/admin/         the back office — root layout #2, fr-only LTR
    api/                   public and admin routes
  middleware.ts            bare paths → a locale
public/
  icons/                   75 Lucide glyphs
  brand/                   the supplied mark, 4 variants
```

Two root layouts in route groups, because the landing mirrors across 8 locales and the
console does not.

## Design decisions carried over from the handoff

- **Modules use layout A + C**, the combination settled on in the design chat: a filterable
  grid on the landing, opening a full module page (`/[locale]/modules/[slug]`) with an
  autoplay carousel, explanation bullets, the measured gain, and connected modules as chips.
- **Ember (`--cta-warm`) is the landing's conversion colour, always with navy ink** — white
  on ember fails AA. The back office stays plum.
- **Status values are never translated.** `past_due`, `uncollectible`, `sub_1QaBelBast` are
  data: they render in mono, in English, straight from the column.
- **No emoji, no hand-drawn SVG.** Every glyph comes from `public/icons`.
- **Tailwind's preflight is off.** The design system ships its own reset; preflight would
  load after it and undo the body font, heading weights and focus rings.

## Verified

`npm run typecheck`, `npm run lint` and `npm run build` all pass clean, and the build makes
no database calls. **The app has not been run against a live MySQL** — no database was
reachable from the machine it was built on, so the migration, the seed and the rendered
pages are unverified end to end. Run the four commands under [Getting started](#getting-started)
first.

The same caveat covers `npm run sync:modules`: its **read** path is verified — the eight
manifests parse and resolve against local clones (`--dry-run --from-disk`) — but its
**write** path has never touched a database. Run it once with `--dry-run`, then for real,
and check `/[locale]/modules/<slug>` before pointing the workflow at production.

The 28 screenshots shipped with the modules are real captures of the running apps
(`signage`, `pwa_delivery`, `back_office_ws_franchisor`, `back_office_ws_franchisee`),
taken with Playwright against each app's own seed data. `webshop`, `supplier_atl`,
`pwa_kitchen` and `pwa_consultant` could not be captured: the first loads React from a
CDN and the other three are thin clients over a remote API, neither reachable from the
build machine. Their manifests carry no `screenshots`, so their carousels show the
labelled placeholder until someone runs the same capture on a connected machine.

## Known gaps

- **Arabic copy is translator-review quality**, carried over from the design handoff. Have
  it reviewed before release.
- **Fonts and icons are substitutions** — Manrope / IBM Plex from Google Fonts, and 75
  Lucide glyphs. No binaries or icon set were supplied. Both are one-directory swaps:
  `src/design-system/tokens/fonts.css` and `public/icons`.
- **No brand logos or module screenshots.** `tfb_brands.logo_path` is empty, so the trust
  strip renders dashed name chips; screenshot rows are seeded with paths whose files do not
  exist yet, so carousels show a labelled placeholder naming the storage folder. Upload
  real files through the back office and both finish themselves.
- **No admin-users screen.** `tfb_admin_users` has no UI spec in the briefs; accounts are
  seeded. Say the word and it gets designed.
- **Sections cannot be reordered by dragging yet.** The API takes a whole new order
  (`PUT /api/admin/sections`); the screen only toggles `is_active` so far.
- **The rate limiter is in-process.** It protects a single instance; behind more than one
  Node process, move it to Redis or the reverse proxy. The call sites do not change.
- **The logo is the supplied mark**, used as-is in four mechanically derived variants. No
  monkey, wordmark or vector version was drawn or invented.
