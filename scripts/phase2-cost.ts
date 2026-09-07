import { performance } from 'node:perf_hooks';
import { TUNING } from '../tuning';
import { initializePhysics } from '../shared/simulation';
import { runTrajectory } from './phase2-harness';
import { trajectorySchedule } from './phase2-policies';
import { provenance, writeBoundedJSON } from './phase2-report';
const label=process.argv[2];
if(!['baseline','selected'].includes(label))throw new Error('Supply the evidence label baseline or selected; numerical profiles remain root tuning.');
const source=await provenance(),schedule=trajectorySchedule(TUNING.phase2Evidence.trajectoryRuns);
const cases=schedule.filter(s=>s.seed===TUNING.seed&&(
  s.scene==='crossing'&&s.policy==='bad'&&s.playerCount>=TUNING.hardCap-1||
  s.scene==='rescue'&&s.policy==='frozen-tail'&&s.playerCount===TUNING.phase2Evidence.teamSizes[0]
));
await initializePhysics();
const results=[];
for(const original of cases){
  const spec={...original,horizonSeconds:Math.min(original.horizonSeconds,TUNING.phase2Evidence.replaySeconds)};
  const started=performance.now(),{record}=runTrajectory(spec),wallSeconds=(performance.now()-started)/1000;
  const matchingFullMatrixCells=schedule.filter(s=>s.playerCount===spec.playerCount&&s.scene===spec.scene&&s.policy===spec.policy).length;
  const projection={matchingFullMatrixCells,fullHorizonSeconds:original.horizonSeconds,
    wallSecondsPerObservedSimulationSecond:wallSeconds/record.observedSeconds,
    conditionalMatchingCellWallSeconds:wallSeconds/record.observedSeconds*original.horizonSeconds*matchingFullMatrixCells,
    limitation:'Conditional cost scenario only: every matching team/scene/policy row across different seeds/families would have to sustain this observed rate to its full horizon. It is not a measured full-run duration or a rigorous upper bound; early terminations may reduce cost and later states may increase it.'};
  results.push({originalFullSpec:original,probeSpec:spec,wallSeconds,record,projection});
  console.log(JSON.stringify({scene:spec.scene,players:spec.playerCount,policy:spec.policy,wallSeconds,observedSeconds:record.observedSeconds,ending:record.ending,stepMs:record.stepExecutionMs,projection}));
}
await writeBoundedJSON(`reports/phase2-${label}-cost.json`,{...source,generatedAt:new Date().toISOString(),
  scope:'Separate bounded cost probes at the root replay horizon. They do not replace or shorten any trajectory in the required fixed 1,000-run matrix. Shared machine load remains a confounder.',
  full1000Requirement:'PENDING',results});
if(results.some(r=>r.record.error||!r.record.evidenceComplete))process.exitCode=1;
