import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { createElement } from 'react';
import { TUNING } from '../tuning';
import { phase2State } from './fixtures/phase2-state';
import { cameraFrame, displayedSpans, groundPatches, inside, interpolateState } from '../client/presentation';
import { groundSupports, LocalPrediction, safeGroundPrediction, supportedSweep } from '../client/prediction';
import { controlHint, moveFromKeys, nearestWall, screenDirection } from '../client/controls';
import { ClientEvidence } from '../client/evidence';
import { IncidentEvidence, roleRows } from '../client/IncidentEvidence';
import { OperatorControls } from '../client/OperatorControls';
// Test the client form's semantics without depending on the scaffold's bundler-only @ alias.
vi.mock('../components/ui/button', () => ({ Button: (props: object) => createElement('button', props) }));

describe('Phase 2 presentation topology', () => {
  it.each([2, 3, 4, 5, 6])('draws exactly adjacent spans for %i players with shared harness endpoints', count => {
    const snapshot = phase2State(count), before = structuredClone(snapshot);
    snapshot.players[1].position.x += 0.1;
    const spans = displayedSpans(snapshot);
    expect(spans).toHaveLength(count - 1);
    expect(spans.reduce((sum, span) => sum + span.points.length - 1, 0)).toBe((count - 1) * TUNING.rope.segments);
    for (let i = 0; i < spans.length; i++) {
      expect(spans[i].a).toBe(i); expect(spans[i].b).toBe(i + 1);
      expect(spans[i].points[0].x).toBeCloseTo(snapshot.players[i].position.x);
      expect(spans[i].points.at(-1)!.x).toBeCloseTo(snapshot.players[i + 1].position.x);
    }
    expect(snapshot.rope).toEqual(before.rope); // Render endpoint offsets never mutate authority or add cross-span edges.
  });
  it('does not interpolate across epochs or team/topology changes', () => {
    const old = phase2State(6), current = phase2State(2); current.epoch++;
    old.players[0].position.x = 100;
    const rendered = interpolateState(current, [{ at: 0, state: old }, { at: 100, state: current }], 100);
    expect(rendered.players).toHaveLength(2); expect(rendered.players[0].position).toEqual(current.players[0].position);
    rendered.players[0].position.x++; expect(current.players[0].position.x).not.toBe(rendered.players[0].position.x);
  });
  it('continues body interpolation when a rope contact changes its point sampling', () => {
    const a = phase2State(2, 'flat'), b = structuredClone(a);
    b.players[0].position.x += 1; b.rope.points.splice(1, 0, { x: 0, y: 0.039, z: 0.039 }); b.rope.spans![0].endPoint++;
    const rendered = interpolateState(b, [{ at: 0, state: a }, { at: 100, state: b }], 50 + TUNING.network.interpolationMs);
    expect(rendered.players[0].position.x).toBeCloseTo(a.players[0].position.x + 0.5);
    expect(rendered.rope.points).toEqual(b.rope.points);
  });
  it('subtracts pit rectangles without a floor across holes and conserves top-surface area', () => {
    const bounds = { minX: -5, maxX: 5, minZ: -5, maxZ: 5 }, hole = { minX: -2, maxX: 2, minZ: -1, maxZ: 1 };
    const patches = groundPatches(bounds, [hole]);
    const area = patches.reduce((sum, p) => sum + (p.maxX - p.minX) * (p.maxZ - p.minZ), 0);
    expect(area).toBe(92);
    expect(patches.some(p => inside({ x: 0, z: 0 }, p))).toBe(false);
  });
  it('follows depth with the approved team/own weighting and remains zoom bounded for six spread bodies', () => {
    const players = phase2State(6).players; players[3].position.y = -10;
    const frame = cameraFrame(players, 3, 0.5, [{ x: 0, y: 0, z: 0 }]);
    const average = players.reduce((sum, p) => sum + p.position.y, 0) / players.length;
    expect(frame.target.y).toBeCloseTo(average * (1 - TUNING.camera.localWeight) - 10 * TUNING.camera.localWeight);
    expect(frame.span).toBeLessThanOrEqual(TUNING.camera.maximumVerticalSpan);
    expect(frame.span).toBeGreaterThanOrEqual(TUNING.camera.baseVerticalSpan);
    players[5].position.x = 1000;
    expect(cameraFrame(players, 3, 1).span).toBe(TUNING.camera.maximumVerticalSpan);
  });
});

describe('conservative local contact prediction', () => {
  it.each([2, 3, 4, 5, 6])('matches the selected authority motor for a %i-player flat diagnostic', count => {
    const state = phase2State(count, 'flat'), prediction = new LocalPrediction();
    const point = prediction.sample(state, state, 0, { x: 1, z: 0, brace: true }, 0.05, 0, true)!;
    if (count === 2) {
      expect(point).toEqual(state.players[0].position);
      expect(controlHint(state.players[0], state)).toContain('release it to move');
    } else {
      expect(point.x).toBeGreaterThan(state.players[0].position.x);
      expect(point.x - state.players[0].position.x).toBeLessThanOrEqual(TUNING.phase2.haulSpeed * 0.05 + 1e-9);
      expect(controlHint(state.players[0], state)).toContain('Release Space to walk');
    }
  });
  it('checks a whole swept path instead of jumping a narrow unsupported hole', () => {
    const state = phase2State(2, 'crossing'); state.terrain!.bridges = [];
    const a = { x: 0, y: 0.45, z: -1 }, b = { x: 0, y: 0.45, z: 4 };
    expect(groundSupports(a, state)).toBe(true); expect(groundSupports(b, state)).toBe(true);
    expect(supportedSweep(a, b, state)).toBe(false);
    state.terrain!.bridges = [{ id: 0, crevasseId: 0, minX: -1, maxX: 1, minZ: 0, maxZ: 2.8, cue: 0, collapsed: false }];
    expect(supportedSweep(a, b, state)).toBe(true);
    state.terrain!.bridges[0].collapsed = true; expect(supportedSweep(a, b, state)).toBe(false);
  });
  it('uses both adjacent neighbors for a middle harness and never moves another body', () => {
    const state = phase2State(3, 'flat'); const before = structuredClone(state);
    const from = state.players[1].position;
    const predicted = safeGroundPrediction(from, { ...from, x: 100 }, 1, state);
    for (const neighbor of [state.players[0], state.players[2]]) expect(Math.hypot(predicted.x - neighbor.position.x, predicted.z - neighbor.position.z)).toBeLessThanOrEqual(TUNING.rope.length + TUNING.rope.solverToleranceM);
    expect(state).toEqual(before);
  });
  it('does not sweep through another body or invent ordinary-ground traction on ice', () => {
    const state = phase2State(2, 'flat');
    state.players[0].position = { x: -2, y: 0.45, z: 0 }; state.players[1].position = { x: 0, y: 0.45, z: 0 };
    expect(safeGroundPrediction(state.players[0].position, { x: 2, y: 0.45, z: 0 }, 0, state)).toEqual(state.players[0].position);
    state.terrain!.ice = [{ id: 0, minX: -3, maxX: -1, minZ: -1, maxZ: 1 }];
    const predictor = new LocalPrediction();
    expect(predictor.sample(state, state, 0, { x: 1, z: 0, brace: true }, 0.05, 0, true)).toEqual(state.players[0].position);
    expect(controlHint(state.players[0], state)).toContain('traction is lower');
  });
  it.each(['air', 'wall'] as const)('does not invent motor thrust or brace anchoring for %s support', support => {
    const state = phase2State(2); state.players[1].support = support;
    const before = structuredClone(state), prediction = new LocalPrediction();
    for (let i = 0; i < 5; i++) expect(prediction.sample(state, state, 1, { x: 1, z: 1, brace: true }, 0.016, i * 16, true)).toEqual(state.players[1].position);
    expect(state).toEqual(before);
  });
  it('does not preserve visual displacement after support disappears or a scene resets', () => {
    const state = phase2State(2, 'flat'), prediction = new LocalPrediction();
    prediction.sample(state, state, 0, { x: -1, z: 0, brace: false }, 0.05, 0, true);
    state.players[0].support = 'air'; state.players[0].position.y = -2;
    expect(prediction.sample(state, state, 0, { x: -1, z: 0, brace: true }, 0.05, 20, true)).toEqual(state.players[0].position);
    state.epoch++; state.players[0].position.x = 20;
    expect(prediction.sample(state, state, 0, { x: 0, z: 0, brace: false }, 0.05, 0, false)).toEqual(state.players[0].position);
  });
});

describe('control and operator readability', () => {
  it('keeps diagonal input normalized and labels wall directions in the same fixed camera frame', () => {
    const move = moveFromKeys(new Set(['KeyW', 'KeyD', 'Space']));
    expect(Math.hypot(move.x, move.z)).toBeCloseTo(1); expect(move.brace).toBe(true);
    expect(screenDirection({ x: 0, z: -1 })).toBe('W / ↑ + D / →');
    const state = phase2State(4), own = state.players[2]; own.support = 'wall'; own.position.z = TUNING.body.depth / 2 + TUNING.phase2.collisionSkin;
    expect(nearestWall(own.position, state.terrain)?.direction).toEqual({ x: 0, y: 0, z: -1 });
    expect(controlHint(own, state)).toContain('W / ↑ + D / →');
    own.support = 'air'; expect(controlHint(own, state)).toContain('Space cannot anchor');
  });
  it('exposes all scene/team options and names an occupied-seat reduction constraint', () => {
    const html = renderToStaticMarkup(createElement(OperatorControls, { snapshot: phase2State(6), busy: false, onLoad: async () => {}, onCommand: async () => {} }));
    for (const count of [2, 3, 4, 5, 6]) expect(html).toContain(`${count} climbers`);
    expect(html).toContain('Crossing'); expect(html).toContain('Rescue'); expect(html).toContain('Flat');
    expect(html).toContain('occupied higher-numbered seat'); expect(html).toContain('Reset and load scene');
  });
  it('shows per-harness denominators, static holds and pending first-attempt evidence without inventing a pass', () => {
    const state = phase2State(4), incident = state.incidents![0]; incident.roleActiveSeconds[0] = 0; incident.roleIdleSeconds[0] = 0;
    expect(roleRows(incident, 4)[0].fraction).toBeNull();
    const html = renderToStaticMarkup(createElement(IncidentEvidence, { snapshot: state }));
    expect(html).toContain('No samples'); expect(html).toContain('Static hold'); expect(html).toContain('pending');
    expect(html).toContain('Human verdict: not evaluated');
  });
  it('presents a middle-player climb as adjacent highlights while preserving the received event without catch attribution', () => {
    const state = phase2State(3), evidence = new ClientEvidence();
    state.players[1].support = 'wall'; state.players[1].rescueState = 'climbing';
    state.rope.spans![0].tensionN = 0; // Adjacency can highlight this span without a measured contribution.
    state.events = [{ id: 1, epoch: state.epoch, tick: state.tick, substep: 0, kind: 'climb', incidentId: 1,
      playerIds: [1], spanIds: [0, 1], surfaceIds: [] }];
    const before = structuredClone(state);
    const html = renderToStaticMarkup(createElement(IncidentEvidence, { snapshot: state }));
    expect(html.match(/<td>On<\/td>/g)).toHaveLength(2);
    expect(html).toContain('Chord-gap proxy'); expect(html).toContain('Correction proxy (N)');
    expect(html).not.toContain('Caught span');
    evidence.receive(state, 1, 100);
    expect(evidence.report().physicalEvents).toEqual(state.events);
    expect(evidence.report().scope).toContain('Event spanIds are adjacent spans');
    expect(evidence.report().scope).toContain('causal associations are unknown');
    expect(state).toEqual(before);
  });
});

describe('client cue/event evidence', () => {
  it('distinguishes received warnings from the first camera-frame draw and never renders a warning retrospectively after collapse', () => {
    const state = phase2State(2, 'crossing'), evidence = new ClientEvidence();
    evidence.receive(state, 0, 100); evidence.drawn(state, new Set(), new Set(), 110);
    expect(evidence.report().observations[0].firstDrawnAtMs).toBeNull();
    state.terrain!.bridges[0].collapsed = true; state.tick++;
    evidence.receive(state, 0, 120); evidence.drawn(state, new Set([0]), new Set(), 130);
    const rows = evidence.report().observations;
    expect(rows.find(row => row.kind === 'bridge-cue')!.firstDrawnAtMs).toBeNull();
    expect(rows.find(row => row.kind === 'bridge-collapse')!.firstDrawnAtMs).toBe(30);
  });
  it('accumulates delta events exactly once, ignores historical epochs and clears on reset', () => {
    const state = phase2State(2), evidence = new ClientEvidence();
    state.events = [{ id: 1, epoch: 1, tick: 10, substep: 0, kind: 'fall', incidentId: 1, playerIds: [1], spanIds: [0], surfaceIds: [] }];
    evidence.receive(state, 1, 100); evidence.receive(state, 1, 110); state.events = []; evidence.receive(state, 1, 120);
    expect(evidence.report().physicalEvents).toHaveLength(1);
    state.epoch++; state.events = [{ id: 2, epoch: 1, tick: 20, substep: 0, kind: 'catch', incidentId: 1, playerIds: [1], spanIds: [0], surfaceIds: [] }];
    evidence.receive(state, 1, 130); expect(evidence.report().physicalEvents).toHaveLength(0);
  });
  it('does not treat a recovered historical incident as a newly visible fall', () => {
    const state = phase2State(2), evidence = new ClientEvidence(); state.incidents![0].status = 'recovered';
    state.players[1].rescueState = 'safe'; evidence.receive(state, 1, 100); evidence.drawn(state, new Set([0]), new Set([0, 1]), 110);
    expect(evidence.report().observations.some(row => row.kind === 'fall')).toBe(false);
  });
  it('bounds retained cues and events and marks truncation rather than silently discarding old evidence', () => {
    const state = phase2State(2, 'crossing'), evidence = new ClientEvidence();
    const bridge = state.terrain!.bridges[0]; state.terrain!.bridges = Array.from({ length: TUNING.camera.maximumCueEvidence + 1 }, (_, id) => ({ ...bridge, id }));
    state.events = Array.from({ length: TUNING.phase2.maximumEvents + 1 }, (_, id) => ({ id, epoch: state.epoch, tick: id, substep: 0, kind: 'collapse' as const, incidentId: null, playerIds: [], spanIds: [], surfaceIds: [id] }));
    evidence.receive(state, 0, 0);
    expect(evidence.report().observations).toHaveLength(TUNING.camera.maximumCueEvidence);
    expect(evidence.report().physicalEvents).toHaveLength(TUNING.phase2.maximumEvents);
    expect(evidence.report().truncated).toBe(true);
  });
});
