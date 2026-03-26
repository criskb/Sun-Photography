import { elements } from '../ui/dom.js';

export class GroundMap3DView {
  constructor() {
    this.map = null;
    this.marker = null;
  }

  init() {
    if (typeof maplibregl === 'undefined') {
      throw new Error('MapLibre GL script not loaded.');
    }

    this.map = new maplibregl.Map({
      container: 'groundMap3d',
      style: 'https://demotiles.maplibre.org/style.json',
      center: [-74.006, 40.7128],
      zoom: 14,
      pitch: 65,
      bearing: 180,
      antialias: true
    });

    this.map.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), 'top-right');

    this.marker = new maplibregl.Marker({ color: '#ffd35e' }).setLngLat([-74.006, 40.7128]).addTo(this.map);
  }

  setView({ lat, lon, yawDeg }) {
    if (!this.map) return;

    this.map.easeTo({
      center: [lon, lat],
      bearing: yawDeg,
      pitch: 65,
      zoom: 14,
      duration: 500
    });

    if (this.marker) this.marker.setLngLat([lon, lat]);
  }

  resize() {
    if (this.map) this.map.resize();
  }
}
