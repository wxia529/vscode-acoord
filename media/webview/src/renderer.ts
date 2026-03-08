import * as THREE from 'three';
import { TrackballControls } from 'three/examples/jsm/controls/TrackballControls.js';
import { structureStore, displayStore, lightingStore } from './state';
import type { Atom, Bond, Structure, UiHooks, UnitCellEdge } from './types';
import { debounce } from './utils/performance';
import * as axisIndicator from './axisIndicator';

const MOUSE = THREE.MOUSE;

// Camera auto-scaling constants
const CAMERA_TARGET_DIMENSION = 30;
const CAMERA_SCALE_MIN = 0.05;
const CAMERA_SCALE_MAX = 5;
const CAMERA_SIZE_SCALE_MIN = 1.5;
const CAMERA_SIZE_SCALE_MAX = 6;

// Restore Three.js r128-era rendering behavior.
// r155+ defaults to sRGB output + color management which darkens the scene
// significantly compared to the legacy linear pipeline.
THREE.ColorManagement.enabled = false;

export interface RendererApi {
  init(canvas: HTMLCanvasElement, handlers: { setError: (m: string) => void; setStatus: (m: string) => void }): void;
  renderStructure(structure: Structure, hooks: UiHooks, options?: { fitCamera?: boolean }): void;
  fitCamera(): void;
  setProjectionMode(mode: 'orthographic' | 'perspective'): void;
  snapCameraToAxis(axis: string): void;
  getScale(): number;
  getRaycaster(): THREE.Raycaster;
  getMouse(): THREE.Vector2;
  getCamera(): THREE.Camera;
  getAtomMeshes(): Map<string, THREE.Mesh>;
  getBondMeshes(): THREE.Mesh[];
  getDragPlane(): THREE.Plane;
  setControlsEnabled(enabled: boolean): void;
  setOnCameraMove(callback: (() => void) | null): void;
  updateLighting(): void;
  updateDisplaySettings(): void;
  exportHighResolutionImage(options?: { scale?: number }): { dataUrl: string; width: number; height: number } | null;
  updateAtomPosition(atomId: string, position: THREE.Vector3): void;
  markDirty(): void;
  rotateCameraBy(axis: string, angleDeg: number): void;
  dispose(): void;
}

interface RendererState {
  scene: THREE.Scene | null;
  camera: THREE.PerspectiveCamera | THREE.OrthographicCamera | null;
  renderer: THREE.WebGLRenderer | null;
  controls: TrackballControls | { update: () => void; enabled?: boolean; target?: THREE.Vector3; dispose?: () => void } | null;
  onCameraMove: (() => void) | null;
  /** Invisible per-atom meshes used only for raycasting and drag interaction. */
  atomMeshes: Map<string, THREE.Mesh>;
  /** Instanced meshes that visually render atoms (one per radius group). */
  atomInstancedMeshes: THREE.InstancedMesh[];
  /** Maps atom id to its instanced mesh + instance index for matrix updates during drag. */
  atomInstanceIndex: Map<string, { im: THREE.InstancedMesh; index: number }>;
  /**
   * Maps atom id to all bond-half instances that touch this atom (either end).
   * Used by updateAtomPosition() to incrementally recompute bond cylinder
   * matrices without a full renderStructure() rebuild.
   *
   * Each entry describes one half-cylinder:
   *   im      – the InstancedMesh that owns this instance
   *   index   – the instance index within im
   *   atomId1 – atom id at the start (non-midpoint) end of this half
   *   atomId2 – atom id at the far full end (the other endpoint of the bond)
   *   isFirstHalf – true  → half runs from atomId1 toward midpoint
   *                 false → half runs from midpoint toward atomId1
   *                 (atomId2 is always the other endpoint, never in this half)
   *
   * Both atomId1 and atomId2 keys in bondHalfIndex point to the same entry so
   * that moving either endpoint triggers a recompute of both halves.
   */
  bondHalfIndex: Map<string, Array<{
    im: THREE.InstancedMesh;
    index: number;
    atomId1: string;
    atomId2: string;
    isFirstHalf: boolean;
    /**
      * For cross-boundary periodic stubs, the cell-boundary endpoint of the
      * full stub.  During drag, the midpoint between the atom's live position
      * and this fixed boundary point is recalculated, and each half-cylinder
      * is updated accordingly.  Null for ordinary (non-periodic-stub) bond halves.
      */
      fixedEnd: THREE.Vector3 | null;
  }>>;
  bondMeshes: THREE.Mesh[];
  bondLines: THREE.Mesh[];
  /** Instanced meshes that visually render bonds (one per radius group). */
  bondInstancedMeshes: THREE.InstancedMesh[];
  unitCellGroup: THREE.Group | null;
  raycaster: THREE.Raycaster | null;
  mouse: THREE.Vector2 | null;
  dragPlane: THREE.Plane | null;
  lastScale: number;
  lastSizeScale: number;
  extraMeshes: THREE.Mesh[];
  projectionMode: string;
  orthoSize: number;
  setError: (m: string) => void;
  setStatus: (m: string) => void;
  ambientLight: THREE.AmbientLight | null;
  keyLight: THREE.DirectionalLight | null;
  fillLight: THREE.DirectionalLight | null;
  rimLight: THREE.DirectionalLight | null;
  /** Dirty flag: set true whenever the scene needs a re-render. */
  needsRender: boolean;
  /** Status update interval handle for cleanup. */
  statusInterval: ReturnType<typeof setInterval> | null;
  /** requestAnimationFrame handle for cancellation on dispose. */
  animationFrameId: number | null;
}

const rendererState: RendererState = {
  scene: null,
  camera: null,
  renderer: null,
  controls: null,
  onCameraMove: null,
  atomMeshes: new Map(),
  atomInstancedMeshes: [],
  atomInstanceIndex: new Map(),
  bondHalfIndex: new Map(),
  bondMeshes: [],
  bondLines: [],
  bondInstancedMeshes: [],
  unitCellGroup: null,
  raycaster: null,
  mouse: null,
  dragPlane: null,
  lastScale: 1,
  lastSizeScale: 1,
  extraMeshes: [],
  projectionMode: 'perspective',
  orthoSize: 30,
  setError: () => {},
  setStatus: () => {},
  ambientLight: null,
  keyLight: null,
  fillLight: null,
  rimLight: null,
  needsRender: true,
  statusInterval: null,
  animationFrameId: null,
};

/** Mark the scene dirty so animate() will issue a render on the next frame. */
function markDirty(): void {
  rendererState.needsRender = true;
}

function resolveLightColor(value: unknown, fallback: string): string {
  const color = typeof value === 'string' ? value.trim() : '';
  if (/^#[0-9A-Fa-f]{6}$/.test(color)) {
    return color;
  }
  return fallback;
}

function getSurfaceShininess(): number {
  const value = Number(displayStore.shininess);
  if (!Number.isFinite(value)) {
    return 50;
  }
  return Math.max(30, Math.min(100, value));
}

function setObjectShininess(object: THREE.Object3D | null, shininess: number): void {
  if (!object) return;
  object.traverse((node) => {
    const mesh = node as THREE.Mesh;
    if (!mesh.material) return;
    const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    for (const material of materials) {
      if (material && 'shininess' in material) {
        (material as THREE.MeshPhongMaterial).shininess = shininess;
        material.needsUpdate = true;
      }
    }
  });
}

function applySurfaceShininess(): void {
  const shininess = getSurfaceShininess();
  // Update instanced atom meshes (visual rendering meshes).
  for (const im of rendererState.atomInstancedMeshes) {
    setObjectShininess(im, shininess);
  }
  // Update non-selectable extra atom meshes.
  for (const mesh of rendererState.extraMeshes) {
    setObjectShininess(mesh, shininess);
  }
  // Update instanced bond meshes.
  for (const im of rendererState.bondInstancedMeshes) {
    setObjectShininess(im, shininess);
  }
}

function getOrthoFrustum(width: number, height: number) {
  const aspect = width / height;
  const viewSize = Math.max(1, rendererState.orthoSize || 30);
  const halfHeight = viewSize / 2;
  const halfWidth = halfHeight * aspect;
  return { left: -halfWidth, right: halfWidth, top: halfHeight, bottom: -halfHeight };
}

function createCamera(mode: string, width: number, height: number): THREE.PerspectiveCamera | THREE.OrthographicCamera {
  if (mode === 'orthographic') {
    const frustum = getOrthoFrustum(width, height);
    const camera = new THREE.OrthographicCamera(
      frustum.left, frustum.right, frustum.top, frustum.bottom, 0.1, 10000
    );
    camera.zoom = displayStore.viewZoom || 1;
    camera.updateProjectionMatrix();
    return camera;
  }
  return new THREE.PerspectiveCamera(75, width / height, 0.1, 10000);
}

function applyControls(camera: THREE.Camera): void {
  const ctrl = rendererState.controls as TrackballControls | null;
  if (ctrl && ctrl.dispose) {
    ctrl.dispose();
  }
  const controls = new TrackballControls(camera, rendererState.renderer!.domElement);
  controls.rotateSpeed = 3.0;
  controls.zoomSpeed = 1.2;
  controls.panSpeed = 0.8;
  controls.staticMoving = true;
  controls.mouseButtons = {
    LEFT: MOUSE.PAN,
    MIDDLE: MOUSE.DOLLY,
    RIGHT: MOUSE.ROTATE,
  };
  controls.addEventListener('change', () => {
    markDirty();
    if (rendererState.onCameraMove) {
      rendererState.onCameraMove();
    }
  });
  rendererState.controls = controls;
}

function init(canvas: HTMLCanvasElement, handlers: { setError: (m: string) => void; setStatus: (m: string) => void }): void {
  rendererState.setError = handlers.setError;
  rendererState.setStatus = handlers.setStatus;

  const container = document.getElementById('container');
  if (!container) { handlers.setError('Container element not found.'); return; }
  const rect = container.getBoundingClientRect();
  const width = Math.max(1, rect.width - 250);
  const height = Math.max(1, rect.height);
  handlers.setStatus('Canvas size: ' + Math.round(width) + 'x' + Math.round(height));

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(displayStore.backgroundColor || '#0d1015');
  rendererState.scene = scene;

  rendererState.projectionMode = displayStore.projectionMode || 'perspective';
  const camera = createCamera(rendererState.projectionMode, width, height);
  camera.position.z = 20;
  rendererState.camera = camera;

  try {
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setClearColor(0x222222, 1);
    // Use linear output to match the old Three.js r128 visual appearance.
    renderer.outputColorSpace = THREE.LinearSRGBColorSpace;
    rendererState.renderer = renderer;
  } catch {
    handlers.setError('WebGL renderer failed to initialize. Check GPU/WebGL support.');
    return;
  }

  const gl = rendererState.renderer!.getContext();
  if (!gl) {
    handlers.setError('WebGL context unavailable. Your system or VS Code may have WebGL disabled.');
    return;
  }

  rendererState.ambientLight = new THREE.AmbientLight(
    resolveLightColor(lightingStore.ambientColor, '#ffffff'),
    // Three.js r183 BRDF_Lambert divides diffuse by PI in the shader.
    // Multiply intensity by PI to compensate and match old r128 brightness.
    (lightingStore.ambientIntensity ?? 0.5) * Math.PI
  );
  scene.add(rendererState.ambientLight);

  rendererState.keyLight = new THREE.DirectionalLight(
    resolveLightColor(lightingStore.keyLight?.color, '#CCCCCC'),
    (lightingStore.keyLight?.intensity ?? 0.7) * Math.PI
  );
  scene.add(rendererState.keyLight);

  rendererState.fillLight = new THREE.DirectionalLight(
    resolveLightColor(lightingStore.fillLight?.color, '#ffffff'),
    (lightingStore.fillLight?.intensity ?? 0) * Math.PI
  );
  scene.add(rendererState.fillLight);

  rendererState.rimLight = new THREE.DirectionalLight(
    resolveLightColor(lightingStore.rimLight?.color, '#ffffff'),
    (lightingStore.rimLight?.intensity ?? 0) * Math.PI
  );
  scene.add(rendererState.rimLight);

  updateLightsForCamera();

  axisIndicator.init();

  applyControls(camera);

  camera.lookAt(0, 0, 0);
  rendererState.raycaster = new THREE.Raycaster();
  rendererState.mouse = new THREE.Vector2();
  rendererState.dragPlane = new THREE.Plane();

  window.addEventListener('resize', _onResizeDebounced);
  onResize();
  requestAnimationFrame(() => onResize());
  setTimeout(() => onResize(), 150);
  animate();
  markDirty();

  rendererState.statusInterval = setInterval(() => {
    const calls = rendererState.renderer ? rendererState.renderer.info.render.calls : 0;
    handlers.setStatus('Render OK. Draw calls: ' + calls + ' | Atoms: ' + rendererState.atomMeshes.size);
  }, 1000);
}

function animate(): void {
  rendererState.animationFrameId = requestAnimationFrame(animate);
  if (!rendererState.renderer || !rendererState.controls) return;
  rendererState.controls.update();
  if (rendererState.camera) {
    axisIndicator.update(rendererState.camera.quaternion);
  }
  if (!rendererState.needsRender) return;
  rendererState.needsRender = false;
  updateLightsForCamera();
  rendererState.renderer.render(rendererState.scene!, rendererState.camera!);
}

function updateLightsForCamera(): void {
  if (!rendererState.camera || !rendererState.keyLight ||
      !rendererState.fillLight || !rendererState.rimLight) {
    return;
  }
  const camera = rendererState.camera;
  // Reuse pre-allocated scratch Vector3s — no allocations per frame.
  _keyOffset.set(lightingStore.keyLight?.x ?? 0, lightingStore.keyLight?.y ?? 0, lightingStore.keyLight?.z ?? 10);
  _fillOffset.set(lightingStore.fillLight?.x ?? -10, lightingStore.fillLight?.y ?? -5, lightingStore.fillLight?.z ?? 5);
  _rimOffset.set(lightingStore.rimLight?.x ?? 0, lightingStore.rimLight?.y ?? 5, lightingStore.rimLight?.z ?? -10);

  _keyOffset.applyQuaternion(camera.quaternion);
  _fillOffset.applyQuaternion(camera.quaternion);
  _rimOffset.applyQuaternion(camera.quaternion);

  const distance = 50;
  rendererState.keyLight.position.copy(_keyOffset.normalize().multiplyScalar(distance));
  rendererState.fillLight.position.copy(_fillOffset.normalize().multiplyScalar(distance));
  rendererState.rimLight.position.copy(_rimOffset.normalize().multiplyScalar(distance));
}

// Cached reference to the main container element — set on first onResize call.
let _container: HTMLElement | null = null;

function onResize(): void {
  if (!rendererState.renderer || !rendererState.camera) return;
  if (!_container) {
    _container = document.getElementById('container');
  }
  if (!_container) return;
  const rect = _container.getBoundingClientRect();
  const width = Math.max(1, rect.width - 250);
  const height = Math.max(1, rect.height);
  if (rendererState.camera instanceof THREE.OrthographicCamera) {
    const frustum = getOrthoFrustum(width, height);
    rendererState.camera.left = frustum.left;
    rendererState.camera.right = frustum.right;
    rendererState.camera.top = frustum.top;
    rendererState.camera.bottom = frustum.bottom;
    rendererState.camera.zoom = displayStore.viewZoom || 1;
  } else if (rendererState.camera instanceof THREE.PerspectiveCamera) {
    rendererState.camera.aspect = width / height;
  }
  rendererState.camera.updateProjectionMatrix();
  rendererState.renderer.setSize(width, height);
  const ctrl = rendererState.controls as TrackballControls | null;
  if (ctrl && ctrl.handleResize) {
    ctrl.handleResize();
  }
  markDirty();
}

// Debounced variant for the window resize event — avoids multiple full
// renderer resizes when the OS fires a burst of resize events.
const _onResizeDebounced = debounce(onResize, 50);

function getAutoScales(atoms: Atom[]): { scale: number; sizeScale: number } {
  if (!atoms || atoms.length === 0) return { scale: 1, sizeScale: 1 };
  let minX = Infinity, minY = Infinity, minZ = Infinity;
  let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;
  for (const atom of atoms) {
    const x = atom.position[0], y = atom.position[1], z = atom.position[2];
    if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(z)) continue;
    minX = Math.min(minX, x); minY = Math.min(minY, y); minZ = Math.min(minZ, z);
    maxX = Math.max(maxX, x); maxY = Math.max(maxY, y); maxZ = Math.max(maxZ, z);
  }
  const maxDim = Math.max(maxX - minX, maxY - minY, maxZ - minZ);
  if (!Number.isFinite(maxDim) || maxDim <= 0) return { scale: 1, sizeScale: 1 };
  const scale = Math.min(Math.max(CAMERA_TARGET_DIMENSION / maxDim, CAMERA_SCALE_MIN), CAMERA_SCALE_MAX);
  const sizeScale = Math.min(Math.max(10 / Math.sqrt(maxDim), CAMERA_SIZE_SCALE_MIN), CAMERA_SIZE_SCALE_MAX);
  return { scale, sizeScale };
}

function getConfiguredAtomRadius(atom: Atom): number {
  return Number.isFinite(atom.radius) ? atom.radius : 0.1;
}

function disposeMaterial(material: THREE.Material | THREE.Material[] | null | undefined): void {
  if (!material) return;
  if (Array.isArray(material)) {
    for (const item of material) { if (item) item.dispose(); }
    return;
  }
  material.dispose();
}

function disposeObject3D(object: THREE.Object3D | null): void {
  if (!object) return;
  object.traverse((node) => {
    const mesh = node as THREE.Mesh;
    if (mesh.geometry) mesh.geometry.dispose();
    disposeMaterial(mesh.material as THREE.Material | THREE.Material[]);
  });
}

function disposeInstancedMesh(im: THREE.InstancedMesh | null): void {
  if (!im) return;
  if (im.geometry) im.geometry.dispose();
  disposeMaterial(im.material as THREE.Material | THREE.Material[]);
}

function createUnitCellEdgeMesh(start: THREE.Vector3, end: THREE.Vector3, radius: number, color: string): THREE.Mesh | null {
  const direction = end.clone().sub(start);
  const length = direction.length();
  if (length <= 1e-6) return null;
  const geometry = new THREE.CylinderGeometry(radius, radius, length, 12);
  const material = new THREE.MeshBasicMaterial({ color });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.copy(start).add(end).multiplyScalar(0.5);
  const up = new THREE.Vector3(0, 1, 0);
  mesh.quaternion.setFromUnitVectors(up, direction.clone().normalize());
  return mesh;
}

/**
 * Build a world-space matrix for a half-cylinder instance.
 *
 * The geometry is a unit-height cylinder along Y.  We position it at the
 * midpoint of [from, to], orient it along the from→to direction, and scale
 * the Y axis to the actual half-length.  X/Z scale stays 1 because the
 * geometry already encodes the bond radius at creation time.
 *
 * Reused by both renderStructure() and updateAtomPosition() so the two paths
 * are guaranteed to produce identical matrices.
 */
const _cmUp   = new THREE.Vector3(0, 1, 0);
const _cmAxis  = new THREE.Vector3();
const _cmQuat  = new THREE.Quaternion();
const _cmDummy = new THREE.Object3D();
const _cmXAxis = new THREE.Vector3(1, 0, 0);

// Scratch objects for updateLightsForCamera — avoids 3 allocations per rendered frame.
const _keyOffset  = new THREE.Vector3();
const _fillOffset = new THREE.Vector3();
const _rimOffset  = new THREE.Vector3();

// Scratch objects for buildCylinderMatrix — no allocations per call.
const _cmCenter = new THREE.Vector3();
const _cmDir    = new THREE.Vector3();

function buildCylinderMatrix(from: THREE.Vector3, to: THREE.Vector3, target: THREE.Matrix4): void {
  _cmCenter.addVectors(from, to).multiplyScalar(0.5);
  _cmDir.subVectors(to, from);
  const halfLen = _cmDir.length();
  _cmDir.normalize();

  _cmDummy.position.copy(_cmCenter);

  if (halfLen > 1e-6 && _cmDir.length() > 0.0001) {
    _cmAxis.crossVectors(_cmUp, _cmDir);
    if (_cmAxis.length() > 0.0001) {
      const angle = Math.acos(Math.max(-1, Math.min(1, _cmUp.dot(_cmDir))));
      _cmQuat.setFromAxisAngle(_cmAxis.normalize(), angle);
      _cmDummy.quaternion.copy(_cmQuat);
    } else {
      // Parallel or anti-parallel to Y
      _cmDummy.quaternion.set(0, 0, 0, 1);
      if (_cmUp.dot(_cmDir) < 0) {
        _cmDummy.quaternion.setFromAxisAngle(_cmXAxis, Math.PI);
      }
    }
  } else {
    _cmDummy.quaternion.set(0, 0, 0, 1);
  }

  _cmDummy.scale.set(1, halfLen, 1);
  _cmDummy.updateMatrix();
  target.copy(_cmDummy.matrix);
}

// Scratch objects for updateAtomPosition — avoids 4 allocations per drag event.
const _uapMatrix = new THREE.Matrix4();
const _uapPos    = new THREE.Vector3();
const _uapQuat   = new THREE.Quaternion();
const _uapSca    = new THREE.Vector3();
// Scratch Vector3 for midpoint computation in bond-half updates.
const _uapMid    = new THREE.Vector3();

function buildUnitCellGroup(edges: UnitCellEdge[], scale: number): THREE.Group | null {
  if (!Array.isArray(edges) || edges.length === 0) return null;

  const color = displayStore.unitCellColor || '#FF6600';
  const thickness = Number.isFinite(displayStore.unitCellThickness)
    ? Math.max(0.5, Math.min(6, displayStore.unitCellThickness)) : 1;
  const style = displayStore.unitCellLineStyle === 'dashed' ? 'dashed' : 'solid';
  const radius = Math.max(0.01, thickness * 0.03);
  const dashLength = 0.45;
  const gapLength = 0.28;
  const group = new THREE.Group();

  for (const edge of edges) {
    const start = new THREE.Vector3(edge.start[0] * scale, edge.start[1] * scale, edge.start[2] * scale);
    const end = new THREE.Vector3(edge.end[0] * scale, edge.end[1] * scale, edge.end[2] * scale);
    const direction = end.clone().sub(start);
    const edgeLength = direction.length();
    if (edgeLength <= 1e-6) continue;

    if (style === 'solid') {
      const solidMesh = createUnitCellEdgeMesh(start, end, radius, color);
      if (solidMesh) group.add(solidMesh);
      continue;
    }

    const edgeDirection = direction.clone().normalize();
    let cursor = 0;
    while (cursor < edgeLength) {
      const segStart = cursor;
      const segEnd = Math.min(edgeLength, cursor + dashLength);
      if (segEnd > segStart + 1e-4) {
        const s = start.clone().addScaledVector(edgeDirection, segStart);
        const e = start.clone().addScaledVector(edgeDirection, segEnd);
        const dashMesh = createUnitCellEdgeMesh(s, e, radius, color);
        if (dashMesh) group.add(dashMesh);
      }
      cursor += dashLength + gapLength;
    }
  }

  return group.children.length > 0 ? group : null;
}

function renderStructure(data: Structure, uiHooks?: Partial<UiHooks>, options?: { fitCamera?: boolean }): void {
  structureStore.currentStructure = data;
  let scale = displayStore.manualScale;
  let sizeScale = 1;
  if (displayStore.autoScaleEnabled) {
    const auto = getAutoScales(data.atoms || []);
    scale = auto.scale;
    sizeScale = auto.sizeScale;
  }
  rendererState.lastScale = scale;
  rendererState.lastSizeScale = sizeScale;

  for (const mesh of rendererState.atomMeshes.values()) {
    rendererState.scene!.remove(mesh);
    disposeObject3D(mesh);
  }
  rendererState.atomMeshes.clear();
  rendererState.atomInstanceIndex.clear();

  for (const im of rendererState.atomInstancedMeshes) {
    rendererState.scene!.remove(im);
    disposeInstancedMesh(im);
  }
  rendererState.atomInstancedMeshes = [];

  for (const mesh of rendererState.extraMeshes) {
    rendererState.scene!.remove(mesh);
    disposeObject3D(mesh);
  }
  rendererState.extraMeshes = [];

  for (const line of rendererState.bondLines) {
    rendererState.scene!.remove(line);
    disposeObject3D(line);
  }
  rendererState.bondLines = [];
  rendererState.bondMeshes = [];

  for (const im of rendererState.bondInstancedMeshes) {
    rendererState.scene!.remove(im);
    disposeInstancedMesh(im);
  }
  rendererState.bondInstancedMeshes = [];
  rendererState.bondHalfIndex.clear();

  if (rendererState.unitCellGroup) {
    rendererState.scene!.remove(rendererState.unitCellGroup);
    disposeObject3D(rendererState.unitCellGroup);
    rendererState.unitCellGroup = null;
  }

  const selectedSet = new Set(data.selectedAtomIds || []);
  const renderAtoms = data.renderAtoms || data.atoms;
  const renderBonds = data.renderBonds || data.bonds;
  const surfaceShininess = getSurfaceShininess();

  if (renderAtoms) {
    // --- Instanced rendering for selectable atoms ---
    // Group atoms by rounded radius so that all atoms sharing the same visual
    // radius can share a single InstancedMesh (one draw call per group).
    const selectableAtoms = renderAtoms.filter((atom) => {
      if (!Number.isFinite(atom.position[0]) || !Number.isFinite(atom.position[1]) || !Number.isFinite(atom.position[2])) return false;
      return atom.selectable !== false;
    });
    const nonSelectableAtoms = renderAtoms.filter((atom) => {
      if (!Number.isFinite(atom.position[0]) || !Number.isFinite(atom.position[1]) || !Number.isFinite(atom.position[2])) return false;
      return atom.selectable === false;
    });

    // Build instanced meshes for selectable atoms grouped by radius key.
    if (selectableAtoms.length > 0) {
      // Map: radiusKey → list of atoms
      const byRadius = new Map<number, typeof selectableAtoms>();
      for (const atom of selectableAtoms) {
        const isSelected = !!atom.selected || selectedSet.has(atom.id);
        const configuredRadius = getConfiguredAtomRadius(atom);
        const sphereRadius = Math.max(configuredRadius * sizeScale, 0.12) * (isSelected ? 1.12 : 1);
        // Round to 3 decimal places as map key.
        const key = Math.round(sphereRadius * 1000) / 1000;
        if (!byRadius.has(key)) byRadius.set(key, []);
        byRadius.get(key)!.push(atom);
      }

      const dummy = new THREE.Object3D();
      const _color = new THREE.Color();

      // Shared low-poly sphere geometry for hit-testing all atoms
      // Scale is applied per-mesh via mesh.scale.set()
      const hitTestGeometry = new THREE.SphereGeometry(1, 6, 4);
      const hitTestMaterial = new THREE.MeshBasicMaterial({ visible: false });

      for (const [radiusKey, atoms] of byRadius) {
        // Shared geometry for this radius group (16-segment sphere is a good
        // balance between quality and triangle count; was 32 before).
        const geo = new THREE.SphereGeometry(radiusKey, 16, 12);
        // Use a single shared material; per-instance color is handled via
        // instanceColor buffer — MeshPhongMaterial supports it.
        const mat = new THREE.MeshPhongMaterial({
          specular: new THREE.Color(0x333333),
          shininess: surfaceShininess,
        });
        const im = new THREE.InstancedMesh(geo, mat, atoms.length);
        im.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(atoms.length * 3), 3);

        for (let i = 0; i < atoms.length; i++) {
          const atom = atoms[i];
          const isSelected = !!atom.selected || selectedSet.has(atom.id);
          dummy.position.set(atom.position[0] * scale, atom.position[1] * scale, atom.position[2] * scale);
          dummy.updateMatrix();
          im.setMatrixAt(i, dummy.matrix);
          _color.set(isSelected ? '#f6d55c' : atom.color);
          im.setColorAt(i, _color);

          // Invisible hit-test mesh: use shared geometry scaled to radius.
          // This avoids creating a new geometry per atom (was O(n) allocations).
          const hitMesh = new THREE.Mesh(hitTestGeometry, hitTestMaterial);
          hitMesh.scale.set(radiusKey, radiusKey, radiusKey);
          hitMesh.position.set(atom.position[0] * scale, atom.position[1] * scale, atom.position[2] * scale);
          hitMesh.userData = { atomId: atom.id };
          rendererState.scene!.add(hitMesh);
          rendererState.atomMeshes.set(atom.id, hitMesh);
          rendererState.atomInstanceIndex.set(atom.id, { im, index: i });
        }

        im.instanceMatrix.needsUpdate = true;
        if (im.instanceColor) im.instanceColor.needsUpdate = true;
        rendererState.scene!.add(im);
        rendererState.atomInstancedMeshes.push(im);
      }
    }

    // Non-selectable atoms (e.g. ghost/extra atoms) — individual meshes since
    // they don't need selection/drag support.  A single shared unit-sphere
    // geometry (radius = 1) is reused for every atom; each mesh is scaled to
    // the desired radius.  This satisfies §6.1: no separate geometry per atom.
    if (nonSelectableAtoms.length > 0) {
      const sharedGhostGeo = new THREE.SphereGeometry(1, 16, 12);
      for (const atom of nonSelectableAtoms) {
        const configuredRadius = getConfiguredAtomRadius(atom);
        const sphereRadius = Math.max(configuredRadius * sizeScale, 0.12);
        const material = new THREE.MeshPhongMaterial({
          color: new THREE.Color(atom.color),
          specular: new THREE.Color(0x333333),
          shininess: surfaceShininess,
        });
        const mesh = new THREE.Mesh(sharedGhostGeo, material);
        mesh.scale.set(sphereRadius, sphereRadius, sphereRadius);
        mesh.position.set(atom.position[0] * scale, atom.position[1] * scale, atom.position[2] * scale);
        rendererState.scene!.add(mesh);
        rendererState.extraMeshes.push(mesh);
      }
    }
  }

  if (renderBonds) {
    // Pre-compute all bond half-cylinder data, then group by radius key for instancing.
    // atomId1/atomId2 are carried through so bondHalfIndex can be populated below.
    interface BondHalf {
      from: THREE.Vector3;
      to: THREE.Vector3;
      halfLen: number;
      color: string;
      bondRadius: number;
      emissive: string;
      bondKey: string | undefined;
      /** Atom id at the non-midpoint end of this half (the "owning" atom). */
      ownAtomId: string | undefined;
      /** Atom id at the other full end of the bond (used during drag to find the far position). */
      otherAtomId: string | undefined;
      /** True → this half runs from ownAtom end toward midpoint. */
      isFirstHalf: boolean;
      /**
       * For cross-boundary periodic stubs, the cell-boundary endpoint of the
       * full stub.  Both color-halves of a periodic stub share the same fixedEnd.
       * During drag, the midpoint is recalculated from the atom's live position
       * and this fixed point.  Null for ordinary (non-periodic-stub) bond halves.
       */
      fixedEnd: THREE.Vector3 | null;
    }
    const bondHalves: BondHalf[] = [];

    for (const bond of renderBonds) {
      const isSelectedBond = !!bond.selected;
      const highlightBond =
        isSelectedBond ||
        !!(bond.atomId1 && bond.atomId2 && selectedSet.has(bond.atomId1) && selectedSet.has(bond.atomId2));
      const start = new THREE.Vector3(bond.start[0] * scale, bond.start[1] * scale, bond.start[2] * scale);
      const end = new THREE.Vector3(bond.end[0] * scale, bond.end[1] * scale, bond.end[2] * scale);
      const length = start.distanceTo(end);
      const bondThicknessScale = Number.isFinite(displayStore.bondThicknessScale) ? displayStore.bondThicknessScale : 1;
      const bondRadius = Math.max(bond.radius * sizeScale * bondThicknessScale, 0.03) * (highlightBond ? 1.35 : 1);
      const midpoint = start.clone().add(end).multiplyScalar(0.5);
      const emissive = isSelectedBond ? '#704214' : '#000000';

      // First half: from atomId1's end toward midpoint
      bondHalves.push({
        from: start, to: midpoint, halfLen: length / 2,
        color: bond.color1 || bond.color, bondRadius, emissive, bondKey: bond.key,
        // For periodic stubs, BOTH halves belong to atomId1 (the stub's owning
        // atom).  The stub is entirely on one atom's side of the cell boundary,
        // so dragging atomId1 should update both halves, and dragging atomId2
        // should not affect this stub at all.
        ownAtomId: bond.atomId1, otherAtomId: bond.periodicStub ? bond.atomId1 : bond.atomId2, isFirstHalf: true,
        // For periodic stubs, store the WireBond's `end` (the cell-boundary
        // endpoint of the full stub) so that during drag we can recompute the
        // midpoint from the atom's new position and this fixed boundary point.
        fixedEnd: bond.periodicStub ? end.clone() : null,
      });
      // Second half: from midpoint toward atomId2's end
      bondHalves.push({
        from: midpoint, to: end, halfLen: length / 2,
        color: bond.color2 || bond.color, bondRadius, emissive, bondKey: bond.key,
        ownAtomId: bond.periodicStub ? bond.atomId1 : bond.atomId2, otherAtomId: bond.atomId1, isFirstHalf: false,
        fixedEnd: bond.periodicStub ? end.clone() : null,
      });
    }

    // Group bond halves by (bondRadius, emissive) key for instancing.
    const byBondRadius = new Map<string, BondHalf[]>();
    for (const half of bondHalves) {
      const key = `${Math.round(half.bondRadius * 1000)}_${half.emissive}`;
      if (!byBondRadius.has(key)) byBondRadius.set(key, []);
      byBondRadius.get(key)!.push(half);
    }

    const _color = new THREE.Color();
    const _matrix = new THREE.Matrix4();

    // Shared low-poly cylinder geometry for bond hit-testing
    // Scale is applied per-mesh via mesh.scale.set()
    const hitTestCylinderGeometry = new THREE.CylinderGeometry(1, 1, 1, 4);
    const hitTestCylinderMaterial = new THREE.MeshBasicMaterial({ visible: false });

    for (const [, halves] of byBondRadius) {
      const firstHalf = halves[0];
      // Use half-length = 1 in geometry; we scale each instance via matrix.
      const geo = new THREE.CylinderGeometry(firstHalf.bondRadius, firstHalf.bondRadius, 1, 8);
      const mat = new THREE.MeshPhongMaterial({
        specular: new THREE.Color(0x333333),
        emissive: new THREE.Color(firstHalf.emissive),
        shininess: surfaceShininess,
      });
      const im = new THREE.InstancedMesh(geo, mat, halves.length);
      im.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(halves.length * 3), 3);

      for (let i = 0; i < halves.length; i++) {
        const half = halves[i];

        // Use shared buildCylinderMatrix so updateAtomPosition() produces
        // identical results when it recomputes the same half during drag.
        buildCylinderMatrix(half.from, half.to, _matrix);
        im.setMatrixAt(i, _matrix);
        _color.set(half.color);
        im.setColorAt(i, _color);

        // Register this half in bondHalfIndex under BOTH endpoint atoms so
        // that updateAtomPosition() finds it regardless of which end moves.
        // Only register for atoms that have a hit-mesh (selectable atoms);
        // periodic ghost atoms have fixed positions and are never dragged.
        if (half.ownAtomId && half.otherAtomId) {
          const entry = {
            im,
            index: i,
            atomId1: half.ownAtomId,
            atomId2: half.otherAtomId,
            isFirstHalf: half.isFirstHalf,
            fixedEnd: half.fixedEnd,
          };
          // Register under ownAtomId (the non-midpoint end of this half).
          if (rendererState.atomMeshes.has(half.ownAtomId)) {
            if (!rendererState.bondHalfIndex.has(half.ownAtomId)) {
              rendererState.bondHalfIndex.set(half.ownAtomId, []);
            }
            rendererState.bondHalfIndex.get(half.ownAtomId)!.push(entry);
          }
          // Also register under otherAtomId so that when the far end moves,
          // this half (which shares the midpoint) is also recomputed.
          // For periodic stubs, fixedEnd is set (the midpoint is a fixed boundary
          // point, not derived from otherAtom's position), so skip this registration
          // to prevent wrong updates when the far atom moves.
          if (!half.fixedEnd && rendererState.atomMeshes.has(half.otherAtomId)) {
            if (!rendererState.bondHalfIndex.has(half.otherAtomId)) {
              rendererState.bondHalfIndex.set(half.otherAtomId, []);
            }
            rendererState.bondHalfIndex.get(half.otherAtomId)!.push(entry);
          }
        }

        // Invisible hit-test mesh for bond selection.
        // Use shared geometry scaled to match bond dimensions.
        if (half.bondKey) {
          // Derive center and quaternion from the already-computed matrix.
          const center = new THREE.Vector3();
          const quat   = new THREE.Quaternion();
          const scl    = new THREE.Vector3();
          _matrix.decompose(center, quat, scl);

          const hitMesh = new THREE.Mesh(hitTestCylinderGeometry, hitTestCylinderMaterial);
          hitMesh.scale.set(firstHalf.bondRadius, half.halfLen, firstHalf.bondRadius);
          hitMesh.position.copy(center);
          hitMesh.quaternion.copy(quat);
          hitMesh.userData = { bondKey: half.bondKey };
          rendererState.scene!.add(hitMesh);
          rendererState.bondMeshes.push(hitMesh);
          rendererState.bondLines.push(hitMesh);
        }
      }

      im.instanceMatrix.needsUpdate = true;
      if (im.instanceColor) im.instanceColor.needsUpdate = true;
      rendererState.scene!.add(im);
      rendererState.bondInstancedMeshes.push(im);
    }
  }

  if (data.unitCell && data.unitCell.edges && data.unitCell.edges.length > 0) {
    const unitCellGroup = buildUnitCellGroup(data.unitCell.edges, scale);
    if (unitCellGroup) {
      rendererState.scene!.add(unitCellGroup);
      rendererState.unitCellGroup = unitCellGroup;
    }
  }

  if (uiHooks) {
    if (uiHooks.updateCounts) {
      uiHooks.updateCounts(data.atoms.length, data.bonds ? data.bonds.length : 0);
    }
    if (uiHooks.updateAtomList) {
      uiHooks.updateAtomList(data.atoms, data.selectedAtomIds || [], data.selectedAtomId || null);
    }
  }

  if (options && options.fitCamera) {
    fitCamera();
  }
  markDirty();
}

function fitCamera(): void {
  if (rendererState.atomMeshes.size === 0) return;
  const box = new THREE.Box3();
  for (const mesh of rendererState.atomMeshes.values()) {
    box.expandByObject(mesh);
  }
  const size = box.getSize(new THREE.Vector3());
  const maxDim = Math.max(size.x, size.y, size.z);
  const center = box.getCenter(new THREE.Vector3());

  if (rendererState.camera instanceof THREE.OrthographicCamera) {
    const cam = rendererState.camera;
    const targetSize = Math.max(maxDim * 1.2, 1);
    rendererState.orthoSize = targetSize / (displayStore.viewZoom || 1);
    const cameraDistance = Math.max(targetSize * 2, 20);
    cam.position.set(center.x, center.y, center.z + cameraDistance);
    cam.near = Math.max(0.1, cameraDistance / 100);
    cam.far = Math.max(1000, cameraDistance * 10);
    onResize();
  } else {
    const cam = rendererState.camera as THREE.PerspectiveCamera;
    const fov = cam.fov * (Math.PI / 180);
    const cameraDistance = Math.abs(maxDim / 2 / Math.tan(fov / 2)) * 0.6 / displayStore.viewZoom;
    cam.position.set(center.x, center.y, center.z + cameraDistance * 1.2);
    cam.near = Math.max(0.1, cameraDistance / 100);
    cam.far = Math.max(1000, cameraDistance * 10);
    cam.updateProjectionMatrix();
  }
  const ctrl = rendererState.controls as TrackballControls;
  if (ctrl && ctrl.target) {
    ctrl.target.copy(center);
  }
  rendererState.controls!.update();
  markDirty();
}

// axis: 'a'|'b'|'c'|'-a'|'-b'|'-c'  →  snap camera to look along that axis
function snapCameraToAxis(axis: string): void {
  if (!rendererState.camera) return;

  const ctrl = rendererState.controls as TrackballControls;
  const target = (ctrl && ctrl.target) ? ctrl.target.clone() : new THREE.Vector3();

  // Compute current camera distance from target so we preserve zoom level
  const dist = rendererState.camera.position.distanceTo(target);
  const d = Math.max(dist, 1);

  let pos: THREE.Vector3;
  let up: THREE.Vector3;
  switch (axis) {
    case 'a':  pos = new THREE.Vector3(d, 0, 0);  up = new THREE.Vector3(0, 0, 1); break;
    case '-a': pos = new THREE.Vector3(-d, 0, 0); up = new THREE.Vector3(0, 0, 1); break;
    case 'b':  pos = new THREE.Vector3(0, d, 0);  up = new THREE.Vector3(0, 0, 1); break;
    case '-b': pos = new THREE.Vector3(0, -d, 0); up = new THREE.Vector3(0, 0, 1); break;
    case 'c':  pos = new THREE.Vector3(0, 0, d);  up = new THREE.Vector3(0, 1, 0); break;
    case '-c': pos = new THREE.Vector3(0, 0, -d); up = new THREE.Vector3(0, 1, 0); break;
    default: return;
  }

  rendererState.camera.position.copy(target).add(pos);
  rendererState.camera.up.copy(up);
  rendererState.camera.lookAt(target);
  rendererState.camera.updateProjectionMatrix();

  if (ctrl && ctrl.target) {
    ctrl.target.copy(target);
  }
  if (rendererState.controls) rendererState.controls.update();
  markDirty();
}

function setProjectionMode(mode: string): void {
  const nextMode = mode === 'orthographic' ? 'orthographic' : 'perspective';
  if (rendererState.projectionMode === nextMode) return;
  if (!rendererState.renderer || !rendererState.camera) return;

  const container = document.getElementById('container');
  if (!container) return;
  const rect = container.getBoundingClientRect();
  const width = Math.max(1, rect.width - 250);
  const height = Math.max(1, rect.height);
  const oldCamera = rendererState.camera;
  const ctrl = rendererState.controls as TrackballControls | null;
  const previousTarget = ctrl && ctrl.target ? ctrl.target.clone() : null;
  const newCamera = createCamera(nextMode, width, height);
  newCamera.position.copy(oldCamera.position);
  newCamera.up.copy(oldCamera.up);
  newCamera.quaternion.copy(oldCamera.quaternion);
  newCamera.near = oldCamera.near;
  newCamera.far = oldCamera.far;

  rendererState.camera = newCamera;
  rendererState.projectionMode = nextMode;
  applyControls(newCamera);
  const newCtrl = rendererState.controls as TrackballControls | null;
  if (newCtrl && newCtrl.target && previousTarget) {
    newCtrl.target.copy(previousTarget);
    newCamera.lookAt(previousTarget);
  }
  onResize();
}

function getRaycaster(): THREE.Raycaster { return rendererState.raycaster!; }
function getMouse(): THREE.Vector2 { return rendererState.mouse!; }
function getCamera(): THREE.Camera { return rendererState.camera!; }
function getAtomMeshes(): Map<string, THREE.Mesh> { return rendererState.atomMeshes; }
function getBondMeshes(): THREE.Mesh[] { return rendererState.bondMeshes; }
function getDragPlane(): THREE.Plane { return rendererState.dragPlane!; }

function setControlsEnabled(enabled: boolean): void {
  const ctrl = rendererState.controls as TrackballControls | null;
  if (ctrl && ctrl.enabled !== undefined) {
    ctrl.enabled = enabled;
  }
}

function setOnCameraMove(callback: (() => void) | null): void {
  rendererState.onCameraMove = callback;
}

function getScale(): number { return rendererState.lastScale || 1; }

function updateLighting(): void {
  if (!rendererState.ambientLight || !rendererState.keyLight ||
      !rendererState.fillLight || !rendererState.rimLight || !rendererState.camera) {
    return;
  }
  const enabled = lightingStore.lightingEnabled !== false;
  rendererState.ambientLight.intensity = enabled ? (lightingStore.ambientIntensity ?? 0.5) * Math.PI : 0;
  rendererState.keyLight.intensity = enabled ? (lightingStore.keyLight?.intensity ?? 0.7) * Math.PI : 0;
  rendererState.fillLight.intensity = enabled ? (lightingStore.fillLight?.intensity ?? 0) * Math.PI : 0;
  rendererState.rimLight.intensity = enabled ? (lightingStore.rimLight?.intensity ?? 0) * Math.PI : 0;
  rendererState.ambientLight.color.set(resolveLightColor(lightingStore.ambientColor, '#ffffff'));
  rendererState.keyLight.color.set(resolveLightColor(lightingStore.keyLight?.color, '#CCCCCC'));
  rendererState.fillLight.color.set(resolveLightColor(lightingStore.fillLight?.color, '#ffffff'));
  rendererState.rimLight.color.set(resolveLightColor(lightingStore.rimLight?.color, '#ffffff'));
  applySurfaceShininess();
  updateLightsForCamera();
  markDirty();
}

/**
 * Apply lightweight display-setting changes that do NOT require rebuilding geometry.
 *
 * Handled here (mutate existing scene objects):
 *   - showAxes         – toggle axes helper visibility
 *   - backgroundColor  – set scene background color
 *   - unitCellColor    – recolor existing unit-cell mesh materials
 *
 * NOT handled here (require a full renderStructure() call to rebuild geometry):
 *   - unitCellThickness  – tube radius is baked into BufferGeometry at render time
 *   - unitCellLineStyle  – dashed vs. solid uses different material/geometry types
 *
 * Callers that change thickness or line style must call renderStructure() directly
 * (see interactionDisplay.ts rerenderStructure).
 */
function updateDisplaySettings(): void {
  axisIndicator.setVisible(displayStore.showAxes !== false);
  if (rendererState.scene && displayStore.backgroundColor) {
    rendererState.scene.background = new THREE.Color(displayStore.backgroundColor);
  }
  if (rendererState.unitCellGroup && displayStore.unitCellColor) {
    const nextColor = new THREE.Color(displayStore.unitCellColor);
    rendererState.unitCellGroup.traverse((node) => {
      const mesh = node as THREE.Mesh;
      if (!mesh.material) return;
      const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      for (const material of materials) {
        if (material && 'color' in material) {
          (material as THREE.MeshBasicMaterial).color.set(nextColor);
        }
      }
    });
  }
  markDirty();
}

function exportHighResolutionImage(options?: { scale?: number }): { dataUrl: string; width: number; height: number } | null {
  if (!rendererState.renderer || !rendererState.camera || !rendererState.scene) return null;

  const renderer = rendererState.renderer;
  const camera = rendererState.camera;
  const scene = rendererState.scene;
  const requestedScale = options && Number.isFinite(Number(options.scale)) ? Number(options.scale) : 4;
  const scale = Math.max(1, requestedScale);

  const originalSize = renderer.getSize(new THREE.Vector2());
  const originalWidth = Math.max(1, Math.round(originalSize.x));
  const originalHeight = Math.max(1, Math.round(originalSize.y));
  const originalPixelRatio = renderer.getPixelRatio();
  const perspectiveAspect = camera instanceof THREE.PerspectiveCamera ? camera.aspect : null;
  const orthoFrustum = camera instanceof THREE.OrthographicCamera ? {
    left: camera.left,
    right: camera.right,
    top: camera.top,
    bottom: camera.bottom,
    zoom: camera.zoom,
  } : null;

  const maxTextureSize = (renderer.capabilities as { maxTextureSize?: number })?.maxTextureSize || 8192;
  const targetWidthRaw = Math.max(1, Math.round(originalWidth * scale));
  const targetHeightRaw = Math.max(1, Math.round(originalHeight * scale));
  const maxTarget = Math.max(targetWidthRaw, targetHeightRaw);
  const limitScale = maxTarget > maxTextureSize ? maxTextureSize / maxTarget : 1;
  const targetWidth = Math.max(1, Math.floor(targetWidthRaw * limitScale));
  const targetHeight = Math.max(1, Math.floor(targetHeightRaw * limitScale));

  try {
    renderer.setPixelRatio(1);
    renderer.setSize(targetWidth, targetHeight, false);
    if (camera instanceof THREE.PerspectiveCamera) {
      camera.aspect = targetWidth / targetHeight;
    } else if (camera instanceof THREE.OrthographicCamera) {
      const frustum = getOrthoFrustum(targetWidth, targetHeight);
      camera.left = frustum.left; camera.right = frustum.right;
      camera.top = frustum.top; camera.bottom = frustum.bottom;
      camera.zoom = displayStore.viewZoom || 1;
    }
    camera.updateProjectionMatrix();
    updateLightsForCamera();
    renderer.render(scene, camera);
    return {
      dataUrl: renderer.domElement.toDataURL('image/png'),
      width: targetWidth,
      height: targetHeight,
    };
  } finally {
    renderer.setPixelRatio(originalPixelRatio);
    renderer.setSize(originalWidth, originalHeight, false);
    if (camera instanceof THREE.PerspectiveCamera && perspectiveAspect !== null) {
      camera.aspect = perspectiveAspect;
    } else if (camera instanceof THREE.OrthographicCamera && orthoFrustum) {
      camera.left = orthoFrustum.left; camera.right = orthoFrustum.right;
      camera.top = orthoFrustum.top; camera.bottom = orthoFrustum.bottom;
      camera.zoom = orthoFrustum.zoom;
    }
    camera.updateProjectionMatrix();
    updateLightsForCamera();
    renderer.render(scene, camera);
  }
}

function updateAtomPosition(atomId: string, position: THREE.Vector3): void {
  // Update hit-test mesh position (used for raycasting and box-select).
  const hitMesh = rendererState.atomMeshes.get(atomId);
  if (hitMesh) {
    hitMesh.position.copy(position);
  }
  // Update the corresponding instance in the InstancedMesh so the visual moves too.
  const entry = rendererState.atomInstanceIndex.get(atomId);
  if (entry) {
    const { im, index } = entry;
    im.getMatrixAt(index, _uapMatrix);
    // Decompose, replace translation, recompose — using pre-allocated scratch objects.
    _uapMatrix.decompose(_uapPos, _uapQuat, _uapSca);
    _uapPos.copy(position);
    _uapMatrix.compose(_uapPos, _uapQuat, _uapSca);
    im.setMatrixAt(index, _uapMatrix);
    im.instanceMatrix.needsUpdate = true;
  }

  // Incrementally update all bond half-cylinders that have this atom as an
  // endpoint.  Each entry is registered under BOTH endpoint atoms, so when
  // atom A moves we find both halves of every A-B bond here.
  // We look up the current world position of each endpoint from atomMeshes
  // (always up to date) and recompute only the affected instance matrices.
  const halfEntries = rendererState.bondHalfIndex.get(atomId);
  if (halfEntries && halfEntries.length > 0) {
    // Track which InstancedMeshes were touched so we upload only once each.
    const dirtyIMs = new Set<THREE.InstancedMesh>();

    for (const he of halfEntries) {
      // Resolve world positions for both full endpoints.
      // For the atom being dragged, use the new position directly.
      // For the other atom, read its current hit-mesh position.
      const posA = he.atomId1 === atomId
        ? position
        : rendererState.atomMeshes.get(he.atomId1)?.position;

      if (!posA) continue;

      // For cross-boundary periodic stubs, fixedEnd stores the cell-boundary
      // endpoint of the full stub.  We recalculate the midpoint between the
      // atom's live position and this boundary point, then draw each half.
      // Using the raw position of the other atom would produce a wrong bond
      // that crosses the entire cell.
      let to: THREE.Vector3;
      let from: THREE.Vector3;
      if (he.fixedEnd) {
        // Periodic stub: both halves belong to the same atom (atomId1).
        // `fixedEnd` is the cell-boundary endpoint of the full stub.
        // Recompute the midpoint between the atom's live position and the
        // fixed boundary point, then assign the correct segment.
        _uapMid.addVectors(posA, he.fixedEnd).multiplyScalar(0.5);
        from = he.isFirstHalf ? posA    : _uapMid;
        to   = he.isFirstHalf ? _uapMid : he.fixedEnd;
      } else {
        // Ordinary bond: recompute midpoint from both live atom positions.
        const posB = he.atomId2 === atomId
          ? position
          : rendererState.atomMeshes.get(he.atomId2)?.position;
        if (!posB) continue;
        // midpoint between the two full atom endpoints — use scratch to avoid allocation.
        _uapMid.addVectors(posA, posB).multiplyScalar(0.5);
        from = he.isFirstHalf ? posA    : _uapMid;
        to   = he.isFirstHalf ? _uapMid : posA;
      }

      buildCylinderMatrix(from, to, _uapMatrix);
      he.im.setMatrixAt(he.index, _uapMatrix);
      dirtyIMs.add(he.im);
    }

    for (const im of dirtyIMs) {
      im.instanceMatrix.needsUpdate = true;
    }
  }

  markDirty();
}

export const renderer: RendererApi = {
  init,
  renderStructure,
  fitCamera,
  setProjectionMode,
  snapCameraToAxis,
  getScale,
  getRaycaster,
  getMouse,
  getCamera,
  getAtomMeshes,
  getBondMeshes,
  getDragPlane,
  setControlsEnabled,
  setOnCameraMove,
  updateLighting,
  updateDisplaySettings,
  exportHighResolutionImage,
  updateAtomPosition,
  markDirty,
  rotateCameraBy,
  dispose,
};

// axis: 'tiltUp'|'tiltDown'|'rotateLeft'|'rotateRight'|'rollCCW'|'rollCW'
// Rotates the camera around controls.target by angleDeg.
function rotateCameraBy(axis: string, angleDeg: number): void {
  if (!rendererState.camera) return;
  const ctrl = rendererState.controls as TrackballControls;
  const target = (ctrl && ctrl.target) ? ctrl.target.clone() : new THREE.Vector3();

  const rad = (angleDeg * Math.PI) / 180;
  const cam = rendererState.camera;

  // The three camera-space axes
  const forward = new THREE.Vector3().subVectors(target, cam.position).normalize();
  const right = new THREE.Vector3().crossVectors(forward, cam.up).normalize();
  // re-orthogonalise up in case of floating-point drift
  const up = new THREE.Vector3().crossVectors(right, forward).normalize();

  let rotAxis: THREE.Vector3;
  let angle = rad;
  switch (axis) {
    case 'tiltUp':    rotAxis = right;   break;
    case 'tiltDown':  rotAxis = right;   angle = -rad; break;
    case 'rotateLeft':  rotAxis = up;    break;
    case 'rotateRight': rotAxis = up;    angle = -rad; break;
    case 'rollCCW': rotAxis = forward; break;
    case 'rollCW':  rotAxis = forward; angle = -rad; break;
    default: return;
  }

  const q = new THREE.Quaternion().setFromAxisAngle(rotAxis, angle);
  // Rotate camera position around target
  const offset = new THREE.Vector3().subVectors(cam.position, target).applyQuaternion(q);
  cam.position.copy(target).add(offset);
  // Rotate camera up vector
  cam.up.copy(up).applyQuaternion(q);
  cam.lookAt(target);
  cam.updateProjectionMatrix();

  if (ctrl && ctrl.target) ctrl.target.copy(target);
  if (rendererState.controls) rendererState.controls.update();
  markDirty();
}

function dispose(): void {
  if (rendererState.animationFrameId !== null) {
    cancelAnimationFrame(rendererState.animationFrameId);
    rendererState.animationFrameId = null;
  }
  window.removeEventListener('resize', _onResizeDebounced);
  if (rendererState.statusInterval) {
    clearInterval(rendererState.statusInterval);
    rendererState.statusInterval = null;
  }
  for (const mesh of rendererState.atomMeshes.values()) {
    rendererState.scene?.remove(mesh);
    disposeObject3D(mesh);
  }
  rendererState.atomMeshes.clear();
  rendererState.atomInstanceIndex.clear();

  for (const im of rendererState.atomInstancedMeshes) {
    rendererState.scene?.remove(im);
    disposeInstancedMesh(im);
  }
  rendererState.atomInstancedMeshes = [];

  for (const mesh of rendererState.extraMeshes) {
    rendererState.scene?.remove(mesh);
    disposeObject3D(mesh);
  }
  rendererState.extraMeshes = [];

  for (const mesh of rendererState.bondMeshes) {
    rendererState.scene?.remove(mesh);
    disposeObject3D(mesh);
  }
  rendererState.bondMeshes = [];
  rendererState.bondLines = [];

  for (const im of rendererState.bondInstancedMeshes) {
    rendererState.scene?.remove(im);
    disposeInstancedMesh(im);
  }
  rendererState.bondInstancedMeshes = [];
  rendererState.bondHalfIndex.clear();

  if (rendererState.unitCellGroup) {
    rendererState.scene?.remove(rendererState.unitCellGroup);
    disposeObject3D(rendererState.unitCellGroup);
    rendererState.unitCellGroup = null;
  }

  axisIndicator.dispose();

  const ctrl = rendererState.controls as TrackballControls | null;
  if (ctrl && ctrl.dispose) {
    ctrl.dispose();
  }
  rendererState.controls = null;

  if (rendererState.renderer) {
    rendererState.renderer.dispose();
    rendererState.renderer = null;
  }

  rendererState.scene = null;
  rendererState.camera = null;
  rendererState.raycaster = null;
  rendererState.mouse = null;
  rendererState.dragPlane = null;
}

// Clean up Three.js resources when the webview closes
window.addEventListener('beforeunload', () => {
  dispose();
});
