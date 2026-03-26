# Solargraphy Draw Application

A full-stack starter for long-duration (6+ month) solargraphy planning with:

- **Node + Express** backend for sun path sample generation.
- **Three.js** fixed ground-angle sky rendering of the sun trail.
- **OpenStreetMap (Leaflet)** ground map preview at your pinhole location (lat/lon).
- **Sky drawing-to-instruction workflow** to select where/when shutter pulses happen.
- **JSON export/import** so a capture plan can be resumed later.
- **Arduino Nano firmware** to drive an **MG90S servo shutter**.

## Features

1. Configure latitude/longitude and date range (months long).
2. Set fixed camera **pitch** and **yaw/rotation** for a ground-level viewpoint.
3. Generate daylight-only sun samples with interval control.
4. Draw directly over the sky view to select sample points for shutter instructions.
5. Export/import full JSON sessions including selected instructions + camera setup.
6. Copy Nano schedule JSON payload for firmware-side execution.

## Install & Run

```bash
npm install
npm start
```

Open: `http://localhost:3000`

## API

### `POST /api/sunpath`

Request body:

```json
{
  "lat": 40.7128,
  "lon": -74.006,
  "startDate": "2026-03-26T00:00:00Z",
  "endDate": "2026-09-26T23:59:59Z",
  "intervalMinutes": 60
}
```

Response includes `byDay` samples with `timestamp`, `altitudeDeg`, and `azimuthDeg`.

## Sky Draw Workflow

1. Generate a sun path.
2. Adjust camera pitch/yaw and click **Apply View**.
3. Draw over the sky trajectory in the top viewport.
4. Click **Apply Drawing To Schedule** to filter instruction events.
5. Copy Nano schedule JSON or export session JSON.

## Arduino Nano + MG90S

Firmware is in `arduino/solargraphy_shutter.ino`.

- Connect MG90S signal wire to Nano **D9**.
- Power servo from a stable 5V source (shared GND with Nano).
- Upload sketch, then open Serial Monitor at **115200 baud**.

Commands:

- `OPEN`
- `CLOSE`
- `PULSE 1500`
- `CFG 110 10`

## Session JSON (export/import)

The browser exports a JSON session with:

- location
- date schedule
- sun samples grouped by day
- camera pitch/yaw
- selected instruction events from the drawing overlay

You can re-import to continue planning months later.
