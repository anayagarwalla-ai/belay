import { randomUUID } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { TUNING } from '../tuning';
import { manifest, rootSettings } from './local-load-model';
import { runLocalLoad } from './local-load-run';

// Exactly one real six-body room, explicitly requested profiling fixture. Root guards remain intact.
const plan = manifest('test-fixture', 'phase2', { ...rootSettings(), smokeRooms: 1, generatorProcesses: 1,
  smokeSeconds: TUNING.phase2Evidence.replaySeconds });
plan.rooms[0].scene = 'crossing'; plan.rooms[0].playerCount = TUNING.hardCap;
plan.expectedClients = TUNING.hardCap; plan.expectedScheduled = plan.expectedClients * plan.framesPerClient;
const directory = path.resolve('reports', `local-load-one-room-${randomUUID()}`);
const hostFreeBytes = os.freemem();
if (hostFreeBytes < plan.settings.minimumFreeMemoryBytes) {
  await mkdir(directory);
  const receipt = { status: 'NOT RUN', reason: 'Original root host-free-memory guard fails before launch', hostFreeBytes,
    requiredFreeBytes: plan.settings.minimumFreeMemoryBytes, fixture: plan, generatedAt: new Date().toISOString(),
    authorityStarted: false, socketsCreated: 0, retries: 0, scope: 'One guarded single-room attempt; no default-profile retry or capacity claim.' };
  await writeFile(path.join(directory, 'preflight.json'), JSON.stringify(receipt, null, 2));
  await writeFile(path.join(directory, 'result.md'), `# One-room socket profiling attempt\n\nNOT RUN: raw host free memory ${hostFreeBytes} bytes is below the unchanged ${plan.settings.minimumFreeMemoryBytes}-byte guard. No authority or clients were launched. The frozen one-room/six-body profile is in preflight.json. No retry or socket performance result is claimed.\n`);
  console.log(JSON.stringify({ directory, ...receipt }));
} else {
  const { result } = await runLocalLoad(plan, directory);
  console.log(JSON.stringify({ directory, status: result.status, failure: result.failure, metrics: result.metrics }));
}
