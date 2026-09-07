import * as THREE from 'three';
import { TUNING } from '../tuning';
import { flatTerrain } from '../shared/terrain';
import { motorVelocity } from '../shared/movement';
import type { BelayConnection } from './connection';
import type { Snapshot, Vec3 } from '../shared/protocol';

export function createViewport(host: HTMLElement, connection: BelayConnection) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#d7d7d7');
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, TUNING.camera.distance * 4);
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
  renderer.setPixelRatio(Math.min(devicePixelRatio, TUNING.camera.maximumPixelRatio));
  renderer.domElement.tabIndex = 0;
  renderer.domElement.setAttribute('aria-label', 'Flat-ground rope test. Move with WASD or arrows. Hold Space to brace.');
  host.append(renderer.domElement);
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(TUNING.terrain.halfExtent * 2, TUNING.terrain.halfExtent * 2), new THREE.MeshBasicMaterial({ color: '#d7d7d7' }));
  ground.rotation.x = -Math.PI / 2; scene.add(ground);
  const grid = new THREE.GridHelper(TUNING.terrain.halfExtent * 2, TUNING.terrain.halfExtent * 2, '#bcbcbc', '#c6c6c6');
  grid.position.y = TUNING.rope.floorHeight / 2; scene.add(grid);
  const boxes: THREE.Mesh[] = [], outlines: THREE.LineSegments[] = [];
  const labels: HTMLDivElement[] = [], markers: HTMLDivElement[] = [];
  const boxGeometry = new THREE.BoxGeometry(TUNING.body.width, TUNING.body.height, TUNING.body.depth);
  for (let i = 0; i < TUNING.players; i++) {
    const material = new THREE.MeshBasicMaterial({ color: i === 0 ? '#777777' : '#a8a8a8' });
    const box = new THREE.Mesh(boxGeometry, material);
    box.position.set((i - 0.5) * TUNING.rope.initialSpacing, TUNING.body.height / 2, 0);
    scene.add(box); boxes.push(box);
    const line = new THREE.LineSegments(new THREE.EdgesGeometry(boxGeometry), new THREE.LineBasicMaterial({ color: '#222222' }));
    box.add(line); outlines.push(line);
    const label = document.createElement('div'); label.className = 'climber-label'; label.textContent = String(i + 1); host.append(label); labels.push(label);
    const marker = document.createElement('div'); marker.className = 'edge-marker'; marker.hidden = true; host.append(marker); markers.push(marker);
  }
  const ropeMaterial = new THREE.MeshBasicMaterial({ color: '#404040' });
  const ropeGeometry = new THREE.CylinderGeometry(TUNING.rope.radius, TUNING.rope.radius, 1, 6);
  const ropeSegments = Array.from({ length: TUNING.rope.segments }, () => { const mesh = new THREE.Mesh(ropeGeometry, ropeMaterial); mesh.visible = false; scene.add(mesh); return mesh; });
  const marks = new THREE.Group(); scene.add(marks);
  let markSeed: number | undefined;
  const centroid = new THREE.Vector3(), cameraTarget = new THREE.Vector3(), target = new THREE.Vector3();
  const direction = new THREE.Vector3();
  const up = new THREE.Vector3(0, 1, 0);
  const az = THREE.MathUtils.degToRad(TUNING.camera.azimuthDegrees), el = THREE.MathUtils.degToRad(TUNING.camera.elevationDegrees);
  const cameraOffset = new THREE.Vector3(Math.sin(az) * Math.cos(el), Math.sin(el), Math.cos(az) * Math.cos(el)).multiplyScalar(TUNING.camera.distance);
  let width = 1, height = 1, frame = 0, previousAt = performance.now(), verticalSpan = TUNING.camera.baseVerticalSpan as number;
  let predicted: Vec3 | undefined, predictedVelocity: Vec3 | undefined, predictedTick = -1, predictedEpoch = -1;
  const correction = new THREE.Vector3();

  function resize() { width = host.clientWidth; height = host.clientHeight; renderer.setSize(width, height); }
  const observer = new ResizeObserver(resize); observer.observe(host); resize();
  function interpolate(a: Vec3, b: Vec3, t: number) { return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, z: a.z + (b.z - a.z) * t }; }
  function render(now: number) {
    const dt = Math.min((now - previousAt) / 1000, TUNING.network.maximumPredictionMs / 1000); previousAt = now;
    const snapshot = connection.latest;
    let renderState: Snapshot | undefined;
    if (snapshot) {
      const samples = connection.history, at = now - TUNING.network.interpolationMs;
      let a = samples[0], b = samples.at(-1)!;
      for (let i = 1; i < samples.length; i++) if (samples[i].at >= at) { a = samples[i - 1]; b = samples[i]; break; }
      const blend = b.at === a.at ? 1 : Math.max(0, Math.min(1, (at - a.at) / (b.at - a.at)));
      renderState = { ...snapshot, players: snapshot.players.map((p, i) => ({ ...p, position: interpolate(a.state.players[i].position, b.state.players[i].position, blend) })),
        rope: { ...snapshot.rope, points: snapshot.rope.points.map((p, i) => interpolate(a.state.rope.points[i] ?? p, b.state.rope.points[i] ?? p, blend)) } };
      const local = snapshot.players[connection.localId];
      if (local) {
        if (snapshot.epoch !== predictedEpoch || !predicted) {
          predicted = { ...local.position }; predictedVelocity = { ...local.velocity }; correction.set(0, 0, 0);
        } else if (predictedTick !== snapshot.tick) {
          correction.set(predicted.x + correction.x - local.position.x, 0, predicted.z + correction.z - local.position.z);
          if (correction.length() > TUNING.network.hardCorrectionDistance) correction.set(0, 0, 0);
          predicted = { ...local.position }; predictedVelocity = { ...local.velocity };
        }
        predictedEpoch = snapshot.epoch; predictedTick = snapshot.tick;
        const age = now - samples.at(-1)!.at;
        if (!snapshot.paused && age < TUNING.network.maximumPredictionMs) {
          predictedVelocity = motorVelocity(predictedVelocity!, connection.input, dt, snapshot.family);
          predicted.x += predictedVelocity.x * dt; predicted.z += predictedVelocity.z * dt;
          // Only local motion is predicted. The neighbor is an authoritative boundary condition.
          const neighbor = snapshot.players[1 - connection.localId].position;
          const dx = predicted.x - neighbor.x, dz = predicted.z - neighbor.z, distance = Math.hypot(dx, dz);
          if (distance > snapshot.rope.length) {
            predicted.x = neighbor.x + dx / distance * snapshot.rope.length;
            predicted.z = neighbor.z + dz / distance * snapshot.rope.length;
          }
        }
        correction.multiplyScalar(Math.exp(-dt / TUNING.network.reconciliationSeconds));
        renderState.players[connection.localId].position = { x: predicted.x + correction.x, y: predicted.y, z: predicted.z + correction.z };
      }
      if (markSeed !== snapshot.seed) {
        // Snapshot the child list because removal mutates it during iteration.
        for (const child of marks.children.slice()) { const mesh = child as THREE.Mesh; mesh.geometry.dispose(); (mesh.material as THREE.Material).dispose(); marks.remove(child); }
        for (const m of flatTerrain(snapshot.seed).marks) {
          const mark = new THREE.Mesh(new THREE.PlaneGeometry(TUNING.terrain.markSize, TUNING.terrain.markSize), new THREE.MeshBasicMaterial({ color: '#999999' }));
          mark.rotation.x = -Math.PI / 2; mark.position.set(m.x, TUNING.rope.floorHeight, m.z); marks.add(mark);
        }
        markSeed = snapshot.seed;
      }
      renderState.players.forEach((p, i) => {
        const visualHeight = p.brace ? TUNING.camera.braceVisualHeight : TUNING.body.height;
        boxes[i].position.set(p.position.x, p.position.y - (TUNING.body.height - visualHeight) / 2, p.position.z);
        boxes[i].scale.y = visualHeight / TUNING.body.height;
        labels[i].textContent = `${i === connection.localId ? 'YOU' : p.connected ? p.label : 'EMPTY'}${p.brace ? ' · BRACED' : ''}`;
      });
      const points = renderState.rope.points.map(p => new THREE.Vector3(p.x, p.y, p.z));
      // Correct rendered endpoints without predicting any remote body or changing rope-force feedback.
      const endpointOffsets = renderState.players.map((p, i) => new THREE.Vector3(p.position.x, p.position.y - TUNING.body.height / 2 + TUNING.body.harnessHeight, p.position.z)
        .sub(points[i === 0 ? 0 : points.length - 1]));
      points.forEach((p, i) => p.addScaledVector(endpointOffsets[0], 1 - i / (points.length - 1)).addScaledVector(endpointOffsets[1], i / (points.length - 1)));
      ropeSegments.forEach((segment, i) => {
        const a = points[i], b = points[i + 1]; direction.subVectors(b, a);
        segment.visible = true; segment.position.copy(a).add(b).multiplyScalar(0.5);
        segment.scale.y = direction.length(); segment.quaternion.setFromUnitVectors(up, direction.normalize());
      });
      ropeMaterial.color.setScalar(0.3 - renderState.rope.tension * 0.25);
    }
    centroid.set(0, 0, 0); boxes.forEach(b => centroid.add(b.position)); centroid.divideScalar(boxes.length);
    target.copy(centroid);
    if (connection.localId >= 0) target.lerp(boxes[connection.localId].position, TUNING.camera.localWeight);
    cameraTarget.lerp(target, 1 - Math.exp(-dt / TUNING.camera.smoothingSeconds));
    ground.position.x = grid.position.x = Math.round(cameraTarget.x / TUNING.terrain.gridUnit) * TUNING.terrain.gridUnit;
    ground.position.z = grid.position.z = Math.round(cameraTarget.z / TUNING.terrain.gridUnit) * TUNING.terrain.gridUnit;
    const span = boxes[0].position.distanceTo(boxes[1].position) + TUNING.camera.margin;
    const desiredSpan = Math.min(TUNING.camera.maximumVerticalSpan, Math.max(TUNING.camera.baseVerticalSpan, span / Math.min(1, width / height)));
    verticalSpan += (desiredSpan - verticalSpan) * (1 - Math.exp(-dt / TUNING.camera.smoothingSeconds));
    camera.left = -verticalSpan * width / height / 2; camera.right = -camera.left;
    camera.top = verticalSpan / 2; camera.bottom = -camera.top; camera.updateProjectionMatrix();
    camera.position.copy(cameraTarget).add(cameraOffset); camera.lookAt(cameraTarget); camera.updateMatrixWorld();
    boxes.forEach((box, i) => {
      const projected = box.position.clone().project(camera);
      const x = (projected.x + 1) * width / 2, y = (1 - projected.y) * height / 2;
      const off = Math.abs(projected.x) > 1 || Math.abs(projected.y) > 1;
      labels[i].hidden = off; markers[i].hidden = !off;
      labels[i].style.transform = `translate(${x}px, ${y - TUNING.camera.labelOffsetPx}px) translate(-50%, -100%)`;
      if (off) {
        const inset = TUNING.camera.edgeInsetPx;
        markers[i].style.left = `${Math.max(inset, Math.min(width - inset, x))}px`;
        markers[i].style.top = `${Math.max(inset, Math.min(height - inset, y))}px`;
        markers[i].textContent = `${x < width / 2 ? '←' : '→'} ${i + 1} · ${Math.round((snapshot?.rope.tension ?? 0) * 100)}%`;
      }
    });
    renderer.render(scene, camera); frame = requestAnimationFrame(render);
  }
  frame = requestAnimationFrame(render);
  return { canvas: renderer.domElement, dispose() {
    cancelAnimationFrame(frame); observer.disconnect(); labels.forEach(l => l.remove()); markers.forEach(m => m.remove());
    scene.traverse(object => { const mesh = object as THREE.Mesh; mesh.geometry?.dispose();
      const material = mesh.material; if (Array.isArray(material)) material.forEach(m => m.dispose()); else material?.dispose(); });
    renderer.dispose(); renderer.domElement.remove();
  } };
}
