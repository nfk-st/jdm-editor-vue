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
import { readFileSync } from 'node:fs';
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

const loaded = await import(pathToFileURL(ENTRY).href);
console.log(
  `✓ dist/index.js loads under Node — ${Object.keys(loaded).length} exports, ${bare.length} external import(s)`,
);
