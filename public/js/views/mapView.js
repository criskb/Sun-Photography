export class MapView {
  constructor() {
    this.map = null;
    this.marker = null;
    this.line = null;
  }

  init() {
    this.map = L.map('map').setView([40.7128, -74.006], 10);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors'
    }).addTo(this.map);
  }

  render(lat, lon, samples) {
    if (this.marker) this.marker.remove();
    if (this.line) this.line.remove();

    this.marker = L.marker([lat, lon]).addTo(this.map).bindPopup('Pinhole camera location').openPopup();
    this.map.setView([lat, lon], 12);

    const segments = samples.map((sample) => {
      const bearingRad = (sample.azimuthDeg * Math.PI) / 180;
      const meters = 80;
      const dLat = (meters * Math.cos(bearingRad)) / 111320;
      const dLon = (meters * Math.sin(bearingRad)) / (111320 * Math.cos((lat * Math.PI) / 180));
      return [lat + dLat, lon + dLon];
    });

    this.line = L.polyline([[lat, lon], ...segments], { color: '#f8d66d', weight: 2 }).addTo(this.map);
  }
}
