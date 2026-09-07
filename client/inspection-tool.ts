import type { BelayDebugApi } from './connection';

type Registry = { registerTool(tool: {
  name: string; title: string; description: string; inputSchema: object;
  annotations: { readOnlyHint: boolean; untrustedContentHint: boolean };
  execute(input: unknown): unknown;
}, options: { signal: AbortSignal }): void | Promise<void> };

/** Optional browser inspection of the same state as the operator's visible readouts. */
export function registerInspectionTool(api: BelayDebugApi) {
  const context = (document as Document & { modelContext?: Registry }).modelContext;
  const lifetime = new AbortController();
  if (context?.registerTool) {
    try {
      void Promise.resolve(context.registerTool({
        name: 'read_belay_rope_test', title: 'Read BELAY rope test',
        description: 'Read the connected Phase 1 room, rope and network measurements. Does not join, move, reset, or evaluate the human playtest.',
        inputSchema: { type: 'object', properties: {}, additionalProperties: false },
        annotations: { readOnlyHint: true, untrustedContentHint: false },
        execute(input) {
          if (!input || typeof input !== 'object' || Array.isArray(input) || Object.keys(input).length) throw new Error('Expected an empty object.');
          const state = api.getState();
          return { connected: state !== null, state, measurements: api.counters(), humanVerdict: 'NOT EVALUATED' };
        },
      }, { signal: lifetime.signal })).catch(() => { /* Unsupported draft implementations cannot interrupt play. */ });
    } catch { /* Optional API; the visible controls and window.BELAY remain available. */ }
  }
  return () => lifetime.abort();
}
