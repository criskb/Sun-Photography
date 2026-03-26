import { elements } from './dom.js';

export function setStatus(lines) {
  const text = Array.isArray(lines) ? lines.join('\n') : lines;
  elements.status.textContent = text;
}

export function initializeDates() {
  const now = new Date();
  const end = new Date(now);
  end.setMonth(end.getMonth() + 6);
  elements.startDate.value = now.toISOString().slice(0, 10);
  elements.endDate.value = end.toISOString().slice(0, 10);
}

export function getCameraSettings() {
  return {
    pitchDeg: Number(elements.cameraPitch.value),
    yawDeg: Number(elements.cameraYaw.value)
  };
}

export function syncCameraInputs(pitchDeg, yawDeg) {
  elements.cameraPitch.value = Math.max(-10, Math.min(89, pitchDeg)).toFixed(2);
  elements.cameraYaw.value = ((yawDeg % 360) + 360) % 360;
}

export function setToolMode(mode) {
  elements.rotateToolBtn.classList.toggle('is-active', mode === 'rotate');
  elements.drawToolBtn.classList.toggle('is-active', mode === 'draw');
  elements.drawCanvas.style.cursor = mode === 'draw' ? 'crosshair' : 'grab';
}

export function setViewportMode(mode) {
  const isSky = mode === 'sky';

  elements.skyViewBtn.classList.toggle('is-active', isSky);
  elements.ground3dViewBtn.classList.toggle('is-active', !isSky);

  elements.three.classList.toggle('hidden', !isSky);
  elements.drawCanvas.classList.toggle('hidden', !isSky);
  elements.groundMap3d.classList.toggle('hidden', isSky);
}
