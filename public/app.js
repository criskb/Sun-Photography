import * as THREE from 'https://unpkg.com/three@0.165.0/build/three.module.js';

const state = {
  session: null,
  map: null,
  marker: null,
  line: null,
  scene: null,
  camera: null,
  renderer: null,
  pathObject: null,
  allSamples: [],
  selectedSamples: [],
  drawPoints: [],
  isDrawing: false
};

const elements = {
  lat: document.getElementById('lat'),
  lon: document.getElementById('lon'),
  startDate: document.getElementById('startDate'),
  endDate: document.getElementById('endDate'),
  intervalMinutes: document.getElementById('intervalMinutes'),
  generateBtn: document.getElementById('generateBtn'),
  exportBtn: document.getElementById('exportBtn'),
  importInput: document.getElementById('importInput'),
  status: document.getElementById('status'),
  openAngle: document.getElementById('openAngle'),
  closedAngle: document.getElementById('closedAngle'),
  openMs: document.getElementById('openMs'),
  copyScheduleBtn: document.getElementById('copyScheduleBtn'),
  cameraPitch: document.getElementById('cameraPitch'),
  cameraYaw: document.getElementById('cameraYaw'),
  applyViewBtn: document.getElementById('applyViewBtn'),
  clearDrawBtn: document.getElementById('clearDrawBtn'),
  applyDrawBtn: document.getElementById('applyDrawBtn'),
  drawCanvas: document.getElementById('drawCanvas')
};

initializeDates();
initMap();
initThree();
initDrawing();
wireEvents();
animate();

function initializeDates() {
  const now = new Date();
  const end = new Date(now);
  end.setMonth(end.getMonth() + 6);
  elements.startDate.value = now.toISOString().slice(0, 10);
  elements.endDate.value = end.toISOString().slice(0, 10);
}

function setStatus(text) {
  elements.status.textContent = text;
}

async function generatePath() {
  setStatus('Generating sun path...');
  const payload = {
    lat: Number(elements.lat.value),
    lon: Number(elements.lon.value),
    startDate: `${elements.startDate.value}T00:00:00Z`,
    endDate: `${elements.endDate.value}T23:59:59Z`,
    intervalMinutes: Number(elements.intervalMinutes.value)
  };

  const resp = await fetch('/api/sunpath', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });

  const data = await resp.json();
  if (!resp.ok) {
    throw new Error(data.error || 'Unknown error while generating path.');
  }

  state.session = {
    version: 2,
    createdAt: new Date().toISOString(),
    selectedInstructions: [],
    camera: getCameraSettings(),
    ...data
  };

  renderSession();
}

function renderSession() {
  if (!state.session) return;

  state.allSamples = state.session.byDay.flatMap((d) => d.samples);
  state.selectedSamples = state.allSamples;

  applyFixedGroundView();
  clearDrawing();
  renderThreePath(state.allSamples, state.selectedSamples);
  renderMap(state.session.location.lat, state.session.location.lon, state.selectedSamples);

  setStatus([
    'Session ready',
    `Samples total: ${state.allSamples.length}`,
    `Samples selected: ${state.selectedSamples.length}`,
    `Location: ${state.session.location.lat.toFixed(5)}, ${state.session.location.lon.toFixed(5)}`
  ].join('\n'));
}

function renderThreePath(allSamples, selectedSamples) {
  if (state.pathObject) {
    state.scene.remove(state.pathObject);
  }

  const group = new THREE.Group();

  const fullVertices = allSamples.map(sampleToVector);
  const fullGeometry = new THREE.BufferGeometry().setFromPoints(fullVertices);
  const fullMaterial = new THREE.LineBasicMaterial({ color: 0x4b6078, opacity: 0.8, transparent: true });
  group.add(new THREE.Line(fullGeometry, fullMaterial));

  const selectedVertices = selectedSamples.map(sampleToVector);
  const selectedGeometry = new THREE.BufferGeometry().setFromPoints(selectedVertices);
  const selectedMaterial = new THREE.LineBasicMaterial({ color: 0xffcd3c });
  group.add(new THREE.Line(selectedGeometry, selectedMaterial));

  state.pathObject = group;
  state.scene.add(group);
}

function sampleToVector(sample) {
  const az = (sample.azimuthDeg * Math.PI) / 180;
  const alt = (sample.altitudeDeg * Math.PI) / 180;
  const radius = 25;
  const x = radius * Math.cos(alt) * Math.sin(az);
  const y = radius * Math.sin(alt);
  const z = radius * Math.cos(alt) * Math.cos(az);
  return new THREE.Vector3(x, y, z);
}

function initThree() {
  const container = document.getElementById('three');
  state.scene = new THREE.Scene();
  state.scene.background = new THREE.Color(0x0f1723);

  state.camera = new THREE.PerspectiveCamera(58, container.clientWidth / container.clientHeight, 0.1, 1000);
  state.camera.position.set(0, 1.6, 0);

  state.renderer = new THREE.WebGLRenderer({ antialias: true });
  state.renderer.setSize(container.clientWidth, container.clientHeight);
  container.appendChild(state.renderer.domElement);

  const ground = new THREE.Mesh(
    new THREE.CircleGeometry(26, 64),
    new THREE.MeshBasicMaterial({ color: 0x1b2f1f, side: THREE.DoubleSide })
  );
  ground.rotation.x = -Math.PI / 2;
  state.scene.add(ground);

  const dome = new THREE.Mesh(
    new THREE.SphereGeometry(26, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2),
    new THREE.MeshBasicMaterial({ color: 0x1f2f43, wireframe: true })
  );
  state.scene.add(dome);

  const horizon = new THREE.AxesHelper(5);
  horizon.position.y = 0.01;
  state.scene.add(horizon);

  window.addEventListener('resize', handleResize);
  handleResize();
}

function getCameraSettings() {
  return {
    pitchDeg: Number(elements.cameraPitch.value),
    yawDeg: Number(elements.cameraYaw.value)
  };
}

function applyFixedGroundView() {
  const settings = getCameraSettings();
  const yawRad = (settings.yawDeg * Math.PI) / 180;
  const pitchRad = (settings.pitchDeg * Math.PI) / 180;

  const dir = new THREE.Vector3(
    Math.sin(yawRad) * Math.cos(pitchRad),
    Math.sin(pitchRad),
    Math.cos(yawRad) * Math.cos(pitchRad)
  );

  state.camera.position.set(0, 1.6, 0);
  state.camera.lookAt(dir);

  if (state.session) {
    state.session.camera = settings;
  }
}

function handleResize() {
  const wrap = document.getElementById('threeWrap');
  const width = wrap.clientWidth;
  const height = wrap.clientHeight;

  state.camera.aspect = width / height;
  state.camera.updateProjectionMatrix();
  state.renderer.setSize(width, height);

  elements.drawCanvas.width = width;
  elements.drawCanvas.height = height;
  redrawCanvas();
}

function animate() {
  requestAnimationFrame(animate);
  state.renderer.render(state.scene, state.camera);
}

function initMap() {
  state.map = L.map('map').setView([40.7128, -74.006], 10);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; OpenStreetMap contributors'
  }).addTo(state.map);
}

function renderMap(lat, lon, samples) {
  if (state.marker) state.marker.remove();
  if (state.line) state.line.remove();

  state.marker = L.marker([lat, lon]).addTo(state.map).bindPopup('Pinhole camera location').openPopup();
  state.map.setView([lat, lon], 12);

  const segments = samples.map((sample) => {
    const bearingRad = (sample.azimuthDeg * Math.PI) / 180;
    const meters = 80;
    const dLat = (meters * Math.cos(bearingRad)) / 111320;
    const dLon = (meters * Math.sin(bearingRad)) / (111320 * Math.cos((lat * Math.PI) / 180));
    return [lat + dLat, lon + dLon];
  });

  state.line = L.polyline([[lat, lon], ...segments], { color: '#f8d66d', weight: 2 }).addTo(state.map);
}

function exportSession() {
  if (!state.session) {
    setStatus('Generate or import a session first.');
    return;
  }

  state.session.selectedInstructions = state.selectedSamples.map((s) => ({ utc: s.timestamp, action: 'PULSE_OPEN' }));

  const blob = new Blob([JSON.stringify(state.session, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `solargraphy-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
  setStatus('Exported session JSON with selected instructions.');
}

function importSession(file) {
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const data = JSON.parse(String(reader.result));
      if (!data.byDay || !data.location) throw new Error('Invalid session file.');
      state.session = data;
      elements.lat.value = data.location.lat;
      elements.lon.value = data.location.lon;

      if (data.camera) {
        elements.cameraPitch.value = data.camera.pitchDeg;
        elements.cameraYaw.value = data.camera.yawDeg;
      }

      renderSession();

      if (Array.isArray(data.selectedInstructions) && data.selectedInstructions.length > 0) {
        const selectedUtc = new Set(data.selectedInstructions.map((item) => item.utc));
        state.selectedSamples = state.allSamples.filter((sample) => selectedUtc.has(sample.timestamp));
        renderThreePath(state.allSamples, state.selectedSamples);
        renderMap(data.location.lat, data.location.lon, state.selectedSamples);
      }

      setStatus('Imported session JSON.');
    } catch (error) {
      setStatus(`Import failed: ${error.message}`);
    }
  };
  reader.readAsText(file);
}

async function copyNanoSchedule() {
  if (!state.session) {
    setStatus('Generate or import a session before making a Nano schedule.');
    return;
  }

  const schedule = {
    servo: {
      openAngle: Number(elements.openAngle.value),
      closedAngle: Number(elements.closedAngle.value),
      pulseOpenMs: Number(elements.openMs.value)
    },
    camera: getCameraSettings(),
    events: state.selectedSamples.map((sample) => ({ utc: sample.timestamp, action: 'PULSE_OPEN' }))
  };

  await navigator.clipboard.writeText(JSON.stringify(schedule, null, 2));
  setStatus(`Copied Nano schedule JSON. Events: ${schedule.events.length}`);
}

function initDrawing() {
  const canvas = elements.drawCanvas;

  canvas.addEventListener('pointerdown', (event) => {
    state.isDrawing = true;
    canvas.setPointerCapture(event.pointerId);
    addDrawPoint(event);
  });

  canvas.addEventListener('pointermove', (event) => {
    if (!state.isDrawing) return;
    addDrawPoint(event);
  });

  canvas.addEventListener('pointerup', () => {
    state.isDrawing = false;
  });
}

function addDrawPoint(event) {
  const rect = elements.drawCanvas.getBoundingClientRect();
  const point = { x: event.clientX - rect.left, y: event.clientY - rect.top };
  state.drawPoints.push(point);
  redrawCanvas();
}

function redrawCanvas() {
  const ctx = elements.drawCanvas.getContext('2d');
  ctx.clearRect(0, 0, elements.drawCanvas.width, elements.drawCanvas.height);

  if (state.drawPoints.length < 2) return;

  ctx.strokeStyle = '#74d3ff';
  ctx.lineWidth = 8;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(state.drawPoints[0].x, state.drawPoints[0].y);
  for (let i = 1; i < state.drawPoints.length; i += 1) {
    ctx.lineTo(state.drawPoints[i].x, state.drawPoints[i].y);
  }
  ctx.stroke();
}

function clearDrawing() {
  state.drawPoints = [];
  redrawCanvas();
}

function applyDrawingToSchedule() {
  if (!state.session || state.drawPoints.length < 2) {
    setStatus('Generate data and draw on the sky before applying.');
    return;
  }

  const hitRadiusPx = 12;
  const selected = [];

  for (const sample of state.allSamples) {
    const projected = projectSampleToScreen(sample);
    if (!projected) continue;

    for (const point of state.drawPoints) {
      const dx = projected.x - point.x;
      const dy = projected.y - point.y;
      if (Math.sqrt(dx * dx + dy * dy) <= hitRadiusPx) {
        selected.push(sample);
        break;
      }
    }
  }

  state.selectedSamples = selected;
  renderThreePath(state.allSamples, state.selectedSamples);
  renderMap(state.session.location.lat, state.session.location.lon, state.selectedSamples);
  setStatus(`Drawing applied. Selected samples: ${state.selectedSamples.length}`);
}

function projectSampleToScreen(sample) {
  const vector = sampleToVector(sample).clone().project(state.camera);
  if (vector.z > 1) return null;

  const width = elements.drawCanvas.width;
  const height = elements.drawCanvas.height;

  return {
    x: (vector.x * 0.5 + 0.5) * width,
    y: (-vector.y * 0.5 + 0.5) * height
  };
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
    applyFixedGroundView();
    setStatus('Applied fixed ground camera settings.');
  });

  elements.clearDrawBtn.addEventListener('click', () => {
    clearDrawing();
    setStatus('Drawing cleared.');
  });

  elements.applyDrawBtn.addEventListener('click', applyDrawingToSchedule);
  elements.exportBtn.addEventListener('click', exportSession);

  elements.importInput.addEventListener('change', (event) => {
    const [file] = event.target.files;
    if (file) importSession(file);
  });

  elements.copyScheduleBtn.addEventListener('click', async () => {
    try {
      await copyNanoSchedule();
    } catch (error) {
      setStatus(`Clipboard error: ${error.message}`);
    }
  });
}
