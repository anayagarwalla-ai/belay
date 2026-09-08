import { TUNING } from '../tuning';

/** Operands and results from the existing support-area load calculation. */
export type BridgeLoadContributionInput = {
  bridgeId: number; playerId: number; supportSolidId: number;
  overlapAreaM2: number; totalSupportAreaM2: number;
  massKg: number; gravityMps2: number; dtSeconds: number;
  arrivalVelocityY: number; ropeDeltaY: number; normalLoadDeltaY: number;
  bodyLoadN: number; accumulatedBridgeLoadN: number;
};
export type BridgeLoadContribution = BridgeLoadContributionInput & {
  overlapFraction: number; weightN: number; arrivalTermMps2: number;
  downwardCorrectionTermMps2: number; arrivalN: number; downwardCorrectionN: number;
  bridgeShareLoadN: number;
};
export type BridgeLoadReceiptInput = {
  kind: 'cue' | 'collapse-queued';
  tick: number; substep: number; physicsStep: number; tickHz: number; physicsHz: number;
  phase: 'post-integration-before-warning-update' | 'post-integration-after-warning-update';
  bridgeId: number; cueEventId: number | null;
  loadN: number; capacityN: number; ratio: number; cue: number;
  overloadSeconds: number; warnedSeconds: number; queuedCollapse: boolean;
};
export type BridgeLoadReceipt = BridgeLoadReceiptInput & { id: number; contributors: BridgeLoadContribution[] };

/** Explicit, offline opt-in. Never attached to snapshots, tapes or ordinary diagnostics. */
export class BridgeLoadObserver {
  private contributions = new Map<number, BridgeLoadContribution[]>();
  private records: BridgeLoadReceipt[] = [];
  private totalRecords = 0;
  private truncated = false;

  beginSubstep() { this.contributions.clear(); }
  observeContribution(input: BridgeLoadContributionInput) {
    // Decompose separately, after the solver has stored its original sum. In
    // particular, do not replace load * area / total with load * (area / total).
    const arrivalTermMps2 = Math.max(0, -input.arrivalVelocityY) / input.dtSeconds;
    const downwardCorrectionTermMps2 = Math.max(0, -input.ropeDeltaY - input.normalLoadDeltaY) / (input.dtSeconds * input.dtSeconds);
    const row: BridgeLoadContribution = { ...input,
      overlapFraction: input.overlapAreaM2 / input.totalSupportAreaM2,
      weightN: input.massKg * input.gravityMps2, arrivalTermMps2, downwardCorrectionTermMps2,
      arrivalN: input.massKg * arrivalTermMps2, downwardCorrectionN: input.massKg * downwardCorrectionTermMps2,
      bridgeShareLoadN: input.bodyLoadN * input.overlapAreaM2 / input.totalSupportAreaM2 };
    const rows = this.contributions.get(input.bridgeId) ?? [];
    rows.push(row); this.contributions.set(input.bridgeId, rows);
  }
  observeDecision(input: BridgeLoadReceiptInput) {
    this.records.push({ ...input, id: this.totalRecords++, contributors: structuredClone(this.contributions.get(input.bridgeId) ?? []) });
    if (this.records.length > TUNING.phase2.maximumEvents) { this.records.shift(); this.truncated = true; }
  }
  endSubstep() { this.contributions.clear(); }
  report() {
    return { scope: 'Numerical estimates from the existing bridge-load equation. Contributors are load terms, not culprits; causal blame is unknown. No visibility, support-loss or catch-force attribution is measured.',
      maximumRecords: TUNING.phase2.maximumEvents, totalRecords: this.totalRecords, truncated: this.truncated,
      records: structuredClone(this.records) };
  }
}
