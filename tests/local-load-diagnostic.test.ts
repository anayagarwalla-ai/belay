import { cp, mkdtemp, readFile, readdir, rm, stat } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import os from 'node:os';
import path from 'node:path';
import net from 'node:net';
import { afterAll, describe, expect, it } from 'vitest';
import { manifest, rootSettings, decodeFloat64, distribution } from '../scripts/local-load-model';
import { auditGenerators } from '../scripts/local-load-analysis';
import { runLocalLoad } from '../scripts/local-load-run';
import { LocalChild } from '../scripts/local-load-supervisor';

// Named fixture overrides, not production defaults. All normal runs resolve root tuning.
const SOCKET_FIXTURE = { ...rootSettings(), smokeRooms: 2, smokeSeconds: 2, generatorProcesses: 2,
  warmupMs: 100, startLeadMs: 100, sampleMs: 100, lifecycleCycles: 2, lifecycleRooms: 1, lifecycleHoldMs: 25,
  startupTimeoutMs: 10000, maximumWallMs: 30000, shutdownGraceMs: 1000,
  minimumFreeMemoryBytes: 1 }; // Functional/supervision fixture only; root smoke retains its real host safety guard.
const temporary: string[] = [];
afterAll(async () => { await Promise.all(temporary.map(directory => rm(directory, { recursive: true, force: true }))); });
async function directory() { const root = await mkdtemp(path.join(os.tmpdir(), 'belay-local-load-test-')); temporary.push(root); return path.join(root, 'run'); }
function checkFunctionalAcceptance(result: Awaited<ReturnType<typeof runLocalLoad>>['result']) {
  for (const row of result.acceptance) {
    // terminate() can discard an already offered, unacknowledged frame. The
    // exact benchmark audit must still report FAIL for that deficit; this
    // transport fault fixture instead checks the recorded uncertainty bound.
    const atRisk = result.generators.flatMap(generator => generator.faults)
      .filter(fault => fault.kind === 'disconnect-fresh-join' && fault.roomId === row.roomId)
      .reduce((sum, fault) => sum + (fault.unacknowledgedOfferedSequences as number[]).length, 0);
    expect(row.accepted, JSON.stringify(row)).not.toBeNull();
    expect(row.offeredMinusAccepted, JSON.stringify(row)).toBeGreaterThanOrEqual(0);
    expect(row.offeredMinusAccepted, JSON.stringify({ row, atRisk })).toBeLessThanOrEqual(atRisk);
    expect(row.status).toBe(row.offeredMinusAccepted === 0 ? 'PASS' : 'FAIL');
  }
}

describe('bounded real-socket local load diagnostic', () => {
  it('freezes the profile and refuses unbounded or legacy 300-room runs', () => {
    const plan = manifest('test-fixture', 'legacy', SOCKET_FIXTURE);
    expect(plan.expectedScheduled).toBe(plan.expectedClients * plan.framesPerClient);
    expect(manifest('test-fixture', 'legacy', SOCKET_FIXTURE)).toEqual(plan);
    expect(() => manifest('300', 'legacy', SOCKET_FIXTURE)).toThrow('six-body');
    expect(() => manifest('smoke', 'phase2', { ...SOCKET_FIXTURE, smokeRooms: SOCKET_FIXTURE.maximumRooms + 1 })).toThrow('bounds');
    expect(() => manifest('smoke', 'legacy', { ...SOCKET_FIXTURE, maximumReportBytes: 1 })).toThrow('byte cap');
    expect(distribution([1, 9, 3, 7]).p50).toBe(3);
    expect(() => decodeFloat64('AQ==')).toThrow('length');
  });
  it('runs actual authority/client processes, reconciles raw offers and acceptance, then disposes every room', async () => {
    const output = await directory(), plan = manifest('test-fixture', 'legacy', SOCKET_FIXTURE);
    const { result } = await runLocalLoad(plan, output);
    expect(result.failure).toBeNull(); expect(result.status).toBe('COMPLETE');
    expect(result.audit.problems).toEqual([]);
    expect(result.audit.observedSlots).toBe(plan.expectedScheduled);
    expect(result.audit.counts.offered).toBeGreaterThan(0);
    expect(result.acceptance).toHaveLength(plan.rooms.length);
    checkFunctionalAcceptance(result);
    expect(result.functional).toHaveLength(4);
    expect(result.finalEmpty?.worldCount).toBe(0);
    expect(result.generators.flatMap(generator => generator.faults).some(fault => fault.kind === 'real-socket-read-pause' && fault.healthyAdvanced)).toBe(true);
    expect(result.generators.flatMap(generator => generator.faults).some(fault => fault.kind === 'disconnect-fresh-join' && fault.newSession)).toBe(true);
    expect(result.reconnect.successFraction).toBeNull();
    expect(result.teardown.ownedChildren.every(child => child.code === 0)).toBe(true);
    expect(new Set(result.teardown.ownedChildren.map(child => child.pid)).size).toBe(plan.generators + 1);
    expect(result.samples.some(sample => sample.stage === 'fixed-input-window')).toBe(true);
    const persisted = await readFile(path.join(output, 'result.json'), 'utf8');
    expect(persisted).not.toContain('operatorToken'); expect(persisted).not.toContain('testerToken'); expect(persisted).not.toContain('BELAY_SESSION_SECRET');
    if (process.env.BELAY_LOCAL_LOAD_SAVE_FIXTURE === '1') await cp(output, path.resolve('reports', `local-load-functional-fixture-${randomUUID()}`), { recursive: true, errorOnExist: true, force: false });
    const corrupted = structuredClone(result.generators); corrupted[0].counts.offered++;
    expect(auditGenerators(plan, corrupted).problems.some(problem => problem.includes('counter/raw mismatch'))).toBe(true);
  });
  it('cleans up only its own processes after a resource abort and preserves incomplete evidence', async () => {
    const settings = { ...SOCKET_FIXTURE, maximumTotalRssBytes: 1 };
    const unrelated = net.createServer(); await new Promise<void>(resolve => unrelated.listen(0, '127.0.0.1', resolve));
    try {
      const { result } = await runLocalLoad(manifest('test-fixture', 'legacy', settings), await directory());
      expect(result.status).toBe('INCOMPLETE'); expect(result.failure).toContain('RSS cap');
      expect(result.teardown.ownedChildren).toHaveLength(settings.generatorProcesses + 1);
      expect(unrelated.listening).toBe(true);
    } finally { await new Promise<void>((resolve, reject) => unrelated.close(error => error ? reject(error) : resolve())); }
  });
  it('authority exits on parent IPC loss and releases its ephemeral listening socket', async () => {
    const child = new LocalChild('authority', SOCKET_FIXTURE);
    try {
      const initialized = await child.request<{ endpoint: string }>('initialize', SOCKET_FIXTURE);
      const port = Number(new URL(initialized.endpoint).port);
      child.child.disconnect();
      await child.exit;
      const canBind = net.createServer();
      await new Promise<void>((resolve, reject) => { canBind.once('error', reject); canBind.listen(port, '127.0.0.1', resolve); });
      await new Promise<void>((resolve, reject) => canBind.close(error => error ? reject(error) : resolve()));
    } finally { await child.stop(); }
  });
  it('preserves an invalid receipt and teardown within the artifact cap when raw windows cannot fit', async () => {
    const ARTIFACT_CAP_FIXTURE = { ...SOCKET_FIXTURE, maximumReportBytes: 40000 };
    const output = await directory();
    const { result } = await runLocalLoad(manifest('test-fixture', 'legacy', ARTIFACT_CAP_FIXTURE), output);
    expect(result.status).toBe('INCOMPLETE'); expect(result.failure).toContain('Evidence byte cap');
    const receipt = JSON.parse(await readFile(path.join(output, 'result.json'), 'utf8')) as { omittedSampleWindows: number; teardown: { ownedChildren: unknown[] } };
    expect(receipt.omittedSampleWindows).toBeGreaterThan(0); expect(receipt.teardown.ownedChildren).toHaveLength(3);
    const sizes = await Promise.all((await readdir(output)).map(async file => (await stat(path.join(output, file))).size));
    expect(sizes.reduce((sum, size) => sum + size, 0)).toBeLessThanOrEqual(ARTIFACT_CAP_FIXTURE.maximumReportBytes);
  });
  it('uses integrated Phase 2 scenes with every actual body/seat count from two through six', async () => {
    const PHASE2_SOCKET_FIXTURE = { ...SOCKET_FIXTURE, smokeRooms: 5 };
    const output = await directory(), plan = manifest('test-fixture', 'phase2', PHASE2_SOCKET_FIXTURE);
    const { result } = await runLocalLoad(plan, output);
    expect(result.failure).toBeNull(); expect(result.audit.problems).toEqual([]);
    expect(result.before?.rooms.map(room => room.playerCount).sort()).toEqual([2, 3, 4, 5, 6]);
    expect(new Set(result.before?.rooms.map(room => room.scene))).toEqual(new Set(['flat', 'crossing', 'rescue']));
    expect(result.before?.connected).toBe(20);
    checkFunctionalAcceptance(result);
    expect(result.finalEmpty?.worldCount).toBe(0);
    expect(result.teardown.ownedChildren.every(child => child.code === 0)).toBe(true);
    if (process.env.BELAY_LOCAL_LOAD_SAVE_FIXTURE === '1') await cp(output, path.resolve('reports', `local-load-phase2-fixture-${randomUUID()}`), { recursive: true, errorOnExist: true, force: false });
  });
});
