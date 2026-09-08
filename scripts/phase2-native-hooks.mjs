import { registerHooks } from 'node:module';
import { extname } from 'node:path';

// Native Node type stripping executes inside the measured Node process. The
// frozen resolver supplies only the extension omitted by existing TS imports;
// no TSX loader, esbuild service, watcher or external compiler is started.
registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier.startsWith('.') && !extname(specifier)) return nextResolve(`${specifier}.ts`, context);
    return nextResolve(specifier, context);
  },
});

export function assertNativeProcess() {
  if (process.env.NODE_OPTIONS || process.env.NODE_PATH || process.execArgv.some(arg => !/^--max-old-space-size=\d+$/.test(arg))) {
    throw new Error('Native offline runner refuses custom Node preloads, loaders or module-path overrides.');
  }
}
