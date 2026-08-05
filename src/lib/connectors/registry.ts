/**
 * §19 — every external dependency this application has, and what stops working
 * when it stops working.
 *
 * The registry is code, not a table. A connector exists because some module calls
 * it; adding a row to a database would not add the call, and a connector nobody
 * calls is a lie on a status page. The one thing that *is* stored is the history
 * of probes (`tfb_connector_checks`).
 *
 * Two ideas hold the whole screen together:
 *
 *  1. **`unconfigured` and `down` are different states.** The first is a decision —
 *     nobody plugged Stripe in, and the application says so instead of pretending.
 *     The second is an accident — the key is there and the service answers badly.
 *     Merged into one red dot, they cost either a week hunting a fault that does
 *     not exist, or a real outage nobody looked at.
 *
 *  2. **Every connector names what breaks.** A red lamp says a service is dead; it
 *     does not say a customer can be charged without a subscription row being
 *     written. `breaks` is the sentence that makes someone act.
 */

export type Outcome = 'ok' | 'degraded' | 'down' | 'unconfigured';

export interface ConnectorMeta {
  key: string;
  name: string;
  what: string;
  /** Icon file stem in public/icons. */
  icon: string;
  /** The environment variables involved, named — never their values. */
  env: string[];
  /** What stops working. Written to be read by whoever is deciding what to fix. */
  breaks: string;
  /**
   * True when this connector's absence is a normal, supported state rather than a
   * fault: the console degrades and says so. False when the application cannot do
   * its job at all without it.
   */
  optional: boolean;
  /** Routes and screens whose behaviour changes. Shown on the detail page. */
  dependents: { name: string; whenBroken: string }[];
}

export const CONNECTORS: ConnectorMeta[] = [
  {
    key: 'database',
    name: 'Base de données',
    what: 'MySQL — le schéma tfb_landing et toutes les tables tfb_',
    icon: 'layers',
    env: ['DATABASE_URL'],
    breaks: 'Tout. Le back office ne rend plus une seule page, et la landing non plus.',
    optional: false,
    dependents: [
      { name: 'Back office (toutes les pages)', whenBroken: 'erreur 500' },
      { name: '/api/landing', whenBroken: 'erreur 500' },
      { name: '/api/health', whenBroken: 'signale la panne' },
    ],
  },
  {
    key: 'sessions',
    name: 'Sessions back office',
    what: 'JWT HS256 dans un cookie httpOnly, valable 8 heures',
    icon: 'lock',
    env: ['ADMIN_SESSION_SECRET', 'ALLOW_INSECURE_COOKIES'],
    breaks:
      'La connexion au back office. Sans HTTPS, le cookie Secure n’est jamais renvoyé par le '
      + 'navigateur et la connexion échoue en silence — la page de login se recharge, sans erreur.',
    optional: false,
    dependents: [
      { name: 'POST /api/admin/auth/login', whenBroken: 'aucune session ne peut être signée' },
      { name: 'Toute route /api/admin/*', whenBroken: '401' },
    ],
  },
  {
    key: 'storage',
    name: 'Stockage des fichiers',
    what: 'Disque serveur — captures de modules et logos d’enseigne',
    icon: 'file-text',
    env: ['STORAGE_PATH'],
    breaks:
      'Les téléversements. Les fichiers déjà écrits restent servis : c’est une panne d’écriture, '
      + 'pas de lecture.',
    optional: false,
    dependents: [
      { name: 'POST /api/admin/upload', whenBroken: 'échec du téléversement' },
      { name: 'Captures de modules', whenBroken: 'les existantes restent lisibles' },
    ],
  },
  {
    key: 'billing',
    name: 'Service de facturation',
    what: 'Service Laravel séparé — tenants, magasins, licences, factures',
    icon: 'building-2',
    env: ['BILLING_SERVICE_URL', 'BILLING_SERVICE_TOKEN'],
    breaks:
      'Clients, licences, factures et commissions basculent sur un jeu de démonstration, avec un '
      + 'bandeau sur chaque écran. Aucune action destructive n’est acceptée, et aucune commission '
      + 'ne peut être arrêtée : payer sur des chiffres inventés est pire que ne pas payer.',
    optional: true,
    dependents: [
      { name: 'Clients, Licences, Factures', whenBroken: 'affichent les fixtures' },
      { name: 'Agents — commissions', whenBroken: 'calculées mais non arrêtables' },
      { name: 'Blocage de licence', whenBroken: 'refusé' },
      { name: '/api/entitlement', whenBroken: '503 — voir « Vérification des clés tenant »' },
    ],
  },
  {
    key: 'stripe',
    name: 'Stripe',
    what: 'Paiements, abonnements, portail client, webhook',
    icon: 'credit-card',
    env: ['STRIPE_SECRET_KEY', 'STRIPE_PUBLISHABLE_KEY', 'STRIPE_WEBHOOK_SECRET'],
    breaks:
      'Le paiement. Sans clé, Checkout renvoie une réponse bouchon et rien n’est facturé. Sans le '
      + 'secret de webhook — le cas le plus dangereux — le paiement fonctionne, le client est '
      + 'débité, et l’événement est rejeté faute de signature vérifiable : aucun abonnement n’est '
      + 'écrit, et rien nulle part n’a l’air en erreur.',
    optional: true,
    dependents: [
      { name: '/api/checkout', whenBroken: 'réponse bouchon' },
      { name: '/api/stripe/webhook', whenBroken: 'rejette tout' },
      { name: '/api/billing/portal', whenBroken: 'réponse bouchon' },
      { name: 'Packs — resynchronisation des prix', whenBroken: 'ne lit aucun produit' },
      { name: 'Abonnements', whenBroken: 'jamais alimentés' },
    ],
  },
  {
    key: 'tenant-keys',
    name: 'Vérification des clés tenant',
    what: 'POST /admin/api-keys/verify, délégué au service de facturation',
    icon: 'scan-line',
    env: ['BILLING_SERVICE_URL', 'BILLING_SERVICE_TOKEN'],
    breaks:
      '/api/entitlement répond 503 au lieu de 401 : les PWA produit ne verrouillent rien à tort, '
      + 'mais n’ouvrent rien non plus. La distinction est délibérée — un 401 fait fermer un module, '
      + 'un 503 fait attendre.',
    optional: true,
    dependents: [
      { name: '/api/entitlement', whenBroken: '503 — ne pas verrouiller' },
      { name: 'PWA produit', whenBroken: 'gardent leur dernier état connu' },
    ],
  },
];

export function connectorMeta(key: string): ConnectorMeta | undefined {
  return CONNECTORS.find((c) => c.key === key);
}

export const OUTCOME_LABEL: Record<Outcome, string> = {
  ok: 'opérationnel',
  degraded: 'dégradé',
  down: 'en échec',
  unconfigured: 'non configuré',
};

/**
 * The one-line explanation of each state, shown next to the counters.
 *
 * `degraded` exists for the case that would otherwise be reported green: the
 * connector answers, but one of its parts is missing. Stripe with a secret key and
 * no webhook secret is the canonical example — every read works, and no payment is
 * ever recorded.
 */
export const OUTCOME_MEANING: Record<Outcome, string> = {
  ok: 'répond, et tout ce dont il a besoin est présent',
  degraded: 'répond, mais une pièce manque — la panne la plus discrète',
  down: 'configuré et ne répond pas : un accident',
  unconfigured: 'aucune configuration : une décision, pas une panne',
};
