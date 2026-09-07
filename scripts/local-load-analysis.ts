import { decodeFloat64, distribution, outcomes, type LoadManifest } from './local-load-model';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { GeneratorResult } from './local-load-generator';

export function auditGenerators(manifest: LoadManifest, generators: GeneratorResult[]) {
  const counts = Object.fromEntries(Object.keys(outcomes).map(key => [key, 0]));
  const lateness: number[] = [], offeredLateness: number[] = [];
  const offeredByRoom: Record<string, number> = {};
  const problems: string[] = []; let observedAcknowledged = 0;
  const seenGenerators = new Set<number>();
  for (const generator of generators) {
    if (seenGenerators.has(generator.generator)) problems.push('Duplicate generator result');
    seenGenerators.add(generator.generator);
    const statuses = Buffer.from(generator.raw.statuses, 'base64'), ack = Buffer.from(generator.raw.exactAck, 'base64');
    const late = decodeFloat64(generator.raw.float64);
    const expected = generator.clients.length * manifest.framesPerClient;
    if (statuses.length !== expected || ack.length !== expected || late.length !== expected || generator.scheduled !== expected) problems.push(`Generator ${generator.generator}: raw plane length differs from fixed manifest`);
    const localCounts = Object.fromEntries(Object.keys(outcomes).map(key => [key, 0]));
    for (let index = 0; index < statuses.length; index++) {
      const outcome = Object.entries(outcomes).find(([, code]) => code === statuses[index])?.[0];
      if (!outcome) { problems.push('Unknown outcome byte'); continue; }
      counts[outcome]++; localCounts[outcome]++;
      if (Number.isFinite(late[index])) lateness.push(late[index]);
      if (statuses[index] !== outcomes.pending && !Number.isFinite(late[index])) problems.push('Processed schedule slot has no lateness observation');
      if (statuses[index] === outcomes.offered) {
        offeredLateness.push(late[index]);
        const room = generator.clients[Math.floor(index / manifest.framesPerClient)]?.roomId;
        if (room) offeredByRoom[room] = (offeredByRoom[room] ?? 0) + 1;
      }
      if (ack[index]) {
        observedAcknowledged++;
        if (ack[index] !== 1 || statuses[index] !== outcomes.offered) problems.push('Acknowledgement does not refer to an offered input');
      }
    }
    for (const key of Object.keys(outcomes)) if (localCounts[key] !== generator.counts[key]) problems.push(`Generator ${generator.generator}: ${key} counter/raw mismatch`);
    problems.push(...generator.errors);
  }
  const observedSlots = Object.values(counts).reduce((sum, n) => sum + n, 0);
  if (observedSlots !== manifest.expectedScheduled) problems.push('Total schedule population differs from frozen manifest');
  if (seenGenerators.size !== manifest.generators) problems.push('Missing generator results');
  if (counts.pending) problems.push('Unprocessed scheduled slots remain');
  return { expectedScheduled: manifest.expectedScheduled, observedSlots, counts, observedAcknowledged,
    offeredByRoom, latenessMs: distribution(lateness), offeredLatenessMs: distribution(offeredLateness),
    problems: [...new Set(problems)], percentileDefinition: 'Nearest rank ceil(n*p)-1 over full decoded observation planes; no averaging of generator percentiles.',
    acknowledgementScope: 'Exact seq values observed in snapshots form a lower bound on accepted input count. Use the separate server acceptedInputs delta for the exact total.' };
}

export type AuthorityInspection = {
  atMonoMs: number; worldCount: number; connected: number; totalBufferedBytes: number; maximumBufferedBytes: number;
  rooms: { roomId: string; tick: number; epoch: number; scene: string; seed: number; playerCount: number; connected: number;
    acceptedInputs: number | null; rejectedInputs: unknown; droppedWallMs: unknown; skippedTickSlots: unknown; snapshotDeliveries: unknown; skippedSnapshots: unknown;
    counters?: Record<string, unknown> }[];
};
export function acceptanceAudit(before: AuthorityInspection, after: AuthorityInspection, offeredByRoom: Record<string, number>) {
  return after.rooms.map(room => {
    const start = before.rooms.find(candidate => candidate.roomId === room.roomId);
    const accepted = typeof room.acceptedInputs === 'number' && typeof start?.acceptedInputs === 'number' ? room.acceptedInputs - start.acceptedInputs : null;
    return { roomId: room.roomId, offered: offeredByRoom[room.roomId] ?? 0, accepted,
      offeredMinusAccepted: accepted === null ? null : (offeredByRoom[room.roomId] ?? 0) - accepted,
      status: accepted === null ? 'NOT RUN' : accepted === (offeredByRoom[room.roomId] ?? 0) ? 'PASS' : 'FAIL' };
  });
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (process.argv.length !== 3) throw new Error('Usage: npx tsx scripts/local-load-analysis.ts /absolute/path/to/local-load-report');
  const folder = path.resolve(process.argv[2]);
  const frozen = JSON.parse(await readFile(path.join(folder, 'manifest.json'), 'utf8')) as { manifest: LoadManifest };
  const saved = JSON.parse(await readFile(path.join(folder, 'result.json'), 'utf8')) as { generators: GeneratorResult[]; before?: AuthorityInspection; after?: AuthorityInspection };
  const audit = auditGenerators(frozen.manifest, saved.generators);
  const acceptance = saved.before && saved.after ? acceptanceAudit(saved.before, saved.after, audit.offeredByRoom) : [];
  console.log(JSON.stringify({ audit, acceptance }, null, 2));
  if (audit.problems.length || acceptance.some(room => room.status !== 'PASS')) process.exitCode = 1;
}
