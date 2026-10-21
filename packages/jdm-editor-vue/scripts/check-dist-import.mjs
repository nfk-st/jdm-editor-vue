// Guard: the PUBLISHED bundle must load.
//
// PORTING.md's contract: "The published bundle imports cleanly under Node —
// `pnpm build` then `node --input-type=module -e "import('./dist/index.js')"`
// is the check."
//
// This is the check the gates missed. The build externalises the library's
// dependencies, and an externalised specifier that a consumer's resolver
// cannot resolve (a subpath of a package without an `exports` map — Node
// needs the file extension) leaves a bundle that throws on import. Every
// gate stayed green while the package could not be loaded at all.
//
// Run: `pnpm --filter @nfk.st/jdm-editor-vue check:dist`
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const PKG_DIR = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const ENTRY = join(PKG_DIR, 'dist', 'index.js');

let source;
try {
  source = readFileSync(ENTRY, 'utf8');
} catch {
  console.error('✗ dist/index.js is missing — run `pnpm build` first.');
  process.exit(1);
}

// The bare specifiers the bundle imports. A relative path is part of the
// package; a bare one must be resolvable by the consumer.
// The bundle's import statements each start a line (rollup emits them at
// the top, one per line). The anchor matters: a story fixture's function
// SOURCE contains `import zen from 'zen'` inside a string, and that is not
// an import of the bundle.
const specifiers = new Set();
for (const match of source.matchAll(/^(?:import|export)[^'"]*?from\s*['"]([^'"]+)['"]/gm)) {
  specifiers.add(match[1]);
}
for (const match of source.matchAll(/^import\s*['"]([^'"]+)['"]/gm)) {
  specifiers.add(match[1]);
}

const bare = [...specifiers].filter((id) => !id.startsWith('.') && !id.startsWith('/')).sort();

let failed = false;

for (const id of bare) {
  try {
    await import(id);
  } catch (error) {
    failed = true;
    console.error(`✗ '${id}' is imported by the bundle but cannot be resolved:`);
    console.error(`    ${error?.message?.split('\n')[0] ?? error}`);
  }
}

if (failed) {
  console.error('');
  console.error('The published bundle must load in a consumer. An unresolvable');
  console.error("import means the dependency's specifier was externalised wrongly");
  console.error('(a subpath of a package without an `exports` map needs Node to');
  console.error('resolve it by path — with the file extension).');
  process.exit(1);
}

// ── the bundle must not carry an UNDECLARED dependency ────────────────────
//
// A dependency that is bundled instead of externalised is invisible to the
// import check above (it loads fine) — but it ships without its licence
// notice and without being declared. reka-ui/date is the case in point:
// bundling it pulled @internationalized/date (Apache-2.0) into the
// package.
const MAP = join(PKG_DIR, 'dist', 'index.js.map');

if (existsSync(MAP)) {
  const map = JSON.parse(readFileSync(MAP, 'utf8'));
  const manifest = JSON.parse(readFileSync(join(PKG_DIR, 'package.json'), 'utf8'));
  const declared = new Set([
    ...Object.keys(manifest.dependencies ?? {}),
    ...Object.keys(manifest.peerDependencies ?? {}),
    ...Object.keys(manifest.devDependencies ?? {}),
  ]);

  const bundled = new Set();

  for (const source of map.sources ?? []) {
    // the LAST '/node_modules/' segment is the package itself (pnpm's store
    // path repeats it)
    const parts = source.split('/node_modules/');
    const tail = parts[parts.length - 1];

    if (!tail || tail.startsWith('.')) {
      continue;
    }

    const segments = tail.split('/');
    bundled.add(segments[0].startsWith('@') ? `${segments[0]}/${segments[1]}` : segments[0]);
  }

  const undeclared = [...bundled].filter((name) => !declared.has(name)).sort();

  if (undeclared.length) {
    failed = true;
    console.error('✗ the bundle carries dependencies the manifest does not declare:');
    for (const name of undeclared) {
      console.error(`    ${name}`);
    }
    console.error('');
    console.error('An externalised dependency must be external by NAME — a subpath');
    console.error("is externalised only when the package's `exports` map publishes it.");
  }
}

if (failed) {
  process.exit(1);
}

const loaded = await import(pathToFileURL(ENTRY).href);
console.log(
  `✓ dist/index.js loads under Node — ${Object.keys(loaded).length} exports, ${bare.length} external import(s)`,
);
