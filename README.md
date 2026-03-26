# Solargraphy Studio

A full-stack starter for long-duration (6+ month) solargraphy planning with a modern, modular architecture.

## Highlights

- **Modern UI/UX**: flat, card-based, dynamic control panel + immersive workspace.
- **Design system**: centralized color tokens, spacing tokens, and reusable button/card patterns in CSS.
- **Modular frontend**: UI, API, views, tools, and state split into separate files.
- **Physically-based sun sampling**: SunCalc solar positions sampled inside daily sunrise/sunset windows.
- **Three.js + OpenStreetMap**: 3D trail + ground context preview.
- **Rotate/Draw workflow**: toggle viewport tool for framing or instruction sketching.
- **JSON import/export**: preserve session, camera, and selected instruction events.
- **Arduino Nano MG90S firmware**: serial-controlled shutter pulses.

## Run

```bash
npm install
npm start
```

Open: `http://localhost:3000`

## Frontend File Structure

```text
public/
  app.js                        # entrypoint
  js/
    core/state.js               # app state
    services/sunApi.js          # backend API client
    services/sessionService.js  # import/export/schedule helpers
    ui/dom.js                   # element references
    ui/panel.js                 # status + form helpers
    views/threeView.js          # Three.js renderer
    views/mapView.js            # Leaflet renderer
    tools/viewportTools.js      # rotate/draw interaction layer
    main.js                     # orchestration
```

## API

### `POST /api/sunpath`

Request body:

```json
{
  "lat": 40.7128,
  "lon": -74.006,
  "startDate": "2026-03-26T00:00:00Z",
  "endDate": "2026-09-26T23:59:59Z",
  "intervalMinutes": 30
}
```

Response fields include:

- `model`: generation model description.
- `byDay`: sampled sun path grouped by UTC day.
- `samplesCount`: total number of generated daylight points.

## Accuracy Notes

- Solar vectors are generated via `SunCalc.getPosition(date, lat, lon)`.
- Sampling is restricted to each day’s sunrise/sunset window (`SunCalc.getTimes`).
- Latitude/longitude are validated server-side.

## Arduino Nano + MG90S

Firmware: `arduino/solargraphy_shutter.ino`.

Commands:

- `OPEN`
- `CLOSE`
- `PULSE 1500`
- `CFG 110 10`
