import { useState } from 'react';
import { getAdaptedChunks } from '../utils/gemini';
import type { ChunkedInput } from '../utils/gemini';

export default function Popup() {
  const [adapted, setAdapted] = useState<Record<string, string> | null>(null);
  const [loading, setLoading] = useState(false);

  // Load downloaded JSON file (manually for now)
  const handleLoadAndRunGemini = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const text = await file.text();
    const json = JSON.parse(text) as ChunkedInput;

    setLoading(true);
    const result = await getAdaptedChunks(json, "adhd"); // Later make neurotype dynamic
    setAdapted(result);
    setLoading(false);
  };

  return (
    <div style={{ padding: 10, width: 320 }}>
      <h2>BrowseAble</h2>

      <input type="file" accept="application/json" onChange={handleLoadAndRunGemini} />

      {loading && <p>Loading...</p>}

      {adapted && (
        <pre style={{ marginTop: 10, maxHeight: 300, overflowY: 'auto', whiteSpace: 'pre-wrap' }}>
          {JSON.stringify(adapted, null, 2)}
        </pre>
      )}
    </div>
  );
}
