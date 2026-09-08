import { TUNING } from '../tuning';
import type { Snapshot, Vec3 } from '../shared/protocol';
import { projectDisplayedBody } from './terrain-view';
export { inside, groundPatches, type Rect } from './terrain-view';

export const mix = (a: Vec3, b: Vec3, t: number): Vec3 => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, z: a.z + (b.z - a.z) * t });
export function sameTopology(a: Snapshot, b: Snapshot) {
  return a.epoch === b.epoch && a.scene === b.scene && a.players.length === b.players.length
    && a.players.every((p, i) => p.id === b.players[i]?.id)
    && JSON.stringify(a.rope.spans?.map(s => [s.id, s.a, s.b])) === JSON.stringify(b.rope.spans?.map(s => [s.id, s.a, s.b]));
}
export function interpolateState(latest: Snapshot, history: readonly { at: number; state: Snapshot }[], now: number): Snapshot {
  const samples = history.filter(sample => sameTopology(sample.state, latest));
  if (!samples.length) return structuredClone(latest);
  const at = now - TUNING.network.interpolationMs;
  let a = samples[0], b = samples.at(-1)!;
  for (let i = 1; i < samples.length; i++) if (samples[i].at >= at) { a = samples[i - 1]; b = samples[i]; break; }
  const blend = b.at === a.at ? 1 : Math.max(0, Math.min(1, (at - a.at) / (b.at - a.at)));
  const sameSamples = [a.state, b.state].every(state => state.rope.points.length === latest.rope.points.length
    && JSON.stringify(state.rope.spans?.map(s => [s.startPoint, s.endPoint])) === JSON.stringify(latest.rope.spans?.map(s => [s.startPoint, s.endPoint])));
  return { ...latest, players: latest.players.map((p, i) => {
    const position = mix(a.state.players[i].position, b.state.players[i].position, blend);
    return { ...p, position: latest.terrain && latest.scene !== 'flat' && blend > 0 && blend < 1
      ? projectDisplayedBody(a.state.players[i].position, position, latest.terrain) : position };
  }),
    rope: { ...latest.rope, points: latest.rope.points.map((p, i) => sameSamples ? mix(a.state.rope.points[i], b.state.rope.points[i], blend) : { ...p }) } };
}

export function ropeSpans(snapshot: Snapshot) {
  return snapshot.rope.spans ?? (snapshot.players.length === 2 && snapshot.rope.points.length > 1 ? [{
    id: 0, a: snapshot.players[0].id, b: snapshot.players[1].id, startPoint: 0, endPoint: snapshot.rope.points.length - 1,
    length: snapshot.rope.length, tension: snapshot.rope.tension, tensionN: snapshot.rope.tensionN, slackM: snapshot.rope.slackM, catchHighlight: false,
  }] : []);
}

/** Each material span is sliced separately; no segment joins the end of one span to the next. */
export function displayedSpans(snapshot: Snapshot) {
  return ropeSpans(snapshot).flatMap(span => {
    const a = snapshot.players.find(p => p.id === span.a), b = snapshot.players.find(p => p.id === span.b);
    if (!a || !b || span.startPoint < 0 || span.endPoint >= snapshot.rope.points.length || span.endPoint <= span.startPoint) return [];
    const points = snapshot.rope.points.slice(span.startPoint, span.endPoint + 1).map(p => ({ ...p }));
    const harness = (p: Vec3): Vec3 => ({ x: p.x, y: p.y - TUNING.body.height / 2 + TUNING.body.harnessHeight, z: p.z });
    const ha = harness(a.position), hb = harness(b.position), start = points[0], end = points.at(-1)!;
    const offsetA = { x: ha.x - start.x, y: ha.y - start.y, z: ha.z - start.z };
    const offsetB = { x: hb.x - end.x, y: hb.y - end.y, z: hb.z - end.z };
    for (let i = 0; i < points.length; i++) {
      const offset = mix(offsetA, offsetB, i / (points.length - 1));
      points[i].x += offset.x; points[i].y += offset.y; points[i].z += offset.z;
    }
    return [{ ...span, points }];
  });
}

export function cameraFrame(players: readonly { id: number; position: Vec3 }[], localId: number, aspect: number,
  incidentRims: readonly Vec3[] = []) {
  const positions = players.map(p => p.position);
  if (!positions.length) return { target: { x: 0, y: 0, z: 0 }, span: TUNING.camera.baseVerticalSpan as number };
  const centroid = positions.reduce((c, p) => ({ x: c.x + p.x / positions.length, y: c.y + p.y / positions.length, z: c.z + p.z / positions.length }), { x: 0, y: 0, z: 0 });
  const own = players.find(p => p.id === localId)?.position;
  const target = own ? mix(centroid, own, TUNING.camera.localWeight) : centroid;
  const az = TUNING.camera.azimuthDegrees * Math.PI / 180, el = TUNING.camera.elevationDegrees * Math.PI / 180;
  let halfWidth = 0, halfHeight = 0;
  for (const p of [...positions, ...incidentRims]) {
    const x = p.x - target.x, y = p.y - target.y, z = p.z - target.z;
    halfWidth = Math.max(halfWidth, Math.abs(x * Math.cos(az) - z * Math.sin(az)));
    halfHeight = Math.max(halfHeight, Math.abs(-x * Math.sin(az) * Math.sin(el) + y * Math.cos(el) - z * Math.cos(az) * Math.sin(el)));
  }
  return { target, span: Math.min(TUNING.camera.maximumVerticalSpan, Math.max(TUNING.camera.baseVerticalSpan,
    halfHeight * 2 + TUNING.camera.margin, (halfWidth * 2 + TUNING.camera.margin) / Math.max(Number.EPSILON, aspect))) };
}
