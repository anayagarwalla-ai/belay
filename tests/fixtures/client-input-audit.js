// Evaluate with agent-browser in client-loopback.html after joining. Keyboard/blur/visibility events are injected;
// snapshots, acknowledgements, partner joins, scene commands and the received input observations use real transport.
// oxlint-disable-next-line typescript/no-floating-promises -- Browser evaluation awaits this returned promise.
(async () => {
  const results = [], held = ['KeyW', 'Space'];
  const assert = (condition, message) => { if (!condition) throw new Error(message); };
  const rest = input => input?.x === 0 && input.z === 0 && input.brace === false;
  const moving = input => Math.hypot(input?.x ?? 0, input?.z ?? 0) > 0 && input.brace === true;
  const wait = async (check, message) => {
    const deadline = performance.now() + 5000;
    while (!await check()) { if (performance.now() > deadline) throw new Error(message); await new Promise(resolve => setTimeout(resolve, 20)); }
  };
  const key = (code, type = 'keydown', repeat = false, target = document.querySelector('canvas')) => {
    const event = new KeyboardEvent(type, { code, key: code === 'Space' ? ' ' : 'w', repeat, bubbles: true, cancelable: true });
    target.dispatchEvent(event); return event.defaultPrevented;
  };
  const control = async options => {
    const response = await fetch('/audit/control', { method: 'POST', body: JSON.stringify(options) });
    const result = await response.json(); assert(response.ok, JSON.stringify(result)); return result;
  };
  const serverInput = async () => (await (await fetch('/audit/state')).json()).find(seat => seat.id === 0)?.input;
  const freshHold = async () => {
    document.querySelector('canvas').focus(); held.forEach(code => key(code, 'keyup')); held.forEach(code => key(code));
    await wait(async () => moving(await serverInput()), 'Move/brace did not reach authority.');
  };
  const checkRelease = async name => {
    assert(rest(window.BELAY_AUDIT.input()), `${name}: local input remained held.`);
    await wait(async () => rest(await serverInput()), `${name}: release did not reach authority.`);
    document.querySelector('canvas').focus(); held.forEach(code => key(code, 'keydown', true));
    assert(rest(window.BELAY_AUDIT.input()), `${name}: autorepeat resumed input without a fresh keydown.`);
    results.push({ name, local: window.BELAY_AUDIT.input(), authority: await serverInput() });
  };
  try {
    assert(window.BELAY_AUDIT.acceptsMovement(), 'Join the loopback room first.');
    await freshHold(); document.querySelector('.test-tools').open = true; document.querySelector('.operator').open = true;
    const field = document.querySelector('.scene-form select'); field.focus();
    assert(!key('KeyW', 'keydown', false, field), 'Form input was intercepted as movement.');
    await checkRelease('canvas to operator form');

    await freshHold(); window.dispatchEvent(new Event('blur')); await checkRelease('window blur');
    await freshHold(); Object.defineProperty(document, 'hidden', { configurable: true, value: true });
    document.dispatchEvent(new Event('visibilitychange')); delete document.hidden;
    document.dispatchEvent(new Event('visibilitychange')); await checkRelease('hidden-tab event');

    await freshHold(); await control({ pressure: true });
    await wait(() => document.querySelector('.connection output').textContent.includes('stalled'), 'Snapshot suppression did not stall the client.');
    assert(!window.BELAY_AUDIT.acceptsMovement(), 'Stale state still accepts movement/prediction.');
    const frozenTick = window.BELAY.getState().tick; await checkRelease('stale snapshots');
    await control({ pressure: false });
    await wait(() => window.BELAY_AUDIT.acceptsMovement(), 'Fresh snapshots did not restore the session.');
    await checkRelease('fresh-state recovery');
    assert(window.BELAY_AUDIT.history().every(sample => sample.tick > frozenTick), 'Interpolation history still bridges the stale interval.');

    for (const playerCount of [2, 6, 2, 6]) {
      await freshHold(); const epoch = window.BELAY.getState().epoch;
      await window.BELAY.loadScene({ scene: 'flat', playerCount });
      await wait(() => window.BELAY.getState().epoch !== epoch, 'Scene reset snapshot did not arrive.');
      assert(window.BELAY.getState().players.length === playerCount, 'Wrong resized team.');
      await checkRelease(`scene reset to ${playerCount}`);
    }
    for (let iteration = 0; iteration < 3; iteration++) {
      await freshHold(); await window.BELAY_AUDIT.leave();
      await wait(async () => (await (await fetch('/audit/state')).json()).length === 0, 'Leave retained the authoritative seat.');
      assert(!window.BELAY_AUDIT.acceptsMovement(), 'Left connection accepts controls.');
      await window.BELAY_AUDIT.join(); await wait(() => window.BELAY_AUDIT.acceptsMovement(), 'Rejoin did not receive seat and state.');
      await checkRelease(`leave/rejoin ${iteration + 1}`);
    }
    await Promise.all([window.BELAY_AUDIT.join(), window.BELAY_AUDIT.join(), window.BELAY_AUDIT.join()]);
    const before = (await (await fetch('/audit/state')).json())[0], start = performance.now();
    await new Promise(resolve => setTimeout(resolve, 750));
    const after = (await (await fetch('/audit/state')).json())[0], elapsed = performance.now() - start;
    const rate = (after.seq - before.seq) * 1000 / elapsed, expected = window.BELAY.counters().network.inputHz;
    assert(rate > expected / 2 && rate < expected * 1.25, 'Unexpected input rate after repeated joins.');
    results.push({ name: 'input interval ownership', rateHz: rate, expectedHz: expected });
    await control({ partners: 5 });
    await wait(() => window.BELAY.getState().players.filter(player => player.connected).length === 6, 'Five audit partners did not join.');
    document.querySelector('.test-tools').open = true; document.querySelector('.operator').open = true;
    assert(window.__consoleErrors.length === 0, 'Browser error during input audit.');
    return { results, next: 'Use the actual Team control to request 2 climbers; all six seats are occupied.', errors: window.__consoleErrors };
  } finally {
    delete document.hidden; held.forEach(code => key(code, 'keyup')); window.dispatchEvent(new Event('blur'));
    await control({ pressure: false });
  }
})()
