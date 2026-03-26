# Solargraphy Draw Application

A full-stack starter for long-duration (6+ month) solargraphy planning with:

- **Node + Express** backend for sun path sample generation.
- **Three.js** 3D sky dome rendering of the sun trail.
- **OpenStreetMap (Leaflet)** ground map preview at your pinhole location (lat/lon).
- **JSON export/import** so a capture plan can be resumed later.
- **Arduino Nano firmware** to drive an **MG90S servo shutter**.

## Features

1. Configure latitude/longitude and date range (months long).
2. Generate daylight-only sun samples with interval control.
3. Visualize the path in 3D and on a map.
4. Export the full capture session as JSON.
5. Import previous JSON session files.
6. Generate/copy a Nano shutter schedule payload JSON.

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

Response:

```json
{
  "generatedAt": "2026-03-26T12:00:00.000Z",
  "location": { "lat": 40.7128, "lon": -74.006 },
  "schedule": {
    "startDate": "2026-03-26T00:00:00.000Z",
    "endDate": "2026-09-26T23:59:59.000Z",
    "intervalMinutes": 60
  },
  "samplesCount": 1234,
  "byDay": [
    {
      "date": "2026-03-26",
      "samples": [
        {
          "timestamp": "2026-03-26T11:00:00.000Z",
          "altitudeDeg": 10.2,
          "azimuthDeg": 95.1
        }
      ]
    }
  ]
}
```

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
- metadata for reproducibility over long captures

You can re-import to continue planning months later.
