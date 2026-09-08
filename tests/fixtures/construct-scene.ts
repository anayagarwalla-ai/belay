import RAPIER from '@dimforge/rapier3d-compat';
import { BelaySimulation } from '../../shared/simulation';
import type { SceneOptions, Vec3 } from '../../shared/protocol';

/** Place diagnostic bodies before the engine constructs their harnesses and
 * material particles. No post-start teleport or physics alteration is involved. */
export function constructScene(options: SceneOptions, place: (position: Vec3, id: number) => Vec3) {
  // eslint-disable-next-line typescript/unbound-method
  const original = RAPIER.World.prototype.createRigidBody;
  let id = 0;
  RAPIER.World.prototype.createRigidBody = function (description) {
    const p = place(description.translation, id++); description.setTranslation(p.x, p.y, p.z);
    return original.call(this, description);
  };
  try { return new BelaySimulation(options); }
  finally { RAPIER.World.prototype.createRigidBody = original; }
}
