import RAPIER from '@dimforge/rapier3d-compat';
import { TUNING, FAMILIES, type Family, type TickHz } from '../tuning';
import { REST, normalizeMove, type Scene, type SceneOptions, type Vec3, type Move, type Tape,
  type SimulationSnapshot, type IncidentState, type PhysicalEvent, type RescueState, type SimCounters } from './protocol';
import { expeditionMotorVelocity } from './expedition-movement';
import { wallMotorVelocity } from './wall-motor';
import { distanceMultiplier } from './rope-projection';
import { ropeRoute, ropeReach } from './rope-route';
import { physicalTerrain } from './terrain';
import { emptyPhysicalDiagnostics } from './physical-diagnostics';
import type { BridgeLoadObserver } from './bridge-load-observer';
import { dot, vectorDistance as distance, projectMotion, supportAt, penetration, contactNormalsAt, blockingNormalsAt, expeditionContactHalf, type Contact } from './contact-geometry';

const zero = (): Vec3 => ({ x: 0, y: 0, z: 0 });
const bodyHalf = { x: TUNING.body.width / 2, y: TUNING.body.height / 2, z: TUNING.body.depth / 2 };
// The same contact envelope is used by Rapier and every swept PBD projection.
// A native-only skin would lift bodies after rope projection and add energy.
const half = expeditionContactHalf;
const particleHalf = { x: TUNING.rope.radius, y: TUNING.rope.radius, z: TUNING.rope.radius };
const axes = ['x', 'y', 'z'] as const;
const clamp = (n: number, min: number, max: number) => Math.max(min, Math.min(max, n));
type Span = { id: number; a: number; b: number; nodes: number[]; startPoint: number; endPoint: number;
  tension: number; tensionN: number; corrections: Vec3[]; highlightUntil: number; wasTaut: boolean };

/** Shared harness degrees of freedom, adjacent unilateral particle spans, and swept terrain
 * projections. Each Rapier step advances time once, and each body receives one rope impulse. */
export class ExpeditionSimulation {
  readonly world: RAPIER.World;
  readonly scene: Scene;
  readonly playerCount: number;
  readonly seed: number;
  readonly family: Family;
  readonly tickHz: TickHz;
  readonly length: number;
  readonly tape: Tape;
  readonly bodies: RAPIER.RigidBody[] = [];
  readonly points: Vec3[] = [];
  readonly counters: SimCounters;
  readonly diagnostics = emptyPhysicalDiagnostics();
  private terrain: ReturnType<typeof physicalTerrain>;
  private solidColliders = new Map<number, RAPIER.Collider>();
  private nodes: Vec3[] = [];
  private previous: Vec3[] = [];
  private nodeNormals: Vec3[][] = [];
  private normalLoadDelta: Vec3[] = [];
  private spans: Span[] = [];
  private contacts: Contact[] = [];
  private brace: boolean[] = [];
  private states: RescueState[] = [];
  private catchSeconds: number[] = [];
  private recoverySeconds: number[] = [];
  private lastInputs: Move[] = [];
  private incidents: IncidentState[] = [];
  private active?: IncidentState;
  private events: PhysicalEvent[] = [];
  private nextEventId = 0;
  private nextIncidentId = 0;
  private overload = new Map<number, number>();
  private warned = new Map<number, number>();
  private queuedCollapses = new Set<number>();
  private runStatus: 'testing' | 'active' | 'complete' | 'failed';
  private runEndedAt?: number;
  private substepNumber = 0;
  private readonly bridgeLoadObserver?: BridgeLoadObserver;
  tick = 0;
  tension = 0;
  tensionN = 0;

  constructor(options: SceneOptions, bridgeLoadObserver?: BridgeLoadObserver) {
    this.bridgeLoadObserver = bridgeLoadObserver;
    this.scene = options.scene ?? 'flat'; this.playerCount = options.playerCount ?? TUNING.players;
    this.seed = options.seed ?? TUNING.seed; this.family = options.family ?? 'balanced'; this.tickHz = options.tickHz ?? TUNING.tickHz;
    this.length = FAMILIES[this.family].ropeLength * (this.playerCount - 1);
    this.tape = { version: TUNING.version, seed: this.seed, family: this.family, tickHz: this.tickHz,
      scene: this.scene, playerCount: this.playerCount, frames: [], truncated: false };
    this.counters = { ticks: 0, elapsedSeconds: 0, maximumSpanErrorM: 0, maximumSegmentErrorM: 0,
      maximumSpeedMps: 0, maximumJoltMps2: 0, tautTransitions: 0, totalTensionSeconds: 0,
      distanceTravelledM: Array(this.playerCount).fill(0) };
    this.runStatus = this.scene === 'flat' ? 'testing' : 'active';
    this.terrain = physicalTerrain(this.scene, this.seed);
    this.world = new RAPIER.World({ x: 0, y: -TUNING.gravity, z: 0 });
    this.world.timestep = 1 / TUNING.physicsHz;
    this.world.integrationParameters.normalizedPredictionDistance = TUNING.phase2.contactPredictionM;
    for (const solid of this.terrain.solids) {
      const collider = this.world.createCollider(RAPIER.ColliderDesc.cuboid((solid.maxX - solid.minX) / 2,
        (solid.maxY - solid.minY) / 2, (solid.maxZ - solid.minZ) / 2)
        .setTranslation((solid.minX + solid.maxX) / 2, (solid.minY + solid.maxY) / 2, (solid.minZ + solid.maxZ) / 2)
        .setFriction(TUNING.body.groundFriction));
      this.solidColliders.set(solid.id, collider);
    }
    for (let id = 0; id < this.playerCount; id++) {
      const x = this.scene === 'crossing' ? 0 : (id - (this.playerCount - 1) / 2)
        * (this.scene === 'rescue' ? TUNING.phase2.rescueSpacing : TUNING.rope.initialSpacing);
      const z = this.scene === 'crossing' ? -id * TUNING.rope.initialSpacing : this.scene === 'flat' ? 0
        : id === Math.floor(this.playerCount / 2) ? TUNING.phase2.rescueFallerAdvance : -TUNING.phase2.rescueSafeOffset;
      const body = this.world.createRigidBody(RAPIER.RigidBodyDesc.dynamic().setTranslation(x, half.y + TUNING.phase2.collisionSkin, z)
        .lockRotations().setCanSleep(false).setCcdEnabled(true));
      this.world.createCollider(RAPIER.ColliderDesc.cuboid(bodyHalf.x, bodyHalf.y, bodyHalf.z)
        .setMass(TUNING.body.mass).setFriction(TUNING.body.groundFriction).setContactSkin(TUNING.phase2.bodyContactSkinM), body);
      this.bodies.push(body); this.nodes.push(this.harness(id)); this.previous.push(this.harness(id));
      this.contacts.push(supportAt(body.translation(), half, this.terrain.solids));
      this.brace.push(false); this.states.push('safe'); this.catchSeconds.push(0); this.recoverySeconds.push(0); this.lastInputs.push({ ...REST });
    }
    for (let id = 0; id < this.playerCount - 1; id++) {
      const nodes = [id], a = this.nodes[id], b = this.nodes[id + 1], startPoint = this.points.length;
      for (let j = 1; j < TUNING.rope.segments; j++) {
        const t = j / TUNING.rope.segments, curve = 4 * t * (1 - t);
        const p = { x: a.x + (b.x - a.x) * t, y: a.y - curve * TUNING.rope.initialSag,
          z: a.z + (b.z - a.z) * t + (this.scene === 'flat' ? curve * TUNING.rope.initialBend : 0) };
        const corrected = projectMotion(p, p, particleHalf, this.terrain.solids).position;
        nodes.push(this.nodes.length); this.nodes.push(corrected); this.previous.push({ ...corrected });
      }
      nodes.push(id + 1); this.points.push(...nodes.map(index => this.nodes[index]));
      this.spans.push({ id, a: id, b: id + 1, nodes, startPoint, endPoint: this.points.length - 1,
        tension: 0, tensionN: 0, corrections: [zero(), zero()], highlightUntil: 0, wasTaut: false });
    }
  }
  private harness(id: number) {
    const p = this.bodies[id].translation(); return { x: p.x, y: p.y - bodyHalf.y + TUNING.body.harnessHeight, z: p.z };
  }
  private center(p: Vec3) { return { x: p.x, y: p.y + bodyHalf.y - TUNING.body.harnessHeight, z: p.z }; }
  private time() { return this.substepNumber / TUNING.physicsHz; }
  private event(kind: PhysicalEvent['kind'], playerIds: number[] = [], surfaceIds: number[] = []) {
    this.events.push({ id: this.nextEventId++, epoch: 0, tick: this.tick,
      substep: this.substepNumber % (TUNING.physicsHz / this.tickHz), kind, incidentId: this.active?.id ?? null,
      playerIds: [...playerIds], spanIds: this.spans.filter(s => playerIds.includes(s.a) || playerIds.includes(s.b)).map(s => s.id), surfaceIds });
    if (this.events.length > TUNING.phase2.maximumEvents) { this.events.shift(); this.diagnostics.eventsTruncated = true; }
  }
  step(inputs: Move[], record = false) {
    const frame = this.bodies.map((_, id) => normalizeMove(inputs[id] ?? REST));
    if (record) {
      if (this.tape.frames.length < this.tickHz * TUNING.network.maximumTapeSeconds) this.tape.frames.push({ tick: this.tick, inputs: frame.map(p => ({ ...p })) });
      else this.tape.truncated = true;
    }
    for (let i = 0; i < TUNING.physicsHz / this.tickHz; i++) {
      if (this.runStatus !== 'failed' && this.runStatus !== 'complete') this.substep(frame);
      this.substepNumber++;
    }
    this.tick++; this.counters.ticks = this.tick; this.counters.elapsedSeconds = this.tick / this.tickHz;
  }

  private substep(inputs: Move[]) {
    const dt = 1 / TUNING.physicsHz, mass = TUNING.body.mass, profile = TUNING.phase2;
    for (const id of this.queuedCollapses) {
      const bridge = this.terrain.state.bridges.find(b => b.id === id)!; bridge.collapsed = true;
      const solid = this.terrain.solids.find(s => s.bridgeId === id)!;
      this.world.removeCollider(this.solidColliders.get(solid.id)!, true); this.solidColliders.delete(solid.id);
      this.terrain.solids = this.terrain.solids.filter(s => s !== solid); this.event('collapse', [], [id]);
    }
    this.queuedCollapses.clear();
    const before = this.bodies.map(b => ({ ...b.translation() })), velocities = this.bodies.map(b => ({ ...b.linvel() }));
    if (this.scene === 'flat') {
      const x = before.reduce((sum, p) => sum + p.x, 0) / this.playerCount;
      const z = before.reduce((sum, p) => sum + p.z, 0) / this.playerCount;
      const floor = this.terrain.solids[0], extent = TUNING.terrain.halfExtent;
      floor.minX = x - extent; floor.maxX = x + extent; floor.minZ = z - extent; floor.maxZ = z + extent;
      this.solidColliders.get(floor.id)!.setTranslation({ x, y: (floor.minY + floor.maxY) / 2, z });
      this.terrain.state.bounds = { minX: floor.minX, maxX: floor.maxX, minZ: floor.minZ, maxZ: floor.maxZ };
    }
    if (this.scene !== 'flat' && before.every(p => p.y < profile.terminalY)) {
      for (let id = 0; id < this.playerCount; id++) { this.states[id] = 'lost'; this.event('lost', [id]); }
      this.failRun(); return;
    }
    let initialEnergy = before.reduce((sum, p, id) => sum + mass / 2 * dot(velocities[id], velocities[id]) + mass * TUNING.gravity * p.y, 0);
    for (let id = this.playerCount; id < this.nodes.length; id++) initialEnergy += TUNING.rope.particleMass
      * (distance(this.nodes[id], this.previous[id]) ** 2 / (2 * dt * dt) + TUNING.gravity * this.nodes[id].y);
    this.contacts = before.map(p => supportAt(p, half, this.terrain.solids)); this.brace = inputs.map(i => i.brace);
    const traction = Array(this.playerCount).fill(0), ropeDelta = this.bodies.map(zero);
    this.normalLoadDelta = this.bodies.map(zero);
    let motorWork = 0;
    for (let id = 0; id < this.playerCount; id++) {
      let v = { ...velocities[id] };
      const contact = this.contacts[id], input = inputs[id];
      if (contact.support === 'ground') {
        const ice = this.terrain.state.ice.some(p => before[id].x >= p.minX && before[id].x <= p.maxX && before[id].z >= p.minZ && before[id].z <= p.maxZ);
        const scale = ice ? profile.iceTractionMultiplier : 1;
        v = expeditionMotorVelocity(v, input, dt * scale, this.family);
        if (input.brace) traction[id] = Math.max(0, FAMILIES[this.family].braceFriction * scale * mass * TUNING.gravity * dt
          - mass * Math.hypot(v.x - velocities[id].x, v.z - velocities[id].z));
      } else if (contact.support === 'wall') {
        v = wallMotorVelocity(v, input, contact.normal, dt,
          before[id].y + bodyHalf.y >= contact.solid!.maxY + profile.ledgeReachAboveHeadM);
      } // Unsupported inputs never add a motor impulse or change effective mass.
      motorWork += mass / 2 * (dot(v, v) - dot(velocities[id], velocities[id]));
      this.bodies[id].setLinvel(v, true);
    }
    this.world.step();
    const predicted = this.bodies.map((_, id) => this.harness(id)), predictedVelocities = this.bodies.map(b => ({ ...b.linvel() }));
    this.contacts = predicted.map(p => supportAt(this.center(p), half, this.terrain.solids));
    for (let id = 0; id < this.playerCount; id++) Object.assign(this.nodes[id], predicted[id]);
    const damping = Math.exp(-FAMILIES[this.family].ropeDrag * dt);
    for (let i = this.playerCount; i < this.nodes.length; i++) {
      const p = this.nodes[i], old = { ...p }, prev = this.previous[i];
      p.x += (p.x - prev.x) * damping; p.y += (p.y - prev.y) * damping - TUNING.gravity * dt * dt; p.z += (p.z - prev.z) * damping;
      Object.assign(p, projectMotion(old, p, particleHalf, this.terrain.solids).position); this.previous[i] = old;
    }
    for (const span of this.spans) span.corrections = [zero(), zero()];
    const contactNormals: Vec3[][] = this.bodies.map(() => []);
    const segment = FAMILIES[this.family].ropeLength / TUNING.rope.segments;
    let iterations = 0;
    for (; iterations < profile.maximumSolverIterations; iterations++) {
      const prior = this.nodes.map(p => ({ ...p }));
      this.nodeNormals = this.nodes.map((p, id) => contactNormalsAt(id < this.playerCount ? this.center(p) : p,
        id < this.playerCount ? half : particleHalf, this.terrain.solids));
      for (const span of this.spans) {
        for (let k = 0; k < span.nodes.length - 1; k++) {
          const j = iterations % 2 ? span.nodes.length - k - 2 : k;
          this.constrain(span, span.nodes[j], span.nodes[j + 1], segment, traction, ropeDelta, dt);
        }
        this.constrain(span, span.a, span.b, FAMILIES[this.family].ropeLength, traction, ropeDelta, dt);
        for (let j = 1; j < span.nodes.length - 1; j++) {
          this.constrain(span, span.a, span.nodes[j], segment * j, traction, ropeDelta, dt);
          this.constrain(span, span.nodes[j], span.b, segment * (span.nodes.length - 1 - j), traction, ropeDelta, dt);
        }
      }

      this.separateBodies();
      for (let i = 0; i < this.nodes.length; i++) {
        const body = i < this.playerCount;
        const projection = projectMotion(body ? this.center(prior[i]) : prior[i], body ? this.center(this.nodes[i]) : this.nodes[i], body ? half : particleHalf, this.terrain.solids);
        Object.assign(this.nodes[i], body ? { ...projection.position, y: projection.position.y - bodyHalf.y + TUNING.body.harnessHeight } : projection.position);
        this.diagnostics.contactProjections += projection.projections;
        if (body) contactNormals[i].push(...projection.normals);
      }
      const potentialError = this.constrainPotential(initialEnergy + motorWork);
      if (iterations + 1 >= profile.solverIterations && this.segmentError() <= profile.solverToleranceM
        && potentialError <= profile.energyToleranceJ) { iterations++; break; }
    }
    this.diagnostics.solverIterations = iterations;
    let kinetic = 0, potential = 0, correctionWork = 0, gravityWork = 0;
    for (let id = 0; id < this.playerCount; id++) {
      const position = this.center(this.nodes[id]), velocity = { ...predictedVelocities[id] };
      const predictedCenter = this.center(predicted[id]);
      for (const axis of axes) velocity[axis] += (position[axis] - predictedCenter[axis]) / dt;
      for (const normal of contactNormals[id]) {
        const inward = Math.min(0, dot(velocity, normal)); for (const axis of axes) velocity[axis] -= normal[axis] * inward;
      }
      const contact = supportAt(position, half, this.terrain.solids);
      if (contact.support === 'ground') {
        velocity.y = ropeDelta[id].y > 0 ? Math.max(0, velocity.y) : 0;
      }
      if (contact.support === 'wall') { const inward = Math.min(0, dot(velocity, contact.normal)); for (const axis of axes) velocity[axis] -= contact.normal[axis] * inward; }
      this.bodies[id].setTranslation(position, true); this.bodies[id].setLinvel(velocity, true);
      // External PBD position corrections can change the active cuboid face at
      // a lip. Rapier's cached wall manifold otherwise survives on the bank and
      // repeatedly pushes the climber back into the hole. Refresh the identical
      // shape after our external pose commit; mass, dimensions and CCD stay
      // unchanged. Even a tiny correction can cross the active face boundary.
      const collider = this.bodies[id].collider(0); collider.setShape(collider.shape);
      Object.assign(this.nodes[id], this.harness(id)); this.previous[id] = { ...this.nodes[id] };
      kinetic += mass / 2 * dot(velocity, velocity); potential += mass * TUNING.gravity * position.y;
      gravityWork += mass * TUNING.gravity * (before[id].y - this.center(predicted[id]).y);
      correctionWork += mass / 2 * (dot(velocity, velocity) - dot(predictedVelocities[id], predictedVelocities[id]))
        + mass * TUNING.gravity * (position.y - this.center(predicted[id]).y);
      this.counters.distanceTravelledM[id] += distance(before[id], position);
      for (const solid of this.terrain.solids) this.diagnostics.maximumTerrainPenetrationM = Math.max(this.diagnostics.maximumTerrainPenetrationM, penetration(position, half, solid)?.depth ?? 0);
    }
    this.diagnostics.kineticEnergyJ = kinetic; this.diagnostics.potentialEnergyJ = potential;
    this.diagnostics.motorWorkJ += motorWork; this.diagnostics.gravityWorkJ += gravityWork; this.diagnostics.ropeContactWorkJ += correctionWork;
    const predictedKinetic = predictedVelocities.reduce((sum, v) => sum + mass / 2 * dot(v, v), 0);
    const beforeKinetic = velocities.reduce((sum, v) => sum + mass / 2 * dot(v, v), 0);
    this.diagnostics.maximumUnexplainedEnergyGainJ = Math.max(this.diagnostics.maximumUnexplainedEnergyGainJ, predictedKinetic - beforeKinetic - motorWork - gravityWork);
    this.contacts = this.bodies.map(b => supportAt(b.translation(), half, this.terrain.solids));
    for (let id = this.playerCount; id < this.nodes.length; id++) {
      // A static lip may redirect the rope but cannot launch a particle when the
      // contact projection changes its position. Remove contact-normal Verlet velocity.
      const velocity = { x: this.nodes[id].x - this.previous[id].x, y: this.nodes[id].y - this.previous[id].y, z: this.nodes[id].z - this.previous[id].z };
      for (const normal of blockingNormalsAt(this.nodes[id], particleHalf, this.terrain.solids, velocity)) {
        const amount = Math.min(0, dot(velocity, normal));
        for (const axis of axes) velocity[axis] -= amount * normal[axis];
      }
      for (const axis of axes) this.previous[id][axis] = this.nodes[id][axis] - velocity[axis];
    }
    // Coupled unilateral projection can otherwise add energy when a lip changes the
    // active constraints. Project kinetic energy back into the mechanical budget,
    // including rope particles, gravity potential and measured motor work. Keep the
    // removed work visible; this is a numerical correction, never a rescue impulse.
    let ropeKinetic = 0, ropePotential = 0;
    for (let id = this.playerCount; id < this.nodes.length; id++) {
      ropeKinetic += TUNING.rope.particleMass * distance(this.nodes[id], this.previous[id]) ** 2 / (2 * dt * dt);
      ropePotential += TUNING.rope.particleMass * TUNING.gravity * this.nodes[id].y;
    }
    const available = initialEnergy + motorWork + profile.energyToleranceJ - potential - ropePotential;
    const excess = kinetic + ropeKinetic - Math.max(0, available);
    this.diagnostics.maximumPotentialExcessJ = Math.max(this.diagnostics.maximumPotentialExcessJ, -available);
    if (excess > 0 && kinetic + ropeKinetic > 0) {
      const scale = Math.sqrt(Math.max(0, available) / (kinetic + ropeKinetic));
      this.diagnostics.energyProjectionCount++; this.diagnostics.maximumEnergyProjectionJ = Math.max(this.diagnostics.maximumEnergyProjectionJ, excess);
      for (const body of this.bodies) { const v = body.linvel(); body.setLinvel({ x: v.x * scale, y: v.y * scale, z: v.z * scale }, true); }
      for (let id = this.playerCount; id < this.nodes.length; id++) for (const axis of axes) this.previous[id][axis] = this.nodes[id][axis] - (this.nodes[id][axis] - this.previous[id][axis]) * scale;
      this.diagnostics.kineticEnergyJ *= scale * scale; this.diagnostics.ropeContactWorkJ -= excess;
    }
    for (let id = 0; id < this.playerCount; id++) {
      const v = this.bodies[id].linvel();
      this.counters.maximumSpeedMps = Math.max(this.counters.maximumSpeedMps, Math.sqrt(dot(v, v)));
      this.counters.maximumJoltMps2 = Math.max(this.counters.maximumJoltMps2, distance(v, velocities[id]) / dt);
    }
    this.routeRope();
    this.updateSpans(dt); this.updateBridges(velocities, ropeDelta, dt); this.updateIncidents(inputs, before, ropeDelta, dt);
    this.lastInputs = inputs.map(p => ({ ...p }));
  }

  private constrain(span: Span, a: number, b: number, maximum: number, traction: number[], ropeDelta: Vec3[], dt: number) {
    const p = this.nodes[a], q = this.nodes[b];
    const material = span.nodes.indexOf(b) === span.nodes.indexOf(a) + 1;
    const route = material ? ropeRoute(p, q, this.terrain.solids) : ropeReach(p, q, this.terrain.solids, maximum);
    if (route.length <= maximum) return;
    const toward = (from: Vec3, to: Vec3) => { const d = distance(from, to); return d ? { x: (to.x - from.x) / d, y: (to.y - from.y) / d, z: (to.z - from.z) / d } : zero(); };
    const directions = [toward(p, route.points[1]), toward(q, route.points.at(-2)!)];
    const masses = [a, b].map(id => id < this.playerCount ? TUNING.body.mass : TUNING.rope.particleMass);
    const weights = [a, b].map((id, k) => {
      const mass = masses[k], w = { x: 1 / mass, y: 1 / mass, z: 1 / mass };
      this.nodeNormals[id] = blockingNormalsAt(id < this.playerCount ? this.center(this.nodes[id]) : this.nodes[id],
        id < this.playerCount ? half : particleHalf, this.terrain.solids, directions[k]);
      if (id < this.playerCount && this.brace[id] && this.contacts[id].support === 'ground' && traction[id] > 0) {
        w.x /= FAMILIES[this.family].braceMassMultiplier; w.z /= FAMILIES[this.family].braceMassMultiplier;
      }
      for (const normal of this.nodeNormals[id]) for (const axis of axes) if (normal[axis]) w[axis] = 0;
      return w;
    });
    const multiplier = () => route.points.length === 2
      ? distanceMultiplier({ x: q.x - p.x, y: q.y - p.y, z: q.z - p.z },
        { x: weights[0].x + weights[1].x, y: weights[0].y + weights[1].y, z: weights[0].z + weights[1].z }, maximum)
      : (route.length - maximum) / Math.max(Number.MIN_VALUE, weights.reduce((sum, w, k) => sum + axes.reduce((s, axis) => s + w[axis] * directions[k][axis] ** 2, 0), 0));
    let lambda = multiplier();
    const demand = (k: number) => lambda * masses[k] / dt * Math.hypot(...(['x', 'z'] as const)
      .map(axis => directions[k][axis] * (weights[k][axis] ? 1 / masses[k] - weights[k][axis] : 0)));
    if ([a, b].some((id, k) => id < this.playerCount && demand(k) > traction[id])) {
      weights.forEach((w, k) => { for (const axis of axes) if (w[axis]) w[axis] = 1 / masses[k]; }); lambda = multiplier();
    }
    if (!Number.isFinite(lambda) || !lambda) return;
    const trial = [{ ...p }, { ...q }];
    let accepted = false;
    for (let search = 0; search <= TUNING.phase2.ropeProjectionLineSearchSteps; search++) {
      [p, q].forEach((node, k) => { for (const axis of axes) trial[k][axis] = node[axis] + lambda * weights[k][axis] * directions[k][axis]; });
      const length = (material ? ropeRoute(trial[0], trial[1], this.terrain.solids) : ropeReach(trial[0], trial[1], this.terrain.solids, maximum)).length;
      if (length <= route.length) { accepted = true; break; } lambda *= 0.5;
    }
    if (!accepted) return;
    [a, b].forEach((id, k) => {
      if (id < this.playerCount) traction[id] -= demand(k);
      for (const axis of axes) {
        const correction = trial[k][axis] - this.nodes[id][axis]; this.nodes[id][axis] = trial[k][axis];
        if (id < this.playerCount) ropeDelta[id][axis] += correction;
        const physical = lambda * directions[k][axis] / masses[k];
        if (id < this.playerCount && !weights[k][axis]) this.normalLoadDelta[id][axis] += physical;
        if (id === span.a) span.corrections[0][axis] += physical;
        if (id === span.b) span.corrections[1][axis] += physical;
      }
    });
  }
  private separateBodies() {
    for (let a = 0; a < this.playerCount; a++) for (let b = a + 1; b < this.playerCount; b++) {
      const p = this.nodes[a], q = this.nodes[b];
      const depths = { x: TUNING.body.width - Math.abs(p.x - q.x), y: TUNING.body.height - Math.abs(p.y - q.y), z: TUNING.body.depth - Math.abs(p.z - q.z) };
      if (axes.some(axis => depths[axis] <= 0)) continue;
      const axis = axes.reduce((best, key) => depths[key] < depths[best] ? key : best, 'x');
      const correction = (depths[axis] + TUNING.phase2.collisionSkin) / 2 * (p[axis] < q[axis] ? -1 : 1);
      p[axis] += correction; q[axis] -= correction;
    }
  }
  private constrainPotential(ceiling: number) {
    // A passive constraint cannot leave potential alone above total available
    // mechanical energy. Solve this half-space alongside rope and contacts,
    // before reconstructing velocities; velocity scaling cannot repair it.
    let potential = 0, movableMass = 0;
    const movable = this.nodes.map((p, id) => {
      const body = id < this.playerCount, mass = body ? TUNING.body.mass : TUNING.rope.particleMass;
      potential += mass * TUNING.gravity * (body ? this.center(p).y : p.y);
      const free = !blockingNormalsAt(body ? this.center(p) : p, body ? half : particleHalf, this.terrain.solids, { x: 0, y: -1, z: 0 }).length;
      if (free) movableMass += mass;
      return free;
    });
    const excess = potential - ceiling;
    if (excess > 0 && movableMass > 0) {
      const correction = excess / (movableMass * TUNING.gravity);
      this.nodes.forEach((p, id) => {
        if (!movable[id]) return;
        const body = id < this.playerCount, from = body ? this.center(p) : p;
        const projected = projectMotion(from, { ...from, y: from.y - correction }, body ? half : particleHalf, this.terrain.solids).position;
        p.y = projected.y - (body ? bodyHalf.y - TUNING.body.harnessHeight : 0);
      });
    }
    return Math.max(0, excess);
  }
  private routeRope() {
    this.points.length = 0;
    for (const span of this.spans) {
      span.startPoint = this.points.length; this.points.push(this.nodes[span.nodes[0]]);
      for (let j = 1; j < span.nodes.length; j++) {
        const route = ropeRoute(this.nodes[span.nodes[j - 1]], this.nodes[span.nodes[j]], this.terrain.solids);
        this.points.push(...route.points.slice(1));
      }
      span.endPoint = this.points.length - 1;
    }
  }
  private segmentError() {
    let error = 0; const segment = FAMILIES[this.family].ropeLength / TUNING.rope.segments;
    for (const span of this.spans) for (let j = 1; j < span.nodes.length; j++) error = Math.max(error, ropeRoute(this.nodes[span.nodes[j - 1]], this.nodes[span.nodes[j]], this.terrain.solids).length - segment);
    return error;
  }
  private updateSpans(dt: number) {
    let taut = false; this.tensionN = 0; this.tension = 0;
    for (const span of this.spans) {
      span.tensionN = Math.max(...span.corrections.map(v => Math.sqrt(dot(v, v)) * TUNING.body.mass / (dt * dt)));
      span.tension += (Math.min(1, span.tensionN / TUNING.rope.tensionReferenceN) - span.tension) * (1 - Math.exp(-dt / TUNING.rope.tensionSmoothingSeconds));
      this.tensionN = Math.max(this.tensionN, span.tensionN); this.tension = Math.max(this.tension, span.tension);
      const d = distance(this.nodes[span.a], this.nodes[span.b]), nowTaut = d >= FAMILIES[this.family].ropeLength * TUNING.rope.tautFraction;
      if (nowTaut && !span.wasTaut) this.counters.tautTransitions++; span.wasTaut = nowTaut; taut ||= nowTaut;
      this.counters.maximumSpanErrorM = Math.max(this.counters.maximumSpanErrorM, d - FAMILIES[this.family].ropeLength);
    }
    if (taut) this.counters.totalTensionSeconds += dt;
    this.counters.maximumSegmentErrorM = Math.max(this.counters.maximumSegmentErrorM, this.segmentError());
    for (let a = 0; a < this.playerCount; a++) for (let b = a + 1; b < this.playerCount; b++) {
      const p = this.nodes[a], q = this.nodes[b];
      this.diagnostics.maximumBodyOverlapM = Math.max(this.diagnostics.maximumBodyOverlapM,
        Math.min(TUNING.body.width - Math.abs(p.x - q.x), TUNING.body.height - Math.abs(p.y - q.y), TUNING.body.depth - Math.abs(p.z - q.z)));
    }
  }
  private updateBridges(velocities: Vec3[], ropeDelta: Vec3[], dt: number) {
    const observer = this.bridgeLoadObserver;
    observer?.beginSubstep();
    const loads = new Map<number, number>();
    for (let id = 0; id < this.playerCount; id++) {
      if (this.contacts[id].support !== 'ground') continue;
      const p = this.bodies[id].translation();
      const supports = this.terrain.solids.map(s => ({ solid: s, area: Math.max(0, Math.min(p.x + half.x, s.maxX) - Math.max(p.x - half.x, s.minX))
        * Math.max(0, Math.min(p.z + half.z, s.maxZ) - Math.max(p.z - half.z, s.minZ)) })).filter(s => s.area > 0 && Math.abs(p.y - half.y - s.solid.maxY) <= TUNING.phase2.groundContactTolerance);
      const area = supports.reduce((sum, s) => sum + s.area, 0);
      const load = TUNING.body.mass * (TUNING.gravity + Math.max(0, -velocities[id].y) / dt
        + Math.max(0, -ropeDelta[id].y - this.normalLoadDelta[id].y) / (dt * dt));
      for (const s of supports) if (s.solid.bridgeId !== undefined) {
        loads.set(s.solid.bridgeId, (loads.get(s.solid.bridgeId) ?? 0) + load * s.area / area);
        observer?.observeContribution({ bridgeId: s.solid.bridgeId, playerId: id, supportSolidId: s.solid.id,
          overlapAreaM2: s.area, totalSupportAreaM2: area, massKg: TUNING.body.mass, gravityMps2: TUNING.gravity,
          dtSeconds: dt, arrivalVelocityY: velocities[id].y, ropeDeltaY: ropeDelta[id].y,
          normalLoadDeltaY: this.normalLoadDelta[id].y, bodyLoadN: load, accumulatedBridgeLoadN: loads.get(s.solid.bridgeId)! });
      }
    }
    for (const bridge of this.terrain.state.bridges) {
      if (bridge.collapsed) continue;
      const ratio = (loads.get(bridge.id) ?? 0) / this.terrain.capacities.get(bridge.id)!;
      const overload = Math.max(0, (this.overload.get(bridge.id) ?? 0) + (ratio > 1 ? dt : -dt * TUNING.phase2.bridgeRecoveryRate));
      this.overload.set(bridge.id, overload);
      const wasVisible = bridge.cue > 0;
      bridge.cue = clamp((ratio - TUNING.phase2.bridgeCueStartFraction) / (1 - TUNING.phase2.bridgeCueStartFraction), 0, 1);
      if (!wasVisible && bridge.cue > 0) {
        this.event('cue', [], [bridge.id]);
        observer?.observeDecision({ kind: 'cue', tick: this.tick,
          substep: this.substepNumber % (TUNING.physicsHz / this.tickHz), physicsStep: this.substepNumber,
          tickHz: this.tickHz, physicsHz: TUNING.physicsHz, phase: 'post-integration-before-warning-update',
          bridgeId: bridge.id, cueEventId: this.events.at(-1)!.id, loadN: loads.get(bridge.id) ?? 0,
          capacityN: this.terrain.capacities.get(bridge.id)!, ratio, cue: bridge.cue, overloadSeconds: overload,
          warnedSeconds: this.warned.get(bridge.id) ?? 0, queuedCollapse: this.queuedCollapses.has(bridge.id) });
      }
      this.warned.set(bridge.id, bridge.cue > 0 ? (this.warned.get(bridge.id) ?? 0) + dt : 0);
      if (overload >= TUNING.phase2.bridgeOverloadSeconds && this.warned.get(bridge.id)! >= TUNING.phase2.bridgeWarningSeconds) {
        this.queuedCollapses.add(bridge.id);
        observer?.observeDecision({ kind: 'collapse-queued', tick: this.tick,
          substep: this.substepNumber % (TUNING.physicsHz / this.tickHz), physicsStep: this.substepNumber,
          tickHz: this.tickHz, physicsHz: TUNING.physicsHz, phase: 'post-integration-after-warning-update',
          bridgeId: bridge.id, cueEventId: null, loadN: loads.get(bridge.id) ?? 0,
          capacityN: this.terrain.capacities.get(bridge.id)!, ratio, cue: bridge.cue, overloadSeconds: overload,
          warnedSeconds: this.warned.get(bridge.id)!, queuedCollapse: this.queuedCollapses.has(bridge.id) });
      }
    }
    observer?.endSubstep();
  }
  private updateIncidents(inputs: Move[], before: Vec3[], ropeDelta: Vec3[], dt: number) {
    for (let id = 0; id < this.playerCount; id++) {
      const body = this.bodies[id], p = body.translation(), v = body.linvel(), previous = this.states[id];
      if (p.y < TUNING.phase2.terminalY) {
        this.states[id] = 'lost'; if (previous !== 'lost') this.event('lost', [id]); continue;
      }
      if (this.contacts[id].support === 'ground') {
        if (this.active?.playerIds.includes(id)) {
          const area = this.terrain.solids.reduce((sum, s) => Math.abs(p.y - half.y - s.maxY) <= TUNING.phase2.groundContactTolerance
            ? sum + Math.max(0, Math.min(p.x + half.x, s.maxX) - Math.max(p.x - half.x, s.minX))
              * Math.max(0, Math.min(p.z + half.z, s.maxZ) - Math.max(p.z - half.z, s.minZ)) : sum, 0);
          if (area < TUNING.body.width * TUNING.body.depth * TUNING.phase2.recoverySupportFraction) {
            this.recoverySeconds[id] = 0; continue;
          }
        }
        this.recoverySeconds[id] += dt;
        if (!this.active?.playerIds.includes(id) || this.recoverySeconds[id] >= TUNING.phase2.recoveryConfirmSeconds) this.states[id] = 'safe';
        continue;
      }
      this.recoverySeconds[id] = 0;
      if (p.y - half.y >= -TUNING.phase2.fallDepth) continue;
      if (!this.active) {
        this.active = { id: this.nextIncidentId++, fallTick: this.tick, playerIds: [], status: 'active', recoveredTick: null,
          cascades: 0, firstAttemptSuccess: true, roleActiveSeconds: Array(this.playerCount).fill(0),
          roleIdleSeconds: Array(this.playerCount).fill(0), staticHoldSeconds: Array(this.playerCount).fill(0) };
        this.incidents.push(this.active); this.diagnostics.incidentsStarted++;
        if (this.diagnostics.firstFallSeconds === null) this.diagnostics.firstFallSeconds = this.time();
        if (this.incidents.length > TUNING.phase2.maximumIncidents) { this.incidents.shift(); this.diagnostics.incidentsTruncated = true; }
      }
      if (!this.active.playerIds.includes(id)) {
        if (this.active.playerIds.length) { this.active.cascades++; this.active.firstAttemptSuccess = false; this.diagnostics.cascades++; }
        this.active.playerIds.push(id); this.event('fall', [id]);
      }
      const upward = ropeDelta[id].y > 0 && v.y >= -TUNING.phase2.catchSpeed;
      this.catchSeconds[id] = upward ? this.catchSeconds[id] + dt : 0;
      const climbing = this.contacts[id].support === 'wall' && v.y > TUNING.phase2.catchSpeed;
      if (climbing) this.states[id] = 'climbing';
      else if (this.catchSeconds[id] >= TUNING.phase2.catchConfirmSeconds) this.states[id] = 'hanging';
      else if (this.contacts[id].support === 'wall' && Math.abs(v.y) <= TUNING.phase2.catchSpeed) this.states[id] = 'hanging';
      else if (v.y < -TUNING.phase2.fallSpeed || previous === 'safe') this.states[id] = 'falling';
      if (this.states[id] !== previous && (this.states[id] === 'hanging' || this.states[id] === 'climbing')) {
        this.event(this.states[id] === 'hanging' ? 'catch' : 'climb', [id]);
        for (const span of this.spans) if (span.a === id || span.b === id) span.highlightUntil = this.time() + TUNING.phase2.catchHighlightSeconds;
      }
      if ((previous === 'hanging' || previous === 'climbing') && this.states[id] === 'falling') { this.active.firstAttemptSuccess = false; this.event('relapse', [id]); }
    }
    if (this.active) {
      for (let id = 0; id < this.playerCount; id++) {
        const input = inputs[id], last = this.lastInputs[id], position = this.bodies[id].translation();
        const motion = this.contacts[id].support === 'ground' ? Math.hypot(position.x - before[id].x, position.z - before[id].z) / dt : distance(before[id], position) / dt;
        const changed = input.brace !== last.brace || Math.hypot(input.x - last.x, input.z - last.z) > TUNING.phase2.inputChangeEpsilon;
        const loaded = this.spans.some(s => (s.a === id || s.b === id) && s.tensionN > TUNING.body.mass * TUNING.gravity * TUNING.phase2.wallRopeSupportFraction);
        const takingSlack = this.spans.some(s => {
          const other = s.a === id ? s.b : s.b === id ? s.a : -1;
          if (other < 0) return false;
          const separation = distance(before[id], before[other]);
          const contribution = separation ? axes.reduce((sum, axis) => sum + (position[axis] - before[id][axis])
            * (before[id][axis] - before[other][axis]), 0) / separation / dt : 0;
          return separation < FAMILIES[this.family].ropeLength - TUNING.phase2.rescueSlackTargetM
            && contribution > TUNING.phase2.usefulMotionMps
            && (distance(position, this.bodies[other].translation()) - separation) / dt > TUNING.phase2.usefulMotionMps;
        });
        // A planted catch is useful while a casualty is actually falling. Once
        // caught, an unchanged stationary brace no longer counts as an active
        // rescue role. This does not credit passive drifting or an idle body.
        const catching = input.brace && loaded && this.active.playerIds.some(casualty => this.states[casualty] === 'falling');
        const useful = catching || ((input.x || input.z) && motion > TUNING.phase2.usefulMotionMps && (loaded || takingSlack || this.states[id] === 'climbing')) || changed && loaded;
        if (useful) this.active.roleActiveSeconds[id] += dt; else this.active.roleIdleSeconds[id] += dt;
        if (input.brace && !input.x && !input.z && !changed) this.active.staticHoldSeconds[id] += dt;
      }
      if (this.active.playerIds.every(id => this.states[id] === 'safe') && this.states.every(s => s === 'safe')) {
        this.active.status = 'recovered'; this.active.recoveredTick = this.tick; this.diagnostics.incidentsRecovered++;
        this.event('recovery', this.active.playerIds); this.active = undefined;
      }
    }
    if (this.states.every(s => s === 'lost')) {
      this.failRun();
    } else if (this.scene === 'crossing' && this.bodies.every((b, id) => b.translation().z >= TUNING.phase2.finishZ && this.states[id] === 'safe')) {
      this.runStatus = 'complete'; this.runEndedAt = this.time() + dt; this.event('complete', this.bodies.map((_, id) => id));
    }
  }
  private failRun() {
    this.runStatus = 'failed'; this.runEndedAt = this.time();
    if (this.active) { this.active.status = 'failed'; this.active.firstAttemptSuccess = false; this.diagnostics.incidentsFailed++; this.active = undefined; }
  }
  snapshot(epoch = 0): SimulationSnapshot {
    const spans = this.spans.map(s => ({ id: s.id, a: s.a, b: s.b, startPoint: s.startPoint, endPoint: s.endPoint,
      length: FAMILIES[this.family].ropeLength, tension: s.tension, tensionN: s.tensionN,
      slackM: Math.max(0, FAMILIES[this.family].ropeLength - distance(this.nodes[s.a], this.nodes[s.b])), catchHighlight: s.highlightUntil > this.time() }));
    return { version: TUNING.version, epoch, tick: this.tick, serverTime: Date.now(), seed: this.seed, family: this.family,
      tickHz: this.tickHz, paused: false, scene: this.scene, playerCount: this.playerCount,
      players: this.bodies.map((b, id) => ({ id, position: { ...b.translation() }, velocity: { ...b.linvel() }, brace: this.brace[id],
        connected: false, label: `Climber ${id + 1}`, ackSeq: -1, support: this.contacts[id].support,
        rescueState: this.states[id], activeIncidentId: this.active?.playerIds.includes(id) ? this.active.id : null })),
      rope: { points: this.points.map(p => ({ ...p })), length: this.length, tension: this.tension, tensionN: this.tensionN,
        slackM: spans.reduce((sum, span) => sum + span.slackM, 0), spans },
      terrain: structuredClone(this.terrain.state), incidents: structuredClone(this.incidents),
      events: this.events.map(event => ({ ...structuredClone(event), epoch })), diagnostics: { ...this.diagnostics },
      counters: { ...this.counters, distanceTravelledM: [...this.counters.distanceTravelledM] },
      run: { status: this.runStatus, elapsedSeconds: this.runEndedAt ?? this.time(), progress: this.scene === 'crossing'
        ? clamp(Math.min(...this.bodies.map(b => b.translation().z)) / TUNING.phase2.finishZ, 0, 1) : 0,
      reason: this.runStatus === 'failed' ? 'terminal-boundary' : this.runStatus === 'complete' ? 'finish' : null } };
  }
  dispose() { this.world.free(); }
}
