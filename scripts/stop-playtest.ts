import { failureMessage, isMain, projectRoot, stopSession } from './operations';

if (isMain(import.meta.url)) {
  try {
    const result = await stopSession(projectRoot, 'playtest');
    console.log(result.stale ? 'Removed stale remote-session metadata and invitations. No process was signaled; no teardown verdict was invented. Run preflight to check the protected port.'
      : result.stopped ? 'Remote session teardown confirmed. See work/last-playtest-teardown.json.' : 'No remote session is recorded in this checkout.');
  } catch (error) { console.error(failureMessage(error)); process.exitCode = 1; }
}
