import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { parse } from 'yaml';

/**
 * Reads docs/openapi.yaml — the API contract, kept as a file rather than generated
 * from the routes.
 *
 * That choice is deliberate: a contract derived from the code can never contradict
 * it, and therefore can never catch a route that changed shape without anyone
 * deciding to. CI enforces the other direction instead — every `x-tfb-source` must
 * name a file that exists, so the spec cannot outlive the code it describes.
 *
 * The file ships with the repository, and the deploy checks out the whole tree, so
 * it is on disk next to the app. If it ever is not, every caller here degrades to
 * "unavailable" rather than throwing: an API documentation page is not worth a 500.
 */

export interface Operation {
  method: string;
  path: string;
  summary: string;
  description: string;
  operationId: string;
  tags: string[];
  /** The route file this operation is read off. */
  source: string | null;
  /** Whether the operation needs the admin session cookie, a tenant key, or nothing. */
  security: 'admin' | 'tenant' | 'public';
  responses: { code: string; description: string }[];
  deprecated: boolean;
}

export interface Spec {
  title: string;
  version: string;
  description: string;
  tags: { name: string; description: string }[];
  operations: Operation[];
}

const METHODS = ['get', 'post', 'put', 'patch', 'delete'] as const;

type Raw = Record<string, unknown>;

function str(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback;
}

/** Which credential an operation needs, from its own `security` or the document's. */
function securityOf(operation: Raw, documentDefault: unknown): Operation['security'] {
  const declared = operation.security ?? documentDefault;
  if (!Array.isArray(declared) || declared.length === 0) return 'public';
  const names = declared.flatMap((entry) => (entry && typeof entry === 'object' ? Object.keys(entry) : []));
  if (names.includes('tenantKey')) return 'tenant';
  if (names.includes('adminSession')) return 'admin';
  return 'public';
}

export const SPEC_PATH = path.join(process.cwd(), 'docs', 'openapi.yaml');

/** The raw document, for anyone pointing Swagger UI, Postman or Scalar at it. */
export async function readSpecFile(): Promise<string | null> {
  try {
    return await readFile(SPEC_PATH, 'utf8');
  } catch {
    return null;
  }
}

export async function getSpec(): Promise<Spec | null> {
  const text = await readSpecFile();
  if (!text) return null;

  let doc: Raw;
  try {
    doc = parse(text) as Raw;
  } catch (error) {
    // A malformed contract is a broken build, not a broken page — CI already fails
    // on it. Here it just means there is nothing to render.
    console.error('docs/openapi.yaml is not parsable', error);
    return null;
  }

  const info = (doc.info ?? {}) as Raw;
  const paths = (doc.paths ?? {}) as Record<string, Raw>;
  const operations: Operation[] = [];

  for (const [route, item] of Object.entries(paths)) {
    for (const method of METHODS) {
      const operation = item[method] as Raw | undefined;
      if (!operation) continue;

      const responses = Object.entries((operation.responses ?? {}) as Record<string, Raw>).map(
        ([code, body]) => ({
          code,
          // A $ref'd response keeps its description one level down; showing the code
          // alone would lose exactly the part a reader needs.
          description: str(body?.description) || str((body as Raw)?.$ref).split('/').pop() || '',
        }),
      );

      operations.push({
        method: method.toUpperCase(),
        path: route,
        summary: str(operation.summary),
        description: str(operation.description),
        operationId: str(operation.operationId),
        tags: Array.isArray(operation.tags) ? operation.tags.map((t) => String(t)) : [],
        source: typeof operation['x-tfb-source'] === 'string' ? operation['x-tfb-source'] : null,
        security: securityOf(operation, doc.security),
        responses,
        deprecated: operation.deprecated === true,
      });
    }
  }

  return {
    title: str(info.title, 'API'),
    version: str(info.version),
    description: str(info.description),
    tags: Array.isArray(doc.tags)
      ? (doc.tags as Raw[]).map((t) => ({ name: str(t.name), description: str(t.description) }))
      : [],
    operations,
  };
}

/** Operations grouped by their first tag, in the order the document declares tags. */
export function byTag(spec: Spec): { tag: string; description: string; operations: Operation[] }[] {
  const order = spec.tags.map((t) => t.name);
  const groups = new Map<string, Operation[]>();
  for (const operation of spec.operations) {
    const tag = operation.tags[0] ?? 'Autres';
    (groups.get(tag) ?? groups.set(tag, []).get(tag)!).push(operation);
  }
  return [...groups.entries()]
    .sort((a, b) => {
      const ai = order.indexOf(a[0]);
      const bi = order.indexOf(b[0]);
      return (ai === -1 ? order.length : ai) - (bi === -1 ? order.length : bi);
    })
    .map(([tag, operations]) => ({
      tag,
      description: spec.tags.find((t) => t.name === tag)?.description ?? '',
      operations,
    }));
}
