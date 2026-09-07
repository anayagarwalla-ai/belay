import RAPIER from '@dimforge/rapier3d-compat';
import { FAMILIES, TUNING, type Family, type TickHz } from '../tuning';
import { REST, normalizeMove, type Move, type SceneOptions, type SimCounters, type Snapshot, type Tape, type Vec3 } from './protocol';
import { motorVelocity } from './movement';

let initialization: Promise<void> | undefined;
export function initializePhysics() { return initialization ??= RAPIER.init(); }
const copy = (p: Vec3): Vec3 => ({ x: p.x, y: p.y, z: p.z });
const distance = (a: Vec3, b: Vec3) => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);

/** Real particle chain with unilateral length constraints. The endpoint span constraint is
 * redundant on an unobstructed plane: it accelerates convergence, never stretches the rope.
 * No spring forces, no client state, no presentation state enters this world. */
export class BelaySimulation {
  readonly world: RAPIER.World;
  private floor: RAPIER.Collider;
  readonly bodies: RAPIER.RigidBody[] = [];
  readonly points: Vec3[] = [];
  private previous: Vec3[] = [];
  private inverseMass: number[] = [];
  readonly seed: number;
  readonly family: Family;
  readonly tickHz: TickHz;
  readonly length: number;
  readonly tape: Tape;
  tick = 0;
  tensionN = 0;
  tension = 0;
  private wasTaut = false;
  private brace: boolean[] = [false, false];
  readonly counters: SimCounters = {
    ticks: 0, elapsedSeconds: 0, maximumSpanErrorM: 0, maximumSegmentErrorM: 0,
    maximumSpeedMps: 0, maximumJoltMps2: 0, tautTransitions: 0,
    totalTensionSeconds: 0, distanceTravelledM: [0, 0],
  };

  constructor(options: SceneOptions = {}) {
    this.seed = options.seed ?? TUNING.seed;
    this.family = options.family ?? 'balanced';
    this.tickHz = options.tickHz ?? TUNING.tickHz;
    this.length = FAMILIES[this.family].ropeLength;
    this.tape = { version: TUNING.version, seed: this.seed, family: this.family, tickHz: this.tickHz, truncated: false, frames: [] };
    this.world = new RAPIER.World({ x: 0, y: -TUNING.gravity, z: 0 });
    this.world.timestep = 1 / TUNING.physicsHz;
    this.floor = this.world.createCollider(RAPIER.ColliderDesc.cuboid(TUNING.terrain.halfExtent, TUNING.body.height / 2, TUNING.terrain.halfExtent)
      .setTranslation(0, -TUNING.body.height / 2, 0).setFriction(TUNING.body.groundFriction));
    for (let i = 0; i < TUNING.players; i++) {
      const body = this.world.createRigidBody(RAPIER.RigidBodyDesc.dynamic()
        .setTranslation((i - 0.5) * TUNING.rope.initialSpacing, TUNING.body.height / 2, 0)
        .lockRotations().setCanSleep(false).setCcdEnabled(true));
      this.world.createCollider(RAPIER.ColliderDesc.cuboid(TUNING.body.width / 2, TUNING.body.height / 2, TUNING.body.depth / 2)
        .setMass(TUNING.body.mass).setFriction(TUNING.body.groundFriction).setRestitution(0), body);
      this.bodies.push(body);
    }
    const a = this.harness(0), b = this.harness(1);
    for (let i = 0; i <= TUNING.rope.segments; i++) {
      const t = i / TUNING.rope.segments;
      // Polynomial initialization avoids platform-dependent transcendental world generation.
      const curve = 4 * t * (1 - t);
      const p = { x: a.x + (b.x - a.x) * t, y: Math.max(TUNING.rope.floorHeight, a.y - curve * TUNING.rope.initialSag),
        z: a.z + curve * TUNING.rope.initialBend * (this.seed % 2 ? 1 : -1) };
      this.points.push(p); this.previous.push(copy(p));
      this.inverseMass.push(1 / TUNING.rope.particleMass);
    }
  }

  private harness(index: number): Vec3 {
    const p = this.bodies[index].translation();
    return { x: p.x, y: p.y - TUNING.body.height / 2 + TUNING.body.harnessHeight, z: p.z };
  }

  step(inputs: Move[], record = false) {
    const frame = this.bodies.map((_, i) => normalizeMove(inputs[i] ?? REST));
    if (record) {
      if (this.tape.frames.length < this.tickHz * TUNING.network.maximumTapeSeconds) this.tape.frames.push({ tick: this.tick, inputs: frame.map(v => ({ ...v })) });
      else this.tape.truncated = true;
    }
    for (let substep = 0; substep < TUNING.physicsHz / this.tickHz; substep++) this.substep(frame);
    this.tick++;
    this.counters.ticks = this.tick;
    this.counters.elapsedSeconds = this.tick / this.tickHz;
  }

  private substep(inputs: Move[]) {
    const dt = 1 / TUNING.physicsHz;
    const positionsBefore = this.bodies.map(b => copy(b.translation()));
    const velocitiesBefore = this.bodies.map(b => copy(b.linvel()));
    this.floor.setTranslation({ x: (positionsBefore[0].x + positionsBefore[1].x) / 2,
      y: -TUNING.body.height / 2, z: (positionsBefore[0].z + positionsBefore[1].z) / 2 });
    this.brace = inputs.map(i => i.brace);
    for (let i = 0; i < this.bodies.length; i++) {
      this.bodies[i].setLinvel(motorVelocity(copy(this.bodies[i].linvel()), inputs[i], dt, this.family), true);
    }
    this.world.step();
    const predicted = this.bodies.map((_, i) => this.harness(i));
    const last = this.points.length - 1;
    this.points[0] = copy(predicted[0]); this.points[last] = copy(predicted[1]);
    this.inverseMass[0] = 1 / (TUNING.body.mass * (inputs[0].brace ? FAMILIES[this.family].braceMassMultiplier : 1));
    this.inverseMass[last] = 1 / (TUNING.body.mass * (inputs[1].brace ? FAMILIES[this.family].braceMassMultiplier : 1));
    const damping = Math.exp(-FAMILIES[this.family].ropeDrag * dt);
    for (let i = 1; i < last; i++) {
      const p = this.points[i], prev = this.previous[i];
      const old = copy(p);
      p.x += (p.x - prev.x) * damping;
      p.y = Math.max(TUNING.rope.floorHeight, p.y + (p.y - prev.y) * damping - TUNING.gravity * dt * dt);
      p.z += (p.z - prev.z) * damping;
      this.previous[i] = old;
    }
    const segmentLength = this.length / TUNING.rope.segments;
    for (let iteration = 0; iteration < TUNING.solverIterations; iteration++) {
      for (let k = 0; k < last; k++) {
        const i = iteration % 2 ? last - k - 1 : k;
        this.constrain(i, i + 1, segmentLength);
      }
      this.constrain(0, last, this.length);
      // Long-range unilateral constraints are implied by the chain. They propagate a taut
      // jolt without requiring the iteration count to grow with the particle count.
      for (let i = 1; i < last; i++) {
        this.constrain(0, i, i * segmentLength);
        this.constrain(i, last, (last - i) * segmentLength);
      }
      for (let i = 1; i < last; i++) this.points[i].y = Math.max(TUNING.rope.floorHeight, this.points[i].y);
    }
    let force = 0;
    for (let i = 0; i < this.bodies.length; i++) {
      const node = i === 0 ? 0 : last;
      const p = this.points[node], base = predicted[i];
      const dx = p.x - base.x, dy = p.y - base.y, dz = p.z - base.z;
      force = Math.max(force, Math.hypot(dx, dy, dz) / this.inverseMass[node] / (dt * dt));
      const body = this.bodies[i], at = body.translation(), velocity = body.linvel();
      const correctedY = Math.max(TUNING.body.height / 2, at.y + dy);
      body.setTranslation({ x: at.x + dx, y: correctedY, z: at.z + dz }, true);
      body.setLinvel({ x: velocity.x + dx / dt, y: Math.max(0, velocity.y + dy / dt), z: velocity.z + dz / dt }, true);
      this.points[node] = this.harness(i);
      this.previous[node] = copy(this.points[node]);
      const final = body.translation(), speed = body.linvel();
      this.counters.distanceTravelledM[i] += distance(positionsBefore[i], final);
      this.counters.maximumSpeedMps = Math.max(this.counters.maximumSpeedMps, Math.hypot(speed.x, speed.z));
      this.counters.maximumJoltMps2 = Math.max(this.counters.maximumJoltMps2,
        Math.hypot(speed.x - velocitiesBefore[i].x, speed.z - velocitiesBefore[i].z) / dt);
    }
    this.tensionN = force;
    this.tension += (Math.min(1, force / TUNING.rope.tensionReferenceN) - this.tension)
      * (1 - Math.exp(-dt / TUNING.rope.tensionSmoothingSeconds));
    const span = distance(this.points[0], this.points[last]);
    const taut = span / this.length >= TUNING.rope.tautFraction;
    if (taut && !this.wasTaut) this.counters.tautTransitions++;
    this.wasTaut = taut;
    if (taut) this.counters.totalTensionSeconds += dt;
    this.counters.maximumSpanErrorM = Math.max(this.counters.maximumSpanErrorM, span - this.length);
    for (let i = 0; i < last; i++) this.counters.maximumSegmentErrorM = Math.max(this.counters.maximumSegmentErrorM,
      distance(this.points[i], this.points[i + 1]) - segmentLength);
  }

  private constrain(a: number, b: number, maximum: number) {
    const p = this.points[a], q = this.points[b];
    const dx = q.x - p.x, dy = q.y - p.y, dz = q.z - p.z;
    const d = Math.hypot(dx, dy, dz);
    if (d <= maximum) return; // Slack never pushes bodies apart.
    const sum = this.inverseMass[a] + this.inverseMass[b];
    const scale = (d - maximum) / (d * sum);
    const wa = scale * this.inverseMass[a], wb = scale * this.inverseMass[b];
    p.x += dx * wa; p.y += dy * wa; p.z += dz * wa;
    q.x -= dx * wb; q.y -= dy * wb; q.z -= dz * wb;
  }

  snapshot(epoch = 0): Snapshot {
    const last = this.points.length - 1;
    return {
      version: TUNING.version, epoch, tick: this.tick, serverTime: Date.now(), seed: this.seed,
      family: this.family, tickHz: this.tickHz, paused: false,
      players: this.bodies.map((b, id) => ({ id, position: copy(b.translation()), velocity: copy(b.linvel()),
        brace: this.brace[id], connected: false, label: `Climber ${id + 1}`, ackSeq: -1 })),
      rope: { points: this.points.map(copy), length: this.length, tension: this.tension, tensionN: this.tensionN,
        slackM: Math.max(0, this.length - distance(this.points[0], this.points[last])) },
      counters: { ...this.counters, distanceTravelledM: [...this.counters.distanceTravelledM] },
    };
  }
  dispose() { this.world.free(); }
}
