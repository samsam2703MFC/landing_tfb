/**
 * Génération du contenu éditorial par l'API Anthropic.
 *
 * On n'écrit aucun texte produit à la main : le contenu est déduit du code
 * source et du README de chaque dépôt. Pour obtenir du JSON exploitable, on
 * force l'usage d'un outil (`tool_choice`) dont le schéma décrit exactement la
 * structure attendue — le modèle ne peut alors répondre qu'en remplissant ce
 * schéma.
 */

import Anthropic from '@anthropic-ai/sdk';

const MODELE_DEFAUT = 'claude-sonnet-4-5';
const TENTATIVES_MAX = 3;

/** Instancie le client. La clé n'est lue que depuis l'environnement. */
function client() {
  const cle = process.env.ANTHROPIC_API_KEY;
  if (!cle) throw new Error('ANTHROPIC_API_KEY manquant.');
  return new Anthropic({ apiKey: cle });
}

function modele() {
  return process.env.ANTHROPIC_MODEL || MODELE_DEFAUT;
}

// ---------------------------------------------------------------------------
// Ligne éditoriale — partagée par toutes les générations
// ---------------------------------------------------------------------------

const LIGNE_EDITORIALE = `Tu rédiges le contenu d'un site qui présente un ERP destiné aux réseaux de franchise et de succursales.

Angle imposé :
- Tu pars des problèmes concrets du franchiseur (perte de contrôle sur l'exécution en point de vente, remontées d'information tardives ou fausses, procédures qui ne survivent pas au départ d'une personne, ressaisie, disparités entre magasins), puis tu montres la réponse apportée.
- Fil conducteur : la vraie valeur d'un réseau, c'est sa capacité à être transmis. Un réseau qui ne tient que dans la tête de ses fondateurs ne se transmet pas et ne se vend pas. Un outil de gestion solide est ce qui rend le savoir-faire transmissible.
- Ton opérationnel : ce que la personne fait à l'écran, ce qu'elle cesse de faire à la main. Pas de superlatifs, pas de jargon commercial, pas de « révolutionnaire », « leader », « innovant ».

Règles de véracité :
- Tu ne décris QUE ce que le code et le README montrent réellement. Si une capacité n'apparaît pas, tu ne l'inventes pas.
- Aucun chiffre inventé : pas de pourcentage, pas de gain chiffré, pas de nom de client, pas de témoignage.
- Français correct, phrases courtes, voix active.`;

// ---------------------------------------------------------------------------
// Outil : contenu d'un module
// ---------------------------------------------------------------------------

const OUTIL_MODULE = {
  name: 'publier_module',
  description:
    "Publie la fiche éditoriale d'un module de l'ERP, déduite de son code source et de son README.",
  input_schema: {
    type: 'object',
    properties: {
      nom: {
        type: 'string',
        description: "Nom commercial court du module en français, sans le nom du dépôt (ex. « Panel consultant »).",
      },
      accroche: {
        type: 'string',
        description: 'Une phrase de 15 mots maximum qui dit à qui sert le module et pour quoi faire.',
      },
      resume: {
        type: 'string',
        description: 'Deux à trois phrases décrivant le module. Texte brut, sans markdown.',
      },
      description: {
        type: 'string',
        description:
          "Présentation longue en markdown (3 à 5 paragraphes) : le problème de terrain, ce que le module fait, comment il s'articule avec le reste du réseau. Pas de titre de niveau 1.",
      },
      public_cible: {
        type: 'string',
        description: "Qui utilise ce module au quotidien (ex. « Animateurs réseau et responsables d'exploitation »).",
      },
      problemes: {
        type: 'array',
        description: "Les problèmes du franchiseur auxquels ce module répond, dans son langage à lui.",
        minItems: 2,
        maxItems: 5,
        items: {
          type: 'object',
          properties: {
            titre: { type: 'string', description: 'Le problème en 6 mots maximum.' },
            texte: { type: 'string', description: 'Deux phrases sur ce que ça coûte concrètement au réseau.' },
          },
          required: ['titre', 'texte'],
          additionalProperties: false,
        },
      },
      benefices: {
        type: 'array',
        description: 'Ce que le module change dans le fonctionnement du réseau.',
        minItems: 3,
        maxItems: 6,
        items: {
          type: 'object',
          properties: {
            titre: { type: 'string', description: 'Le bénéfice en 6 mots maximum.' },
            texte: { type: 'string', description: 'Deux phrases, appuyées sur une capacité réelle du module.' },
          },
          required: ['titre', 'texte'],
          additionalProperties: false,
        },
      },
      fonctions: {
        type: 'array',
        description:
          'Les fonctions du module observées dans le code : écrans, parcours, capacités. Une entrée par fonction identifiable.',
        minItems: 3,
        maxItems: 14,
        items: {
          type: 'object',
          properties: {
            cle: {
              type: 'string',
              description:
                'Identifiant stable en minuscules sans accents, mots séparés par des tirets (ex. « checklists-de-visite »). Sert de clé de mise à jour : il doit rester le même d\'une exécution à l\'autre pour une même fonction.',
              pattern: '^[a-z0-9]+(-[a-z0-9]+)*$',
            },
            nom: { type: 'string', description: 'Nom de la fonction en français, 5 mots maximum.' },
            description: {
              type: 'string',
              description: 'Deux à quatre phrases : ce que la fonction permet de faire, concrètement, à l\'écran.',
            },
            benefice: {
              type: 'string',
              description: 'Une phrase : ce que le réseau y gagne en exploitation.',
            },
            icone: {
              type: 'string',
              description:
                'Nom d\'icône Lucide en kebab-case, choisi dans : calendar, clipboard-check, trending-up, triangle-alert, file-text, pencil, smartphone, shopping-cart, package, truck, chef-hat, monitor, users, settings, bar-chart, map-pin, bell, lock, search, credit-card, layers, refresh-cw.',
            },
          },
          required: ['cle', 'nom', 'description', 'benefice', 'icone'],
          additionalProperties: false,
        },
      },
      stack: {
        type: 'array',
        description: 'Technologies réellement identifiées dans le dépôt (5 entrées maximum).',
        maxItems: 5,
        items: { type: 'string' },
      },
      mermaid: {
        type: 'string',
        description:
          "Diagramme Mermaid du parcours principal du module. Commence obligatoirement par « flowchart TD ». Libellés en français entre crochets, sans guillemets ni parenthèses ni point-virgule à l'intérieur des libellés. 5 à 9 nœuds.",
      },
      mots_cles: {
        type: 'array',
        description: 'Trois à six mots-clés pour le référencement.',
        maxItems: 6,
        items: { type: 'string' },
      },
    },
    required: [
      'nom', 'accroche', 'resume', 'description', 'public_cible',
      'problemes', 'benefices', 'fonctions', 'stack', 'mermaid', 'mots_cles',
    ],
    additionalProperties: false,
  },
};

// ---------------------------------------------------------------------------
// Outil : contenu de la page d'accueil
// ---------------------------------------------------------------------------

const OUTIL_SITE = {
  name: 'publier_site',
  description: "Publie le contenu de la page d'accueil, synthétisé à partir des fiches de tous les modules.",
  input_schema: {
    type: 'object',
    properties: {
      titre: { type: 'string', description: 'Titre principal, 10 mots maximum.' },
      sous_titre: { type: 'string', description: 'Une phrase qui précise le titre.' },
      accroche: {
        type: 'string',
        description:
          "Deux paragraphes courts sur la transmissibilité du réseau comme valeur réelle de l'entreprise. Texte brut.",
      },
      problemes: {
        type: 'array',
        description: 'Les problèmes structurels du franchiseur, avant toute mention de solution.',
        minItems: 3,
        maxItems: 6,
        items: {
          type: 'object',
          properties: {
            titre: { type: 'string' },
            texte: { type: 'string', description: 'Deux à trois phrases.' },
          },
          required: ['titre', 'texte'],
          additionalProperties: false,
        },
      },
      reponses: {
        type: 'array',
        description: 'Les réponses apportées par la plateforme, dans le même ordre que les problèmes quand c\'est possible.',
        minItems: 3,
        maxItems: 6,
        items: {
          type: 'object',
          properties: {
            titre: { type: 'string' },
            texte: { type: 'string', description: 'Deux à trois phrases, appuyées sur des modules existants.' },
          },
          required: ['titre', 'texte'],
          additionalProperties: false,
        },
      },
      mermaid: {
        type: 'string',
        description:
          "Diagramme Mermaid de l'ensemble de la plateforme : les modules et la circulation de l'information entre eux. Commence par « flowchart LR ». Libellés en français sans guillemets ni parenthèses.",
      },
      cta_texte: { type: 'string', description: 'Libellé du bouton principal, 4 mots maximum.' },
      meta_description: { type: 'string', description: 'Description SEO, 155 caractères maximum.' },
    },
    required: ['titre', 'sous_titre', 'accroche', 'problemes', 'reponses', 'mermaid', 'cta_texte', 'meta_description'],
    additionalProperties: false,
  },
};

// ---------------------------------------------------------------------------
// Appel générique en tool-use forcé
// ---------------------------------------------------------------------------

/** Attente simple entre deux tentatives. */
function attendre(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Envoie une requête et renvoie l'objet produit par l'outil.
 * Réessaie sur erreur transitoire (429 / 5xx) et sur réponse invalide,
 * en renvoyant au modèle la liste des problèmes détectés.
 */
async function appelOutil({ outil, systeme, message, valider, maxTokens = 8000 }) {
  const anthropic = client();
  const messages = [{ role: 'user', content: message }];
  let derniereErreur = null;

  for (let tentative = 1; tentative <= TENTATIVES_MAX; tentative += 1) {
    let reponse;
    try {
      reponse = await anthropic.messages.create({
        model: modele(),
        max_tokens: maxTokens,
        system: systeme,
        tools: [outil],
        tool_choice: { type: 'tool', name: outil.name },
        messages,
      });
    } catch (err) {
      const statut = err?.status;
      const transitoire = statut === 429 || statut === 529 || (statut >= 500 && statut < 600);
      if (transitoire && tentative < TENTATIVES_MAX) {
        await attendre(2000 * tentative);
        derniereErreur = err;
        continue;
      }
      throw new Error(`API Anthropic : ${err?.message || err}`);
    }

    const bloc = reponse.content.find((c) => c.type === 'tool_use' && c.name === outil.name);
    if (!bloc) {
      derniereErreur = new Error("Le modèle n'a pas appelé l'outil attendu.");
      continue;
    }

    const problemes = valider ? valider(bloc.input) : [];
    if (problemes.length === 0) return bloc.input;

    derniereErreur = new Error(`Réponse invalide : ${problemes.join(' ; ')}`);
    if (tentative === TENTATIVES_MAX) break;

    // On renvoie l'erreur au modèle pour qu'il corrige au tour suivant.
    messages.push({ role: 'assistant', content: reponse.content });
    messages.push({
      role: 'user',
      content: [
        {
          type: 'tool_result',
          tool_use_id: bloc.id,
          is_error: true,
          content: `Contenu refusé : ${problemes.join(' ; ')}. Rappelle l'outil avec une version corrigée.`,
        },
      ],
    });
  }

  throw new Error(derniereErreur?.message || 'Génération impossible.');
}

// ---------------------------------------------------------------------------
// Validation locale — l'API garantit la forme, pas la qualité
// ---------------------------------------------------------------------------

function texteNonVide(valeur, longueurMin = 1) {
  return typeof valeur === 'string' && valeur.trim().length >= longueurMin;
}

/** Vérifie qu'un diagramme Mermaid est exploitable côté navigateur. */
function validerMermaid(valeur, prefixes) {
  const problemes = [];
  if (!texteNonVide(valeur, 20)) {
    problemes.push('mermaid vide ou trop court');
    return problemes;
  }
  const premiereLigne = valeur.trim().split('\n')[0].trim();
  if (!prefixes.some((p) => premiereLigne.startsWith(p))) {
    problemes.push(`mermaid doit commencer par ${prefixes.join(' ou ')}`);
  }
  if (/```/.test(valeur)) problemes.push('mermaid ne doit pas contenir de bloc de code markdown');
  return problemes;
}

function validerModule(donnees) {
  const problemes = [];
  if (!texteNonVide(donnees.nom, 2)) problemes.push('nom manquant');
  if (!texteNonVide(donnees.accroche, 10)) problemes.push('accroche trop courte');
  if (!texteNonVide(donnees.description, 200)) problemes.push('description trop courte');
  if (!Array.isArray(donnees.fonctions) || donnees.fonctions.length < 3) {
    problemes.push('au moins 3 fonctions attendues');
  } else {
    const cles = new Set();
    for (const fonction of donnees.fonctions) {
      if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(fonction.cle || '')) {
        problemes.push(`clé de fonction invalide : ${fonction.cle}`);
      }
      if (cles.has(fonction.cle)) problemes.push(`clé de fonction en double : ${fonction.cle}`);
      cles.add(fonction.cle);
      if (!texteNonVide(fonction.description, 40)) {
        problemes.push(`description trop courte pour ${fonction.cle}`);
      }
    }
  }
  if (!Array.isArray(donnees.problemes) || donnees.problemes.length < 2) {
    problemes.push('au moins 2 problèmes attendus');
  }
  if (!Array.isArray(donnees.benefices) || donnees.benefices.length < 3) {
    problemes.push('au moins 3 bénéfices attendus');
  }
  problemes.push(...validerMermaid(donnees.mermaid, ['flowchart TD', 'flowchart TB']));
  return problemes;
}

function validerSite(donnees) {
  const problemes = [];
  if (!texteNonVide(donnees.titre, 5)) problemes.push('titre manquant');
  if (!texteNonVide(donnees.accroche, 100)) problemes.push('accroche trop courte');
  if (!Array.isArray(donnees.problemes) || donnees.problemes.length < 3) {
    problemes.push('au moins 3 problèmes attendus');
  }
  if (!Array.isArray(donnees.reponses) || donnees.reponses.length < 3) {
    problemes.push('au moins 3 réponses attendues');
  }
  if (texteNonVide(donnees.meta_description) && donnees.meta_description.length > 200) {
    problemes.push('meta_description trop longue');
  }
  problemes.push(...validerMermaid(donnees.mermaid, ['flowchart LR', 'flowchart TD']));
  return problemes;
}

// ---------------------------------------------------------------------------
// API publique du module
// ---------------------------------------------------------------------------

/**
 * Produit la fiche éditoriale d'un module à partir du digest de son dépôt.
 * @param {{digest: string, repo: string, slug: string, groupe?: string}} contexte
 */
export async function genererContenuModule({ digest, repo, slug, groupe }) {
  const message = [
    `Voici le contenu du dépôt GitHub ${repo} (module « ${slug} »${groupe ? `, famille « ${groupe} »` : ''}).`,
    "Analyse le code et le README, identifie ce que le module fait réellement, puis appelle l'outil publier_module.",
    '',
    digest,
  ].join('\n');

  return appelOutil({
    outil: OUTIL_MODULE,
    systeme: LIGNE_EDITORIALE,
    message,
    valider: validerModule,
  });
}

/**
 * Produit le contenu de la page d'accueil à partir des fiches déjà générées.
 * @param {Array<{slug,nom,accroche,resume,groupe,fonctions}>} modules
 */
export async function genererContenuSite(modules) {
  const inventaire = modules
    .map((module) => {
      const fonctions = (module.fonctions || []).map((f) => f.nom).join(', ');
      return [
        `## ${module.nom} (${module.slug}${module.groupe ? `, ${module.groupe}` : ''})`,
        module.accroche || '',
        module.resume || '',
        fonctions ? `Fonctions : ${fonctions}` : '',
      ]
        .filter(Boolean)
        .join('\n');
    })
    .join('\n\n');

  const message = [
    "Voici l'inventaire des modules de la plateforme, tel qu'il vient d'être généré depuis les dépôts.",
    "Rédige la page d'accueil et appelle l'outil publier_site.",
    '',
    inventaire,
  ].join('\n');

  return appelOutil({
    outil: OUTIL_SITE,
    systeme: LIGNE_EDITORIALE,
    message,
    valider: validerSite,
    maxTokens: 6000,
  });
}

export { MODELE_DEFAUT, modele };
