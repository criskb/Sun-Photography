import * as THREE from 'https://unpkg.com/three@0.165.0/build/three.module.js';

const state = {
  session: null,
  map: null,
  marker: null,
  line: null,
  scene: null,
  camera: null,
  renderer: null,
  pathObject: null
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
  copyScheduleBtn: document.getElementById('copyScheduleBtn')
};

initializeDates();
initMap();
initThree();
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
    version: 1,
    createdAt: new Date().toISOString(),
    ...data
  };

  renderSession();
}

function renderSession() {
  if (!state.session) return;
  const allSamples = state.session.byDay.flatMap((d) => d.samples);

  renderThreePath(allSamples);
  renderMap(state.session.location.lat, state.session.location.lon, allSamples);

  setStatus([
    `Session ready`,
    `Samples: ${state.session.samplesCount}`,
    `Location: ${state.session.location.lat.toFixed(5)}, ${state.session.location.lon.toFixed(5)}`,
    `Dates: ${state.session.schedule.startDate} -> ${state.session.schedule.endDate}`
  ].join('\n'));
}

function renderThreePath(samples) {
  if (state.pathObject) {
    state.scene.remove(state.pathObject);
  }

  const vertices = samples.map((s) => {
    const az = (s.azimuthDeg * Math.PI) / 180;
    const alt = (s.altitudeDeg * Math.PI) / 180;
    const radius = 25;
    const x = radius * Math.cos(alt) * Math.sin(az);
    const y = radius * Math.sin(alt);
    const z = radius * Math.cos(alt) * Math.cos(az);
    return new THREE.Vector3(x, y, z);
  });

  const geometry = new THREE.BufferGeometry().setFromPoints(vertices);
  const material = new THREE.LineBasicMaterial({ color: 0xffcd3c });
  state.pathObject = new THREE.Line(geometry, material);
  state.scene.add(state.pathObject);
}

function initThree() {
  const container = document.getElementById('three');
  state.scene = new THREE.Scene();
  state.scene.background = new THREE.Color(0x0f1723);

  state.camera = new THREE.PerspectiveCamera(55, container.clientWidth / container.clientHeight, 0.1, 1000);
  state.camera.position.set(0, 15, 60);

  state.renderer = new THREE.WebGLRenderer({ antialias: true });
  state.renderer.setSize(container.clientWidth, container.clientHeight);
  container.appendChild(state.renderer.domElement);

  const axes = new THREE.AxesHelper(30);
  state.scene.add(axes);

  const dome = new THREE.Mesh(
    new THREE.SphereGeometry(26, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2),
    new THREE.MeshBasicMaterial({ color: 0x1f2f43, wireframe: true })
  );
  state.scene.add(dome);

  window.addEventListener('resize', () => {
    state.camera.aspect = container.clientWidth / container.clientHeight;
    state.camera.updateProjectionMatrix();
    state.renderer.setSize(container.clientWidth, container.clientHeight);
  });
}

function animate() {
  requestAnimationFrame(animate);
  if (state.pathObject) {
    state.pathObject.rotation.y += 0.001;
  }
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
  const blob = new Blob([JSON.stringify(state.session, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `solargraphy-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
  setStatus('Exported session JSON.');
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
      renderSession();
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
    events: state.session.byDay
      .flatMap((d) => d.samples)
      .filter((_sample, idx) => idx % 6 === 0)
      .map((sample) => ({ utc: sample.timestamp, action: 'PULSE_OPEN' }))
  };

  await navigator.clipboard.writeText(JSON.stringify(schedule, null, 2));
  setStatus(`Copied Nano schedule JSON. Events: ${schedule.events.length}`);
}

function wireEvents() {
  elements.generateBtn.addEventListener('click', async () => {
    try {
      await generatePath();
    } catch (error) {
      setStatus(error.message);
    }
  });

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
