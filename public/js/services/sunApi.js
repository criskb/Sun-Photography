export async function requestSunPath(payload) {
  const resp = await fetch('/api/sunpath', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });

  const data = await resp.json();
  if (!resp.ok) {
    throw new Error(data.error || 'Unknown error while generating path.');
  }

  return data;
}
