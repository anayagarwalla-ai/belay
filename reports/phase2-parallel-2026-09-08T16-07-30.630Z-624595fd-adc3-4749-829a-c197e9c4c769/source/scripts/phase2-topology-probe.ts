/** Bounded two-tape probe. Apply a recorded candidate patch in an isolated checkout before selecting its label. No tuning or runtime file is modified: the two nominal wall profiles live in disposable module copies. */
import {
  readFileSync,
  writeFileSync,
  mkdirSync,
  mkdtempSync,
  rmSync,
  readdirSync,
} from 'node:fs';
import { resolve, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';
import { initializePhysics } from '../shared/simulation';
import { sweepBox, penetration, type Solid } from '../shared/contact-geometry';
import type { SceneOptions, Move, Vec3 } from '../shared/protocol';
import fixtures from '../tests/fixtures/phase2-recovery-counterexamples.json';
type ProbeEngine = {
  substep: (inputs: Move[]) => void;
  nodes: Vec3[];
  spans: { nodes: number[] }[];
  terrain: { solids: Solid[] };
  diagnostics: { solverIterations: number };
};
const label = process.argv[2] ?? 'baseline';
if (!['baseline', 'candidate1', 'candidate2'].includes(label))
  throw new Error('Use baseline, candidate1 or candidate2.');
mkdirSync('work', { recursive: true });
mkdirSync('reports', { recursive: true });
await initializePhysics();
const rows: unknown[] = [];
for (const wall of [900, 450]) {
  const dir = mkdtempSync(resolve('work/topology-probe-'));
  try {
    mkdirSync(join(dir, 'shared'));
    for (const file of readdirSync('shared').filter((f) => f.endsWith('.ts')))
      writeFileSync(
        join(dir, 'shared', file),
        readFileSync(join('shared', file)),
      );
    const tuning = readFileSync('tuning.ts', 'utf8').replace(
      /wallNormalEffortN: \d+/,
      `wallNormalEffortN: ${wall}`,
    );
    writeFileSync(join(dir, 'tuning.ts'), tuning);
    const { BelaySimulation } = (await import(
      pathToFileURL(join(dir, 'shared/simulation.ts')).href
    )) as typeof import('../shared/simulation');
    const { TUNING } = (await import(
      pathToFileURL(join(dir, 'tuning.ts')).href
    )) as typeof import('../tuning');
    if (TUNING.phase2.wallNormalEffortN !== wall)
      throw new Error('Wall profile substitution failed.');
    for (const fixture of fixtures)
      for (const rate of [30, 60] as const) {
        const sim = new BelaySimulation({
            ...fixture.options,
            tickHz: rate,
          } as SceneOptions),
          e = (sim as unknown as { engine: ProbeEngine }).engine,
          half = {
            x: TUNING.rope.radius,
            y: TUNING.rope.radius,
            z: TUNING.rope.radius,
          };
        let maxCrossings = 0,
          maxTensionN = 0,
          peakIterations = 0,
          maxRopePenetrationM = 0,
          maxCrossingDepthM = 0;
        const crossingTicks: number[] = [];
        const substep = e.substep.bind(e);
        e.substep = (input: Move[]) => {
          substep(input);
          peakIterations = Math.max(
            peakIterations,
            e.diagnostics.solverIterations,
          );
        };
        for (const run of fixture.runs)
          for (let tick = 0; tick < run.ticks * (rate / 30); tick++) {
            sim.step(run.inputs);
            let crossings = 0;
            for (const span of e.spans)
              for (let j = 1; j < span.nodes.length; j++)
                for (const solid of e.terrain.solids) {
                  const a = e.nodes[span.nodes[j - 1]],
                    b = e.nodes[span.nodes[j]],
                    hit = sweepBox(a, b, half, solid);
                  if (hit) {
                    crossings++;
                    const reverse = sweepBox(b, a, half, solid),
                      t = (hit.time + (reverse ? 1 - reverse.time : 1)) / 2;
                    const point = {
                      x: a.x + (b.x - a.x) * t,
                      y: a.y + (b.y - a.y) * t,
                      z: a.z + (b.z - a.z) * t,
                    };
                    maxCrossingDepthM = Math.max(
                      maxCrossingDepthM,
                      penetration(point, half, solid)?.depth ?? 0,
                    );
                  }
                }
            for (const p of e.nodes)
              for (const solid of e.terrain.solids)
                maxRopePenetrationM = Math.max(
                  maxRopePenetrationM,
                  penetration(p, half, solid)?.depth ?? 0,
                );
            if (crossings > 0) crossingTicks.push(sim.tick);
            maxCrossings = Math.max(maxCrossings, crossings);
            maxTensionN = Math.max(maxTensionN, sim.tensionN);
          }
        const state = sim.snapshot();
        rows.push({
          wall,
          playerCount: sim.playerCount,
          tickHz: rate,
          ticks: sim.tick,
          run: state.run,
          incidents: state.incidents,
          counters: state.counters,
          diagnostics: state.diagnostics,
          maxCrossings,
          maxRopePenetrationM,
          maxCrossingDepthM,
          crossingTicks,
          peakIterations,
          maxTensionN,
          bodyState: state.players.map((p) => ({
            id: p.id,
            support: p.support,
            position: p.position,
            velocity: p.velocity,
          })),
        });
        console.log(
          JSON.stringify({
            label,
            wall,
            n: sim.playerCount,
            rate,
            segment: state.counters.maximumSegmentErrorM,
            span: state.counters.maximumSpanErrorM,
            maxCrossings,
            maxRopePenetrationM,
            maxCrossingDepthM,
            peakIterations,
            energy: state.diagnostics.maximumEnergyProjectionJ,
            potential: state.diagnostics.maximumPotentialExcessJ,
            incident: state.incidents[0]?.status,
          }),
        );
        sim.dispose();
      }
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}
writeFileSync(
  `reports/phase2-topology-${label}.json`,
  JSON.stringify(
    {
      label,
      runtime: process.version,
      engineSha256: createHash('sha256')
        .update(readFileSync('shared/expedition-simulation.ts'))
        .digest('hex'),
      rows,
    },
    null,
    2,
  ),
);
