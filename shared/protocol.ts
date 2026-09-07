import { TUNING, type Family, type TickHz } from '../tuning';

export type Vec3 = { x: number; y: number; z: number };
export type Move = { x: number; z: number; brace: boolean };
export const REST: Move = Object.freeze({ x: 0, z: 0, brace: false });
export type InputFrame = Move & { seq: number };
export type SceneOptions = { seed?: number; family?: Family; tickHz?: TickHz };
export type PlayerState = {
  id: number; position: Vec3; velocity: Vec3; brace: boolean; connected: boolean;
  label: string; ackSeq: number;
};
export type SimCounters = {
  ticks: number; elapsedSeconds: number; maximumSpanErrorM: number; maximumSegmentErrorM: number;
  maximumSpeedMps: number; maximumJoltMps2: number; tautTransitions: number;
  totalTensionSeconds: number; distanceTravelledM: number[];
};
export type Snapshot = {
  version: string; epoch: number; tick: number; serverTime: number; seed: number; family: Family;
  tickHz: TickHz; paused: boolean; players: PlayerState[];
  rope: { points: Vec3[]; length: number; tension: number; tensionN: number; slackM: number };
  counters: SimCounters;
};
export type Tape = {
  version: string; seed: number; family: Family; tickHz: TickHz;
  truncated: boolean;
  frames: { tick: number; inputs: Move[] }[];
};
export type DebugCommand = { requestId: string; command: 'setSeed' | 'loadScene' | 'stepTicks' | 'pause' | 'resume' | 'counters' | 'tape'; value?: unknown };
export type ClientConfig = { roomId: string; token: string; operator: boolean; endpoint: string };

/** Reject invalid ownership/time/state fields rather than accidentally accepting client state. */
export function parseInput(value: unknown): InputFrame | null {
  if (!value || typeof value !== 'object') return null;
  const v = value as Record<string, unknown>;
  if (Object.keys(v).some(k => !['seq', 'x', 'z', 'brace'].includes(k))) return null;
  if (!Number.isSafeInteger(v.seq) || (v.seq as number) < 0 || typeof v.brace !== 'boolean') return null;
  if (typeof v.x !== 'number' || typeof v.z !== 'number' || !Number.isFinite(v.x) || !Number.isFinite(v.z)) return null;
  if (Math.abs(v.x) > 1 || Math.abs(v.z) > 1) return null;
  const length = Math.hypot(v.x, v.z);
  return { seq: v.seq as number, x: v.x / Math.max(1, length), z: v.z / Math.max(1, length), brace: v.brace };
}
export function normalizeMove(move: Move): Move {
  const d = Math.max(1, Math.hypot(move.x, move.z));
  return { x: move.x / d, z: move.z / d, brace: move.brace };
}
export const simulationVersion = () => TUNING.version;
