import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { readBoundedJSON, writeBoundedJSON } from '../scripts/phase2-report';

const directories: string[] = [];
afterEach(async () => { await Promise.all(directories.splice(0).map(path => rm(path, { recursive: true, force: true }))); });

describe('Phase 2 bounded evidence files', () => {
  it('refuses an oversized replacement without destroying prior evidence', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'belay-phase2-evidence-')); directories.push(directory);
    const path = join(directory, 'report.json');
    await writeBoundedJSON(path, { actual: true }, 100);
    const previous = await readFile(path, 'utf8');
    await expect(writeBoundedJSON(path, { oversized: 'xxxxxxxxxx' }, 4)).rejects.toThrow(/bound/);
    expect(await readFile(path, 'utf8')).toBe(previous);
    expect(await readBoundedJSON(path, 100)).toEqual({ actual: true });
  });
  it('checks the input byte cap and rejects malformed JSON', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'belay-phase2-evidence-')); directories.push(directory);
    const path = join(directory, 'input.json');
    await writeFile(path, '{"fixture":true}');
    await expect(readBoundedJSON(path, 2)).rejects.toThrow(/bound/);
    await writeFile(path, '{');
    await expect(readBoundedJSON(path, 2)).rejects.toThrow();
  });
});
