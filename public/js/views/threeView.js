import * as THREE from 'https://unpkg.com/three@0.165.0/build/three.module.js';
import { elements } from '../ui/dom.js';

export class ThreeView {
  constructor() {
    this.scene = null;
    this.camera = null;
    this.renderer = null;
    this.pathObject = null;
    this.groundMaterial = null;
    this.lastGroundKey = null;
  }

  init() {
    const container = document.getElementById('three');

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x0b1628);

    this.camera = new THREE.PerspectiveCamera(58, container.clientWidth / container.clientHeight, 0.1, 1000);
    this.camera.position.set(0, 1.6, 0);

    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    this.renderer.setPixelRatio(window.devicePixelRatio || 1);
    this.renderer.setSize(container.clientWidth, container.clientHeight);
    container.appendChild(this.renderer.domElement);

    this.groundMaterial = new THREE.MeshBasicMaterial({
      color: 0x1a1f2a,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.9
    });

    const ground = new THREE.Mesh(new THREE.CircleGeometry(26, 72), this.groundMaterial);
    ground.rotation.x = -Math.PI / 2;
    this.scene.add(ground);

    const horizonRing = new THREE.LineLoop(
      new THREE.BufferGeometry().setFromPoints(
        Array.from({ length: 128 }).map((_, idx) => {
          const a = (idx / 128) * Math.PI * 2;
          return new THREE.Vector3(Math.cos(a) * 25, 0.01, Math.sin(a) * 25);
        })
      ),
      new THREE.LineBasicMaterial({ color: 0x77a4d3, opacity: 0.8, transparent: true })
    );
    this.scene.add(horizonRing);

    const dome = new THREE.Mesh(
      new THREE.SphereGeometry(26, 48, 24, 0, Math.PI * 2, 0, Math.PI / 2),
      new THREE.MeshBasicMaterial({ color: 0x2d4566, wireframe: true, opacity: 0.25, transparent: true })
    );
    this.scene.add(dome);

    window.addEventListener('resize', () => this.resize());
    this.resize();
  }

  async updateGroundTexture(lat, lon) {
    const key = `${lat.toFixed(4)},${lon.toFixed(4)}`;
    if (this.lastGroundKey === key) return;
    this.lastGroundKey = key;

    const textureUrl = `https://staticmap.openstreetmap.de/staticmap.php?center=${lat},${lon}&zoom=15&size=1024x1024&maptype=mapnik`;

    const texture = await new Promise((resolve, reject) => {
      const loader = new THREE.TextureLoader();
      loader.setCrossOrigin('anonymous');
      loader.load(textureUrl, resolve, undefined, reject);
    }).catch(() => null);

    if (!texture) return;

    texture.wrapS = THREE.ClampToEdgeWrapping;
    texture.wrapT = THREE.ClampToEdgeWrapping;
    texture.colorSpace = THREE.SRGBColorSpace;

    this.groundMaterial.map = texture;
    this.groundMaterial.needsUpdate = true;
  }

  resize() {
    const width = elements.threeWrap.clientWidth;
    const height = elements.threeWrap.clientHeight;
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
    elements.drawCanvas.width = width;
    elements.drawCanvas.height = height;
  }

  animate() {
    const loop = () => {
      requestAnimationFrame(loop);
      this.renderer.render(this.scene, this.camera);
    };
    loop();
  }

  applyCamera({ pitchDeg, yawDeg }) {
    const yaw = (yawDeg * Math.PI) / 180;
    const pitch = (pitchDeg * Math.PI) / 180;

    const direction = new THREE.Vector3(
      Math.sin(yaw) * Math.cos(pitch),
      Math.sin(pitch),
      Math.cos(yaw) * Math.cos(pitch)
    );

    this.camera.position.set(0, 1.6, 0);
    this.camera.lookAt(direction);
  }

  sampleToVector(sample) {
    const az = (sample.azimuthDeg * Math.PI) / 180;
    const alt = (sample.altitudeDeg * Math.PI) / 180;
    const radius = 25;

    return new THREE.Vector3(
      radius * Math.cos(alt) * Math.sin(az),
      radius * Math.sin(alt),
      radius * Math.cos(alt) * Math.cos(az)
    );
  }

  renderTrails(byDay, selectedSamples) {
    if (this.pathObject) this.scene.remove(this.pathObject);

    const selectedSet = new Set(selectedSamples.map((sample) => sample.timestamp));
    const group = new THREE.Group();

    byDay.forEach((day, idx) => {
      if (!day.samples.length) return;

      const points = day.samples.map((sample) => this.sampleToVector(sample));
      const hue = (0.12 + (idx % 30) / 60) % 1;
      const dayColor = new THREE.Color().setHSL(hue, 0.7, 0.62);

      const geometry = new THREE.BufferGeometry().setFromPoints(points);
      group.add(new THREE.Line(geometry, new THREE.LineBasicMaterial({ color: dayColor, opacity: 0.22, transparent: true })));

      const selectedPoints = day.samples.filter((sample) => selectedSet.has(sample.timestamp)).map((sample) => this.sampleToVector(sample));
      if (selectedPoints.length > 1) {
        const selectedGeometry = new THREE.BufferGeometry().setFromPoints(selectedPoints);
        group.add(new THREE.Line(selectedGeometry, new THREE.LineBasicMaterial({ color: 0xf8f8ff, opacity: 0.95, transparent: true })));

        group.add(
          new THREE.Points(
            selectedGeometry,
            new THREE.PointsMaterial({ color: 0xfff3be, size: 0.18, transparent: true, opacity: 0.9 })
          )
        );
      }
    });

    this.pathObject = group;
    this.scene.add(group);
  }

  projectSample(sample) {
    const projected = this.sampleToVector(sample).clone().project(this.camera);
    if (projected.z > 1) return null;

    return {
      x: (projected.x * 0.5 + 0.5) * elements.drawCanvas.width,
      y: (-projected.y * 0.5 + 0.5) * elements.drawCanvas.height
    };
  }
}
