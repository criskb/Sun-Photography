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

function startOfUtcDay(date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function endOfUtcDay(date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), 23, 59, 59, 999));
}

function buildSamples({ lat, lon, startDate, endDate, intervalMinutes }) {
  const start = new Date(startDate);
  const end = new Date(endDate);

  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    throw new Error('Invalid date range.');
  }
  if (start > end) {
    throw new Error('startDate must be before endDate.');
  }

  const safeInterval = Math.max(1, Math.min(240, Number(intervalMinutes) || 60));
  const byDay = [];
  let samplesCount = 0;

  for (let day = startOfUtcDay(start); day <= end; day = new Date(day.getTime() + 24 * 60 * 60 * 1000)) {
    const dayStart = day < start ? start : day;
    const dayEndCap = endOfUtcDay(day);
    const dayEnd = dayEndCap > end ? end : dayEndCap;

    const times = SunCalc.getTimes(day, lat, lon);
    const sunrise = times.sunrise;
    const sunset = times.sunset;

    if (!(sunrise instanceof Date) || !(sunset instanceof Date)) {
      byDay.push({ date: day.toISOString().slice(0, 10), samples: [] });
      continue;
    }

    const sampleStart = new Date(Math.max(dayStart.getTime(), sunrise.getTime()));
    const sampleEnd = new Date(Math.min(dayEnd.getTime(), sunset.getTime()));

    if (sampleStart > sampleEnd) {
      byDay.push({ date: day.toISOString().slice(0, 10), samples: [] });
      continue;
    }

    const samples = [];
    for (let ts = sampleStart.getTime(); ts <= sampleEnd.getTime(); ts += safeInterval * 60 * 1000) {
      const date = new Date(ts);
      const pos = SunCalc.getPosition(date, lat, lon);

      const altitudeDeg = (pos.altitude * 180) / Math.PI;
      const azimuthNorthDeg = ((pos.azimuth * 180) / Math.PI + 180 + 360) % 360;

      if (altitudeDeg <= 0) continue;

      samples.push({
        timestamp: date.toISOString(),
        altitudeDeg,
        azimuthDeg: azimuthNorthDeg
      });
    }

    samplesCount += samples.length;
    byDay.push({ date: day.toISOString().slice(0, 10), samples });
  }

  return {
    generatedAt: new Date().toISOString(),
    model: 'SunCalc position + sunrise/sunset daylight window',
    location: { lat, lon },
    schedule: {
      startDate: start.toISOString(),
      endDate: end.toISOString(),
      intervalMinutes: safeInterval
    },
    samplesCount,
    byDay
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
    if (lat < -90 || lat > 90 || lon < -180 || lon > 180) {
      return res.status(400).json({ error: 'lat/lon out of range.' });
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
