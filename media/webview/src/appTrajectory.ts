/**
 * Trajectory playback module.
 *
 * Owns: updateTrajectoryUI, requestTrajectoryFrame, jumpToTrajectoryFrame,
 *       stepTrajectoryFrame, restartTrajectoryPlaybackTimer, setTrajectoryPlaying,
 *       and wires all Trajectory-tab UI controls.
 *
 * setup(callbacks) must be called once during app initialisation.
 */
import { trajectoryStore } from './state';
import type { VsCodeApi } from './types';
import { debounce } from './utils/performance';

let _vscode: VsCodeApi | null = null;
let trajectoryPlaybackTimer: ReturnType<typeof setInterval> | null = null;
let trajectoryFrameRequestPending = false;

// Debounced version of requestTrajectoryFrame for slider input (16ms = 60fps)
const debouncedRequestTrajectoryFrame = debounce(
  function (frameIndex: number): void {
    if (trajectoryFrameRequestPending) { return; }
    trajectoryFrameRequestPending = true;
    _vscode?.postMessage({ command: 'setTrajectoryFrame', frameIndex });
  },
  16
);

// ── Core logic ─────────────────────────────────────────────────────────────────

export function updateUI(frameIndex: number, frameCount: number): void {
  const total = Number.isFinite(frameCount) ? Math.max(1, Math.floor(frameCount)) : 1;
  const current = Number.isFinite(frameIndex)
    ? Math.max(0, Math.min(total - 1, Math.floor(frameIndex)))
    : 0;
  trajectoryStore.trajectoryFrameIndex = current;
  trajectoryStore.trajectoryFrameCount = total;

  const statusFrame = document.getElementById('status-traj-frame') as HTMLElement | null;
  const firstBtn = document.getElementById('btn-first-frame') as HTMLButtonElement | null;
  const prevBtn = document.getElementById('btn-prev-frame') as HTMLButtonElement | null;
  const nextBtn = document.getElementById('btn-next-frame') as HTMLButtonElement | null;
  const lastBtn = document.getElementById('btn-last-frame') as HTMLButtonElement | null;
  const frameInput = document.getElementById('traj-frame-input') as HTMLInputElement | null;
  if (statusFrame) {
    statusFrame.textContent = `Frame ${current + 1}/${total}`;
  }
  if (firstBtn) { firstBtn.disabled = total <= 1 || current <= 0; }
  if (prevBtn) { prevBtn.disabled = total <= 1 || current <= 0; }
  if (nextBtn) { nextBtn.disabled = total <= 1 || current >= total - 1; }
  if (lastBtn) { lastBtn.disabled = total <= 1 || current >= total - 1; }
  if (frameInput) {
    frameInput.min = '1';
    frameInput.max = String(total);
    frameInput.disabled = total <= 1;
    if (document.activeElement !== frameInput) {
      frameInput.value = String(current + 1);
    }
  }

  const playBtn = document.getElementById('btn-play-trajectory') as HTMLButtonElement | null;
  const speedSlider = document.getElementById('traj-speed-slider') as HTMLInputElement | null;
  const speedValue = document.getElementById('traj-speed-value') as HTMLElement | null;
  if (total <= 1 && trajectoryStore.trajectoryPlaying) {
    setPlaying(false);
  }
  if (playBtn) {
    playBtn.textContent = trajectoryStore.trajectoryPlaying ? 'Pause' : 'Play';
    playBtn.disabled = total <= 1;
  }
  if (speedSlider) {
    speedSlider.value = String(trajectoryStore.trajectoryPlaybackFps || 8);
    speedSlider.disabled = total <= 1;
  }
  if (speedValue) {
    speedValue.textContent = `${trajectoryStore.trajectoryPlaybackFps || 8} fps`;
  }
}

function requestTrajectoryFrame(frameIndex: number, force?: boolean): void {
  if (!force && trajectoryFrameRequestPending) { return; }
  trajectoryFrameRequestPending = true;
  _vscode?.postMessage({ command: 'setTrajectoryFrame', frameIndex });
}

export function jumpToFrame(frameIndex: number): void {
  const total = Math.max(1, Math.floor(trajectoryStore.trajectoryFrameCount || 1));
  const nextIndex = Math.max(0, Math.min(total - 1, Math.floor(frameIndex)));
  if (nextIndex === trajectoryStore.trajectoryFrameIndex) {
    updateUI(trajectoryStore.trajectoryFrameIndex, trajectoryStore.trajectoryFrameCount);
    return;
  }
  requestTrajectoryFrame(nextIndex, true);
}

function stepTrajectoryFrame(): void {
  if (trajectoryStore.trajectoryFrameCount <= 1) { return; }
  const nextIndex =
    trajectoryStore.trajectoryFrameIndex + 1 >= trajectoryStore.trajectoryFrameCount
      ? 0
      : trajectoryStore.trajectoryFrameIndex + 1;
  requestTrajectoryFrame(nextIndex);
}

function restartTrajectoryPlaybackTimer(): void {
  if (trajectoryPlaybackTimer) {
    clearInterval(trajectoryPlaybackTimer);
    trajectoryPlaybackTimer = null;
  }
  if (!trajectoryStore.trajectoryPlaying || trajectoryStore.trajectoryFrameCount <= 1) { return; }
  const fps = Math.max(1, Math.floor(trajectoryStore.trajectoryPlaybackFps || 8));
  const intervalMs = Math.max(16, Math.round(1000 / fps));
  trajectoryPlaybackTimer = setInterval(() => {
    if (trajectoryStore.trajectoryFrameCount <= 1) {
      setPlaying(false);
      return;
    }
    stepTrajectoryFrame();
  }, intervalMs);
}

export function setPlaying(playing: boolean): void {
  trajectoryStore.trajectoryPlaying = !!playing && trajectoryStore.trajectoryFrameCount > 1;
  restartTrajectoryPlaybackTimer();
  updateUI(trajectoryStore.trajectoryFrameIndex, trajectoryStore.trajectoryFrameCount);
}

export function clearPending(): void {
  trajectoryFrameRequestPending = false;
}

// ── UI wiring ──────────────────────────────────────────────────────────────────

export function setup(vscode: VsCodeApi): void {
  _vscode = vscode;

  const firstFrameBtn = document.getElementById('btn-first-frame') as HTMLButtonElement | null;
  const prevFrameBtn = document.getElementById('btn-prev-frame') as HTMLButtonElement | null;
  const nextFrameBtn = document.getElementById('btn-next-frame') as HTMLButtonElement | null;
  const lastFrameBtn = document.getElementById('btn-last-frame') as HTMLButtonElement | null;
  const playTrajectoryBtn = document.getElementById('btn-play-trajectory') as HTMLButtonElement | null;
  const frameInput = document.getElementById('traj-frame-input') as HTMLInputElement | null;
  const speedSlider = document.getElementById('traj-speed-slider') as HTMLInputElement | null;

  if (firstFrameBtn) {
    firstFrameBtn.addEventListener('click', () => { jumpToFrame(0); });
  }
  if (prevFrameBtn) {
    prevFrameBtn.addEventListener('click', () => { jumpToFrame(trajectoryStore.trajectoryFrameIndex - 1); });
  }
  if (nextFrameBtn) {
    nextFrameBtn.addEventListener('click', () => { jumpToFrame(trajectoryStore.trajectoryFrameIndex + 1); });
  }
  if (lastFrameBtn) {
    lastFrameBtn.addEventListener('click', () => { jumpToFrame(trajectoryStore.trajectoryFrameCount - 1); });
  }
  if (playTrajectoryBtn) {
    playTrajectoryBtn.addEventListener('click', () => { setPlaying(!trajectoryStore.trajectoryPlaying); });
  }
  if (frameInput) {
    // Debounced frame input commit (prevents flooding during typing)
    const debouncedCommitFrameInput = debounce(() => {
      const total = Math.max(1, Math.floor(trajectoryStore.trajectoryFrameCount || 1));
      const parsed = Number.parseInt(frameInput.value, 10);
      if (!Number.isFinite(parsed)) {
        updateUI(trajectoryStore.trajectoryFrameIndex, total);
        return;
      }
      jumpToFrame(parsed - 1);
    }, 100);

    const commitFrameInput = () => {
      debouncedCommitFrameInput();
    };
    frameInput.addEventListener('change', commitFrameInput);
    frameInput.addEventListener('input', commitFrameInput); // Debounced input for smoother UX
    frameInput.addEventListener('keydown', (event: KeyboardEvent) => {
      if (event.key !== 'Enter') { return; }
      event.preventDefault();
      commitFrameInput();
    });
  }
  if (speedSlider) {
    speedSlider.addEventListener('input', (event: Event) => {
      const target = event.target as HTMLInputElement;
      const nextFps = Math.max(1, Math.min(30, Math.floor(Number(target.value) || 8)));
      trajectoryStore.trajectoryPlaybackFps = nextFps;
      if (trajectoryStore.trajectoryPlaying) {
        restartTrajectoryPlaybackTimer();
      }
      updateUI(trajectoryStore.trajectoryFrameIndex, trajectoryStore.trajectoryFrameCount);
    });
  }

  updateUI(trajectoryStore.trajectoryFrameIndex, trajectoryStore.trajectoryFrameCount);
}

// ── Cleanup ────────────────────────────────────────────────────────────────────

window.addEventListener('beforeunload', () => {
  if (trajectoryPlaybackTimer) {
    clearInterval(trajectoryPlaybackTimer);
    trajectoryPlaybackTimer = null;
  }
});
