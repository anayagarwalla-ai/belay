'use client';
import { useEffect, useRef, useState } from 'react';
import { Button } from '../components/ui/button';
import { BelayConnection } from './connection';
import { createViewport } from './viewport';
import { FAMILIES, TUNING, type Family } from '../tuning';
import type { Snapshot } from '../shared/protocol';
import { registerInspectionTool } from './inspection-tool';

export default function GateClient() {
  const host = useRef<HTMLDivElement>(null);
  const connectionRef = useRef<BelayConnection | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [status, setStatus] = useState('Ready');
  const [snapshot, setSnapshot] = useState<Snapshot>();
  const [localId, setLocalId] = useState(-1);
  const [operator, setOperator] = useState(false);
  const [rtt, setRtt] = useState<number | null>(null);
  const [notice, setNotice] = useState('');
  const [viewError, setViewError] = useState('');

  useEffect(() => {
    const connection = new BelayConnection(); connectionRef.current = connection;
    window.BELAY = connection.debugApi();
    const unregisterInspection = registerInspectionTool(window.BELAY);
    connection.onChange = () => { setStatus(connection.status); setLocalId(connection.localId); setOperator(connection.operator); };
    let viewport: ReturnType<typeof createViewport> | undefined;
    try { viewport = createViewport(host.current!, connection); canvasRef.current = viewport.canvas; }
    catch {
      // One initialization failure must surface to the player; no render/effect feedback loop exists.
      // oxlint-disable-next-line react/react-compiler
      setViewError('This prototype requires WebGL2. Try a desktop browser with hardware acceleration enabled.');
    }
    const keys = new Set<string>();
    const movementKeys = ['KeyW','KeyA','KeyS','KeyD','ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Space'];
    const update = () => {
      const horizontal = Number(keys.has('KeyD') || keys.has('ArrowRight')) - Number(keys.has('KeyA') || keys.has('ArrowLeft'));
      const vertical = Number(keys.has('KeyW') || keys.has('ArrowUp')) - Number(keys.has('KeyS') || keys.has('ArrowDown'));
      const angle = TUNING.camera.azimuthDegrees * Math.PI / 180;
      const size = Math.max(1, Math.hypot(horizontal, vertical));
      connection.input = { x: (horizontal * Math.cos(angle) - vertical * Math.sin(angle)) / size,
        z: (-horizontal * Math.sin(angle) - vertical * Math.cos(angle)) / size, brace: keys.has('Space') };
    };
    const down = (event: KeyboardEvent) => {
      if (!connection.room || !movementKeys.includes(event.code) || (event.target instanceof HTMLElement && event.target.closest('button,input,textarea,select'))) return;
      event.preventDefault(); keys.add(event.code); update();
    };
    const up = (event: KeyboardEvent) => { if (movementKeys.includes(event.code)) { keys.delete(event.code); update(); } };
    const clear = () => { keys.clear(); connection.releaseInput(); };
    const visibility = () => { if (document.hidden) clear(); };
    window.addEventListener('keydown', down); window.addEventListener('keyup', up); window.addEventListener('blur', clear);
    document.addEventListener('visibilitychange', visibility);
    const hud = setInterval(() => { setSnapshot(connection.latest); setRtt(connection.networkCounters().rttMs.p50); }, TUNING.network.hudUpdateMs);
    return () => {
      clearInterval(hud); window.removeEventListener('keydown', down); window.removeEventListener('keyup', up); window.removeEventListener('blur', clear);
      document.removeEventListener('visibilitychange', visibility); unregisterInspection(); connection.dispose(); viewport?.dispose();
    };
  }, []);

  const join = async () => { setNotice(''); await connectionRef.current?.join(); canvasRef.current?.focus(); };
  const run = async (action: () => Promise<unknown>) => { try { await action(); setNotice(''); canvasRef.current?.focus(); } catch (error) { setNotice(error instanceof Error ? error.message : 'Test action failed.'); } };
  const load = (family: Family) => run(() => connectionRef.current!.command('loadScene', { family }));
  const exportReport = () => run(async () => {
    const connection = connectionRef.current!;
    const report = { generatedAt: new Date().toISOString(), userAgent: navigator.userAgent, phase: 1,
      gateVerdict: 'NOT EVALUATED', tuning: TUNING, familyDefinitions: FAMILIES,
      client: connection.networkCounters(), impairment: await window.BELAY.networkProfile(), server: await connection.command('counters'), state: connection.latest };
    const url = URL.createObjectURL(new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' }));
    const a = document.createElement('a'); a.href = url; a.download = `belay-gate1-${Date.now()}.json`; a.click(); URL.revokeObjectURL(url);
  });
  const connected = localId >= 0;
  const count = snapshot?.players.filter(p => p.connected).length ?? 0;
  return <main className="gate">
    <header className="gate-header"><div><h1>BELAY</h1><p className="phase-note">Phase 1 · Two players. Flat ground. No objective.</p></div>
      <div className="connection" aria-live="polite"><div>{status}</div>{connected && <div>{count}/2 connected · {rtt === null ? 'Measuring RTT' : `${Math.round(rtt)} ms RTT`}</div>}</div>
    </header>
    <div className="viewport" ref={host}>{viewError && <p className="view-error" role="alert">{viewError}</p>}</div>
    <section className="controls" aria-label="Rope controls"><div className="control-copy"><p>WASD / arrows — move &nbsp; Space — brace</p><small>{connected ? count < 2 ? 'Your partner can join the same local test. Remote access uses a temporary invitation.' : 'Pull against each other. Then try walking together.' : 'Join the rope, then invite a second player to the test.'}</small></div>
      <div className="actions">{!connected ? <Button className="gate-button primary" onClick={join} disabled={status === 'Connecting' || Boolean(viewError)}>Join test rope</Button>
        : <Button className="gate-button" onClick={() => void connectionRef.current?.leave()}>Leave rope</Button>}</div>
    </section>
    {operator && connected && <details className="bench"><summary>Operator test controls</summary><div className="bench-content">
      <div className="actions">{(Object.keys(FAMILIES) as Family[]).map(family => <Button key={family} className="gate-button" onClick={() => load(family)}>Load {family}</Button>)}</div>
      <Button className="gate-button" onClick={() => run(() => connectionRef.current!.command(snapshot?.paused ? 'resume' : 'pause'))}>{snapshot?.paused ? 'Resume' : 'Pause'}</Button>
      <Button className="gate-button" onClick={() => run(() => connectionRef.current!.command('stepTicks', 1))} disabled={!snapshot?.paused}>Step one tick</Button>
      <Button className="gate-button" onClick={exportReport}>Save session measurements</Button>
      <span className="readouts">{snapshot?.family} · {snapshot?.tickHz} Hz · seed {snapshot?.seed} · tick {snapshot?.tick}<br/>Slack {snapshot?.rope.slackM.toFixed(2)} m · tension {Math.round((snapshot?.rope.tension ?? 0) * 100)}% · Gate 1 not evaluated</span>
    </div></details>}
    {notice && <p className="notice" role="alert">{notice}</p>}
  </main>;
}
