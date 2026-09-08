import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { dirname, extname, join, relative, resolve } from 'node:path';
import { brotliCompressSync, constants, gzipSync } from 'node:zlib';
import { init, parse } from 'es-module-lexer';
import ts from 'typescript';

// Offline only: existing output is read, never rebuilt or served. Compression runs one asset at a time.
const sourceRoot = resolve(process.argv[2] ?? '.');
const output = process.argv[3] ?? 'reports/phase2-frontend-budget.json';
if (existsSync(output)) throw new Error(`Refusing to overwrite an existing report: ${output}`);
const buildRoot = join(sourceRoot, 'dist'), clientRoot = join(buildRoot, 'client');
const hash = (data: Buffer | string) => createHash('sha256').update(data).digest('hex');
const gitHead = () => execFileSync('git', ['-C', sourceRoot, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
const headAtStart = gitHead();
const files = (directory: string): string[] => readdirSync(directory, { withFileTypes: true }).flatMap(entry =>
  entry.isDirectory() ? files(join(directory, entry.name)) : [join(directory, entry.name)]);
type Sizes = { rawBytes: number; gzip6Bytes: number; brotli5Bytes: number };
const add = (items: Sizes[]) => items.reduce((sum, item) => ({ rawBytes: sum.rawBytes + item.rawBytes,
  gzip6Bytes: sum.gzip6Bytes + item.gzip6Bytes, brotli5Bytes: sum.brotli5Bytes + item.brotli5Bytes }), { rawBytes: 0, gzip6Bytes: 0, brotli5Bytes: 0 });
const kind = (path: string) => /\.m?js$/.test(path) ? 'js' : path.endsWith('.css') ? 'css' : path.endsWith('.wasm') ? 'wasm'
  : /\.(woff2?|ttf|otf)$/.test(path) ? 'font' : /\.(svg|png|jpe?g|webp|avif|gif)$/.test(path) ? 'image' : 'metadata';
await init;
const assets = files(clientRoot).sort().map(path => {
  const bytes = readFileSync(path), text = bytes.toString(), type = kind(path);
  const imports = type === 'js' ? parse(text)[0].filter(item => item.d !== -2).map(item => ({ specifier: item.n ?? null,
    dynamic: item.d >= 0, resolvedPath: item.n?.startsWith('.') ? relative(clientRoot, resolve(dirname(path), item.n)) : null })) : [];
  return { path: relative(clientRoot, path), kind: type, modifiedAt: statSync(path).mtime.toISOString(), sha256: hash(bytes),
    rawBytes: bytes.length, gzip6Bytes: gzipSync(bytes, { level: 6 }).length,
    brotli5Bytes: brotliCompressSync(bytes, { params: { [constants.BROTLI_PARAM_QUALITY]: 5 } }).length,
    imports, cssUrls: type === 'css' ? [...text.matchAll(/url\(([^)]*)\)/g)].map(match => match[1]) : [],
    cssFontFaces: type === 'css' ? (text.match(/@font-face/g) ?? []).length : 0 };
});
const manifestPath = join(buildRoot, 'server/__vite_rsc_assets_manifest.js'), manifestText = readFileSync(manifestPath, 'utf8');
type Dependencies = { js: string[]; css: string[] };
const manifest = JSON.parse(manifestText.replace(/^export default\s*/, '').replace(/;\s*$/, '')) as {
  clientEntryUrl: string; clientEntryDeps: Dependencies; clientReferenceDeps: Record<string, Dependencies>;
  serverResources: Record<string, Dependencies> };
const routePaths = new Set([...manifest.clientEntryDeps.js, ...manifest.clientEntryDeps.css,
  ...Object.values(manifest.clientReferenceDeps).flatMap(value => [...value.js, ...value.css]),
  ...Object.values(manifest.serverResources).flatMap(value => [...value.js, ...value.css])].map(path => path.replace(/^\//, '')));
const missing = [...routePaths].filter(path => !assets.some(asset => asset.path === path));
if (missing.length) throw new Error(`Manifest references missing files: ${missing.join(', ')}`);
const routeAssets = assets.filter(asset => routePaths.has(asset.path));
const transfers = add(routeAssets), totalsByKind = Object.fromEntries(['js', 'css', 'wasm', 'font', 'image', 'metadata'].map(type =>
  [type, { files: assets.filter(asset => asset.kind === type).length, ...add(assets.filter(asset => asset.kind === type)) }]));

type Edge = { specifier: string; dynamic: boolean; localPath: string | null };
type Source = { path: string; sha256: string; imports: Edge[] };
const graph: Source[] = [], seen = new Set<string>();
function visit(path: string) {
  if (seen.has(path)) return; seen.add(path);
  const content = readFileSync(path, 'utf8'), imports: Edge[] = [];
  if (/\.tsx?$/.test(path)) {
    const tree = ts.createSourceFile(path, content, ts.ScriptTarget.Latest, true, extname(path) === '.tsx' ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
    const capture = (specifier: string, dynamic: boolean) => {
      const base = specifier.startsWith('.') ? resolve(dirname(path), specifier) : specifier.startsWith('@/') ? join(sourceRoot, specifier.slice(2)) : null;
      const target = base ? [base, `${base}.ts`, `${base}.tsx`, join(base, 'index.ts'), join(base, 'index.tsx')].find(candidate => existsSync(candidate) && statSync(candidate).isFile()) : null;
      if (base && !target) throw new Error(`Unresolved local source: ${path} → ${specifier}`);
      imports.push({ specifier, dynamic, localPath: target ? relative(sourceRoot, target) : null });
      if (target) visit(target);
    };
    const walk = (node: ts.Node) => {
      if (ts.isImportDeclaration(node) && ts.isStringLiteral(node.moduleSpecifier)) {
        const clause = node.importClause, names = clause?.namedBindings;
        const typesOnly = clause?.phaseModifier === ts.SyntaxKind.TypeKeyword || !clause?.name && names && ts.isNamedImports(names) && names.elements.length > 0 && names.elements.every(element => element.isTypeOnly);
        if (!typesOnly) capture(node.moduleSpecifier.text, false);
      } else if (ts.isExportDeclaration(node) && !node.isTypeOnly && node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier)) {
        if (!node.exportClause || !ts.isNamedExports(node.exportClause) || node.exportClause.elements.some(element => !element.isTypeOnly)) capture(node.moduleSpecifier.text, false);
      } else if (ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword && ts.isStringLiteral(node.arguments[0])) capture(node.arguments[0].text, true);
      ts.forEachChild(node, walk);
    };
    walk(tree);
  }
  graph.push({ path: relative(sourceRoot, path), sha256: hash(content), imports });
}
visit(join(sourceRoot, 'app/page.tsx')); visit(join(sourceRoot, 'app/layout.tsx'));
const bandwidthMbps = [0.5, 1, 2, 5, 10, 25]; // Declared sensitivity assumptions, not measured links.
const report = { generatedAt: new Date().toISOString(), sourceRoot, sourceHeadAtStart: headAtStart, sourceHeadAtEnd: gitHead(),
  buildSourceCommit: null, buildProvenance: 'Existing output only. Asset mtimes/hashes and current source hashes are recorded separately; current HEAD is not asserted to have produced these files.',
  buildId: readFileSync(join(buildRoot, 'server/BUILD_ID'), 'utf8').trim(),
  manifest: { path: relative(sourceRoot, manifestPath), sha256: hash(manifestText) },
  compression: { runtime: process.version, zlib: process.versions.zlib, brotli: process.versions.brotli,
    scope: 'Per-file local gzip level 6 and Brotli quality 5 byte estimates. Actual HTTP content encoding, headers/framing and response timings were not measured.' },
  assets, totalsByKind, route: { selection: 'Union of emitted bootstrap, client-reference and server-resource dependencies for the single root-route application; layout context may be conditional. Distinct URLs counted once. Ancillary favicon and compatibility manifests excluded.',
    paths: routeAssets.map(asset => asset.path), ...transfers },
  sourceGraph: graph.sort((a, b) => a.path.localeCompare(b.path)),
  transferSeconds: bandwidthMbps.map(mbps => ({ mbps, raw: transfers.rawBytes * 8 / (mbps * 1e6), gzip6: transfers.gzip6Bytes * 8 / (mbps * 1e6), brotli5: transfers.brotli5Bytes * 8 / (mbps * 1e6) })),
  minimumMbps: [3, 10].flatMap(goalSeconds => [0, 1, 2].map(reservedSeconds => ({ goalSeconds, reservedSeconds,
    raw: transfers.rawBytes * 8 / ((goalSeconds - reservedSeconds) * 1e6), gzip6: transfers.gzip6Bytes * 8 / ((goalSeconds - reservedSeconds) * 1e6), brotli5: transfers.brotli5Bytes * 8 / ((goalSeconds - reservedSeconds) * 1e6) }))),
  formula: 'transferSeconds = 8 × compressed-or-raw route bytes / (1,000,000 × sustained Mbps). Threshold = payload bits / (goal seconds − assumed reserved seconds). Assumes ideal shared throughput; excludes HTML/RSC, requests/handshakes, access/login, user actions, parse/execute/style, GPU and authoritative control response. Compression does not reduce uncompressed parse bytes.',
  verdict: '3-second load and 10-second entry are UNMEASURED. No browser, dev server, network fetch or new build was used.' };
if (report.sourceHeadAtStart !== report.sourceHeadAtEnd) throw new Error('Source HEAD changed during the audit; retry against a stable source snapshot.');
mkdirSync(dirname(output), { recursive: true }); writeFileSync(output, JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify({ output, buildId: report.buildId, totalsByKind, route: report.route, transferSeconds: report.transferSeconds, minimumMbps: report.minimumMbps, verdict: report.verdict }, null, 2));
