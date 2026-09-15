import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";
import { parse } from "yaml";

import app from "../test-app.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Mirrors openapi-bundle-refs.test.ts's own findBundledSpec() -- walks up
 * from this file to the repository's bundled OpenAPI spec.
 */
function findBundledSpec(): string {
  let current = __dirname;

  while (true) {
    const candidate = join(current, "openapi", "openapi.bundled.yaml");

    if (existsSync(candidate)) {
      return candidate;
    }

    const parent = dirname(current);

    if (parent === current) {
      throw new Error(
        "openapi/openapi.bundled.yaml not found in any parent directory.",
      );
    }

    current = parent;
  }
}

/**
 * Rendered doc surfaces, not API resources -- deliberately excluded from
 * the spec, see api-reference/introduction.mdx's "Three views of the same
 * spec" section. Every other route mounted in packages/api/src/app.ts
 * must have a matching { method, path } entry in openapi/openapi.yaml, or
 * this test fails: this is the regression coverage that api-reference/
 * introduction.mdx's Info callout notes does not otherwise exist.
 */
const DOC_SURFACE_ALLOWLIST = new Set(["get /documentation", "get /reference"]);

interface ExpressLayer {
  route?: {
    methods: Record<string, boolean>;
  };
  regexp: RegExp;
  keys: Array<{ name: string | number }>;
  handle?: { stack?: ExpressLayer[] };
}

/**
 * Express 5 (path-to-regexp v8) layer regexps follow a predictable shape:
 * a mount-prefix layer's regexp ends in \/?(?=\/|$) (optional trailing
 * slash, followed by / or end-of-string); a leaf route layer's regexp
 * ends in \/?$ (optional trailing slash, then end). Every :param becomes
 * (?:\/([^/]+?)) in registration order, matching layer.keys in the same
 * order. There is no other stored copy of the original path string on an
 * Express 5 Layer before it has matched a real request (layer.path is a
 * getter populated only during matching), so this is the only way to
 * recover route templates without issuing a live HTTP request per route.
 */
function regexpToTemplate(regexp: RegExp, keys: ExpressLayer["keys"]): string {
  let src = regexp.source;

  src = src.replace(/^\^/, "");
  src = src.replace(/\\\/\?\(\?=\\\/\|\$\)$/, "");
  src = src.replace(/\\\/\?\$$/, "");

  let keyIndex = 0;
  src = src.replace(
    /\(\?:\\\/\(\[\^\/\]\+\?\)\)/g,
    () => `/:${keys[keyIndex++]?.name}`,
  );

  // Unescape the regex-escaped literal characters path-to-regexp emits
  // for static segments (e.g. \/well-known\/jwks\.json -> /well-known/jwks.json).
  src = src.replace(/\\([./])/g, "$1");

  const stillEncoded = src.match(/[()?[\]]/);

  if (stillEncoded) {
    throw new Error(
      `regexpToTemplate could not fully decode ${regexp.source} -- ` +
        `unexpected regex metacharacter '${stillEncoded[0]}' survived ` +
        "conversion. Express's path-to-regexp output shape has likely " +
        "changed; update this converter rather than trusting its output.",
    );
  }

  return src;
}

function findMountedRoutes(expressApp: unknown): Set<string> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const router = (expressApp as any)._router;

  if (!router?.stack) {
    throw new Error(
      "app._router.stack not found -- Express's internal router shape " +
        "has likely changed across a version bump. Update this test's " +
        "introspection to match, rather than silently skipping it.",
    );
  }

  const found = new Set<string>();

  function walk(stack: ExpressLayer[], prefix: string): void {
    for (const layer of stack) {
      if (layer.route) {
        const template = regexpToTemplate(layer.regexp, layer.keys);
        const full = (prefix + template).replace(/\/+/g, "/") || "/";

        for (const [method, enabled] of Object.entries(layer.route.methods)) {
          if (enabled) {
            found.add(`${method} ${full}`);
          }
        }

        continue;
      }

      if (layer.handle?.stack) {
        const prefixAddition = regexpToTemplate(layer.regexp, layer.keys);
        walk(layer.handle.stack, prefix + prefixAddition);
      }
    }
  }

  walk(router.stack, "");

  return found;
}

/**
 * OpenAPI path templates use {param}; Express route templates use
 * :param. Normalize both to a bare placeholder so real routes and spec
 * paths compare structurally, independent of the specific param name
 * each side happens to use -- e.g. the spec names it
 * {businessTransactionId} on /verification/{businessTransactionId}, but
 * verify-get.ts's real route is registered as /:id, param name "id".
 */
function normalizePath(path: string): string {
  return path.replace(/:[^/]+/g, "{}").replace(/\{[^}]+\}/g, "{}");
}

describe("OpenAPI spec vs. real mounted routes", () => {
  it("documents every real route (except the deliberately-excluded doc-UI surfaces)", () => {
    const mountedRoutes = findMountedRoutes(app);

    const specPath = findBundledSpec();
    const spec = parse(readFileSync(specPath, "utf8")) as {
      paths: Record<string, Record<string, unknown>>;
    };

    const specRoutes = new Set<string>();

    for (const [path, methods] of Object.entries(spec.paths)) {
      for (const method of Object.keys(methods)) {
        specRoutes.add(`${method} ${normalizePath(path)}`);
      }
    }

    const missingFromSpec = [...mountedRoutes]
      .filter((route) => !DOC_SURFACE_ALLOWLIST.has(route))
      .map((route) => {
        const [method, ...pathParts] = route.split(" ");
        return `${method} ${normalizePath(pathParts.join(" "))}`;
      })
      .filter((normalized) => !specRoutes.has(normalized))
      .sort();

    expect(missingFromSpec).toEqual([]);
  });

  it("does not document a route that is no longer actually mounted", () => {
    const mountedRoutes = new Set(
      [...findMountedRoutes(app)].map((route) => {
        const [method, ...pathParts] = route.split(" ");
        return `${method} ${normalizePath(pathParts.join(" "))}`;
      }),
    );

    for (const surface of DOC_SURFACE_ALLOWLIST) {
      mountedRoutes.add(surface);
    }

    const specPath = findBundledSpec();
    const spec = parse(readFileSync(specPath, "utf8")) as {
      paths: Record<string, Record<string, unknown>>;
    };

    const specOnly = Object.entries(spec.paths)
      .flatMap(([path, methods]) =>
        Object.keys(methods).map(
          (method) => `${method} ${normalizePath(path)}`,
        ),
      )
      .filter((route) => !mountedRoutes.has(route))
      .sort();

    expect(specOnly).toEqual([]);
  });
});
