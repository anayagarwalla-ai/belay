import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { dirname, extname, join, relative, resolve } from 'node:path';
import ts from 'typescript';
import { Scanner } from '@tailwindcss/oxide';

// Source extraction only: no CSS compilation, bundler, browser or project-wide content scan.
const root = resolve(process.argv[2] ?? '.');
const cssPath = join(root, 'app/globals.css'), css = readFileSync(cssPath, 'utf8');
assert.match(css, /@import\s+['"]tailwindcss['"]\s+source\(none\)\s*;/);
assert.match(css, /@import\s+['"]shadcn\/tailwind\.css['"]\s*;/);
const patterns = [...css.matchAll(/@source\s+['"]([^'"]+)['"]\s*;/g)].map(match => match[1]);
assert(patterns.length > 0);
const scanner = new Scanner({ sources: patterns.map(pattern => ({ base: dirname(cssPath), pattern, negated: false })) });
const selectedCandidates = new Set(scanner.scan()), selectedFiles = new Set(scanner.files.map(path => resolve(path)));
assert([...selectedFiles].every(path => !/(?:^|\/)(?:tests|reports|docs|work|node_modules)(?:\/|$)/.test(relative(root, path))));

const seen = new Set<string>(), producers: { path: string; sha256: string; candidates: number; missing: string[] }[] = [];
const graph: { path: string; imports: string[] }[] = [];
function visit(path: string) {
  if (seen.has(path) || !/\.tsx?$/.test(path)) return; seen.add(path);
  const content = readFileSync(path, 'utf8'), imports: string[] = [];
  const tree = ts.createSourceFile(path, content, ts.ScriptTarget.Latest, true, extname(path) === '.tsx' ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
  const dependency = (specifier: string) => {
    imports.push(specifier);
    const base = specifier.startsWith('.') ? resolve(dirname(path), specifier) : specifier.startsWith('@/') ? join(root, specifier.slice(2)) : null;
    if (!base) return;
    const target = [base, `${base}.ts`, `${base}.tsx`, join(base, 'index.ts'), join(base, 'index.tsx')].find(file => existsSync(file) && statSync(file).isFile());
    assert(target, `Unresolved local import: ${path} → ${specifier}`); visit(target);
  };
  const walk = (node: ts.Node) => {
    if (ts.isImportDeclaration(node) && ts.isStringLiteral(node.moduleSpecifier)) {
      const clause = node.importClause, names = clause?.namedBindings;
      const typesOnly = clause?.phaseModifier === ts.SyntaxKind.TypeKeyword || !clause?.name && names && ts.isNamedImports(names) && names.elements.length > 0 && names.elements.every(element => element.isTypeOnly);
      if (!typesOnly) dependency(node.moduleSpecifier.text);
    } else if (ts.isExportDeclaration(node) && !node.isTypeOnly && node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier)) {
      if (!node.exportClause || !ts.isNamedExports(node.exportClause) || node.exportClause.elements.some(element => !element.isTypeOnly)) dependency(node.moduleSpecifier.text);
    } else if (ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword && ts.isStringLiteral(node.arguments[0])) dependency(node.arguments[0].text);
    ts.forEachChild(node, walk);
  };
  walk(tree); graph.push({ path: relative(root, path), imports });
  // These cover the current JSX/CVA/cn and imperative viewport class producers. Full files retain all finite variants.
  if (/\bclassName\b|\bclassList\b|\b(?:cva|cn|clsx)\s*\(|\bsetAttribute\s*\(\s*['"]class['"]/.test(content)) {
    assert(selectedFiles.has(path), `Runtime class producer missing from @source: ${relative(root, path)}`);
    const candidates = new Scanner({}).scanFiles([{ content, extension: extname(path).slice(1) }]);
    const missing = candidates.filter(candidate => !selectedCandidates.has(candidate));
    assert.deepEqual(missing, [], `Runtime candidates omitted from @source: ${relative(root, path)}`);
    producers.push({ path: relative(root, path), sha256: createHash('sha256').update(content).digest('hex'), candidates: candidates.length, missing });
  }
}
visit(join(root, 'app/page.tsx')); visit(join(root, 'app/layout.tsx'));
console.log(JSON.stringify({ sourceRoot: root, patterns, selectedFiles: [...selectedFiles].map(path => relative(root, path)).sort(),
  selectedCandidates: selectedCandidates.size, runtimeGraph: graph.sort((a, b) => a.path.localeCompare(b.path)),
  classProducers: producers.sort((a, b) => a.path.localeCompare(b.path)),
  scope: 'Native candidate extraction covers every current runtime class producer reachable from page/layout, including full Button variants and imperative viewport labels. CSS imports, custom rules and appearance were not compiled or visually verified. This is not whole-program proof for future dynamic class construction.' }, null, 2));
