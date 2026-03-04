import { lightingStore, displayStore } from './state';
import { renderer } from './renderer';
import { updateSettings } from './configHandler';

export interface LightPickerState {
  activeLightPicker: string | null;
  lightPickerDragging: boolean;
}

export const pickerState: LightPickerState = {
  activeLightPicker: null,
  lightPickerDragging: false,
};

function getLightObject(prefix: string): { intensity: number; color: string; x: number; y: number; z: number } | null {
  if (prefix === 'key') return lightingStore.keyLight;
  if (prefix === 'fill') return lightingStore.fillLight;
  if (prefix === 'rim') return lightingStore.rimLight;
  return null;
}

function getLightLabel(prefix: string): string {
  if (prefix === 'key') return 'Key';
  if (prefix === 'fill') return 'Fill';
  if (prefix === 'rim') return 'Rim';
  return '';
}

function updateLightPickerButtons(canvas: HTMLCanvasElement | null): void {
  for (const prefix of ['key', 'fill', 'rim']) {
    const button = document.getElementById(`btn-pick-${prefix}-light`) as HTMLButtonElement | null;
    if (!button) continue;
    const isActive = pickerState.activeLightPicker === prefix;
    button.classList.toggle('active', isActive);
    button.setAttribute('aria-pressed', isActive ? 'true' : 'false');
    button.textContent = isActive ? 'Picking in Canvas...' : 'Pick in Canvas';
  }
  if (canvas) {
    canvas.style.cursor = pickerState.activeLightPicker ? 'crosshair' : '';
  }
}

function setActiveLightPicker(prefix: string | null, canvas: HTMLCanvasElement, onSetStatus: (msg: string) => void): void {
  pickerState.activeLightPicker = prefix;
  pickerState.lightPickerDragging = false;
  renderer.setControlsEnabled(!prefix);
  updateLightPickerButtons(canvas);
  onSetStatus(
    prefix
      ? `${getLightLabel(prefix)} light picker active: drag in canvas (Esc to exit).`
      : 'Ready.'
  );
}

export function applyFromEvent(event: PointerEvent, canvas: HTMLCanvasElement): void {
  if (!pickerState.activeLightPicker) return;
  const lightObj = getLightObject(pickerState.activeLightPicker);
  if (!lightObj) return;
  const rect = canvas.getBoundingClientRect();
  if (!rect.width || !rect.height) return;
  const ndcX = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  const ndcY = -((event.clientY - rect.top) / rect.height) * 2 + 1;
  const xNorm = Math.max(-0.98, Math.min(0.98, ndcX));
  const yNorm = Math.max(-0.98, Math.min(0.98, ndcY));
  const xy = xNorm * xNorm + yNorm * yNorm;
  const zNorm = Math.sqrt(Math.max(0, 1 - Math.min(0.99, xy)));
  const length = Math.max(
    5,
    Math.min(50, Math.sqrt(lightObj.x * lightObj.x + lightObj.y * lightObj.y + lightObj.z * lightObj.z) || 17)
  );
  const zSign = lightObj.z < 0 ? -1 : 1;
  lightObj.x = Math.round(xNorm * length);
  lightObj.y = Math.round(yNorm * length);
  lightObj.z = Math.round(zSign * zNorm * length);
  updateLightSliderUI(pickerState.activeLightPicker, lightObj);
  renderer.updateLighting();
  updateSettings();
}

export function deactivatePicker(canvas: HTMLCanvasElement, onSetStatus: (msg: string) => void): void {
  setActiveLightPicker(null, canvas, onSetStatus);
}

function setupLightSliders(prefix: string): void {
  const intensitySlider = document.getElementById(`${prefix}-intensity-slider`) as HTMLInputElement | null;
  const intensityValue = document.getElementById(`${prefix}-intensity-value`);
  const xSlider = document.getElementById(`${prefix}-x-slider`) as HTMLInputElement | null;
  const xValue = document.getElementById(`${prefix}-x-value`);
  const ySlider = document.getElementById(`${prefix}-y-slider`) as HTMLInputElement | null;
  const yValue = document.getElementById(`${prefix}-y-value`);
  const zSlider = document.getElementById(`${prefix}-z-slider`) as HTMLInputElement | null;
  const zValue = document.getElementById(`${prefix}-z-value`);
  const colorPicker = document.getElementById(`${prefix}-color-picker`) as HTMLInputElement | null;

  if (intensitySlider) {
    intensitySlider.addEventListener('input', () => {
      const lightObj = getLightObject(prefix);
      if (!lightObj) return;
      lightObj.intensity = parseFloat(intensitySlider.value);
      if (intensityValue) intensityValue.textContent = lightObj.intensity.toFixed(1);
      renderer.updateLighting();
      updateSettings();
    });
  }
  if (xSlider) {
    xSlider.addEventListener('input', () => {
      const lightObj = getLightObject(prefix);
      if (!lightObj) return;
      lightObj.x = parseInt(xSlider.value);
      if (xValue) xValue.textContent = String(lightObj.x);
      renderer.updateLighting();
      updateSettings();
    });
  }
  if (ySlider) {
    ySlider.addEventListener('input', () => {
      const lightObj = getLightObject(prefix);
      if (!lightObj) return;
      lightObj.y = parseInt(ySlider.value);
      if (yValue) yValue.textContent = String(lightObj.y);
      renderer.updateLighting();
      updateSettings();
    });
  }
  if (zSlider) {
    zSlider.addEventListener('input', () => {
      const lightObj = getLightObject(prefix);
      if (!lightObj) return;
      lightObj.z = parseInt(zSlider.value);
      if (zValue) zValue.textContent = String(lightObj.z);
      renderer.updateLighting();
      updateSettings();
    });
  }
  if (colorPicker) {
    colorPicker.addEventListener('input', () => {
      const lightObj = getLightObject(prefix);
      if (!lightObj) return;
      lightObj.color = colorPicker.value;
      renderer.updateLighting();
      updateSettings();
    });
  }
}

function updateLightSliderUI(prefix: string, lightObj: { intensity: number; color: string; x: number; y: number; z: number }): void {
  const intensitySlider = document.getElementById(`${prefix}-intensity-slider`) as HTMLInputElement | null;
  const intensityValue = document.getElementById(`${prefix}-intensity-value`);
  const xSlider = document.getElementById(`${prefix}-x-slider`) as HTMLInputElement | null;
  const xValue = document.getElementById(`${prefix}-x-value`);
  const ySlider = document.getElementById(`${prefix}-y-slider`) as HTMLInputElement | null;
  const yValue = document.getElementById(`${prefix}-y-value`);
  const zSlider = document.getElementById(`${prefix}-z-slider`) as HTMLInputElement | null;
  const zValue = document.getElementById(`${prefix}-z-value`);
  const colorPicker = document.getElementById(`${prefix}-color-picker`) as HTMLInputElement | null;

  if (intensitySlider) intensitySlider.value = String(lightObj.intensity);
  if (intensityValue) intensityValue.textContent = lightObj.intensity.toFixed(1);
  if (xSlider) xSlider.value = String(lightObj.x);
  if (xValue) xValue.textContent = String(lightObj.x);
  if (ySlider) ySlider.value = String(lightObj.y);
  if (yValue) yValue.textContent = String(lightObj.y);
  if (zSlider) zSlider.value = String(lightObj.z);
  if (zValue) zValue.textContent = String(lightObj.z);
  if (colorPicker) colorPicker.value = lightObj.color || (prefix === 'key' ? '#CCCCCC' : '#ffffff');
}

export function init(canvas: HTMLCanvasElement, onSetStatus: (msg: string) => void): void {
  const lightingEnabled = document.getElementById('lighting-enabled') as HTMLInputElement | null;
  if (lightingEnabled) {
    lightingEnabled.addEventListener('change', () => {
      lightingStore.lightingEnabled = lightingEnabled.checked;
      renderer.updateLighting();
      updateSettings();
    });
  }

  const ambientSlider = document.getElementById('ambient-slider') as HTMLInputElement | null;
  const ambientValue = document.getElementById('ambient-value');
  const ambientColorPicker = document.getElementById('ambient-color-picker') as HTMLInputElement | null;
  const shininessSlider = document.getElementById('shininess-slider') as HTMLInputElement | null;
  const shininessValue = document.getElementById('shininess-value');

  if (ambientSlider) {
    ambientSlider.addEventListener('input', () => {
      lightingStore.ambientIntensity = parseFloat(ambientSlider.value);
      if (ambientValue) ambientValue.textContent = lightingStore.ambientIntensity.toFixed(1);
      renderer.updateLighting();
      updateSettings();
    });
  }
  if (shininessSlider) {
    const initialShininess = Number.isFinite(displayStore.shininess)
      ? Math.max(0, Math.min(200, Number(displayStore.shininess)))
      : 50;
    displayStore.shininess = initialShininess;
    shininessSlider.value = String(initialShininess);
    if (shininessValue) shininessValue.textContent = String(Math.round(initialShininess));
    shininessSlider.addEventListener('input', () => {
      displayStore.shininess = Math.max(0, Math.min(200, Number(shininessSlider.value) || 50));
      if (shininessValue) shininessValue.textContent = String(Math.round(displayStore.shininess));
      renderer.updateLighting();
      updateSettings();
    });
  }
  if (ambientColorPicker) {
    ambientColorPicker.value = lightingStore.ambientColor || '#ffffff';
    ambientColorPicker.addEventListener('input', () => {
      lightingStore.ambientColor = ambientColorPicker.value;
      renderer.updateLighting();
      updateSettings();
    });
  }

  setupLightSliders('key');
  setupLightSliders('fill');
  setupLightSliders('rim');
  updateLightSliderUI('key', lightingStore.keyLight);
  updateLightSliderUI('fill', lightingStore.fillLight);
  updateLightSliderUI('rim', lightingStore.rimLight);

  for (const prefix of ['key', 'fill', 'rim']) {
    const button = document.getElementById(`btn-pick-${prefix}-light`) as HTMLButtonElement | null;
    if (!button) continue;
    button.addEventListener('click', () => {
      setActiveLightPicker(
        pickerState.activeLightPicker === prefix ? null : prefix,
        canvas,
        onSetStatus
      );
    });
  }
  updateLightPickerButtons(canvas);

  const btnResetLighting = document.getElementById('btn-reset-lighting') as HTMLButtonElement | null;
  if (btnResetLighting) {
    btnResetLighting.addEventListener('click', () => {
      lightingStore.keyLight = { intensity: 0.7, x: 0, y: 0, z: 10, color: '#CCCCCC' };
      lightingStore.fillLight = { intensity: 0, x: -10, y: -5, z: 5, color: '#ffffff' };
      lightingStore.rimLight = { intensity: 0, x: 0, y: 5, z: -10, color: '#ffffff' };
      lightingStore.ambientIntensity = 0.5;
      lightingStore.ambientColor = '#ffffff';
      displayStore.shininess = 50;
      lightingStore.lightingEnabled = true;

      if (lightingEnabled) lightingEnabled.checked = true;
      if (ambientSlider) ambientSlider.value = '0.5';
      if (ambientValue) ambientValue.textContent = '0.5';
      if (ambientColorPicker) ambientColorPicker.value = '#ffffff';
      if (shininessSlider) shininessSlider.value = '50';
      if (shininessValue) shininessValue.textContent = '50';

      updateLightSliderUI('key', { intensity: 0.7, x: 0, y: 0, z: 10, color: '#CCCCCC' });
      updateLightSliderUI('fill', { intensity: 0, x: -10, y: -5, z: 5, color: '#ffffff' });
      updateLightSliderUI('rim', { intensity: 0, x: 0, y: 5, z: -10, color: '#ffffff' });

      renderer.updateLighting();
      setActiveLightPicker(null, canvas, onSetStatus);
      updateSettings();
    });
  }
}
