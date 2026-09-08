/** Encoder-only audit: actual installed Colyseus/SDK/ws paths, zero sockets.
 * Run: npx tsx scripts/local-load-wire-audit.ts
 * Draft static/dynamic objects are offline size experiments, never production handlers.
 */
import assert from 'node:assert/strict';
import { fork, execFileSync } from 'node:child_process';
import { createHash, randomUUID } from 'node:crypto';
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { serialize } from 'node:v8';
import { setImmediate as yieldTurn } from 'node:timers/promises';
import { TUNING } from '../tuning';
import type { SimulationSnapshot } from '../shared/protocol';

const plan = { players: [2, 4, 6], seed: 2000, family: 'balanced' as const, tickHz: 30 as const, epoch: 1,
  scenes: [{ scene: 'flat' as const, ticks: 0 }, { scene: 'crossing' as const, ticks: 180 }, { scene: 'rescue' as const, ticks: 150 }],
  policy: 'Crossing: every seat walks +z. Rescue: middle seat rests for 60 ticks then walks -z; others hold brace. All declared ticks run, even if terminal.',
  delivery: 'Simulation state is real; synthetic all-connected Climber labels and ackSeq=2*tick mirror BelayRoom seat decoration. No sockets, joins or transport latency measured.' };
const digest = (value: unknown) => createHash('sha256').update(serialize(value)).digest('hex');

function splitSnapshot(snapshot: SimulationSnapshot) {
  const { version, seed, family, tickHz, scene, playerCount, terrain, rope, epoch, ...changing } = snapshot;
  const { bridges, ...fixedTerrain } = terrain;
  const { length, spans, ...changingRope } = rope;
  const fixed = { version, seed, family, tickHz, scene, playerCount,
    terrain: { ...fixedTerrain, bridges: bridges.map(({ cue: _cue, collapsed: _collapsed, ...shape }) => shape) },
    rope: { length, spans: spans.map(({ tension: _tension, tensionN: _tensionN, slackM: _slackM, catchHighlight: _highlight, ...shape }) => shape) } };
  const dynamic = { ...changing, terrain: { bridges: bridges.map(({ id, cue, collapsed }) => ({ id, cue, collapsed })) },
    rope: { ...changingRope, spans: spans.map(({ id, tension, tensionN, slackM, catchHighlight }) => ({ id, tension, tensionN, slackM, catchHighlight })) } };
  return { staticMessage: { wireVersion: 1, epoch, staticRevision: 1, content: fixed },
    dynamicMessage: { wireVersion: 1, epoch, staticRevision: 1, state: dynamic } };
}
type Split = ReturnType<typeof splitSnapshot>;
function reassemble(fixed: Split['staticMessage'], dynamic: Split['dynamicMessage']): SimulationSnapshot {
  assert.equal(fixed.wireVersion, dynamic.wireVersion); assert.equal(fixed.epoch, dynamic.epoch);
  assert.equal(fixed.staticRevision, dynamic.staticRevision);
  const content = fixed.content, state = dynamic.state;
  return { ...content, ...state, epoch: fixed.epoch,
    terrain: { ...content.terrain, bridges: state.terrain.bridges.map(bridge => {
      const shape = content.terrain.bridges.find(item => item.id === bridge.id); assert(shape); return { ...shape, ...bridge };
    }) },
    rope: { ...content.rope, ...state.rope, spans: state.rope.spans.map(span => {
      const shape = content.rope.spans.find(item => item.id === span.id); assert(shape); return { ...shape, ...span };
    }) } };
}

async function childAudit(directory: string) {
  assert(process.send && process.connected, 'Owned IPC parent required');
  process.on('disconnect', () => process.exit(1));
  const [{ BelaySimulation, initializePhysics }, { WebSocketClient }, core, sdk, ws] = await Promise.all([
    import('../shared/simulation'), import('@colyseus/ws-transport/WebSocketClient'), import('@colyseus/core'), import('@colyseus/sdk'), import('ws'),
  ]);
  await initializePhysics();
  class Decoder extends sdk.Room {
    decode(type: string, bytes: Buffer): unknown {
      let result: unknown; let calls = 0;
      const off = this.onMessage(type, value => { result = value; calls++; });
      this.onMessageCallback({ data: bytes } as MessageEvent); off(); assert.equal(calls, 1); return result;
    }
  }
  const decoder = new Decoder('encoder-audit');
  let captured: Buffer | undefined;
  const socketSink = { readyState: ws.WebSocket.OPEN, send(data: Buffer, options: { binary?: boolean }) {
    assert.equal(options.binary, true); assert.equal(captured, undefined); captured = Buffer.from(data);
  } } as unknown as import('ws').WebSocket;
  const client = new WebSocketClient('encoder-only-seat', socketSink); client.state = core.ClientState.JOINED;
  const sender = (ws as unknown as { Sender: { frame(data: Buffer, options: object): Buffer[] } }).Sender;
  const frame = (bytes: Buffer) => sender.frame(bytes,
    { fin: true, opcode: 2, mask: false, rsv1: false, readOnly: true });
  function encode(type: string, message: unknown) {
    captured = undefined; client.send(type, message); assert(captured);
    const bytes: Buffer = captured;
    assert.deepStrictEqual(bytes, core.getMessageBytes.raw(core.Protocol.ROOM_DATA, type, message));
    const headerBytes = core.getMessageBytes.raw(core.Protocol.ROOM_DATA, type).length;
    const chunks = frame(bytes), webSocketBytes = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
    assert.equal(webSocketBytes - bytes.length, bytes.length <= 125 ? 2 : bytes.length < 65536 ? 4 : 10);
    return { decoded: decoder.decode(type, bytes), measurements: { protocolCode: bytes[0], type,
      msgpackPayloadBytes: bytes.length - headerBytes, colyseusHeaderBytes: headerBytes,
      colyseusMessageBytes: bytes.length, webSocketHeaderBytes: webSocketBytes - bytes.length, webSocketFrameBytes: webSocketBytes,
      // This is a declared TLS1.3 example, not an observed TLS session or IP bill.
      tls13ExampleBytes: webSocketBytes + 22 * Math.ceil(webSocketBytes / 16384),
      tls13ExampleAssumptions: 'Independent TLS1.3 records,<=16384 application bytes,16-byte AEAD tag,5-byte header,1-byte inner type,no padding. No handshake/TCP/IP/ACK/retransmissions.',
      colyseusBase64: bytes.toString('base64'), colyseusSha256: createHash('sha256').update(bytes).digest('hex') } };
  }
  // Real ws encoder boundary checks; not a network workload.
  for (const n of [125, 126, 65535, 65536]) {
    assert.equal(frame(Buffer.alloc(n)).reduce((sum, chunk) => sum + chunk.length, 0) - n, n <= 125 ? 2 : n < 65536 ? 4 : 10);
  }
  const rows: unknown[] = [], fixtures: unknown[] = [];
  async function record(name: string, original: SimulationSnapshot, eventCursor: number, semantics: string) {
    const snapshot = structuredClone(original);
    for (const player of snapshot.players) { player.connected = true; player.label = `Climber ${player.id + 1}`; player.ackSeq = 2 * snapshot.tick; }
    snapshot.events = snapshot.events.filter(event => event.id > eventCursor);
    const current = encode('snapshot', snapshot), parts = splitSnapshot(snapshot);
    assert.deepStrictEqual(reassemble(parts.staticMessage, parts.dynamicMessage), snapshot);
    const fixed = encode('snapshotStatic', parts.staticMessage), changing = encode('snapshotDynamic', parts.dynamicMessage);
    const decodedReconstruction = reassemble(fixed.decoded as Split['staticMessage'], changing.decoded as Split['dynamicMessage']);
    assert.deepStrictEqual(decodedReconstruction, current.decoded, `${name} decoded state differs`);
    const savings = current.measurements.colyseusMessageBytes - changing.measurements.colyseusMessageBytes;
    const currentNoEvents = encode('snapshot', { ...snapshot, events: [] });
    const dropTerrain = { ...snapshot, terrain: undefined };
    const dropPoints = { ...snapshot, rope: { ...snapshot.rope, points: undefined } };
    const dropDiagnostics = { ...snapshot, diagnostics: undefined, counters: undefined };
    // Omit fields entirely, not encode undefined; report ablations separately, never sum them.
    delete dropTerrain.terrain; delete dropPoints.rope.points; delete dropDiagnostics.diagnostics; delete dropDiagnostics.counters;
    rows.push({ name, scene: snapshot.scene, playerCount: snapshot.playerCount, tick: snapshot.tick, epoch: snapshot.epoch,
      semantics, eventCursor, eventCount: snapshot.events.length, eventKinds: [...new Set(snapshot.events.map(e => e.kind))],
      run: snapshot.run, snapshot, jsonEstimateBytes: Buffer.byteLength(JSON.stringify(snapshot)),
      current: current.measurements, proposedStatic: fixed.measurements, proposedDynamic: changing.measurements,
      savingsPerSteadyStateMessageBytes: savings, savingsPercent: 100 * savings / current.measurements.colyseusMessageBytes,
      initialStaticPlusDynamicBytes: fixed.measurements.colyseusMessageBytes + changing.measurements.colyseusMessageBytes,
      firstStrictSavingsFrameCountIgnoringAck: savings > 0 ? Math.floor(fixed.measurements.colyseusMessageBytes / savings) + 1 : null,
      noNewEventsBytes: currentNoEvents.measurements.colyseusMessageBytes,
      eventBatchAdditionalBytes: current.measurements.colyseusMessageBytes - currentNoEvents.measurements.colyseusMessageBytes,
      ablationReductionBytes: { terrain: current.measurements.colyseusMessageBytes - encode('snapshot', dropTerrain).measurements.colyseusMessageBytes,
        ropePoints: current.measurements.colyseusMessageBytes - encode('snapshot', dropPoints).measurements.colyseusMessageBytes,
        countersAndDiagnostics: current.measurements.colyseusMessageBytes - encode('snapshot', dropDiagnostics).measurements.colyseusMessageBytes },
      sdkDecodeAndStaticReconstruction: 'PASS', originalSnapshotHash: digest(original) });
    await writeFile(path.join(directory, 'measurements.json'), JSON.stringify({ plan, fixtures, rows }, null, 2));
  }
  for (const playerCount of plan.players) for (const fixture of plan.scenes) {
    const options = { scene: fixture.scene, playerCount, family: plan.family, tickHz: plan.tickHz, seed: plan.seed };
    const sim = new BelaySimulation(options);
    try {
      const initial = sim.snapshot(plan.epoch), initialStatic = splitSnapshot(initial).staticMessage;
      await record(`${fixture.scene}-${playerCount}-initial`, initial, -1, 'Initial state; no physics ticks yet; empty event history.');
      let biggest: { state: SimulationSnapshot; priorCursor: number; count: number } | undefined;
      let previousCursor = initial.events.at(-1)?.id ?? -1;
      for (let tick = 0; tick < fixture.ticks; tick++) {
        const moves = sim.bodies.map((_, seat) => fixture.scene === 'crossing' ? { x: 0, z: 1, brace: false }
          : seat === Math.floor(playerCount / 2) ? { x: 0, z: tick < 60 ? 0 : -1, brace: false } : { x: 0, z: 0, brace: true });
        sim.step(moves, true);
        const state = sim.snapshot(plan.epoch);
        assert.deepStrictEqual(splitSnapshot(state).staticMessage, initialStatic, 'Proposed static fields changed within epoch');
        const count = state.events.filter(event => event.id > previousCursor).length;
        if (count > (biggest?.count ?? 0)) biggest = { state, priorCursor: previousCursor, count };
        previousCursor = state.events.at(-1)?.id ?? previousCursor;
        if ((tick + 1) % plan.tickHz === 0) {
          assert(process.memoryUsage().rss <= TUNING.localLoad.maximumTotalRssBytes, 'Owned RSS cap exceeded'); await yieldTurn();
        }
      }
      const final = sim.snapshot(plan.epoch);
      if (fixture.ticks) {
        await record(`${fixture.scene}-${playerCount}-current-reader`, final, final.events.at(-1)?.id ?? -1, 'Same final physical state; reader already sent all retained events.');
        await record(`${fixture.scene}-${playerCount}-late-reader`, final, -1, 'Same final state; existing reader has received none since epoch start; retained event backlog, not one-tick production frequency.');
        if (biggest) await record(`${fixture.scene}-${playerCount}-largest-step-event-batch`, biggest.state, biggest.priorCursor,
          `First largest actual per-step batch in the fixed horizon (${biggest.count} events); not a worst-case bound.`);
      }
      fixtures.push({ options, ticksExecuted: fixture.ticks, recordedFrames: sim.tape.frames.length, tapeHash: digest(sim.tape),
        finalEventCount: final.events.length, finalEventKinds: [...new Set(final.events.map(event => event.kind))],
        biggestSingleStepEvents: biggest?.count ?? 0, proposedStaticConstantAtEveryTick: true, memory: process.memoryUsage() });
      process.send?.({ scene: fixture.scene, playerCount, ticks: fixture.ticks, events: final.events.length, rows: rows.length });
    } finally { sim.dispose(); await yieldTurn(); }
  }
  decoder.removeAllListeners();
  await writeFile(path.join(directory, 'measurements.json'), JSON.stringify({ status: 'COMPLETE', plan, fixtures, rows }, null, 2));
}

async function run() {
  const directory = path.resolve('reports', `local-load-wire-${randomUUID()}`); await mkdir(directory);
  const paths = execFileSync('git', ['ls-files', 'shared', 'tuning.ts', 'server/BelayRoom.ts', 'server/main.ts', 'package-lock.json'], { encoding: 'utf8' }).trim().split('\n');
  paths.push('scripts/local-load-wire-audit.ts',
    'node_modules/@colyseus/core/build/Protocol.mjs', 'node_modules/@colyseus/core/build/Transport.mjs',
    'node_modules/@colyseus/ws-transport/build/WebSocketClient.mjs', 'node_modules/@colyseus/ws-transport/build/WebSocketTransport.mjs',
    'node_modules/@colyseus/sdk/src/Room.ts', 'node_modules/@colyseus/sdk/build/Room.mjs',
    'node_modules/@colyseus/schema/build/index.mjs', 'node_modules/msgpackr/node-index.js',
    'node_modules/msgpackr/pack.js', 'node_modules/msgpackr/unpack.js', 'node_modules/ws/lib/sender.js');
  const hashes = Object.fromEntries(await Promise.all(paths.map(async file => [file, createHash('sha256').update(await readFile(file)).digest('hex')])));
  const packages = Object.fromEntries(await Promise.all(['@colyseus/core', '@colyseus/sdk', '@colyseus/ws-transport', '@colyseus/schema', 'msgpackr', 'ws'].map(async name =>
    [name, JSON.parse(await readFile(`node_modules/${name}/package.json`, 'utf8')).version])));
  await writeFile(path.join(directory, 'manifest.json'), JSON.stringify({ plan, hashes, packages, node: process.version,
    revision: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(), startedAt: new Date().toISOString(),
    host: { arch: os.arch(), load: os.loadavg(), freeBytes: os.freemem() },
    scope: 'Encoder and small real-simulation fixture audit, not actual network traffic; zero listeners/sockets, no CPU benchmark or capacity result. Root cost/model and production protocol untouched.',
    controls: { maximumWallMs: TUNING.localLoad.maximumWallMs, heapMiB: TUNING.localLoad.authorityHeapMiB,
      sampledRssBytes: TUNING.localLoad.maximumTotalRssBytes, maximumReportBytes: TUNING.localLoad.maximumReportBytes } }, null, 2));
  const child = fork(fileURLToPath(import.meta.url), ['--child', directory], { execArgv: ['--import', 'tsx', `--max-old-space-size=${TUNING.localLoad.authorityHeapMiB}`], stdio: ['ignore', 'pipe', 'pipe', 'ipc'] });
  let log = ''; const collect = (data: Buffer) => { log += data.toString().slice(0, Math.max(0, TUNING.localLoad.maximumChildLogBytes - log.length)); };
  child.stdout?.on('data', collect); child.stderr?.on('data', collect); child.on('message', message => console.log(JSON.stringify(message)));
  const timeout = setTimeout(() => child.kill('SIGTERM'), TUNING.localLoad.maximumWallMs);
  const force = setTimeout(() => child.kill('SIGKILL'), TUNING.localLoad.maximumWallMs + TUNING.localLoad.shutdownGraceMs);
  const onSignal = () => child.kill('SIGTERM'); process.on('SIGINT', onSignal); process.on('SIGTERM', onSignal);
  let exit;
  try { exit = await new Promise<{ code: number | null; signal: NodeJS.Signals | null }>((resolve, reject) => {
    child.once('error', reject); child.once('exit', (code, signal) => resolve({ code, signal }));
  }); } finally { clearTimeout(timeout); clearTimeout(force); process.off('SIGINT', onSignal); process.off('SIGTERM', onSignal); }
  await writeFile(path.join(directory, 'teardown.json'), JSON.stringify({ pid: child.pid, ...exit, log, finishedAt: new Date().toISOString() }, null, 2));
  assert.equal(exit.code, 0, `Audit failed; partial evidence at ${directory}`);
  const checksums = Object.fromEntries(await Promise.all((await readdir(directory)).map(async file =>
    [file, createHash('sha256').update(await readFile(path.join(directory, file))).digest('hex')])));
  await writeFile(path.join(directory, 'checksums.json'), JSON.stringify(checksums, null, 2));
  const sizes = await Promise.all((await readdir(directory)).map(async file => (await readFile(path.join(directory, file))).length));
  assert(sizes.reduce((a, b) => a + b, 0) <= TUNING.localLoad.maximumReportBytes, 'Report cap exceeded');
  console.log(JSON.stringify({ directory, status: 'COMPLETE', ...exit }));
}
if (process.argv[2] === '--child') { await childAudit(process.argv[3]); process.exit(0); }
else if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await run();
