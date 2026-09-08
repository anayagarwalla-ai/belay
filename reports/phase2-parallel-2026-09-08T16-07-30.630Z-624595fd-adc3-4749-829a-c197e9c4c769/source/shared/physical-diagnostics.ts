import type { PhysicalDiagnostics } from './protocol';

export const emptyPhysicalDiagnostics = (): PhysicalDiagnostics => ({
  solverIterations: 0, contactProjections: 0, maximumTerrainPenetrationM: 0, maximumBodyOverlapM: 0,
  kineticEnergyJ: 0, potentialEnergyJ: 0, motorWorkJ: 0, gravityWorkJ: 0, ropeContactWorkJ: 0,
  maximumUnexplainedEnergyGainJ: 0, incidentsStarted: 0, incidentsRecovered: 0, incidentsFailed: 0,
  energyProjectionCount: 0, maximumEnergyProjectionJ: 0, maximumPotentialExcessJ: 0,
  cascades: 0, firstFallSeconds: null, eventsTruncated: false, incidentsTruncated: false,
});
