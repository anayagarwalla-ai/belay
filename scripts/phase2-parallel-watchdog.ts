import { Worker } from 'node:worker_threads';

export type WatchdogOptions = { parentPid: number; deadline: number; maximumWallMs: number; maximumRssBytes: number;
  minimumAvailableBytes: number; sampleMs: number; shutdownGraceMs: number; heapMiB: number; sentinelPath: string;
  runtime: { node: string; uv: string; platform: string } };
/** This thread remains responsive while the main JS thread is inside synchronous physics. It only signals its own process. */
export function startWatchdog(options: WatchdogOptions, onFailure: (reason: string) => void, Thread: typeof Worker = Worker) {
  // 0=armed, 1=failed, 2=released. The final completion check must see a
  // watchdog failure even if its message is still queued on the main thread.
  const lifecycle = new Int32Array(new SharedArrayBuffer(Int32Array.BYTES_PER_ELEMENT));
  const worker = new Thread(`
    const { parentPort, workerData: o } = require('node:worker_threads');
    const { writeFile } = require('node:fs');
    const { performance } = require('node:perf_hooks');
    const { getHeapStatistics } = require('node:v8');
    const lifecycle = new Int32Array(o.lifecycle);
    const hardStop = performance.now() + Math.max(0, Math.min(o.maximumWallMs, o.deadline - Date.now()));
    let failure = null, forced;
    function fail(reason) {
      if (failure || Atomics.compareExchange(lifecycle, 0, 0, 1) !== 0) return;
      failure = reason;
      forced = setTimeout(() => process.kill(process.pid, 'SIGKILL'), o.shutdownGraceMs);
      try { parentPort.postMessage({ type: 'failure', reason }); } catch {}
      // The hard stop never waits for the filesystem or its callback. A stalled
      // disk may lose this sentinel, but cannot suspend the independent timer.
      try { writeFile(o.sentinelPath, JSON.stringify({ status: 'INCOMPLETE', reason, pid: process.pid, at: new Date().toISOString() }) + '\\n', { flag: 'wx' }, () => {}); } catch {}
    }
    function check() {
      if (process.ppid !== o.parentPid) return fail('Owned process lost its original parent');
      if (performance.now() >= hardStop) return fail('Independent wall-time limit reached');
      if (process.memoryUsage().rss > o.maximumRssBytes) return fail('Independent process RSS limit reached');
      if (process.versions.node !== o.runtime.node || process.versions.uv !== o.runtime.uv || process.platform !== o.runtime.platform || typeof process.availableMemory !== 'function') return fail('Unsupported available-memory runtime');
      const available = process.availableMemory();
      if (!Number.isFinite(available) || available < o.minimumAvailableBytes) return fail('Independent available-memory floor reached');
    }
    const timer = setInterval(check, o.sampleMs);
    parentPort.on('message', message => { if (message === 'disarm') { clearInterval(timer); clearTimeout(forced); parentPort.close(); } });
    check();
    parentPort.postMessage({ type: 'armed', heapLimitBytes: getHeapStatistics().heap_size_limit });
  `, { eval: true, workerData: { ...options, lifecycle: lifecycle.buffer }, execArgv: [], resourceLimits: { maxOldGenerationSizeMb: options.heapMiB } });
  const ready = new Promise<{ threadId: number; heapLimitBytes: number }>((resolve, reject) => {
    worker.on('message', message => {
      if (message?.type === 'failure') onFailure(String(message.reason));
      if (message?.type === 'armed') resolve({ threadId: worker.threadId, heapLimitBytes: Number(message.heapLimitBytes) });
    });
    worker.once('error', error => { Atomics.compareExchange(lifecycle, 0, 0, 1); onFailure(`Watchdog failed: ${error.message}`); reject(error); });
  });
  return { ready,
    release(force = false) {
      if (force) Atomics.store(lifecycle, 0, 2);
      else if (Atomics.compareExchange(lifecycle, 0, 0, 2) === 1) return false;
      worker.postMessage('disarm'); return true;
    },
    async disarm() { Atomics.store(lifecycle, 0, 2); worker.postMessage('disarm'); await worker.terminate(); },
  };
}
