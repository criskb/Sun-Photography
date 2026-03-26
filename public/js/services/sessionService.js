export function exportSessionJson(session) {
  const blob = new Blob([JSON.stringify(session, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `solargraphy-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

export function importSessionFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        resolve(JSON.parse(String(reader.result)));
      } catch (error) {
        reject(error);
      }
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsText(file);
  });
}

export async function copyNanoSchedule({ selectedSamples, shutterEvents, camera, servo }) {
  const schedule = {
    servo,
    camera,
    mode: 'WINDOWED_OPEN_CLOSE',
    selectedSampleCount: selectedSamples.length,
    events: shutterEvents
  };

  await navigator.clipboard.writeText(JSON.stringify(schedule, null, 2));
  return schedule.events.length;
}
