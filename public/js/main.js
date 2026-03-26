import { state } from './core/state.js';
import { elements } from './ui/dom.js';
import {
  initializeDates,
  setStatus,
  getCameraSettings,
  syncCameraInputs,
  setToolMode,
  setViewportMode
} from './ui/panel.js';
import { requestSunPath } from './services/sunApi.js';
import { exportSessionJson, importSessionFile, copyNanoSchedule } from './services/sessionService.js';
import { ThreeView } from './views/threeView.js';
import { MapView } from './views/mapView.js';
import { GroundMap3DView } from './views/groundMap3dView.js';
import { ViewportTools, drawOverlay } from './tools/viewportTools.js';

const threeView = new ThreeView();
const mapView = new MapView();
const ground3DView = new GroundMap3DView();

initializeDates();
threeView.init();
threeView.animate();
mapView.init();
ground3DView.init();
applyCamera();

const viewportTools = new ViewportTools({
  getMode: () => state.activeTool,
  onRotate: (dx, dy) => {
    const yaw = Number(elements.cameraYaw.value) + dx * 0.35;
    const pitch = Number(elements.cameraPitch.value) - dy * 0.2;
    syncCameraInputs(pitch, yaw);
    applyCamera();
  },
  onDrawPoint: (point) => {
    state.drawPoints.push(point);
  },
  redraw: () => drawOverlay(state.drawPoints)
});
viewportTools.init();

window.addEventListener('resize', () => {
  threeView.resize();
  ground3DView.resize();
  drawOverlay(state.drawPoints);
});

setTool('rotate');
setViewport('sky');
renderAll();
wireEvents();

function applyCamera() {
  const camera = getCameraSettings();
  threeView.applyCamera(camera);
  ground3DView.setView({
    lat: Number(elements.lat.value),
    lon: Number(elements.lon.value),
    yawDeg: camera.yawDeg
  });

  if (state.session) state.session.camera = camera;
}

async function generatePath() {
  setStatus('Generating physically-based sun path...');

  const payload = {
    lat: Number(elements.lat.value),
    lon: Number(elements.lon.value),
    startDate: `${elements.startDate.value}T00:00:00Z`,
    endDate: `${elements.endDate.value}T23:59:59Z`,
    intervalMinutes: Number(elements.intervalMinutes.value)
  };

  const data = await requestSunPath(payload);

  state.session = {
    version: 5,
    createdAt: new Date().toISOString(),
    selectedInstructions: [],
    camera: getCameraSettings(),
    ...data
  };

  state.allSamples = state.session.byDay.flatMap((day) => day.samples);
  state.selectedSamples = [...state.allSamples];
  state.drawPoints = [];

  renderAll();

  setStatus([
    'Session ready',
    `Model: ${state.session.model}`,
    `Samples total: ${state.allSamples.length}`,
    `Samples selected: ${state.selectedSamples.length}`,
    `Location: ${state.session.location.lat.toFixed(5)}, ${state.session.location.lon.toFixed(5)}`
  ]);
}

function renderAll() {
  applyCamera();
  const byDay = state.session ? state.session.byDay : [];
  threeView.renderTrails(byDay, state.selectedSamples);
  drawOverlay(state.drawPoints);

  const lat = state.session ? state.session.location.lat : Number(elements.lat.value);
  const lon = state.session ? state.session.location.lon : Number(elements.lon.value);

  void threeView.updateGroundTexture(lat, lon);
  ground3DView.setView({ lat, lon, yawDeg: Number(elements.cameraYaw.value) });

  if (state.session) {
    mapView.render(state.session.location.lat, state.session.location.lon, state.selectedSamples);
  }
}

function applyDrawingSelection() {
  if (!state.session || state.drawPoints.length < 2) {
    setStatus('Generate data and draw in the viewport before applying selection.');
    return;
  }

  const hitRadiusPx = 12;

  state.selectedSamples = state.allSamples.filter((sample) => {
    const projected = threeView.projectSample(sample);
    if (!projected) return false;

    return state.drawPoints.some((point) => {
      const dx = projected.x - point.x;
      const dy = projected.y - point.y;
      return Math.sqrt(dx * dx + dy * dy) <= hitRadiusPx;
    });
  });

  renderAll();
  setStatus(`Drawing applied. Selected samples: ${state.selectedSamples.length}`);
}

function clearDrawing() {
  state.drawPoints = [];
  drawOverlay(state.drawPoints);
}


function buildShutterEvents(samples, intervalMinutes) {
  const sorted = [...samples].sort((a, b) => a.timestamp.localeCompare(b.timestamp));
  if (!sorted.length) return [];

  const maxGapMs = Math.max(5, intervalMinutes) * 60 * 1000 * 1.5;
  const events = [];
  let windowStart = sorted[0];
  let previous = sorted[0];

  for (let i = 1; i < sorted.length; i += 1) {
    const current = sorted[i];
    const gap = new Date(current.timestamp).getTime() - new Date(previous.timestamp).getTime();

    if (gap > maxGapMs) {
      events.push({ utc: windowStart.timestamp, action: 'OPEN' });
      events.push({ utc: previous.timestamp, action: 'CLOSE' });
      windowStart = current;
    }

    previous = current;
  }

  events.push({ utc: windowStart.timestamp, action: 'OPEN' });
  events.push({ utc: previous.timestamp, action: 'CLOSE' });

  return events;
}

async function exportSession() {
  if (!state.session) {
    setStatus('Generate or import a session first.');
    return;
  }

  state.session.selectedInstructions = buildShutterEvents(state.selectedSamples, Number(elements.intervalMinutes.value));
  state.session.camera = getCameraSettings();
  exportSessionJson(state.session);
  setStatus('Exported session JSON with camera and selected instructions.');
}

async function importSession(file) {
  const data = await importSessionFile(file);

  if (!data.byDay || !data.location) {
    throw new Error('Invalid session file.');
  }

  state.session = data;
  elements.lat.value = data.location.lat;
  elements.lon.value = data.location.lon;

  if (data.camera) {
    syncCameraInputs(data.camera.pitchDeg, data.camera.yawDeg);
  }

  state.allSamples = state.session.byDay.flatMap((day) => day.samples);
  state.selectedSamples = [...state.allSamples];

  if (Array.isArray(data.selectedInstructions) && data.selectedInstructions.length > 0) {
    const selectedUtc = new Set(data.selectedInstructions.map((item) => item.utc));
    state.selectedSamples = state.allSamples.filter((sample) => selectedUtc.has(sample.timestamp));
  }

  renderAll();
  setStatus('Imported session JSON.');
}

async function copySchedule() {
  if (!state.session) {
    setStatus('Generate or import a session before making a Nano schedule.');
    return;
  }

  const total = await copyNanoSchedule({
    selectedSamples: state.selectedSamples,
    shutterEvents: buildShutterEvents(state.selectedSamples, Number(elements.intervalMinutes.value)),
    camera: getCameraSettings(),
    servo: {
      openAngle: Number(elements.openAngle.value),
      closedAngle: Number(elements.closedAngle.value),
      pulseOpenMs: Number(elements.openMs.value)
    }
  });

  setStatus(`Copied Nano schedule JSON. Events: ${total}`);
}

function setTool(mode) {
  state.activeTool = mode;
  setToolMode(mode);
}

function setViewport(mode) {
  state.viewportMode = mode;
  setViewportMode(mode);
  ground3DView.resize();
}

function wireEvents() {
  elements.generateBtn.addEventListener('click', async () => {
    try {
      await generatePath();
    } catch (error) {
      setStatus(error.message);
    }
  });

  elements.applyViewBtn.addEventListener('click', () => {
    applyCamera();
    setStatus('Applied camera view settings.');
  });

  elements.skyViewBtn.addEventListener('click', () => {
    setViewport('sky');
    setStatus('Sky + Ground + Path POV active.');
  });

  elements.ground3dViewBtn.addEventListener('click', () => {
    setViewport('ground3d');
    setStatus('3D Ground View active.');
  });

  elements.rotateToolBtn.addEventListener('click', () => {
    setTool('rotate');
    setStatus('Rotate tool active. Drag viewport to tune yaw/pitch.');
  });

  elements.drawToolBtn.addEventListener('click', () => {
    setTool('draw');
    setStatus('Draw tool active. Sketch desired trail sections.');
  });

  elements.clearDrawBtn.addEventListener('click', () => {
    clearDrawing();
    setStatus('Drawing cleared.');
  });

  elements.applyDrawBtn.addEventListener('click', applyDrawingSelection);
  elements.exportBtn.addEventListener('click', exportSession);

  elements.importInput.addEventListener('change', async (event) => {
    const [file] = event.target.files;
    if (!file) return;

    try {
      await importSession(file);
    } catch (error) {
      setStatus(`Import failed: ${error.message}`);
    }
  });

  elements.copyScheduleBtn.addEventListener('click', async () => {
    try {
      await copySchedule();
    } catch (error) {
      setStatus(`Clipboard error: ${error.message}`);
    }
  });

  elements.cameraPitch.addEventListener('change', applyCamera);
  elements.cameraYaw.addEventListener('change', applyCamera);
  elements.lat.addEventListener('change', renderAll);
  elements.lon.addEventListener('change', renderAll);
}
