import * as THREE from 'https://unpkg.com/three@0.165.0/build/three.module.js';
import { elements } from '../ui/dom.js';

export class ThreeView {
  constructor() {
    this.scene = null;
    this.camera = null;
    this.renderer = null;
    this.pathObject = null;
  }

  init() {
    const container = document.getElementById('three');

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x0f1723);

    this.camera = new THREE.PerspectiveCamera(58, container.clientWidth / container.clientHeight, 0.1, 1000);
    this.camera.position.set(0, 1.6, 0);

    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    this.renderer.setPixelRatio(window.devicePixelRatio || 1);
    this.renderer.setSize(container.clientWidth, container.clientHeight);
    container.appendChild(this.renderer.domElement);

    const ground = new THREE.Mesh(
      new THREE.CircleGeometry(26, 72),
      new THREE.MeshBasicMaterial({ color: 0x1b2f1f, side: THREE.DoubleSide })
    );
    ground.rotation.x = -Math.PI / 2;
    this.scene.add(ground);

    const dome = new THREE.Mesh(
      new THREE.SphereGeometry(26, 48, 24, 0, Math.PI * 2, 0, Math.PI / 2),
      new THREE.MeshBasicMaterial({ color: 0x1f2f43, wireframe: true })
    );
    this.scene.add(dome);

    window.addEventListener('resize', () => this.resize());
    this.resize();
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

  renderTrails(allSamples, selectedSamples) {
    if (this.pathObject) this.scene.remove(this.pathObject);

    const group = new THREE.Group();

    const full = new THREE.BufferGeometry().setFromPoints(allSamples.map((sample) => this.sampleToVector(sample)));
    group.add(new THREE.Line(full, new THREE.LineBasicMaterial({ color: 0x5f7d98, opacity: 0.9, transparent: true })));

    if (selectedSamples.length > 0) {
      const selected = new THREE.BufferGeometry().setFromPoints(selectedSamples.map((sample) => this.sampleToVector(sample)));
      group.add(new THREE.Line(selected, new THREE.LineBasicMaterial({ color: 0xfac55a })));
    }

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
