import * as THREE from 'three';
import { TUNING } from '../tuning';
import { flatTerrain } from '../shared/terrain';
import type { BelayConnection } from './connection';
import type { Snapshot, Vec3 } from '../shared/protocol';
import { cameraFrame, displayedSpans, groundPatches, inside, interpolateState, ropeSpans, type Rect } from './presentation';
import { LocalPrediction } from './prediction';
import { topSurfaceOccludesBody } from './terrain-view';
import { overlapArea, placeOverlay, type ScreenRect } from './overlay-layout';

function disposeGroup(group: THREE.Object3D) {
  const geometries = new Set<THREE.BufferGeometry>(), materials = new Set<THREE.Material>();
  group.traverse(object => {
    const mesh = object as THREE.Mesh;
    if (mesh.geometry) geometries.add(mesh.geometry);
    if (mesh.material) for (const material of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) materials.add(material);
  });
  geometries.forEach(g => g.dispose()); materials.forEach(m => m.dispose()); group.clear();
}

export function createViewport(host: HTMLElement, connection: BelayConnection) {
  const palette = TUNING.camera.palette;
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const scene = new THREE.Scene(); scene.background = new THREE.Color(palette.snow);
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, TUNING.rope.floorHeight, TUNING.camera.distance * 4);
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
  renderer.setPixelRatio(Math.min(devicePixelRatio, TUNING.camera.maximumPixelRatio));
  renderer.domElement.tabIndex = 0;
  renderer.domElement.setAttribute('aria-label', 'BELAY rope test. WASD or arrows move. Space braces where supported. At a wall, move toward it to climb.');
  host.append(renderer.domElement);
  const terrain = new THREE.Group(), bodies = new THREE.Group(), rope = new THREE.Group(); scene.add(terrain, bodies, rope);
  const labels = new Map<number, HTMLDivElement>(), markers = new Map<number, HTMLDivElement>();
  const boxes = new Map<number, THREE.Mesh>();
  const bridges = new Map<number, { mesh: THREE.Mesh; seams: THREE.LineSegments; anchor: THREE.Vector3; label: HTMLDivElement }>();
  const topSurfaces: { rect: Rect; mesh: THREE.Mesh; top: () => number }[] = [];
  const ropeMeshes: THREE.Mesh[] = [];
  const boxGeometry = new THREE.BoxGeometry(TUNING.camera.torsoWidthM, TUNING.camera.torsoHeightM, TUNING.camera.torsoDepthM);
  const hoodGeometry = new THREE.SphereGeometry(TUNING.camera.hoodRadiusM, TUNING.hardCap * 2, TUNING.hardCap);
  const bootGeometry = new THREE.BoxGeometry(TUNING.camera.bootWidthM, TUNING.camera.bootHeightM, TUNING.camera.bootWidthM);
  const packGeometry = new THREE.BoxGeometry(TUNING.camera.torsoWidthM - TUNING.camera.bootWidthM, TUNING.camera.torsoHeightM - TUNING.camera.hoodRadiusM, TUNING.camera.packDepthM);
  const edgeGeometry = new THREE.EdgesGeometry(boxGeometry);
  const ropeGeometry = new THREE.CylinderGeometry(TUNING.rope.radius, TUNING.rope.radius, 1, TUNING.hardCap);
  // One material per physical span: slack desaturates; tautness restores the orange.
  const spanMaterials = Array.from({ length: TUNING.hardCap - 1 }, () => new THREE.MeshBasicMaterial({ color: palette.rope }));
  const ropeColor = new THREE.Color(palette.rope), ropeHsl = { h: 0, s: 0, l: 0 }; ropeColor.getHSL(ropeHsl);
  const ropeMaterial = spanMaterials[0];
  const catchMaterial = new THREE.MeshBasicMaterial({ color: palette.ink });
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(TUNING.terrain.halfExtent * 2, TUNING.terrain.halfExtent * 2), new THREE.MeshBasicMaterial({ color: palette.snow }));
  ground.rotation.x = -Math.PI / 2;
  const grid = new THREE.GridHelper(TUNING.terrain.halfExtent * 2, TUNING.terrain.halfExtent * 2 / TUNING.terrain.gridUnit, '#bcbcbc', '#c6c6c6');
  grid.position.y = TUNING.rope.floorHeight / 2; scene.add(ground, grid);
  const cameraTarget = new THREE.Vector3(), target = new THREE.Vector3(), direction = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0);
  const frustum = new THREE.Frustum(), projection = new THREE.Matrix4(), bridgeBounds = new THREE.Box3();
  const az = THREE.MathUtils.degToRad(TUNING.camera.azimuthDegrees), el = THREE.MathUtils.degToRad(TUNING.camera.elevationDegrees);
  const offset = new THREE.Vector3(Math.sin(az) * Math.cos(el), Math.sin(el), Math.cos(az) * Math.cos(el)).multiplyScalar(TUNING.camera.distance);
  const predictor = new LocalPrediction();
  let width = 1, height = 1, frame = 0, previousAt = performance.now(), verticalSpan = TUNING.camera.baseVerticalSpan as number;
  let terrainKey = '', cameraEpoch: number | null = null, segmentCount = 0, spanCount = 0, cutawayTopFaces = 0, bodiesCoveredByOverlays = 0;
  const project = (position: THREE.Vector3) => {
    const projected = position.clone().project(camera);
    return { x: (projected.x + 1) * width / 2, y: (1 - projected.y) * height / 2,
      visible: Math.abs(projected.x) <= 1 && Math.abs(projected.y) <= 1 && Math.abs(projected.z) <= 1 };
  };
  const label = (className: string) => { const node = document.createElement('div'); node.className = className; node.setAttribute('aria-hidden', 'true'); host.append(node); return node; };
  function syncPlayers(ids: readonly number[]) {
    for (const [id, box] of boxes) if (!ids.includes(id)) {
      box.removeFromParent(); (box.material as THREE.Material).dispose();
      box.children.forEach(child => ((child as THREE.LineSegments).material as THREE.Material).dispose());
      boxes.delete(id); labels.get(id)?.remove(); markers.get(id)?.remove(); labels.delete(id); markers.delete(id);
    }
    for (const id of ids) if (!boxes.has(id)) {
      const box = new THREE.Mesh(boxGeometry, new THREE.MeshBasicMaterial({ color: palette.parkas[id] }));
      box.add(new THREE.LineSegments(edgeGeometry, new THREE.LineBasicMaterial({ color: palette.ink })));
      const hood = new THREE.Mesh(hoodGeometry, new THREE.MeshBasicMaterial({ color: palette.parkas[id] }));
      // Lift the hood clear of the torso so the climber reads as a person at this camera angle.
      hood.position.y = TUNING.camera.hoodCenterY + TUNING.camera.hoodRadiusM; box.add(hood);
      // Mittens flank the parka; their size uses the existing boot silhouette dimensions.
      for (const side of [-1, 1]) {
        const mitten = new THREE.Mesh(bootGeometry, new THREE.MeshBasicMaterial({ color: palette.parkas[id] }));
        mitten.position.set(side * TUNING.camera.torsoWidthM / 2, -TUNING.camera.bootHeightM / 2, 0); box.add(mitten);
      }
      const face = new THREE.Mesh(hoodGeometry, new THREE.MeshBasicMaterial({ color: palette.ink }));
      face.scale.setScalar(0.6); face.position.set(0, hood.position.y, -TUNING.camera.hoodRadiusM / 2); box.add(face);
      const pack = new THREE.Mesh(packGeometry, new THREE.MeshBasicMaterial({ color: palette.ink }));
      pack.position.z = TUNING.camera.torsoDepthM / 2; box.add(pack);
      for (const side of [-1, 1]) {
        const boot = new THREE.Mesh(bootGeometry, new THREE.MeshBasicMaterial({ color: palette.ink }));
        boot.name = `boot${side}`; boot.position.set(side * TUNING.camera.bootWidthM / 2, TUNING.camera.bootCenterY, 0); box.add(boot);
      }
      boxes.set(id, box); bodies.add(box); labels.set(id, label('climber-label')); markers.set(id, label('edge-marker'));
    }
  }
  function surface(rect: Rect, color: string, y = 0) {
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(rect.maxX - rect.minX, rect.maxZ - rect.minZ), new THREE.MeshBasicMaterial({ color, side: THREE.DoubleSide }));
    mesh.rotation.x = -Math.PI / 2; mesh.position.set((rect.minX + rect.maxX) / 2, y, (rect.minZ + rect.maxZ) / 2); terrain.add(mesh);
    topSurfaces.push({ rect, mesh, top: () => mesh.position.y }); return mesh;
  }
  function line(points: Vec3[], color: string) {
    const geometry = new THREE.BufferGeometry().setFromPoints(points.map(p => new THREE.Vector3(p.x, p.y, p.z)));
    const edge = new THREE.Line(geometry, new THREE.LineBasicMaterial({ color })); terrain.add(edge); return edge;
  }
  function rebuildTerrain(state?: Snapshot) {
    const key = state ? `${state.epoch}:${state.seed}:${state.scene ?? 'flat'}:${JSON.stringify(state.terrain ? [state.terrain.bounds, state.terrain.crevasses, state.terrain.ice, state.terrain.finishZ, state.terrain.bridges.map(b => [b.id, b.minX, b.maxX, b.minZ, b.maxZ])] : [])}` : 'preview';
    if (terrainKey === key) return;
    terrainKey = key; disposeGroup(terrain); for (const bridge of bridges.values()) bridge.label.remove(); bridges.clear(); topSurfaces.length = 0;
    const flat = !state?.scene || state.scene === 'flat' || !state.terrain;
    ground.visible = flat; grid.visible = Boolean(flat && state);
    if (flat) {
      for (const mark of flatTerrain(state?.seed ?? TUNING.seed).marks) surface({ minX: mark.x, maxX: mark.x + TUNING.terrain.markSize,
        minZ: mark.z, maxZ: mark.z + TUNING.terrain.markSize }, '#999999', TUNING.rope.floorHeight);
      if (!state) {
        for (let id = 1; id < TUNING.phase2.defaultPlayers; id++) line(Array.from({ length: TUNING.rope.segments + 1 }, (_, i) => {
          const t = i / TUNING.rope.segments;
          return { x: 0, y: TUNING.body.harnessHeight - Math.sin(Math.PI * t) * TUNING.rope.initialSag, z: -(id - 1 + t) * TUNING.rope.initialSpacing };
        }), palette.rope);
      }
      return;
    }
    const level = state.terrain!;
    for (const patch of groundPatches(level.bounds, level.crevasses)) {
      surface(patch, palette.snow);
      for (let z = Math.ceil(patch.minZ / TUNING.camera.contourSpacingM) * TUNING.camera.contourSpacingM; z < patch.maxZ; z += TUNING.camera.contourSpacingM) {
        line(Array.from({ length: TUNING.camera.contourSamples }, (_, i) => {
          const x = patch.minX + (patch.maxX - patch.minX) * i / (TUNING.camera.contourSamples - 1);
          return { x, y: TUNING.rope.floorHeight / 2, z: Math.max(patch.minZ, Math.min(patch.maxZ, z + Math.sin((x + z) / TUNING.camera.contourWavelengthM) * TUNING.camera.contourWaveM)) };
        }), TUNING.camera.contourColor);
      }
      line([{ x: patch.minX, y: TUNING.rope.floorHeight, z: patch.minZ }, { x: patch.maxX, y: TUNING.rope.floorHeight, z: patch.minZ }], '#aaaaaa');
    }
    for (const gap of level.crevasses) {
      surface(gap, palette.glow, -gap.depth);
      // Fixed-camera cutaway: far walls are solid; near walls are outlines so a climber remains readable below the rim.
      const farZ = new THREE.Mesh(new THREE.PlaneGeometry(gap.maxX - gap.minX, gap.depth), new THREE.MeshBasicMaterial({ color: palette.depth, side: THREE.DoubleSide }));
      farZ.position.set((gap.minX + gap.maxX) / 2, -gap.depth / 2, gap.minZ); terrain.add(farZ);
      const farX = new THREE.Mesh(new THREE.PlaneGeometry(gap.maxZ - gap.minZ, gap.depth), new THREE.MeshBasicMaterial({ color: palette.depth, side: THREE.DoubleSide }));
      farX.rotation.y = Math.PI / 2; farX.position.set(gap.minX, -gap.depth / 2, (gap.minZ + gap.maxZ) / 2); terrain.add(farX);
      for (const x of [gap.minX, gap.maxX]) for (const z of [gap.minZ, gap.maxZ]) line([{ x, y: 0, z }, { x, y: -gap.depth, z }], palette.ink);
      line([{ x: gap.minX, y: TUNING.rope.floorHeight, z: gap.minZ }, { x: gap.maxX, y: TUNING.rope.floorHeight, z: gap.minZ },
        { x: gap.maxX, y: TUNING.rope.floorHeight, z: gap.maxZ }, { x: gap.minX, y: TUNING.rope.floorHeight, z: gap.maxZ }, { x: gap.minX, y: TUNING.rope.floorHeight, z: gap.minZ }], palette.ink);
    }
    for (const ice of level.ice) {
      surface(ice, '#DCE2E5', TUNING.rope.floorHeight / 2);
      for (let z = ice.minZ; z <= ice.maxZ; z += TUNING.terrain.gridUnit) line([{ x: ice.minX, y: TUNING.rope.floorHeight, z }, { x: ice.maxX, y: TUNING.rope.floorHeight, z }], '#eeeeee');
    }
    for (const bridge of level.bridges) {
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(bridge.maxX - bridge.minX, TUNING.phase2.bridgeThickness, bridge.maxZ - bridge.minZ), new THREE.MeshBasicMaterial({ color: palette.snow }));
      mesh.position.set((bridge.minX + bridge.maxX) / 2, -TUNING.phase2.bridgeThickness / 2, (bridge.minZ + bridge.maxZ) / 2);
      const seams = new THREE.LineSegments(new THREE.EdgesGeometry(mesh.geometry), new THREE.LineBasicMaterial({ color: palette.ink })); mesh.add(seams); terrain.add(mesh);
      bridges.set(bridge.id, { mesh, seams, anchor: new THREE.Vector3(mesh.position.x, 0, bridge.maxZ + TUNING.body.depth), label: label('bridge-label') });
      topSurfaces.push({ rect: bridge, mesh, top: () => mesh.position.y + TUNING.phase2.bridgeThickness / 2 });
    }
    if (level.finishZ !== null) {
      const cabin = new THREE.Mesh(new THREE.BoxGeometry(TUNING.camera.hutWidthM, TUNING.camera.hutHeightM, TUNING.camera.hutDepthM), new THREE.MeshBasicMaterial({ color: palette.parkas[1] }));
      cabin.position.set(0, TUNING.camera.hutHeightM / 2, level.finishZ + TUNING.camera.hutOffsetM); terrain.add(cabin);
      const roof = new THREE.Mesh(new THREE.ConeGeometry(TUNING.camera.hutWidthM, TUNING.camera.hutRoofHeightM, 4), new THREE.MeshBasicMaterial({ color: palette.rope }));
      roof.rotation.y = Math.PI / 4; roof.position.copy(cabin.position); roof.position.y = TUNING.camera.hutHeightM + TUNING.camera.hutRoofHeightM / 2; terrain.add(roof);
      const door = new THREE.Mesh(new THREE.PlaneGeometry(TUNING.body.width * 2, TUNING.camera.hutHeightM * 0.8), new THREE.MeshBasicMaterial({ color: palette.ink, side: THREE.DoubleSide }));
      door.position.set(0, TUNING.camera.hutHeightM * 0.4, cabin.position.z + TUNING.camera.hutDepthM / 2 + TUNING.rope.floorHeight); terrain.add(door);
      surface({ minX: level.bounds.minX, maxX: level.bounds.maxX, minZ: level.finishZ, maxZ: level.finishZ + TUNING.camera.terrainEdgeWidthM }, '#333333', TUNING.rope.floorHeight);
    }
  }
  function resize() { width = Math.max(1, host.clientWidth); height = Math.max(1, host.clientHeight); renderer.setSize(width, height); }
  const observer = new ResizeObserver(resize); observer.observe(host); resize();
  const viewCounters = () => ({ playersDrawn: boxes.size, spansDrawn: spanCount, segmentsDrawn: segmentCount,
    scope: 'Body, span and segment counts describe constructed scene objects, not visible pixels. Overlay overlap uses projected body rectangles.',
    cameraTarget: { x: cameraTarget.x, y: cameraTarget.y, z: cameraTarget.z }, verticalSpan,
    viewport: { width, height }, drawCalls: renderer.info.render.calls, geometries: renderer.info.memory.geometries,
    prediction: 'Own ordinary-ground body only; contact/rope limits. Ice, wall and air use authoritative interpolation.',
    cutawayTopFaces, bodiesCoveredByOverlays, cutaway: 'Near walls and top faces intersecting body-center-to-camera rays are outlines; physical contacts are unchanged.' });
  connection.viewCounters = viewCounters;
  function render() {
    // A queued receipt may be newer than the rAF timestamp. Use the receipt clock at callback execution.
    const now = performance.now();
    const dt = Math.min(Math.max(0, (now - previousAt) / 1000), TUNING.network.maximumPredictionMs / 1000); previousAt = now;
    const snapshot = connection.latest;
    const rendered = snapshot ? interpolateState(snapshot, connection.history, now) : undefined;
    rebuildTerrain(snapshot);
    if (snapshot && rendered) {
      const position = predictor.sample(snapshot, rendered, connection.localId, connection.input, dt,
        now - (connection.history.at(-1)?.at ?? now), connection.acceptsMovement);
      const own = rendered.players.find(p => p.id === connection.localId); if (own && position) own.position = position;
      syncPlayers(rendered.players.slice(0, TUNING.hardCap).map(p => p.id));
      for (const player of rendered.players) {
        const box = boxes.get(player.id); if (!box) continue;
        const visualHeight = player.brace && player.support !== 'air' ? TUNING.camera.braceVisualHeight : TUNING.body.height;
        box.position.set(player.position.x, player.position.y - (TUNING.body.height - visualHeight) / 2, player.position.z); box.scale.y = visualHeight / TUNING.body.height;
        (box.material as THREE.MeshBasicMaterial).color.set(palette.parkas[player.id]);
        const speed = Math.hypot(player.velocity.x, player.velocity.z);
        for (const side of [-1, 1]) {
          const boot = box.getObjectByName(`boot${side}`)!;
          boot.rotation.x = !reducedMotion.matches && speed > TUNING.camera.gaitSpeedThreshold && player.support === 'ground' && !player.brace
            ? Math.sin((snapshot.run?.elapsedSeconds ?? snapshot.tick / snapshot.tickHz) * speed * TUNING.camera.gaitCyclesPerMeter * Math.PI * 2 + player.id) * side * TUNING.camera.gaitSwingRadians : 0;
        }
        const identity = player.id === connection.localId ? 'YOU' : !player.connected ? 'EMPTY' : player.label.startsWith('BOT') ? 'BOT' : 'CLIMBER';
        const action = player.support === 'air' ? (player.rescueState ?? 'falling').toUpperCase()
          : player.brace ? 'BRACED' : player.rescueState === 'climbing' ? 'CLIMBING' : '';
        labels.get(player.id)!.textContent = `${identity} ${player.id + 1}${action ? `\n${action}` : ''}`;
      }
      const spans = displayedSpans(rendered); spanCount = spans.length; segmentCount = 0;
      for (const [index, span] of spans.entries()) {
        const material = spanMaterials[index];
        material.color.setHSL(ropeHsl.h, ropeHsl.s * Math.max(0, Math.min(1, 1 - span.slackM / span.length)), ropeHsl.l);
        for (let i = 1; i < span.points.length; i++) {
        let mesh = ropeMeshes[segmentCount];
        if (!mesh) { mesh = new THREE.Mesh(ropeGeometry, ropeMaterial); ropeMeshes.push(mesh); rope.add(mesh); }
        const a = new THREE.Vector3(span.points[i - 1].x, span.points[i - 1].y, span.points[i - 1].z);
        const b = new THREE.Vector3(span.points[i].x, span.points[i].y, span.points[i].z); direction.subVectors(b, a);
        const length = direction.length(); mesh.visible = length > 0;
        mesh.position.copy(a).add(b).multiplyScalar(0.5);
        const radius = span.catchHighlight ? TUNING.camera.catchRadiusMultiplier : 1;
        mesh.scale.set(radius, length, radius); if (length > 0) mesh.quaternion.setFromUnitVectors(up, direction.normalize());
        mesh.material = span.catchHighlight ? catchMaterial : material; segmentCount++;
        }
      }
      for (let i = segmentCount; i < ropeMeshes.length; i++) ropeMeshes[i].visible = false;
      for (const bridge of snapshot.terrain?.bridges ?? []) {
        const visual = bridges.get(bridge.id); if (!visual) continue;
        const cue = Math.max(0, Math.min(1, bridge.cue));
        visual.mesh.visible = !bridge.collapsed;
        visual.mesh.position.y = -TUNING.phase2.bridgeThickness / 2 - cue * TUNING.camera.bridgeCueSagM;
        (visual.mesh.material as THREE.MeshBasicMaterial).color.lerpColors(new THREE.Color(palette.snow), new THREE.Color(palette.ink), cue);
        visual.label.textContent = bridge.collapsed ? 'BROKEN SNOW' : cue > 0 ? 'SNOW GIVING WAY' : '';
      }
    } else {
      predictor.reset(); spanCount = segmentCount = 0; ropeMeshes.forEach(mesh => { mesh.visible = false; });
      syncPlayers(Array.from({ length: TUNING.phase2.defaultPlayers }, (_, id) => id));
      for (const [id, box] of boxes) {
        box.position.set(0, TUNING.body.height / 2, -id * TUNING.rope.initialSpacing); box.scale.y = 1; labels.get(id)!.textContent = '';
      }
    }
    const positions = rendered?.players ?? [...boxes].map(([id, box]) => ({ id, position: box.position }));
    cutawayTopFaces = 0;
    for (const surface of topSurfaces) {
      const blocked = surface.mesh.visible && positions.some(p => topSurfaceOccludesBody(surface.rect, surface.top(), p.position));
      (surface.mesh.material as THREE.MeshBasicMaterial).wireframe = blocked;
      if (blocked) cutawayTopFaces++;
    }
    const rims: Vec3[] = [];
    for (const player of rendered?.players ?? []) if (player.support === 'air' || player.support === 'wall') {
      for (const gap of snapshot?.terrain?.crevasses ?? []) if (inside(player.position, gap)) {
        rims.push({ x: player.position.x, y: 0, z: gap.minZ }, { x: player.position.x, y: 0, z: gap.maxZ });
      }
    }
    const desired = cameraFrame(positions, connection.localId, width / height, rims);
    target.set(desired.target.x, desired.target.y, desired.target.z);
    if (!snapshot) {
      // Center the preview rope in the space beside the introduction, so all four figures show.
      const intro = host.querySelector<HTMLElement>('.intro-overlay');
      const occupied = intro ? intro.offsetLeft + intro.offsetWidth : 0;
      const shift = occupied * desired.span / height / 2;
      target.x -= Math.cos(az) * shift; target.z += Math.sin(az) * shift;
    }
    const epoch = snapshot?.epoch ?? null;
    if (cameraEpoch !== epoch) { cameraTarget.copy(target); verticalSpan = desired.span; cameraEpoch = epoch; }
    const blend = 1 - Math.exp(-dt / TUNING.camera.smoothingSeconds);
    cameraTarget.lerp(target, blend); verticalSpan += (desired.span - verticalSpan) * blend;
    ground.position.x = grid.position.x = Math.round(cameraTarget.x / TUNING.terrain.gridUnit) * TUNING.terrain.gridUnit;
    ground.position.z = grid.position.z = Math.round(cameraTarget.z / TUNING.terrain.gridUnit) * TUNING.terrain.gridUnit;
    camera.left = -verticalSpan * width / height / 2; camera.right = -camera.left; camera.top = verticalSpan / 2; camera.bottom = -camera.top;
    camera.updateProjectionMatrix(); camera.position.copy(cameraTarget).add(offset); camera.lookAt(cameraTarget); camera.updateMatrixWorld();
    frustum.setFromProjectionMatrix(projection.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse));
    const visiblePlayers = new Set<number>(), visibleBridges = new Set<number>();
    // HTML overlays also occlude the canvas. Reserve each projected box before placing labels or status text.
    const bodyRects: ScreenRect[] = [];
    for (const box of boxes.values()) {
      const points = [];
      for (const x of [-1, 1]) for (const y of [-1, 1]) for (const z of [-1, 1]) points.push(project(new THREE.Vector3(
        box.position.x + x * TUNING.body.width / 2, box.position.y + (y < 0 ? -TUNING.body.height / 2 : TUNING.camera.hoodCenterY + 2 * TUNING.camera.hoodRadiusM) * box.scale.y, box.position.z + z * TUNING.body.depth / 2)));
      const minX = Math.min(...points.map(p => p.x)), minY = Math.min(...points.map(p => p.y));
      bodyRects.push({ x: minX, y: minY, width: Math.max(...points.map(p => p.x)) - minX, height: Math.max(...points.map(p => p.y)) - minY });
    }
    const placed: ScreenRect[] = [];
    const place = (node: HTMLElement, x: number, y: number) => {
      const rect = placeOverlay({ x, y, width: node.offsetWidth, height: node.offsetHeight }, { width, height }, bodyRects, placed);
      node.style.transform = `translate(${rect.x - node.offsetLeft}px, ${rect.y - node.offsetTop}px)`; placed.push(rect);
    };
    for (const node of host.querySelectorAll<HTMLElement>('.run-status,.scene-caption')) place(node, node.offsetLeft, node.offsetTop);
    for (const [id, box] of boxes) {
      const at = project(box.position), text = labels.get(id)!, marker = markers.get(id)!;
      text.hidden = !at.visible; marker.hidden = at.visible;
      if (at.visible) { visiblePlayers.add(id); place(text, at.x + TUNING.camera.labelOffsetPx, at.y - text.offsetHeight / 2); }
      else {
        const inset = Math.min(TUNING.camera.edgeInsetPx, width / 2, height / 2);
        marker.style.left = `${Math.max(inset, Math.min(width - inset, at.x))}px`; marker.style.top = `${Math.max(inset, Math.min(height - inset, at.y))}px`;
        const tension = Math.max(0, ...(snapshot ? ropeSpans(snapshot).filter(s => s.a === id || s.b === id).map(s => s.tension) : []));
        marker.textContent = `${at.y < 0 ? '↑' : at.y > height ? '↓' : at.x < width / 2 ? '←' : '→'} P${id + 1} · ${Math.round(tension * 100)}%`;
      }
    }
    for (const [id, bridge] of bridges) {
      const at = project(bridge.anchor); bridge.label.hidden = !at.visible || !bridge.label.textContent;
      if (at.visible && bridge.label.textContent) place(bridge.label, at.x - bridge.label.offsetWidth / 2, at.y - bridge.label.offsetHeight);
      // Evidence follows the actual surface bounds, independently of the label's offset onto the bank.
      if (frustum.intersectsBox(bridgeBounds.setFromObject(bridge.mesh))) visibleBridges.add(id);
    }
    bodiesCoveredByOverlays = bodyRects.filter(body => placed.some(rect => overlapArea(body, rect) > 0)).length;
    renderer.render(scene, camera);
    if (snapshot) connection.evidence.drawn(snapshot, visibleBridges, visiblePlayers);
    frame = requestAnimationFrame(render);
  }
  frame = requestAnimationFrame(render);
  return { canvas: renderer.domElement, counters: viewCounters, dispose() {
    cancelAnimationFrame(frame); observer.disconnect(); labels.forEach(node => node.remove()); markers.forEach(node => node.remove()); bridges.forEach(bridge => bridge.label.remove());
    if (connection.viewCounters === viewCounters) connection.viewCounters = () => null;
    disposeGroup(scene); boxGeometry.dispose(); edgeGeometry.dispose(); hoodGeometry.dispose(); bootGeometry.dispose(); packGeometry.dispose(); ropeGeometry.dispose(); spanMaterials.forEach(material => material.dispose()); catchMaterial.dispose();
    renderer.dispose(); renderer.domElement.remove();
  } };
}
