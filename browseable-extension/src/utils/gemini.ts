// Types that match the structure of page-structure.json

export interface PageChunkContent {
  type: string;
  role: string;
  elementSelector: string;
  content: Array<{
    type: string;
    elementSelector: string;
    text?: string;
    src?: string;
    alt?: string;
  }>;
}

export type ChunkedInput = Record<string, PageChunkContent>;

const neuroPromptStyles: Record<string, string> = {
  adhd: "Summarize in short, clear bullet points. Use headers where necessary. Keep things structured and actionable. Remove extra detail or side notes.",
  autism: "Convert into clear, literal, step-by-step explanations. Avoid metaphors, idioms, or ambiguous language. Prefer structured sequences and exact terms.",
  blind: "Rephrase into simple, clear narration. Describe visuals briefly. Use consistent sentence structures. Do not include formatting instructions or markdown.",
  sensory: "Rewrite content in a calming, neutral tone. Remove emotional intensity or visual complexity. Prefer short, soft sentences without strong emphasis."
};

/**
 * Build a prompt from chunked content that considers element types and neurotype instructions.
 */
export function buildPromptFromChunks(data: ChunkedInput, neurotype: string): string {
  const instruction = neuroPromptStyles[neurotype] || "Simplify this content for accessibility.";

  const contentLines = Object.entries(data).map(([chunkId, chunk]) => {
    const section = [`Chunk ${chunkId} (${chunk.role})`, `Selector: ${chunk.elementSelector}`];

    chunk.content.forEach((item) => {
      if (item.text && item.text.trim().length > 0) {
        const isShort = item.text.trim().split(" ").length < 5;
        const prefix = isShort ? "[label]" : `[${item.type}]`;
        section.push(`- ${prefix} "${item.text.trim()}"`);
      } else if (item.type === "image") {
        const label = item.alt?.trim() || "No alt text";
        section.push(`- [image] alt="${label}"`);
      }
    });

    return section.join("\n");
  });

  return `
You are an AI assistant supporting users with ${neurotype}.
Instructions: ${instruction}

Here is structured webpage content in chunks. For each chunk, return a simplified version.
Respond ONLY as a JSON object in this format:
{
  "chunk1-1": "Simplified text",
  "chunk1-2": "Simplified text"
}

Content:
${contentLines.join('\n\n')}
`.trim();
}

/**
 * Clean and safely parse Gemini's response text.
 */
export function tryParseJSON(raw: string): Record<string, string> {
  const cleaned = raw.replace(/```json|```/g, "").trim();
  try {
    return JSON.parse(cleaned);
  } catch (err) {
    console.error("Failed to parse Gemini output:", cleaned);
    return {};
  }
}

/**
 * Optional: encapsulated call if you wire back to this later.
 */
export async function getAdaptedChunks(
  chunks: ChunkedInput,
  neurotype: string
): Promise<Record<string, string>> {
  const prompt = buildPromptFromChunks(chunks, neurotype);
  const API_KEY = import.meta.env.VITE_GEMINI_API_KEY;

  if (!API_KEY) {
    console.error("Missing Gemini API key in .env");
    return {};
  }

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

  if (!response.ok) {
    console.error(`Gemini API error: ${response.status} ${response.statusText}`, json);
    return {};
  }

  const raw = json?.candidates?.[0]?.content?.parts?.[0]?.text || '{}';
  return tryParseJSON(raw);
}