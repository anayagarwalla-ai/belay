import { localClient, observe, delay } from './client-utils';
import { seededRandom } from '../shared/terrain';
import { TUNING } from '../tuning';
import { REST, type Move } from '../shared/protocol';

const value = (name: string, fallback: string) => { const at = process.argv.indexOf(name); return at < 0 ? fallback : process.argv[at + 1]; };
const seconds = Number(value('--seconds', '60'));
const mode = value('--mode', 'bad');
const seed = Number(value('--seed', String(TUNING.seed)));
if (!Number.isFinite(seconds) || seconds <= 0 || !['bad', 'brace', 'walk', 'idle'].includes(mode)) throw new Error('Use --seconds N --mode bad|brace|walk|idle.');
const { config, client } = await localClient();
const room = await client.joinById(config.roomId, { token: config.token, bot: true });
const observed = observe(room);
const random = seededRandom(seed);
let input: Move = { ...REST }, seq = 0;
const choose = () => {
  if (mode === 'brace') input = { ...REST, brace: true };
  else if (mode === 'walk') input = { x: -1, z: 0, brace: false };
  else if (mode === 'idle') input = { ...REST };
  else { const r = random(); input = r < TUNING.bot.idleChance ? { ...REST } : {
    x: random() < 0.5 ? -1 : 1, z: random() < 0.5 ? -1 : 1, brace: r < TUNING.bot.idleChance + TUNING.bot.braceChance }; }
};
choose();
const behavior = setInterval(choose, TUNING.bot.actionSeconds * 1000);
const sending = setInterval(() => room.send('input', { ...input, seq: seq++ }), 1000 / TUNING.network.inputHz);
let closed = false;
async function close() { if (closed) return; closed = true; clearInterval(behavior); clearInterval(sending); await room.leave(); }
process.on('SIGINT', () => void close().then(() => process.exit()));
process.on('SIGTERM', () => void close().then(() => process.exit()));
console.log(`Labeled BOT joined the test rope (${mode}, ${seconds}s). It is not a human playtest.`);
await delay(seconds * 1000);
console.log(JSON.stringify({ phase: 1, bot: true, mode, localId: observed.localId, counters: observed.latest?.counters }));
await close();
