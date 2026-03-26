import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import SunCalc from 'suncalc';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const app = express();
const port = process.env.PORT || 3000;

app.use(express.json({ limit: '1mb' }));
app.use(express.static(path.resolve(__dirname, '../public')));

function buildSamples({ lat, lon, startDate, endDate, intervalMinutes }) {
  const start = new Date(startDate);
  const end = new Date(endDate);

  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    throw new Error('Invalid date range.');
  }
  if (start > end) {
    throw new Error('startDate must be before endDate.');
  }

  const safeInterval = Math.max(5, Math.min(240, Number(intervalMinutes) || 60));
  const points = [];
  const bucketByDay = new Map();

  for (let ts = start.getTime(); ts <= end.getTime(); ts += safeInterval * 60 * 1000) {
    const date = new Date(ts);
    const pos = SunCalc.getPosition(date, lat, lon);

    const altitudeDeg = (pos.altitude * 180) / Math.PI;
    const azimuthNorthDeg = ((pos.azimuth * 180) / Math.PI + 180 + 360) % 360;

    if (altitudeDeg <= 0) continue;

    const key = date.toISOString().slice(0, 10);
    const point = {
      timestamp: date.toISOString(),
      altitudeDeg,
      azimuthDeg: azimuthNorthDeg
    };

    points.push(point);
    const existing = bucketByDay.get(key) ?? [];
    existing.push(point);
    bucketByDay.set(key, existing);
  }

  return {
    generatedAt: new Date().toISOString(),
    location: { lat, lon },
    schedule: {
      startDate: start.toISOString(),
      endDate: end.toISOString(),
      intervalMinutes: safeInterval
    },
    samplesCount: points.length,
    byDay: Array.from(bucketByDay.entries()).map(([date, samples]) => ({ date, samples }))
  };
}

app.post('/api/sunpath', (req, res) => {
  try {
    const lat = Number(req.body.lat);
    const lon = Number(req.body.lon);
    const startDate = req.body.startDate;
    const endDate = req.body.endDate;
    const intervalMinutes = req.body.intervalMinutes;

    if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
      return res.status(400).json({ error: 'lat/lon must be numeric.' });
    }

    const data = buildSamples({ lat, lon, startDate, endDate, intervalMinutes });
    return res.json(data);
  } catch (error) {
    return res.status(400).json({ error: error.message });
  }
});

app.get('/health', (_req, res) => {
  res.json({ ok: true, now: new Date().toISOString() });
});

app.listen(port, () => {
  console.log(`Solargraphy app listening on http://localhost:${port}`);
});
