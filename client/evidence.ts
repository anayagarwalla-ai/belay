import { TUNING } from '../tuning';
import type { PhysicalEvent, Snapshot } from '../shared/protocol';

export type CueObservation = {
  kind: 'bridge-cue' | 'bridge-collapse' | 'fall'; id: number; epoch: number; firstReceivedTick: number;
  firstReceivedAtMs: number; firstDrawnTick: number | null; firstDrawnAtMs: number | null;
  localPlayerId: number; drawnInCameraFrame: boolean; cue: number | null;
  incidentId?: number; playerId?: number;
  endedBeforeDraw: boolean;
  serverCueOnset: { eventId: number; tick: number; substep: number } | null;
};
/** Receipt and renderer submission with geometric frame inclusion are separate observations, not pixel visibility. */
export class ClientEvidence {
  private observations = new Map<string, CueObservation>();
  private events = new Map<number, PhysicalEvent>();
  private epoch: number | null = null;
  private startedAtMs = 0;
  private truncated = false;
  reset(epoch: number | null = null, now = performance.now()) {
    this.observations.clear(); this.events.clear(); this.epoch = epoch; this.startedAtMs = now; this.truncated = false;
  }
  receive(snapshot: Snapshot, localId: number, now = performance.now()) {
    if (snapshot.epoch !== this.epoch) this.reset(snapshot.epoch, now);
    for (const event of snapshot.events ?? []) {
      if (event.epoch !== snapshot.epoch || this.events.has(event.id)) continue;
      if (this.events.size >= TUNING.phase2.maximumEvents) { this.truncated = true; continue; }
      this.events.set(event.id, structuredClone(event));
    }
    for (const observation of this.observations.values()) if (observation.firstDrawnAtMs === null && !this.observable(observation, snapshot)) observation.endedBeforeDraw = true;
    const add = (kind: CueObservation['kind'], id: number, cue: number | null) => {
      const key = `${kind}:${id}`;
      if (this.observations.has(key)) return;
      if (this.observations.size >= TUNING.camera.maximumCueEvidence) { this.truncated = true; return; }
      const onset = kind === 'bridge-cue' ? [...this.events.values()].filter(event => event.kind === 'cue' && event.surfaceIds.includes(id) && event.tick <= snapshot.tick).at(-1) : undefined;
      this.observations.set(key, { kind, id, epoch: snapshot.epoch, firstReceivedTick: snapshot.tick,
        firstReceivedAtMs: now - this.startedAtMs, firstDrawnTick: null, firstDrawnAtMs: null,
        localPlayerId: localId, drawnInCameraFrame: false, cue, endedBeforeDraw: false,
        serverCueOnset: onset ? { eventId: onset.id, tick: onset.tick, substep: onset.substep } : null });
    };
    for (const bridge of snapshot.terrain?.bridges ?? []) {
      if (bridge.cue > 0) add('bridge-cue', bridge.id, bridge.cue);
      if (bridge.collapsed) add('bridge-collapse', bridge.id, bridge.cue);
    }
    for (const incident of snapshot.incidents ?? []) if (incident.status === 'active') for (const player of incident.playerIds) {
      const body = snapshot.players.find(p => p.id === player);
      if (!body || body.rescueState === 'safe' || body.rescueState === 'lost') continue;
      // The incident and harness pair identify repeat falls without mixing separate episodes.
      const id = incident.id * TUNING.hardCap + player;
      add('fall', id, null);
      const observation = this.observations.get(`fall:${id}`);
      if (observation) { observation.incidentId = incident.id; observation.playerId = player; }
    }
  }
  private observable(observation: CueObservation, snapshot: Snapshot) {
    if (observation.kind !== 'fall') {
      const bridge = snapshot.terrain?.bridges.find(b => b.id === observation.id);
      return observation.kind === 'bridge-cue' ? Boolean(bridge && bridge.cue > 0 && !bridge.collapsed) : Boolean(bridge?.collapsed);
    }
    const body = snapshot.players.find(p => p.id === observation.playerId);
    return Boolean(body && body.activeIncidentId === observation.incidentId && body.rescueState !== 'safe' && body.rescueState !== 'lost'
      && snapshot.incidents?.some(i => i.id === observation.incidentId && i.status === 'active'));
  }
  drawn(snapshot: Snapshot, visibleBridges: ReadonlySet<number>, visiblePlayers: ReadonlySet<number>, now = performance.now()) {
    if (snapshot.epoch !== this.epoch) return;
    for (const observation of this.observations.values()) {
      if (observation.firstDrawnAtMs !== null || observation.endedBeforeDraw) continue;
      if (!this.observable(observation, snapshot)) { observation.endedBeforeDraw = true; continue; }
      const visible = observation.kind === 'fall'
        ? visiblePlayers.has(observation.id % TUNING.hardCap)
        : visibleBridges.has(observation.id);
      if (!visible) continue;
      observation.firstDrawnTick = snapshot.tick; observation.firstDrawnAtMs = now - this.startedAtMs;
      observation.drawnInCameraFrame = true;
    }
  }
  report() {
    return { sceneEpoch: this.epoch, truncated: this.truncated, observations: structuredClone([...this.observations.values()]),
      physicalEvents: structuredClone([...this.events.values()]),
      scope: 'Scene-relative first receipt and first post-renderer-submission timestamp per kind/bridge or incident/player. '
        + 'firstDrawn* and drawnInCameraFrame mean a player center is inside the projected frame or bridge bounds intersect the frustum, including hidden collapsed bridge bounds. '
        + 'Ticks refer to the latest snapshot; displayed bodies may be interpolated/predicted. Occlusion, opening visibility and human attention are unknown. '
        + 'Ended unsubmitted observations stay undrawn; server cue onset is included only if received when the observation is created. '
        + 'Event spanIds are adjacent spans; cue/collapse surfaceIds are bridge IDs. Catch records hanging, possibly wall-settled; rescuer, support-loss and causal associations are unknown. '
        + 'tensionN is a correction-derived solver proxy, tension is smoothed, and slackM is a chord-gap proxy that ignores routing. catchHighlight marks spans adjacent to catch/climb events.' };
  }
}
