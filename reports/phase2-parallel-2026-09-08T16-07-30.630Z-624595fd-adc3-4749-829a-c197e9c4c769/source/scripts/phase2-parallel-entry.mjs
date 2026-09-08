import { assertNativeProcess } from './phase2-native-hooks.mjs';
assertNativeProcess();
const { parallelMain } = await import('./phase2-parallel.ts');
await parallelMain();
