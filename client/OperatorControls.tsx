'use client';
import { useState } from 'react';
import { Button } from '../components/ui/button';
import { FAMILIES, TUNING, type Family, type TickHz } from '../tuning';
import type { DebugCommand, Scene, SceneOptions, Snapshot } from '../shared/protocol';

export function OperatorControls({ snapshot, busy, onLoad, onCommand }: {
  snapshot: Snapshot; busy: boolean; onLoad: (options: SceneOptions) => Promise<void>;
  onCommand: (command: DebugCommand['command'], value?: unknown) => Promise<void>;
}) {
  const [scene, setScene] = useState<Scene>(snapshot.scene ?? 'flat');
  const [players, setPlayers] = useState(snapshot.playerCount ?? snapshot.players.length);
  const [family, setFamily] = useState<Family>(snapshot.family);
  const [tickHz, setTickHz] = useState<TickHz>(snapshot.tickHz);
  const [seed, setSeed] = useState(String(snapshot.seed));
  return <details className="bench operator"><summary>Operator scene controls</summary>
    <form className="scene-form" onSubmit={event => {
      event.preventDefault();
      if (!Number.isSafeInteger(Number(seed))) return;
      void onLoad({ scene, playerCount: players, family, tickHz, seed: Number(seed) });
    }}>
      <label>Scene<select value={scene} disabled={busy} onChange={event => setScene(event.target.value as Scene)}>
        <option value="crossing">Crossing · seeded bridges</option><option value="rescue">Rescue · focused fall</option><option value="flat">Flat · regression test</option>
      </select></label>
      <label>Team<select value={players} disabled={busy} onChange={event => setPlayers(Number(event.target.value))}>
        {Array.from({ length: TUNING.hardCap - 1 }, (_, i) => i + 2).map(count => <option key={count} value={count}>{count} climbers</option>)}
      </select></label>
      <label>Family<select value={family} disabled={busy} onChange={event => setFamily(event.target.value as Family)}>
        {(Object.keys(FAMILIES) as Family[]).map(value => <option key={value} value={value}>{value}</option>)}
      </select></label>
      <label>Authority<select value={tickHz} disabled={busy} onChange={event => setTickHz(Number(event.target.value) as TickHz)}>
        <option value={30}>30 Hz</option><option value={60}>60 Hz diagnostic</option>
      </select></label>
      <label>Seed<input type="number" step="1" value={seed} required disabled={busy} onChange={event => setSeed(event.target.value)} /></label>
      <Button type="submit" className="gate-button" disabled={busy}>{busy ? 'Applying…' : 'Reset and load scene'}</Button>
      <p className="form-note">Reset starts a new measurement window and tape. Save evidence first. A smaller team cannot remove an occupied higher-numbered seat.</p>
    </form>
    <div className="bench-content">
      <Button className="gate-button" disabled={busy} onClick={() => void onCommand(snapshot.paused ? 'resume' : 'pause')}>{snapshot.paused ? 'Resume' : 'Pause'}</Button>
      <Button className="gate-button" disabled={busy || !snapshot.paused} onClick={() => void onCommand('stepTicks', 1)}>Step one tick</Button>
      <span className="readouts">{snapshot.scene ?? 'flat'} · {snapshot.players.length} bodies · {snapshot.family} · {snapshot.tickHz} Hz · seed {snapshot.seed} · tick {snapshot.tick}</span>
    </div>
  </details>;
}
