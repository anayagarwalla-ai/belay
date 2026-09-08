import RAPIER from '@dimforge/rapier3d-compat';
import { TUNING, isFamily } from '../tuning';
import { isScene, type Move, type SceneOptions } from './protocol';
import { FlatSimulation } from './flat-simulation';
import { ExpeditionSimulation } from './expedition-simulation';
import type { BridgeLoadObserver } from './bridge-load-observer';

let initialization: Promise<void> | undefined;
export function initializePhysics() { return initialization ??= RAPIER.init(); }

/** Flat/two retains the exact Phase 1 solver. All other approved fixtures use the
 * shared-harness terrain solver; callers always receive the complete current schema. */
export class BelaySimulation {
  private readonly engine: FlatSimulation | ExpeditionSimulation;
  constructor(options: SceneOptions = {}, bridgeLoadObserver?: BridgeLoadObserver) {
    if (options.scene !== undefined && !isScene(options.scene)) throw new Error('Unknown scene.');
    if (options.playerCount !== undefined && (!Number.isInteger(options.playerCount) || options.playerCount < TUNING.players || options.playerCount > TUNING.hardCap)) throw new Error('Player count must be an integer from two through six.');
    if (options.tickHz !== undefined && options.tickHz !== 30 && options.tickHz !== 60) throw new Error('Tick rate must be 30 or 60.');
    if (options.family !== undefined && !isFamily(options.family)) throw new Error('Unknown family.');
    if (options.seed !== undefined && (!Number.isSafeInteger(options.seed) || options.seed < 0 || options.seed > 0xffffffff)) throw new Error('Seed must be an unsigned 32-bit integer.');
    this.engine = (options.scene ?? 'flat') === 'flat' && (options.playerCount ?? TUNING.players) === TUNING.players
      ? new FlatSimulation(options) : new ExpeditionSimulation(options, bridgeLoadObserver);
  }
  get world() { return this.engine.world; }
  get bodies() { return this.engine.bodies; }
  get points() { return this.engine.points; }
  get scene() { return this.engine.scene; }
  get playerCount() { return this.engine.playerCount; }
  get seed() { return this.engine.seed; }
  get family() { return this.engine.family; }
  get tickHz() { return this.engine.tickHz; }
  get length() { return this.engine.length; }
  get tape() { return this.engine.tape; }
  get tick() { return this.engine.tick; }
  get tension() { return this.engine.tension; }
  get tensionN() { return this.engine.tensionN; }
  get counters() { return this.engine.counters; }
  step(inputs: Move[], record = false) { this.engine.step(inputs, record); }
  snapshot(epoch = 0) { return this.engine.snapshot(epoch); }
  dispose() { this.engine.dispose(); }
}
