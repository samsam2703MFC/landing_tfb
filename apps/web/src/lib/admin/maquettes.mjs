/**
 * Les maquettes des vues personnalisées, et le bon pour accord du client.
 *
 * Une vue se vend en une ligne de texte. Le commercial voit un tableau, le
 * client imagine un graphique, et l'écart se découvre à la livraison — au
 * moment le plus cher pour tout le monde. Une capture, même faite dans un
 * tableur, coupe court ; un accord daté dessus rend la discussion inutile
 * trois mois plus tard.
 *
 * Deux règles, et tout le module en découle :
 *
 *   · une maquette par vue, remplacée quand on redépose. Il n'y a pas
 *     d'historique de captures à tenir — ce qui compte est ce qui a été
 *     signé, et cela vit dans l'empreinte du visa ;
 *   · un visa ne s'efface jamais. Le client a signé quelque chose ; si le
 *     flux change ensuite, c'est le flux qui a bougé, pas la signature.
 */
import { createHash } from 'node:crypto';

import { connexion, table, viderCache } from '../db.mjs';
import { TAILLE_MAX_CAPTURE, lireImage } from './images.mjs';
import { empreinteDuFlux, nomDeSignataire } from '../offres/visa.mjs';

/** Les maquettes d'une offre, rangées par rang de vue. */
export async function listerMaquettes(offreId) {
  const db = await connexion();
  return db.requete(
    `SELECT id, offre_id, rang, titre, type_mime, nom, taille, empreinte, depose_le
     FROM ${table('vues_maquettes')} WHERE offre_id = ? ORDER BY rang`,
    [Number(offreId)],
  );
}

/** Le contenu d'une maquette, décodé — pour le seul point qui la sert. */
export async function chargerMaquette(id) {
  const db = await connexion();
  const lignes = await db.requete(
    `SELECT contenu, type_mime FROM ${table('vues_maquettes')} WHERE id = ? LIMIT 1`,
    [Number(id)],
  );
  const l = lignes[0];
  if (!l?.contenu || !l.type_mime) return null;
  return { octets: Buffer.from(l.contenu, 'base64'), type: l.type_mime };
}

/**
 * Dépose la maquette d'une vue. Redéposer remplace.
 *
 * Le rang est celui de la vue dans l'offre : les vues sont un tableau JSON et
 * n'ont pas d'identifiant propre. Réordonner les vues déplacerait donc les
 * maquettes — l'écran le dit, et c'est le prix de ne pas avoir de table de
 * vues rien que pour ça.
 */
export async function deposerMaquette(offreId, rang, fichier, { titre = '', par = null } = {}) {
  const image = await lireImage(fichier, {
    maxOctets: TAILLE_MAX_CAPTURE,
    pourquoi: 'Une capture d’écran plus lourde se recompresse sans devenir illisible.',
  });
  if (!image) throw new Error('Aucun fichier choisi : rien à déposer.');

  const db = await connexion();
  const empreinte = createHash('sha256').update(image.base64).digest('hex');
  const valeurs = [
    String(titre || '').slice(0, 255) || null,
    image.base64,
    image.type,
    String(fichier?.name || '').slice(0, 255) || null,
    image.octets,
    empreinte,
    par === null ? null : Number(par),
    new Date(),
  ];

  const dejaLa = await db.requete(
    `SELECT id FROM ${table('vues_maquettes')} WHERE offre_id = ? AND rang = ? LIMIT 1`,
    [Number(offreId), Number(rang)],
  );
  if (dejaLa.length > 0) {
    await db.executer(
      `UPDATE ${table('vues_maquettes')}
       SET titre = ?, contenu = ?, type_mime = ?, nom = ?, taille = ?, empreinte = ?, depose_par = ?, depose_le = ?
       WHERE id = ?`,
      [...valeurs, dejaLa[0].id],
    );
  } else {
    await db.executer(
      `INSERT INTO ${table('vues_maquettes')}
        (offre_id, rang, titre, contenu, type_mime, nom, taille, empreinte, depose_par, depose_le)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [Number(offreId), Number(rang), ...valeurs],
    );
  }
  viderCache();
  return { empreinte, octets: image.octets };
}

/** Retire la maquette d'une vue. */
export async function retirerMaquette(offreId, rang) {
  const db = await connexion();
  await db.executer(
    `DELETE FROM ${table('vues_maquettes')} WHERE offre_id = ? AND rang = ?`,
    [Number(offreId), Number(rang)],
  );
  viderCache();
}

/**
 * Les visas d'une offre, du plus récent au plus ancien.
 *
 * Plusieurs sont possibles, et c'est voulu : quand le flux change après un
 * accord, on redemande l'accord. Les deux se lisent alors côte à côte, et
 * l'on voit ce qui a bougé entre les deux.
 */
export async function listerVisas(offreId) {
  const db = await connexion();
  const lignes = await db.requete(
    `SELECT id, offre_id, version, signataire_nom, signataire_email, signataire_role,
            commentaire, empreinte, ip, signe_le, trace IS NOT NULL AS avec_trace
     FROM ${table('vues_visas')} WHERE offre_id = ? ORDER BY id DESC`,
    [Number(offreId)],
  );
  return lignes.map((l) => ({ ...l, avec_trace: Boolean(Number(l.avec_trace)) }));
}

/** Le dernier visa, celui qui compte. */
export async function dernierVisa(offreId) {
  return (await listerVisas(offreId))[0] || null;
}

/** Le tracé manuscrit d'un visa, quand le navigateur en a produit un. */
export async function chargerTrace(id) {
  const db = await connexion();
  const lignes = await db.requete(
    `SELECT trace FROM ${table('vues_visas')} WHERE id = ? LIMIT 1`,
    [Number(id)],
  );
  const brut = lignes[0]?.trace;
  if (!brut) return null;
  return { octets: Buffer.from(brut, 'base64'), type: 'image/png' };
}

/**
 * Un tracé manuscrit, tel que le navigateur l'a rendu.
 *
 * Il arrive en « data:image/png;base64,… », c'est-à-dire depuis le client,
 * c'est-à-dire depuis n'importe où. Trois contrôles : le préfixe exact, le
 * base64 valide, et la signature PNG dans les octets. Le troisième est le
 * seul qui prouve quelque chose — les deux autres se falsifient.
 *
 * Un tracé refusé ne bloque pas la signature : le nom tapé et l'horodatage
 * font l'accord, le dessin n'est qu'un agrément.
 */
export function traceValide(saisie) {
  const brut = String(saisie || '').trim();
  if (!brut.startsWith('data:image/png;base64,')) return null;
  const corps = brut.slice('data:image/png;base64,'.length);
  // Un demi-mégaoctet de gribouillis suffit largement, et empêche d'utiliser
  // ce champ pour déposer autre chose.
  if (corps.length > 700_000 || !/^[A-Za-z0-9+/=]+$/.test(corps)) return null;
  let octets;
  try {
    octets = Buffer.from(corps, 'base64');
  } catch {
    return null;
  }
  const PNG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  if (octets.length < 64 || !PNG.every((o, i) => octets[i] === o)) return null;
  return octets.toString('base64');
}

/**
 * Enregistre le bon pour accord du client.
 *
 * Ce qui donne sa valeur au visa n'est pas le nom tapé : c'est l'empreinte,
 * calculée **ici**, à partir de ce que la base contient au moment du clic.
 * La calculer côté serveur est tout le point — une empreinte envoyée par le
 * formulaire se remplacerait aussi facilement que le reste.
 */
export async function poserVisa(offreId, { vues, version = 1, nom, email, role, commentaire, trace, ip, agent }) {
  const signataire = nomDeSignataire(nom);
  if (!signataire) {
    throw new Error('Signez de votre nom complet : c’est lui qui rend cet accord utilisable.');
  }
  const maquettes = await listerMaquettes(offreId);
  const empreinte = empreinteDuFlux(vues, maquettes);

  const db = await connexion();
  await db.executer(
    `INSERT INTO ${table('vues_visas')}
      (offre_id, version, signataire_nom, signataire_email, signataire_role, commentaire, trace, empreinte, ip, agent, signe_le)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      Number(offreId),
      Number(version) || 1,
      signataire,
      String(email || '').trim().slice(0, 200) || null,
      String(role || '').trim().slice(0, 120) || null,
      String(commentaire || '').trim() || null,
      traceValide(trace),
      empreinte,
      String(ip || '').slice(0, 45) || null,
      String(agent || '').slice(0, 255) || null,
      new Date(),
    ],
  );
  viderCache();
  return { empreinte, signataire };
}
