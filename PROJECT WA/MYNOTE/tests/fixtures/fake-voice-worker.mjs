import { createInterface } from 'node:readline';

const lines = createInterface({ input: process.stdin });
console.log(JSON.stringify({ ready: true, model: 'fake' }));

lines.on('line', (line) => {
  const trimmed = line.trim();
  if (!trimmed) return;
  let request;
  try {
    request = JSON.parse(trimmed);
  } catch {
    return;
  }
  console.log(JSON.stringify({ id: request.id, text: 'halo dunia', language: 'id', durationMs: 1234 }));
});
