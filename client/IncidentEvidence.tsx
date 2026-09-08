import type { IncidentState, Snapshot } from '../shared/protocol';
import { ropeSpans } from './presentation';

export function roleRows(incident: IncidentState, count: number) {
  return Array.from({ length: count }, (_, id) => {
    const active = incident.roleActiveSeconds[id] ?? 0, idle = incident.roleIdleSeconds[id] ?? 0;
    return { id, active, idle, fraction: active + idle > 0 ? idle / (active + idle) : null, staticHold: incident.staticHoldSeconds[id] ?? 0 };
  });
}
export function IncidentEvidence({ snapshot }: { snapshot: Snapshot }) {
  const incidents = snapshot.incidents ?? [];
  const incident = incidents.at(-1);
  const spans = ropeSpans(snapshot);
  return <details className="bench evidence"><summary>Incident and role evidence · {incidents.length} recent {incidents.length === 1 ? 'episode' : 'episodes'}</summary>
    <div className="evidence-content">
      <p>Server observations and motion/load proxies. Being dragged under load can accrue the motion/load proxy without purposeful input. It cannot establish agency or pass the human rescue check.</p>
      {incident ? <>
        <p><strong>Incident {incident.id} · {incident.status}</strong> · P{incident.playerIds.map(id => id + 1).join(', P')} · {incident.cascades} additional falls in this episode<br/>
          First fall tick {incident.fallTick} · {incident.recoveredTick === null ? 'Still open / unrecovered' : `Recovered tick ${incident.recoveredTick}`} · first-attempt proxy {incident.status === 'active' ? 'pending' : incident.firstAttemptSuccess ? 'yes' : 'no'}</p>
        <div className="table-scroll"><table><caption>Latest incident: time per harness, not a team average</caption>
          <thead><tr><th>Climber</th><th>Motion/load proxy</th><th>Idle proxy</th><th>Idle fraction</th><th>Static hold</th></tr></thead>
          <tbody>{roleRows(incident, snapshot.players.length).map(row => <tr key={row.id}><th scope="row">P{row.id + 1}</th><td>{row.active.toFixed(1)} s</td><td>{row.idle.toFixed(1)} s</td><td>{row.fraction === null ? 'No samples' : `${Math.round(row.fraction * 100)}%`}</td><td>{row.staticHold.toFixed(1)} s</td></tr>)}</tbody>
        </table></div>
      </> : <p>No incident has been recorded in this scene.</p>}
      <div className="table-scroll"><table><caption>Adjacent rope spans · chord gap ignores routing; correction is a solver proxy</caption>
        <thead><tr><th>Harnesses</th><th>Material length</th><th>Chord-gap proxy</th><th>Correction proxy (N)</th><th>Hanging/climb highlight</th></tr></thead>
        <tbody>{spans.map(span => <tr key={span.id}><th scope="row">P{span.a + 1}–P{span.b + 1}</th><td>{span.length.toFixed(2)} m</td><td>{span.slackM.toFixed(2)} m</td><td>{Math.round(span.tensionN)}</td><td>{span.catchHighlight ? 'On' : '—'}</td></tr>)}</tbody>
      </table></div>
      {snapshot.diagnostics ? <p>Lifetime scene counts: {snapshot.diagnostics.incidentsStarted} started / {snapshot.diagnostics.incidentsRecovered} recovered / {snapshot.diagnostics.incidentsFailed} failed.<br/>
        Event history {snapshot.diagnostics.eventsTruncated ? 'truncated' : 'within bound'}; incident history {snapshot.diagnostics.incidentsTruncated ? 'truncated' : 'within bound'}. Saved measurements include the available records.</p> : null}
      <p><strong>Human stop before Phase 3:</strong> if a fall feels arbitrary or a rescue role is a static hold, stop and re-cut the rescue. Human verdict: not evaluated.</p>
    </div>
  </details>;
}
