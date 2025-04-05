// Types
export interface ChunkContent {
  type: string;
  elementSelector: string;
  text?: string;
  src?: string;
  alt?: string;
  level?: number;
}

export interface Chunk {
  type: string;
  role: string;
  elementSelector: string;
  content: ChunkContent[];
}

export type ChunkedInput = Record<string, Chunk>;

// Prompt style map
const neuroPromptStyles: Record<string, string> = {
  adhd: "Simplify into bullet points. Be concise, clear, and use action-oriented language.",
  autism: "Use step-by-step explanations. Avoid metaphors and abstract phrases.",
  blind: "Format for screen reader clarity. Use structured and unambiguous text.",
  sensory: "Minimize stimulation. Use calming, clear and neutral language."
};

// Builds prompt from chunks
export function buildPromptFromChunks(chunks: ChunkedInput, neurotype: string): string {
  const promptStyle = neuroPromptStyles[neurotype] || "Simplify and adapt this content.";

  const readableChunks = Object.entries(chunks)
    .map(([chunkId, chunk]) => {
      const lines: string[] = [];
      lines.push(`\nChunk ${chunkId}: (${chunk.role})`);
      lines.push(`Selector: ${chunk.elementSelector}`);

      chunk.content.forEach((el) => {
        if (el.text) {
          lines.push(`  - [${el.type}] ${el.text}`);
        } else if (el.alt) {
          lines.push(`  - [image] alt="${el.alt}"`);
        }
      });

      return lines.join("\n");
    })
    .join("\n\n");

  return `
You are an AI assistant supporting neurodivergent users (type: ${neurotype}).
Instructions: ${promptStyle}

Below is structured page content broken into chunks.

Respond ONLY with JSON, matching this structure:
{
  "chunk1": "Simplified version of chunk 1",
  "chunk2": "Simplified version of chunk 2",
  ...
}

Page content:
${readableChunks}
  `.trim();
}

// Parses Gemini's response, cleaning markdown if needed
function tryParseGeminiJSON(raw: string): Record<string, string> {
  const cleaned = raw.replace(/```json|```/g, "").trim();
  try {
    return JSON.parse(cleaned);
  } catch (err) {
    console.error("❌ Failed to parse Gemini output:", raw);
    return {};
  }
}

// API call
export async function getAdaptedChunks(chunks: ChunkedInput, neurotype: string): Promise<Record<string, string>> {
  console.log("Using Gemini API Key:", import.meta.env.VITE_GEMINI_API_KEY);
  const prompt = buildPromptFromChunks(chunks, neurotype);
  const API_KEY = import.meta.env.VITE_GEMINI_API_KEY;

  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${API_KEY}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }]
    })
  });

  const json = await res.json();
  console.log("Gemini full API response:", json);

  if (!res.ok) {
    console.error(`❌ Gemini API error: ${res.status} ${res.statusText}`);
    return {};
  }

  const raw = json?.candidates?.[0]?.content?.parts?.[0]?.text || "{}";
  console.log("Gemini raw output:", raw);

  return tryParseGeminiJSON(raw);
}
