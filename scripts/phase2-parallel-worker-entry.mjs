import { assertNativeProcess } from './phase2-native-hooks.mjs';
assertNativeProcess();
await import('./phase2-parallel-worker.ts');
