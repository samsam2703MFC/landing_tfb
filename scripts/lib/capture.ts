import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { joinUrl, screenshotName } from './module-meta';

/**
 * Capture d'écrans avec Playwright.
 *
 * Playwright est une dépendance optionnelle : la routine sait ingérer un module
 * sans lui, et n'exige son installation que si des captures sont demandées.
 * C'est ~300 Mo de navigateur, inutiles sur un serveur qui ne fait qu'importer
 * du contenu.
 *
 *   npm i -D playwright && npx playwright install --with-deps chromium
 */

export interface CaptureRequest {
  /** URL de base de l'application à photographier. */
  baseUrl: string;
  /** Routes relatives. Une capture par route. */
  routes: string[];
  moduleKey: string;
  /** Dossier de destination — <STORAGE_PATH>/screenshots. */
  outDir: string;
  /** 16:10, le ratio qu'attend le carrousel. */
  width?: number;
  height?: number;
  /** Attente supplémentaire après chargement, pour les animations d'entrée. */
  settleMs?: number;
  /**
   * Binaire Chromium à utiliser. Par défaut celui de Playwright ; renseignez
   * PLAYWRIGHT_CHROMIUM_PATH pour réutiliser un Chromium déjà installé sur la
   * machine et éviter les 300 Mo de téléchargement.
   */
  executablePath?: string;
  /**
   * Accepter un certificat TLS invalide. Réservé aux captures internes : une
   * application encore servie sous certificat auto-signé, ou photographiée par
   * son IP. Sans ce drapeau, Playwright refuse la page et la capture échoue.
   */
  ignoreHttpsErrors?: boolean;
  /**
   * Cookies à poser avant navigation. La plupart des applications métier n'ont
   * aucune page publique : sans session, chaque route redirige vers l'écran de
   * connexion et le carrousel finirait par montrer un formulaire de login.
   */
  cookies?: { name: string; value: string }[];
}

export interface CaptureResult {
  route: string;
  /** Chemin relatif à stocker en base, ou null si la capture a échoué. */
  storagePath: string | null;
  error?: string;
  /**
   * URL réellement photographiée, renseignée seulement si elle diffère de la
   * route demandée. Une redirection silencieuse vers /login est le seul moyen
   * pour une capture d'être techniquement réussie et complètement fausse.
   */
  redirectedTo?: string;
}

export class PlaywrightMissing extends Error {
  constructor() {
    super(
      'Playwright est absent. Pour capturer des écrans :\n' +
      '  npm i -D playwright && npx playwright install --with-deps chromium\n' +
      'Ou relancez sans --url pour importer le module sans captures.',
    );
  }
}

/**
 * Photographie chaque route. Une route qui échoue n'interrompt pas les autres :
 * un module avec trois captures sur quatre reste publiable, et le rapport dit
 * laquelle manque.
 */
export async function captureRoutes(req: CaptureRequest): Promise<CaptureResult[]> {
  const width = req.width ?? 1440;
  const height = req.height ?? 900;
  const settleMs = req.settleMs ?? 600;

  let chromium: typeof import('playwright').chromium;
  try {
    ({ chromium } = await import('playwright'));
  } catch {
    throw new PlaywrightMissing();
  }

  await mkdir(req.outDir, { recursive: true });

  // Un Chromium système évite le téléchargement, et permet de fonctionner quand
  // la version de Playwright ne correspond pas au build déjà présent.
  const executablePath = req.executablePath || process.env.PLAYWRIGHT_CHROMIUM_PATH || undefined;
  const browser = await chromium.launch(executablePath ? { executablePath } : {});
  const results: CaptureResult[] = [];
  try {
    const context = await browser.newContext({
      viewport: { width, height },
      deviceScaleFactor: 2, // les captures sont affichées en 16:10 dans le carrousel
      locale: 'fr-FR',
      reducedMotion: 'reduce',
      ignoreHTTPSErrors: req.ignoreHttpsErrors ?? false,
    });

    if (req.cookies?.length) {
      const { hostname } = new URL(req.baseUrl);
      await context.addCookies(req.cookies.map((c) => ({ ...c, domain: hostname, path: '/' })));
    }

    for (const [i, route] of req.routes.entries()) {
      const target = joinUrl(req.baseUrl, route);
      const page = await context.newPage();
      try {
        // 'load', pas 'networkidle' : une application qui interroge son API en
        // boucle — un tableau de bord, typiquement — n'atteint jamais le repos
        // réseau, et la capture expirait au bout de 30 s sur la seule page qui
        // comptait. Le délai de stabilisation ci-dessous couvre le reste.
        const response = await page.goto(target, { waitUntil: 'load', timeout: 30_000 });

        // Playwright ne lève pas sur un 404 : la page d'erreur se charge très
        // bien. Sans ce contrôle, une route cassée deviendrait une capture
        // publiée sur la landing.
        const status = response?.status() ?? 0;
        if (status >= 400) {
          results.push({ route, storagePath: null, error: `HTTP ${status}` });
          continue;
        }

        await page.waitForTimeout(settleMs);

        // Une session absente ou expirée ne produit pas d'erreur : l'application
        // redirige vers sa page de connexion, qui répond 200. On photographie
        // quand même — mais on le dit, plutôt que de laisser passer un
        // formulaire de login pour une capture produit.
        const landed = new URL(page.url());
        const asked = new URL(target);
        const redirectedTo = landed.pathname !== asked.pathname ? page.url() : undefined;

        const filename = screenshotName(req.moduleKey, i + 1);
        const buffer = await page.screenshot({ type: 'png' });
        await writeFile(path.join(req.outDir, filename), buffer);

        results.push({ route, storagePath: `/storage/screenshots/${filename}`, redirectedTo });
      } catch (error) {
        results.push({ route, storagePath: null, error: error instanceof Error ? error.message : String(error) });
      } finally {
        await page.close();
      }
    }
  } finally {
    await browser.close();
  }

  return results;
}
