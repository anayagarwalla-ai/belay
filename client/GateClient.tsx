'use client';
import { useEffect, useRef, useState } from 'react';
import { Button } from '../components/ui/button';
import { BelayConnection } from './connection';
import { createViewport } from './viewport';
import { TUNING } from '../tuning';
import type { Snapshot } from '../shared/protocol';
import { registerInspectionTool } from './inspection-tool';
import { controlHint, movementKeys, moveFromKeys } from './controls';
import { OperatorControls } from './OperatorControls';
import { IncidentEvidence } from './IncidentEvidence';

export default function GateClient() {
  const host = useRef<HTMLDivElement>(null);
  const connectionRef = useRef<BelayConnection | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [status, setStatus] = useState('Ready');
  const [snapshot, setSnapshot] = useState<Snapshot>();
  const [localId, setLocalId] = useState(-1);
  const [operator, setOperator] = useState(false);
  const [hasSession, setHasSession] = useState(false);
  const [rtt, setRtt] = useState<number | null>(null);
  const [notice, setNotice] = useState('');
  const [viewError, setViewError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const connection = new BelayConnection(); connectionRef.current = connection;
    window.BELAY = connection.debugApi();
    const unregisterInspection = registerInspectionTool(window.BELAY);
    connection.onChange = () => {
      setStatus(connection.status); setLocalId(connection.localId); setOperator(connection.operator); setHasSession(connection.sessionNumber > 0);
      if (!connection.latest) setSnapshot(undefined);
    };
    let viewport: ReturnType<typeof createViewport> | undefined;
    try { viewport = createViewport(host.current!, connection); canvasRef.current = viewport.canvas; }
    catch {
      // One initialization failure surfaces once; no render/effect feedback loop exists.
      // oxlint-disable-next-line react/react-compiler
      setViewError('This prototype requires WebGL2. Try a desktop browser with hardware acceleration enabled.');
    }
    const keys = new Set<string>(); connection.onInputReset = () => keys.clear();
    const update = () => { connection.input = moveFromKeys(keys); };
    const down = (event: KeyboardEvent) => {
      if (!connection.acceptsMovement || !movementKeys.includes(event.code) || (event.repeat && !keys.has(event.code))
        || (event.target instanceof HTMLElement && event.target.closest('button,input,textarea,select,summary'))) return;
      event.preventDefault(); keys.add(event.code); update();
    };
    const up = (event: KeyboardEvent) => { if (movementKeys.includes(event.code)) { keys.delete(event.code); update(); } };
    const clear = () => { keys.clear(); connection.releaseInput(); };
    const visibility = () => { if (document.hidden) clear(); };
    const focus = (event: FocusEvent) => {
      if (event.target instanceof HTMLElement && event.target.closest('button,input,textarea,select,summary')) clear();
    };
    window.addEventListener('keydown', down); window.addEventListener('keyup', up); window.addEventListener('blur', clear);
    document.addEventListener('visibilitychange', visibility); document.addEventListener('focusin', focus);
    const hud = setInterval(() => { setSnapshot(connection.latest); setRtt(connection.networkCounters().rttMs.p50); }, TUNING.network.hudUpdateMs);
    return () => {
      clearInterval(hud); window.removeEventListener('keydown', down); window.removeEventListener('keyup', up); window.removeEventListener('blur', clear);
      document.removeEventListener('visibilitychange', visibility); document.removeEventListener('focusin', focus);
      unregisterInspection(); connection.dispose(); viewport?.dispose(); connectionRef.current = null; canvasRef.current = null;
    };
  }, []);

  const join = async () => { setNotice(''); await connectionRef.current?.join(); canvasRef.current?.focus(); };
  const run = async (action: () => Promise<unknown>) => {
    if (busy) return;
    setBusy(true);
    try { await action(); setNotice(''); canvasRef.current?.focus(); }
    catch (error) { setNotice(error instanceof Error ? error.message : 'Test action failed.'); }
    finally { setBusy(false); }
  };
  const exportReport = () => run(async () => {
    const connection = connectionRef.current!;
    const report = await connection.captureReport();
    const url = URL.createObjectURL(new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' }));
    const a = document.createElement('a'); a.href = url; a.download = `belay-phase2-${Date.now()}.json`; a.click(); URL.revokeObjectURL(url);
  });
  const connected = localId >= 0;
  const count = snapshot?.players.filter(p => p.connected).length ?? 0;
  const own = snapshot?.players.find(p => p.id === localId);
  const active = snapshot?.incidents?.find(incident => incident.status === 'active');
  const scene = snapshot?.scene ?? (snapshot ? 'flat' : undefined);
  return <main className="gate">
    <header className="gate-header"><div><h1>BELAY</h1><p className="phase-note">Phase 2 · 2–6 climbers · Move and brace</p></div>
      <div className="connection"><output>{status}</output>{connected && snapshot ? <div>{count}/{snapshot.playerCount ?? snapshot.players.length} connected · {rtt === null ? 'Measuring RTT' : `${Math.round(rtt)} ms RTT`}</div> : null}</div>
    </header>
    <div className="viewport" ref={host}>{viewError ? <p className="view-error" role="alert">{viewError}</p> : null}
      <div className="scene-caption">{scene === 'flat' ? 'Flat regression · no objective' : scene ? `${scene === 'rescue' ? 'Rescue fixture' : 'Seeded crossing'} · blocking bank faces shown as outlines` : 'Gray-box test · join to load the current scene'}</div>
      {snapshot ? <div className="run-status"><span aria-live="polite">{snapshot.paused ? 'PAUSED · ' : ''}{snapshot.run?.status === 'complete' ? 'Finish boundary reached' : snapshot.run?.status === 'failed' ? 'Run ended · terminal boundary' : active ? `Incident ${active.id} · ${active.playerIds.map(id => `P${id + 1}`).join(', ')} · ${active.cascades} cascades` : scene === 'flat' ? 'No run objective' : 'Cross together · keep the rope team supported'}</span>
        <small>{(snapshot.run?.elapsedSeconds ?? snapshot.counters.elapsedSeconds).toFixed(1)} s · {own ? `P${own.id + 1} ${own.rescueState ?? 'safe'} / ${own.support ?? 'ground'}` : 'Awaiting a seat'}</small>
      </div> : null}
    </div>
    <section className="controls" aria-label="Rope controls"><div className="control-copy"><p>WASD / arrows — move &nbsp; Space — brace</p><small>{controlHint(own, snapshot)}</small></div>
      <div className="actions">{hasSession ? <Button className="gate-button" onClick={exportReport} disabled={status === 'Connecting' || busy}>{busy ? 'Working…' : 'Save measurements'}</Button> : null}
        {!connected ? <Button className="gate-button primary" onClick={join} disabled={status === 'Connecting' || Boolean(viewError)}>Join test rope</Button>
          : <Button className="gate-button" onClick={() => void connectionRef.current?.leave()}>Leave rope</Button>}</div>
    </section>
    {operator && connected && snapshot ? <OperatorControls key={`${snapshot.epoch}:${snapshot.playerCount ?? snapshot.players.length}`} snapshot={snapshot} busy={busy}
      onLoad={options => run(() => connectionRef.current!.command('loadScene', options))}
      onCommand={(command, value) => run(() => connectionRef.current!.command(command, value))} /> : null}
    {snapshot ? <IncidentEvidence snapshot={snapshot} /> : null}
    {notice ? <p className="notice" role="alert">{notice}</p> : null}
  </main>;
}
