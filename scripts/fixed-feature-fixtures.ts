import { TUNING } from '../tuning';
import { makeMaterialChain, type FixedFeatureProblem, type MaterialChain } from './fixed-feature-feasibility';
import type { Vec3 } from '../shared/protocol';

const particleClearance = TUNING.rope.radius + TUNING.phase2.collisionSkin;
const bodyClearance = TUNING.body.harnessHeight + TUNING.phase2.collisionSkin;
const up = { x: 0, y: 1, z: 0 };

/** One infinite floor half-space. Node clearances include the existing body
 * harness offset / rope radius. Endpoint clearance also protects straight edge
 * interiors here; midpoint samples exercise the same fixed feature explicitly. */
function floor(chain: MaterialChain): FixedFeatureProblem['plane'] {
  const samples: NonNullable<FixedFeatureProblem['plane']>['samples'] = chain.positions.map((_, node) => ({
    kind: 'node', node, clearanceM: node < chain.bodyCount ? bodyClearance : particleClearance,
  }));
  for (const span of chain.spans) for (let j = 1; j < span.nodeIds.length; j++) {
    samples.push({ kind: 'edge', a: span.nodeIds[j - 1], b: span.nodeIds[j], fraction: 0.5, clearanceM: particleClearance });
  }
  return { normal: up, offsetM: 0, samples };
}

export type FixedFeatureFixture = { name: string; problem: FixedFeatureProblem; knownFeasiblePositions?: Vec3[];
  infeasibilityProof?: { halfSpanMaterialM: number; minimumContactY: number; fixedBodyY: number; materialEdgesPerHalf: number } };

/** Small fixed inputs, not a parameter search, timestep simulation, or replay.
 * Geometry below is fixture data; every solver/mass/material limit comes from
 * tuning.ts. The lip fixtures prescribe a local feature at one material node,
 * and make no claim of full terrain clearance/discovery outside that feature. */
export function fixedFeatureFixtures(): FixedFeatureFixture[] {
  const slack = makeMaterialChain([{ x: 0, y: 0.6, z: 0 }, { x: 2.5, y: 0.6, z: 0 }]);

  const local = makeMaterialChain([{ x: 0, y: 0.6, z: 0 }, { x: 3.6, y: 0.6, z: 0 }]);
  const localWitness = structuredClone(local.positions);
  local.positions[local.spans[0].nodeIds[2]].x = 0.9;

  const two = makeMaterialChain([{ x: -1.6, y: bodyClearance, z: 0 }, { x: 1.6, y: bodyClearance, z: 0 }]);
  const twoWitness = structuredClone(two.positions);
  two.positions[two.spans[0].nodeIds[6]].y = -0.2;

  const three = makeMaterialChain([{ x: -3.4, y: bodyClearance, z: 0 }, { x: 0, y: bodyClearance, z: 0 }, { x: 3.4, y: bodyClearance, z: 0 }]);
  const threeWitness = structuredClone(three.positions);
  three.positions[three.spans[0].nodeIds[6]].y = -0.2;
  three.positions[three.spans[1].nodeIds[6]].y = 0.9;

  const taut = makeMaterialChain([{ x: -1.8, y: 0, z: 0 }, { x: 1.8, y: 0, z: 0 }]);
  const tautWitness = makeMaterialChain([{ x: -1.65, y: 0.3, z: 0 }, { x: 1.65, y: 0.3, z: 0 }]);
  const peak = { x: 0, y: 0.6 + particleClearance, z: 0 };
  for (let j = 1; j < TUNING.rope.segments; j++) {
    const a = j <= 6 ? tautWitness.positions[0] : peak, b = j <= 6 ? peak : tautWitness.positions[1];
    const t = j <= 6 ? j / 6 : (j - 6) / 6;
    tautWitness.positions[tautWitness.spans[0].nodeIds[j]] = { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, z: 0 };
  }

  const infeasible = makeMaterialChain([{ x: -1.5, y: 0, z: 0 }, { x: 1.5, y: 0, z: 0 }]);
  return [
    { name: 'slack-chain', problem: { chain: slack, plane: floor(slack) }, knownFeasiblePositions: structuredClone(slack.positions) },
    { name: 'local-edge-regression', problem: { chain: local, plane: floor(local) }, knownFeasiblePositions: localWitness },
    { name: 'two-body-floor', problem: { chain: two, plane: floor(two) }, knownFeasiblePositions: twoWitness },
    { name: 'three-body-floor', problem: { chain: three, plane: floor(three) }, knownFeasiblePositions: threeWitness },
    { name: 'taut-prescribed-lip', problem: { chain: taut,
      plane: { normal: up, offsetM: 0.6, samples: [{ kind: 'node', node: taut.spans[0].nodeIds[6], clearanceM: particleClearance }] } },
      knownFeasiblePositions: tautWitness.positions },
    { name: 'infeasible-prescribed-lip', problem: { chain: infeasible,
      plane: { normal: up, offsetM: 2, samples: [{ kind: 'node', node: infeasible.spans[0].nodeIds[6], clearanceM: particleClearance }] },
      fixedBodies: [{ body: 0, position: { ...infeasible.positions[0] } }, { body: 1, position: { ...infeasible.positions[1] } }] },
      infeasibilityProof: { halfSpanMaterialM: infeasible.spans[0].materialLengthM / 2,
        minimumContactY: 2 + particleClearance, fixedBodyY: 0, materialEdgesPerHalf: TUNING.rope.segments / 2 } },
  ];
}
