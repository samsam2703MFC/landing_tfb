/**
 * La signature électronique, et le service qui la porte.
 *
 * Même patron que le courriel : un adaptateur réel quand il est configuré,
 * un journal bavard sinon. La règle qui tient tout le module :
 *
 *   **rien ne dit « signé » qui ne l'est pas.**
 *
 * Un contrat parti chez un prestataire absent reste `brouillon`, et la
 * console dit à voix haute qu'aucun service n'est branché. L'alternative —
 * marquer « envoyé » et attendre un retour qui ne viendra jamais — produit
 * un dossier qui a l'air en ordre et ne l'est pas.
 *
 * DocuSign se branche par variables d'environnement, jamais en dur :
 *
 *   DOCUSIGN_BASE_URI      https://eu.docusign.net/restapi  (démo : demo.docusign.net)
 *   DOCUSIGN_ACCOUNT_ID    l'identifiant du compte
 *   DOCUSIGN_JETON         un jeton d'accès OAuth valide
 *
 * Les trois sont nécessaires : deux sur trois valent zéro, et le service
 * retombe sur le journal en le disant.
 */

/** Les états d'un contrat, dans l'ordre du cycle de vie. */
export const STATUTS_CONTRAT = ['brouillon', 'envoye', 'signe', 'refuse', 'expire'];

/**
 * Ce que le prestataire répond, ramené à nos mots.
 *
 * DocuSign en connaît une douzaine ; trois nous intéressent, et tout le
 * reste veut dire « toujours en cours ». Traduire ici plutôt qu'au fil des
 * écrans évite qu'un `voided` finisse affiché tel quel à un commercial.
 */
export function etatDepuisDocuSign(brut) {
  const s = String(brut || '').toLowerCase();
  if (s === 'completed') return 'signe';
  if (s === 'declined' || s === 'voided') return 'refuse';
  if (s === 'expired') return 'expire';
  return 'envoye';
}

/**
 * @typedef {object} ServiceSignature
 * @property {string} nom        Ce qui sera dit au commercial.
 * @property {boolean} signe     Faux si rien ne part vraiment.
 * @property {(d: object) => Promise<{enveloppe: string, statut: string}>} envoyer
 * @property {(id: string) => Promise<{statut: string}>} etat
 */

/** Le service qui journalise et n'envoie rien. */
export const SIGNATURE_JOURNAL = {
  nom: 'journal du serveur',
  signe: false,
  async envoyer({ reference, signataire_nom, signataire_email, corps }) {
    console.log([
      '─── CONTRAT NON ENVOYÉ EN SIGNATURE (aucun service configuré) ───',
      `Référence  : ${reference}`,
      `Signataire : ${signataire_nom} <${signataire_email}>`,
      '',
      corps,
      '────────────────────────────────────────────────────────────────',
    ].join('\n'));
    // Pas d'enveloppe : il n'y en a pas. En inventer une donnerait un
    // identifiant qu'aucune interrogation ne retrouvera.
    return { enveloppe: null, statut: 'brouillon' };
  },
  async etat() {
    return { statut: 'brouillon' };
  },
};

/**
 * L'adaptateur DocuSign.
 *
 * Un contrat part en texte brut encodé en base64 : DocuSign accepte le
 * `text/plain` et le rend en PDF de son côté. Fabriquer le PDF ici
 * demanderait une dépendance de mise en page pour un document que le
 * prestataire sait déjà composer.
 */
function docusign({ baseUri, compte, jeton }) {
  const appel = async (chemin, options = {}) => {
    const rep = await fetch(`${baseUri}/v2.1/accounts/${compte}${chemin}`, {
      ...options,
      headers: {
        Authorization: `Bearer ${jeton}`,
        'Content-Type': 'application/json',
        ...(options.headers || {}),
      },
    });
    if (!rep.ok) {
      const texte = await rep.text().catch(() => '');
      throw new Error(`DocuSign ${chemin} → ${rep.status} ${texte.slice(0, 200)}`);
    }
    return rep.json();
  };

  return {
    nom: 'DocuSign',
    signe: true,
    async envoyer({ reference, signataire_nom, signataire_email, corps }) {
      const reponse = await appel('/envelopes', {
        method: 'POST',
        body: JSON.stringify({
          emailSubject: `Contrat ${reference} — signature`,
          status: 'sent',
          documents: [{
            documentBase64: Buffer.from(String(corps), 'utf8').toString('base64'),
            name: `Contrat ${reference}`,
            fileExtension: 'txt',
            documentId: '1',
          }],
          recipients: {
            signers: [{
              email: signataire_email,
              name: signataire_nom,
              recipientId: '1',
              routingOrder: '1',
              // L'onglet de signature en bas du document : sans lui,
              // DocuSign envoie un document que personne ne peut signer.
              tabs: {
                signHereTabs: [{ anchorString: 'à signer électroniquement', anchorUnits: 'pixels', anchorYOffset: '20' }],
              },
            }],
          },
        }),
      });
      return { enveloppe: reponse.envelopeId, statut: etatDepuisDocuSign(reponse.status) };
    },
    async etat(enveloppe) {
      const reponse = await appel(`/envelopes/${encodeURIComponent(enveloppe)}`);
      return { statut: etatDepuisDocuSign(reponse.status) };
    },
  };
}

/**
 * Le service en vigueur.
 *
 * L'appelant n'a jamais à choisir : il demande, il reçoit, et il regarde
 * `signe` avant de promettre quoi que ce soit à un commercial.
 */
export function serviceSignature(env = process.env) {
  const baseUri = String(env.DOCUSIGN_BASE_URI || '').replace(/\/+$/, '');
  const compte = String(env.DOCUSIGN_ACCOUNT_ID || '');
  const jeton = String(env.DOCUSIGN_JETON || '');
  if (!baseUri || !compte || !jeton) return SIGNATURE_JOURNAL;
  return docusign({ baseUri, compte, jeton });
}
