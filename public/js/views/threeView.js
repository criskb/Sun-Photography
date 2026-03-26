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
    this.scene.background = new THREE.Color(0x0b1628);

    this.camera = new THREE.PerspectiveCamera(58, container.clientWidth / container.clientHeight, 0.1, 1000);
    this.camera.position.set(0, 1.6, 0);

    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    this.renderer.setPixelRatio(window.devicePixelRatio || 1);
    this.renderer.setSize(container.clientWidth, container.clientHeight);
    container.appendChild(this.renderer.domElement);

    const ground = new THREE.Mesh(
      new THREE.CircleGeometry(26, 72),
      new THREE.MeshBasicMaterial({
        color: 0x1a1f2a,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.45
      })
    );
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
      new THREE.MeshBasicMaterial({ color: 0x2d4566, wireframe: true, opacity: 0.45, transparent: true })
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
    group.add(new THREE.Line(full, new THREE.LineBasicMaterial({ color: 0x7f95af, opacity: 0.7, transparent: true })));

    if (selectedSamples.length > 0) {
      const selected = new THREE.BufferGeometry().setFromPoints(selectedSamples.map((sample) => this.sampleToVector(sample)));
      group.add(new THREE.Line(selected, new THREE.LineBasicMaterial({ color: 0xffd35e })));
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
