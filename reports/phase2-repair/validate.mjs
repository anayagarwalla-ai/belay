import { readFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
import { validateFinalMatrix } from '../../scripts/phase2-independent-final-validate.mjs';
// Pins were recorded before the campaign, separately from its output directory.
assert(process.execArgv.includes('--max-old-space-size=256'), 'Use --max-old-space-size=256');
assert([3, 4].includes(process.argv.length), 'Usage: node --max-old-space-size=256 reports/phase2-repair/validate.mjs FINAL_DIRECTORY [PRE_LAUNCH_PINS]');
const pins = JSON.parse(await readFile(process.argv[3] ?? new URL('./launch-pins.json', import.meta.url), 'utf8'));
try { console.log(JSON.stringify(await validateFinalMatrix(process.argv[2], null, pins), null, 2)); }
catch(error) { console.log(JSON.stringify({validationStatus:'REFUSED',complete:false,reason:error.message}));process.exitCode=1; }
