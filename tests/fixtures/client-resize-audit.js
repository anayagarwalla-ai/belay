// Continue after client-input-audit.js: the real six-seat room is full. Exercise the React form and visible feedback.
// oxlint-disable-next-line typescript/no-floating-promises -- Browser evaluation awaits this returned promise.
(async () => {
  const assert = (condition, message) => { if (!condition) throw new Error(message); };
  const wait = async check => {
    const deadline = performance.now() + 5000;
    while (!check()) { if (performance.now() > deadline) throw new Error('Resize UI did not settle.'); await new Promise(resolve => setTimeout(resolve, 20)); }
  };
  assert(window.BELAY.getState().players.filter(player => player.connected).length === 6, 'Start with all six audit seats occupied.');
  document.querySelector('.test-tools').open = true; document.querySelector('.operator').open = true;
  const team = [...document.querySelectorAll('.scene-form select')].find(select => select.closest('label').textContent.startsWith('Team'));
  team.focus(); team.value = '2'; team.dispatchEvent(new Event('change', { bubbles: true }));
  await new Promise(requestAnimationFrame);
  const epoch = window.BELAY.getState().epoch;
  document.querySelector('.scene-form').requestSubmit(); await wait(() => document.querySelector('[role=alert]'));
  const alert = document.querySelector('[role=alert]'), rect = alert.getBoundingClientRect();
  assert(alert.textContent.includes('must leave'), 'Resize error does not explain the occupied-seat constraint.');
  assert(rect.top >= 0 && rect.bottom <= innerHeight, 'Resize error is below the visible viewport.');
  assert(window.BELAY.getState().epoch === epoch && window.BELAY.getState().players.length === 6, 'Rejected resize changed the scene.');
  const rejected = { message: alert.textContent, top: rect.top, bottom: rect.bottom, viewportHeight: innerHeight, epoch };
  const response = await fetch('/audit/control', { method: 'POST', body: JSON.stringify({ partners: 0 }) });
  assert(response.ok, 'Audit partners did not leave.');
  await wait(() => window.BELAY.getState().players.filter(player => player.connected).length === 1);
  document.querySelector('.scene-form').requestSubmit();
  await wait(() => window.BELAY.getState().epoch !== epoch && !document.querySelector('[role=alert]'));
  assert(window.BELAY.getState().players.length === 2, 'Valid retry did not resize to two.');
  assert(window.BELAY_AUDIT.input().brace === false && window.BELAY_AUDIT.input().x === 0 && window.BELAY_AUDIT.input().z === 0, 'Resize retry retained controls.');
  return { rejected, retry: { players: window.BELAY.getState().players.length, epoch: window.BELAY.getState().epoch, input: window.BELAY_AUDIT.input() }, errors: window.__consoleErrors };
})()
