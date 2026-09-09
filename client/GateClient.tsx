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
import { mission } from './mission';
import { RopeSound } from './sound';
import { IncidentEvidence } from './IncidentEvidence';
import type { PracticeMode, PracticeStatus } from './practice-team';

export default function GateClient() {
  const host = useRef<HTMLDivElement>(null);
  const soundRef = useRef<RopeSound | null>(null);
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
  const [practiceMode, setPracticeMode] = useState<PracticeMode>('recovery');
  const [practice, setPractice] = useState<PracticeStatus>({ state: 'idle', count: 0, message: 'Synthetic teammates for local practice.' });

  const [muted, setMuted] = useState(false);

  useEffect(() => {
    const sound = new RopeSound(); soundRef.current = sound;
    const connection = new BelayConnection(); connectionRef.current = connection;
    const inspection = connection.debugApi(); window.BELAY = inspection;
    const unregisterInspection = registerInspectionTool(inspection);
    connection.onChange = () => {
      setStatus(connection.status); setLocalId(connection.localId); setOperator(connection.operator); setHasSession(connection.sessionNumber > 0);
      setPractice(connection.practice.status);
      if (!connection.acceptsMovement) sound.quiet();
      if (!connection.latest) setSnapshot(undefined);
    };
    connection.onSnapshot = state => { if (document.hidden) sound.quiet(); else sound.observe(state); };
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
    const visibility = () => { if (document.hidden) { clear(); sound.quiet(); connection.practice.stop('Practice bots stopped because the tab was hidden.'); } };
    const focus = (event: FocusEvent) => {
      if (event.target instanceof HTMLElement && event.target.closest('button,input,textarea,select,summary')) clear();
    };
    window.addEventListener('keydown', down); window.addEventListener('keyup', up); window.addEventListener('blur', clear);
    document.addEventListener('visibilitychange', visibility); document.addEventListener('focusin', focus);
    const hud = setInterval(() => { setSnapshot(connection.latest); setRtt(connection.networkCounters().rttMs.p50); }, TUNING.network.hudUpdateMs);
    return () => {
      clearInterval(hud); window.removeEventListener('keydown', down); window.removeEventListener('keyup', up); window.removeEventListener('blur', clear);
      document.removeEventListener('visibilitychange', visibility); document.removeEventListener('focusin', focus);
      if (window.BELAY === inspection) delete window.BELAY;
      unregisterInspection(); sound.dispose(); soundRef.current = null; connection.dispose(); viewport?.dispose(); connectionRef.current = null; canvasRef.current = null;
    };
  }, []);

  const join = () => { void soundRef.current?.start(); return run(() => connectionRef.current!.startCrossing()); };
  const again = () => run(() => connectionRef.current!.restartCrossing());
  const run = async (action: () => Promise<unknown>) => {
    const connection = connectionRef.current;
    if (busy || !connection) return;
    const current = () => connectionRef.current === connection;
    setBusy(true);
    try { await action(); if (current()) { setNotice(''); canvasRef.current?.focus(); } }
    catch (error) { if (current()) setNotice(error instanceof Error ? error.message : 'Test action failed.'); }
    finally { if (current()) setBusy(false); }
  };
  const exportReport = () => run(async () => {
    const connection = connectionRef.current!;
    const report = await connection.captureReport();
    if (connectionRef.current !== connection) return;
    const url = URL.createObjectURL(new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' }));
    const a = document.createElement('a'); a.href = url; a.download = `belay-phase2-${Date.now()}.json`; a.click(); URL.revokeObjectURL(url);
  });
  const connected = localId >= 0;
  const count = snapshot?.players.filter(p => p.connected).length ?? 0;
  const own = snapshot?.players.find(p => p.id === localId);
  const scene = snapshot?.scene ?? (snapshot ? 'flat' : undefined);
  const objective = snapshot ? mission(snapshot, localId) : null;
  const ended = snapshot?.run?.status === 'complete' || snapshot?.run?.status === 'failed';
  return <main className="gate" data-belay-entry="crossing">
    <header className="gate-header"><div className="brand"><h1>BELAY<span>.</span></h1><p className="phase-note">GET YOUR PEOPLE HOME</p></div>
      <div className="connection"><span>{connected && snapshot ? `${count} ON THE ROPE` : 'A GLACIER. ONE ROPE.'}</span>
        <button className="sound-toggle" onClick={() => { const next = !muted; setMuted(next); soundRef.current?.setMuted(next); if (!next) void soundRef.current?.start(); }} aria-pressed={!muted}>{muted ? 'Sound off' : 'Sound on'}</button>
      </div>
    </header>
    <div className="viewport" ref={host}>
      {viewError ? <p className="view-error" role="alert">{viewError}</p> : null}
      {!connected ? <div className="intro-overlay">
        <p className="eyebrow">A LITTLE COOPERATION. A LOT OF BAD IDEAS.</p>
        <h2><span>ONE ROPE.</span><br /><span>NO HEROES.</span></h2>
        <p className="intro-pitch">Get everyone across three crevasses and into the hut. When someone drops, dig in and pull them back.</p>
        <Button className="gate-button primary start-button" onClick={join} disabled={busy || status === 'Connecting' || Boolean(viewError)}>{busy || status === 'Connecting' ? 'Clipping in…' : 'START CROSSING'}</Button>
        <p className="intro-footnote">Local practice adds three BOT partners.<br />WASD to move. Space to brace. Try to bring everybody.</p>
        {hasSession || status !== 'Ready' ? <p className="entry-status">{status}</p> : null}
      </div> : null}
      {objective && connected ? <>
        <div className="run-status mission-hud" data-tone={objective.tone}>
          <span className="eyebrow">{scene === 'crossing' ? 'THE HUT IS THE FINISH LINE' : 'ROPE PRACTICE'}</span>
          <h2 aria-live="polite">{objective.title}</h2><p>{objective.detail}</p>
          {objective.remaining !== null ? <div className="route-progress"><strong>{objective.remaining}<small>m TO SHELTER</small></strong>
            <div className="route-track" aria-label={`${objective.crossed} of ${objective.gaps} crevasses crossed`}>
              {Array.from({length: objective.gaps}, (_, i) => <span key={i} className={i < objective.crossed ? 'crossed' : ''}>{String(i + 1).padStart(2, '0')}</span>)}<b>HUT</b>
            </div>
          </div> : null}
        </div>
        {!ended && scene === 'crossing' ? <div className="scene-caption route-beacon"><b aria-hidden="true">↙</b><span>HUT THIS WAY<small>S + A / ↓ + ←</small></span></div> : null}
        {ended ? <div className="finish-actions"><span>{(snapshot!.run!.elapsedSeconds).toFixed(1)} SECONDS · {snapshot!.incidents?.filter(row => row.status === 'recovered').length ?? 0} RESCUES</span>
          {operator ? <Button className="gate-button primary" disabled={busy} onClick={again}>GO AGAIN</Button> : <p>The host can start the next crossing.</p>}</div> : null}
      </> : null}
    </div>
    <section className="controls" aria-label="Rope controls"><div className="control-copy"><p><kbd>W A S D</kbd> MOVE <span className="control-separator">/</span> <kbd>SPACE</kbd> BRACE</p><small>{controlHint(own, snapshot)}</small></div>
      {connected ? <Button className="gate-button leave-button" onClick={() => void connectionRef.current?.leave()}>Leave rope</Button> : null}
    </section>
    {notice ? <p className="notice" role="alert">{notice}</p> : null}
    <details className="test-tools"><summary>Test tools</summary>
      <div className="tool-status">{status} · {rtt === null ? 'RTT unavailable' : `${Math.round(rtt)} ms RTT`} · short crossing playtest</div>
      {hasSession ? <Button className="gate-button" onClick={exportReport} disabled={status === 'Connecting' || busy}>{busy ? 'Working…' : 'Save measurements'}</Button> : null}
    {operator && connected && snapshot ? <section className="controls practice" aria-label="Practice teammates">
      <div className="control-copy"><p>Try it with bots</p><output className="practice-status">{practice.message}</output>
        <small>BOT labels mark synthetic players. Use real people for the playtest verdict. Hiding this tab stops its bots.</small></div>
      <div className="actions"><label>Bot behavior <select value={practiceMode} disabled={busy || practice.state !== 'idle'} onChange={event => setPracticeMode(event.target.value as PracticeMode)}>
        <option value="recovery">Cooperative</option><option value="bad">Clumsy</option>
      </select></label>
        {practice.state === 'idle' ? <Button className="gate-button" disabled={busy || scene === 'flat' || count >= snapshot.players.length}
          onClick={() => void run(() => connectionRef.current!.startPracticeBots(practiceMode))}>Fill empty seats with bots</Button>
          : <Button className="gate-button" onClick={() => connectionRef.current?.stopPracticeBots()}>{practice.state === 'starting' ? 'Cancel adding bots' : 'Stop practice bots'}</Button>}
      </div>
      {scene === 'flat' ? <small className="form-note">Load a rescue or crossing below to use practice teammates.</small> : null}
    </section> : null}
    {operator && connected && snapshot ? <OperatorControls key={`${snapshot.epoch}:${snapshot.playerCount ?? snapshot.players.length}`} snapshot={snapshot} busy={busy}
      onLoad={options => run(() => connectionRef.current!.command('loadScene', options))}
      onCommand={(command, value) => run(() => connectionRef.current!.command(command, value))} /> : null}
    {snapshot ? <IncidentEvidence snapshot={snapshot} /> : null}
    </details>
  </main>;
}
