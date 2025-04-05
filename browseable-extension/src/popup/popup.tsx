import { useState } from 'react';
import { buildPromptFromChunks, tryParseJSON } from '../utils/gemini';

interface ChunkContentItem {
  type: string;
  elementSelector: string;
  text?: string;
  src?: string;
  alt?: string;
  level?: number;
}

interface Chunk {
  type: string;
  role: string;
  elementSelector: string;
  content: ChunkContentItem[];
}

type ChunkedInput = Record<string, Chunk>;

const Popup = () => {
  const [fileName, setFileName] = useState<string | null>(null);
  const [adaptedOutput, setAdaptedOutput] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const rebuildStructuredOutput = (
    originalRaw: any[],
    geminiOutput: Record<string, string>
  ) => {
    const rebuilt: any[] = [];

    for (const chunkGroup of originalRaw) {
      const rebuiltGroup: Record<string, any[]> = {};

      for (const [chunkId, sections] of Object.entries(chunkGroup)) {
        const updatedSections = (sections as any[]).map((section, index) => {
          const chunkKey = `${chunkId}-${index + 1}`;
          const adaptedText = geminiOutput[chunkKey];
          return adaptedText ? { ...section, adaptedText } : section;
        });

        rebuiltGroup[chunkId] = updatedSections;
      }

      rebuilt.push(rebuiltGroup);
    }

    return rebuilt;
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const content = await file.text();
      const raw = JSON.parse(content);
      setFileName(file.name);

      const converted: ChunkedInput = {};

      if (Array.isArray(raw)) {
        for (const chunkGroup of raw) {
          for (const [chunkId, sections] of Object.entries(chunkGroup)) {
            (sections as any[]).forEach((section, index) => {
              const newKey = `${chunkId}-${index + 1}`;
              converted[newKey] = section;
            });
          }
        }
      }

      console.log("Parsed and converted chunk keys:", Object.keys(converted));

      setIsProcessing(true);

      const API_KEY = import.meta.env.VITE_GEMINI_API_KEY;
      const prompt = buildPromptFromChunks(converted, 'adhd');

      console.log("Gemini prompt:\n", prompt);

      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${API_KEY}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }]
          })
        }
      );

      const json = await response.json();
      const rawText = json?.candidates?.[0]?.content?.parts?.[0]?.text || '{}';
      const parsed = tryParseJSON(rawText);

      const rebuilt = rebuildStructuredOutput(raw, parsed);
      console.log("Structured output for content script:", rebuilt);
      setAdaptedOutput(JSON.stringify(rebuilt, null, 2));
    } catch (err) {
      console.error("Error processing file:", err);
      setAdaptedOutput("Error processing the file.");
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div style={{ padding: 10, width: 320 }}>
      <h2>BrowseAble</h2>
      <input
        type="file"
        accept=".json"
        onClick={(e) => {
          (e.target as HTMLInputElement).value = '';
        }}
        onChange={handleFileUpload}
      />
      {fileName && <p>Loaded: {fileName}</p>}
      {isProcessing && <p>Processing with Gemini...</p>}
      {adaptedOutput && (
        <pre style={{ whiteSpace: 'pre-wrap', maxHeight: 300, overflowY: 'auto', fontSize: 12 }}>
          {adaptedOutput}
        </pre>
      )}
    </div>
  );
};

export default Popup;
