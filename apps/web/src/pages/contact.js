/**
 * Réception du formulaire de démonstration.
 *
 * La demande est écrite dans `landing_leads` et se relit dans la console.
 * Rien n'est envoyé par courriel d'ici : le serveur n'a pas de SMTP, et une
 * demande perdue dans une file d'envoi vaut moins qu'une demande en base.
 *
 * Trois gardes, dans cet ordre : origine du navigateur, piège à robots,
 * champs obligatoires. Aucune ne renvoie de détail à l'appelant — un robot
 * n'a pas à savoir laquelle l'a arrêté.
 */

import { chargerLangues, connexion, table, viderCache } from '../lib/db.mjs';

const BASE = (import.meta.env.BASE_URL || '/').replace(/\/+$/, '');

/**
 * La page d'accueil dans la langue d'où vient le formulaire.
 *
 * Le point de réception est unique — le middleware ne préfixe que les pages —
 * donc c'est au formulaire de dire d'où il écrit. Une langue inconnue ou non
 * publiée retombe sur le français : mieux vaut un remerciement dans la
 * mauvaise langue qu'une redirection vers une page qui répond 404.
 */
async function accueil(codeLangue, suffixe) {
  const code = String(codeLangue || '').trim();
  if (!code || code === 'fr') return `${BASE}/${suffixe}`;
  try {
    const langues = await chargerLangues();
    const langue = langues.find((l) => l.code === code && l.publiee && !l.defaut);
    return langue ? `${BASE}/${code}/${suffixe}` : `${BASE}/${suffixe}`;
  } catch {
    return `${BASE}/${suffixe}`;
  }
}

/** Coupe une valeur à la longueur de sa colonne, sans lever. */
function borne(valeur, taille) {
  return String(valeur ?? '').trim().slice(0, taille) || null;
}

/** Même contrôle d'origine que la console : on compare les noms d'hôte. */
function origineEtrangere(requete) {
  const origine = requete.headers.get('origin');
  const attendu = requete.headers.get('x-forwarded-host') || requete.headers.get('host');
  if (!origine || !attendu) return true;
  try {
    return new URL(origine).host !== attendu.split(',')[0].trim();
  } catch {
    return true;
  }
}

export async function POST({ request, redirect }) {
  if (origineEtrangere(request)) {
    return new Response('Soumission refusée : origine étrangère au site.', { status: 403 });
  }

  const f = await request.formData();
  const merci = await accueil(f.get('langue'), '?envoye=1#contact');

  // Le champ piège est invisible : rempli, c'est un robot. On répond comme
  // si tout s'était bien passé, pour ne rien lui apprendre.
  if (String(f.get('site_web') || '').trim() !== '') {
    return redirect(merci, 303);
  }

  const nom = borne(f.get('nom'), 160);
  const email = borne(f.get('email'), 200);
  if (!nom || !email) {
    return redirect(await accueil(f.get('langue'), '#contact'), 303);
  }

  try {
    const db = await connexion();
    await db.executer(
      `INSERT INTO ${table('leads')} (nom, reseau, email, situation, source, traite, recu_le)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        nom,
        borne(f.get('reseau'), 200),
        email,
        borne(f.get('situation'), 4000),
        'landing',
        false,
        new Date(),
      ],
    );
    viderCache();
  } catch (err) {
    // Une base indisponible ne doit pas renvoyer une page d'erreur au
    // visiteur : on trace et on remercie quand même. La demande est perdue,
    // le journal du service le dit.
    console.error(`[contact] demande non enregistrée : ${err.message}`);
  }

  return redirect(merci, 303);
}
