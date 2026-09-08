import { assertNativeProcess } from './phase2-native-hooks.mjs';
assertNativeProcess();
const { checkBridgeLoadObserver } = await import('./phase2-bridge-load-check.ts');
await checkBridgeLoadObserver();
