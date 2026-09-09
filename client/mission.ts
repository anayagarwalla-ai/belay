import { TUNING } from '../tuning';
import type { Snapshot } from '../shared/protocol';

/** Player-facing instructions derived only from the authoritative public state. */
export function mission(state: Snapshot, localId: number) {
  const own = state.players.find(player => player.id === localId);
  const incident = state.incidents?.find(row => row.status === 'active');
  const tail = Math.min(...state.players.map(player => player.position.z));
  const remaining = state.terrain?.finishZ == null ? null : Math.max(0, Math.ceil(state.terrain.finishZ - tail));
  const crossed = state.terrain?.crevasses.filter(gap => tail > gap.maxZ).length ?? 0;
  const gaps = state.terrain?.crevasses.length ?? 0;
  const base = { remaining, crossed, gaps, progress: state.run?.progress ?? 0 };
  if (state.run?.status === 'complete') return { ...base, tone: 'win', title: 'EVERYBODY MADE IT.', detail: 'One rope. All home. Take a breath.' };
  if (state.run?.status === 'failed') return { ...base, tone: 'danger', title: 'THE GLACIER GOT US.', detail: 'Go again. Stay closer when the snow starts to give.' };
  if (state.paused) return { ...base, tone: 'quiet', title: 'ROPE PAUSED', detail: 'Resume when the team is ready.' };
  if (own?.support === 'wall') return { ...base, tone: 'danger', title: 'CLIMB TOWARD THE WALL.', detail: 'Keep moving into the wall while your team hauls you up.' };
  if (own?.support === 'air') return { ...base, tone: 'danger', title: 'THE ROPE HAS YOU.', detail: 'Your team needs to brace. Move toward the wall when you reach it.' };
  if (incident) return { ...base, tone: 'danger', title: own?.brace ? 'HAUL THEM OUT.' : 'SOMEONE’S DOWN. BRACE!',
    detail: own?.brace ? 'Keep Space held. Step away from the hole to pull them up.' : 'Hold Space to dig in, then move away from the hole.' };
  const recovered = state.incidents?.filter(row => row.status === 'recovered').at(-1);
  if (recovered?.recoveredTick != null && (state.scene === 'rescue' || (state.tick - recovered.recoveredTick) / state.tickHz < TUNING.camera.recoveryMessageSeconds))
    return { ...base, tone: 'win', title: 'BACK ON THE SNOW.', detail: state.scene === 'rescue' ? 'Everyone is back up. Reset the rescue in Test tools to try another catch.' : 'Release Space. Regroup and keep moving.' };
  if (state.scene === 'flat') return { ...base, tone: 'quiet', title: 'PULL EACH OTHER AROUND.', detail: 'Move together. Hold Space to become an anchor.' };
  if (state.scene === 'rescue') return { ...base, tone: 'quiet', title: 'KEEP EVERYONE ON THE SNOW.', detail: 'Be ready to catch a teammate. There is no finish line in this rescue practice.' };
  const flexing = state.terrain?.bridges.some(bridge => !bridge.collapsed && bridge.cue > 0
    && own && Math.abs((bridge.minZ + bridge.maxZ) / 2 - own.position.z) < TUNING.camera.warningReachM);
  return flexing ? { ...base, tone: 'danger', title: 'THE SNOW IS GIVING.', detail: 'Spread out. Be ready to brace if someone drops.' }
    : { ...base, tone: 'quiet', title: 'GET EVERYONE TO THE HUT.', detail: 'Follow the arrow together. Save Space for the catch.' };
}
