import * as THREE from 'three';
import { displayStore } from './state';

interface AxisIndicatorState {
  container: HTMLElement | null;
  axisX: HTMLElement | null;
  axisY: HTMLElement | null;
  axisZ: HTMLElement | null;
  labelX: HTMLElement | null;
  labelY: HTMLElement | null;
  labelZ: HTMLElement | null;
  visible: boolean;
}

const state: AxisIndicatorState = {
  container: null,
  axisX: null,
  axisY: null,
  axisZ: null,
  labelX: null,
  labelY: null,
  labelZ: null,
  visible: true,
};

const ORIGIN_OFFSET = 40;
const AXIS_LENGTH = 28;

export function init(): void {
  const canvasWrap = document.getElementById('canvas-wrap');
  if (!canvasWrap) return;

  if (state.container) {
    state.container.remove();
  }

  const container = document.createElement('div');
  container.id = 'axis-indicator';

  const axesContainer = document.createElement('div');
  axesContainer.className = 'axis-axes-container';

  const axisX = createAxisElement('x', '#ff4444');
  const axisY = createAxisElement('y', '#44ff44');
  const axisZ = createAxisElement('z', '#4488ff');

  axesContainer.appendChild(axisX.element);
  axesContainer.appendChild(axisY.element);
  axesContainer.appendChild(axisZ.element);

  const labelX = createLabelElement('X', '#ff4444');
  const labelY = createLabelElement('Y', '#44ff44');
  const labelZ = createLabelElement('Z', '#4488ff');

  container.appendChild(axesContainer);
  container.appendChild(labelX);
  container.appendChild(labelY);
  container.appendChild(labelZ);

  canvasWrap.appendChild(container);

  state.container = container;
  state.axisX = axisX.element;
  state.axisY = axisY.element;
  state.axisZ = axisZ.element;
  state.labelX = labelX;
  state.labelY = labelY;
  state.labelZ = labelZ;
  state.visible = displayStore.showAxes !== false;

  updateVisibility();
}

function createAxisElement(axis: string, color: string): { element: HTMLElement } {
  const el = document.createElement('div');
  el.className = `axis-line axis-${axis}`;
  el.style.setProperty('--axis-color', color);
  return { element: el };
}

function createLabelElement(text: string, color: string): HTMLElement {
  const el = document.createElement('div');
  el.className = 'axis-label';
  el.textContent = text;
  el.style.color = color;
  return el;
}

export function update(quaternion: THREE.Quaternion): void {
  if (!state.visible || !state.axisX || !state.axisY || !state.axisZ) return;
  if (!state.labelX || !state.labelY || !state.labelZ) return;

  const dirX = new THREE.Vector3(1, 0, 0);
  const dirY = new THREE.Vector3(0, 1, 0);
  const dirZ = new THREE.Vector3(0, 0, 1);

  dirX.applyQuaternion(quaternion);
  dirY.applyQuaternion(quaternion);
  dirZ.applyQuaternion(quaternion);

  updateAxisTransform(state.axisX, state.labelX, dirX);
  updateAxisTransform(state.axisY, state.labelY, dirY);
  updateAxisTransform(state.axisZ, state.labelZ, dirZ);
}

function updateAxisTransform(axisEl: HTMLElement, labelEl: HTMLElement, direction: THREE.Vector3): void {
  const screenX = ORIGIN_OFFSET + direction.x * AXIS_LENGTH;
  const screenY = ORIGIN_OFFSET - direction.y * AXIS_LENGTH;

  const dx = direction.x * AXIS_LENGTH;
  const dy = -direction.y * AXIS_LENGTH;
  const length = Math.sqrt(dx * dx + dy * dy);

  const angle = Math.atan2(dy, dx) * (180 / Math.PI);

  axisEl.style.width = `${length}px`;
  axisEl.style.transform = `rotate(${angle}deg)`;
  axisEl.style.transformOrigin = '0% 50%';

  const labelOffset = 12;
  const labelX = ORIGIN_OFFSET + direction.x * (AXIS_LENGTH + labelOffset);
  const labelY = ORIGIN_OFFSET - direction.y * (AXIS_LENGTH + labelOffset);

  labelEl.style.left = `${labelX}px`;
  labelEl.style.top = `${labelY}px`;
  labelEl.style.transform = 'translate(-50%, -50%)';

  const depth = direction.z;
  const brightness = 0.4 + 0.6 * (depth + 1) / 2;
  axisEl.style.opacity = String(Math.max(0.3, brightness));
  labelEl.style.opacity = String(Math.max(0.4, brightness));
}

export function setVisible(visible: boolean): void {
  state.visible = visible;
  updateVisibility();
}

function updateVisibility(): void {
  if (state.container) {
    state.container.style.display = state.visible ? 'block' : 'none';
  }
}

export function dispose(): void {
  if (state.container) {
    state.container.remove();
    state.container = null;
  }
  state.axisX = null;
  state.axisY = null;
  state.axisZ = null;
  state.labelX = null;
  state.labelY = null;
  state.labelZ = null;
}
