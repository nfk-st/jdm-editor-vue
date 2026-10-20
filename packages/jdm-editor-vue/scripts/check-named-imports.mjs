// Guard against PHANTOM named imports.
//
// A named import of a name a package does not export type-checks (the
// package's .d.ts may declare it) but throws at RUNTIME in a real ESM
// bundler:
//
//   Uncaught SyntaxError: The requested module '.../splitpanes.js' does not
//   provide an export named 'Splitpane'
//
// That error kills the whole application, and it is invisible to
// `vue-tsc`, to vitest (whose SSR transform turns named imports into
// property accesses) and to `vite build` (external dependencies are not
// resolved at build time). This script resolves every named import against
// the package's ACTUAL runtime exports, so the class of bug is caught
// before it reaches a browser.
//
// Run: `pnpm --filter @nfk.st/jdm-editor-vue check:imports`
//
// Exit codes: 0 = clean, 1 = phantom named imports found.
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const PKG_DIR = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SRC_DIR = join(PKG_DIR, 'src');

const SOURCE_EXTENSIONS = ['.ts', '.tsx', '.vue'];
// Type-only files declare modules rather than import them.
const SKIP_FILES = ['.d.ts'];

/** Every source file under src/, minus declaration files. */
const collectFiles = (dir) => {
  const out = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      out.push(...collectFiles(full));
      continue;
    }
    if (!SOURCE_EXTENSIONS.some((ext) => entry.endsWith(ext))) continue;
    if (SKIP_FILES.some((suffix) => entry.endsWith(suffix))) continue;
    out.push(full);
  }
  return out;
};

// `import { a, b } from 'pkg'` / `import type { a } from 'pkg'` /
// `import Default, { a } from 'pkg'`
const IMPORT_RE = /^[ \t]*import\s+(?!type\s)(?!['"])([^'"]*?)\s+from\s+['"]([^'"]+)['"]/gm;
// `export { a } from 'pkg'` / `export { a as b } from 'pkg'`
const EXPORT_RE = /^[ \t]*export\s+(?!type\s)(?!default\s)(?!star\s)([^'"]*?)\s+from\s+['"]([^'"]+)['"]/gm;

/** The package specifiers of an import/export clause, or null for a bare/default/namespace import. */
const clauseSpecifiers = (clause) => {
  const braces = clause.match(/\{([^}]*)\}/);
  if (!braces) return null;
  return (
    braces[1]
      .split(',')
      .map((name) => name.trim())
      // `type X` specifiers are erased at compile time — they are not runtime imports
      .filter((name) => name && !name.startsWith('type '))
      // `X as Y` imports X
      .map((name) => name.split(/\s+as\s+/)[0].trim())
      .filter(Boolean)
  );
};

/** specifier -> Map(imported name -> Set(source file)) */
const collectNamedImports = () => {
  const found = new Map();

  const record = (spec, names, file) => {
    if (spec.startsWith('.') || spec.startsWith('/')) return; // relative
    if (!names.length) return;
    if (!found.has(spec)) found.set(spec, new Map());
    const bag = found.get(spec);
    for (const name of names) {
      if (!bag.has(name)) bag.set(name, new Set());
      bag.get(name).add(file);
    }
  };

  for (const file of collectFiles(SRC_DIR)) {
    const source = readFileSync(file, 'utf8');
    for (const match of source.matchAll(IMPORT_RE)) {
      const names = clauseSpecifiers(match[1]);
      if (names) record(match[2], names, file);
    }
    for (const match of source.matchAll(EXPORT_RE)) {
      const names = clauseSpecifiers(match[1]);
      if (names) record(match[2], names, file);
    }
  }

  return found;
};

/** The runtime exports of a package, or null when it cannot be imported under Node. */
const runtimeExports = async (spec) => {
  try {
    const mod = await import(spec);
    return new Set(Object.keys(mod));
  } catch {
    return null;
  }
};

const namedImports = collectNamedImports();
const phantoms = [];
const unverifiable = [];

for (const [spec, bag] of [...namedImports].sort()) {
  const exports = await runtimeExports(spec);

  if (!exports) {
    unverifiable.push(spec);
    continue;
  }

  for (const [name, files] of bag) {
    if (!exports.has(name)) {
      phantoms.push({ spec, name, files: [...files].sort() });
    }
  }
}

const rel = (file) => relative(PKG_DIR, file);

if (phantoms.length) {
  console.error(`✗ ${phantoms.length} phantom named import(s) — these throw at runtime:\n`);
  for (const { spec, name, files } of phantoms) {
    console.error(`  '${name}' is not exported by '${spec}'`);
    for (const file of files) console.error(`      ${rel(file)}`);
    console.error('');
  }
  console.error('A type shim that declares a name the package does not export is the usual');
  console.error('cause — the shim makes the import type-check while the real module throws.');
}

if (unverifiable.length) {
  // These are packages that cannot be imported outside a browser/test
  // context. Their named imports are NOT checked — the coverage gap is
  // reported rather than hidden.
  console.warn(`! not checked (not importable under Node): ${unverifiable.join(', ')}\n`);
}

const checked = namedImports.size - unverifiable.length;
console.log(
  `checked ${namedImports.size} package(s) (${checked} verified, ${unverifiable.length} unverifiable) · ${phantoms.length} phantom named import(s)`,
);

process.exit(phantoms.length ? 1 : 0);
