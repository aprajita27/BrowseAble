// // gemini.ts

// // Types that match the structure of page-structure.json
// export interface PageChunkContent {
//   type: string;
//   role: string;
//   elementSelector: string;
//   content: Array<{
//     type: string;
//     elementSelector: string;
//     text?: string;
//     src?: string;
//     alt?: string;
//   }>;
// }

// export type ChunkedInput = Record<string, PageChunkContent>;

// // Define interfaces for the response structure
// export interface StyleChange {
//   elementSelector: string;
//   styles: Record<string, string>;
// }

// export interface LayoutChange {
//   elementSelector: string;
//   layout: Record<string, string>;
// }

// export interface ElementChange {
//   elementSelector: string;
//   type: string;
//   text: string;
// }

// export interface ProcessedData {
//   layoutChanges: LayoutChange[];
//   styleChanges: StyleChange[];
//   elementChanges: ElementChange[];
// }

// const neuroPromptStyles: Record<string, string> = {
//   adhd: "Summarize in short, clear bullet points. Use headers where necessary. Keep things structured and actionable. Remove extra detail or side notes.",
//   autism: "Convert into clear, literal, step-by-step explanations. Avoid metaphors, idioms, or ambiguous language. Prefer structured sequences and exact terms.",
//   blind: "Rephrase into simple, clear narration. Describe visuals briefly. Use consistent sentence structures. Do not include formatting instructions or markdown.",
//   sensory: "Rewrite content in a calming, neutral tone. Remove emotional intensity or visual complexity. Prefer short, soft sentences without strong emphasis."
// };

// /**
//  * Build a prompt from chunked content that considers element types and neurotype instructions.
//  */
// export function buildPromptFromChunks(data: ChunkedInput, neurotype: string): string {
//   const instruction = neuroPromptStyles[neurotype] || "Simplify this content for accessibility.";

//   const contentLines = Object.entries(data).map(([chunkId, chunk]) => {
//     const section = [`Chunk ${chunkId} (${chunk.role})`, `Selector: ${chunk.elementSelector}`];

//     chunk.content.forEach((item) => {
//       if (item.text && item.text.trim().length > 0) {
//         const isShort = item.text.trim().split(" ").length < 5;
//         const prefix = isShort ? "[label]" : `[${item.type}]`;
//         section.push(`- ${prefix} "${item.text.trim()}"`);
//       } else if (item.type === "image") {
//         const label = item.alt?.trim() || "No alt text";
//         section.push(`- [image] alt="${label}"`);
//       }
//     });

//     return section.join("\n");
//   });

//   return `
// You are an AI assistant supporting users with ${neurotype}.
// Instructions: ${instruction}

// Here is structured webpage content in chunks. For each chunk, return a simplified version.
// Respond ONLY as a JSON object in this format:
// {
//   "chunk1-1": "Simplified text",
//   "chunk1-2": "Simplified text"
// }

// Content:
// ${contentLines.join('\n\n')}
// `.trim();
// }

// /**
//  * Clean and safely parse Gemini's response text.
//  */
// export function tryParseJSON(raw: string): Record<string, string> {
//   const cleaned = raw.replace(/```json|```/g, "").trim();
//   try {
//     return JSON.parse(cleaned);
//   } catch (err) {
//     console.error("Failed to parse Gemini output:", cleaned);
//     return {};
//   }
// }

// /**
//  * Optional: encapsulated call if you wire back to this later.
//  */
// export async function getAdaptedChunks(
//   chunks: ChunkedInput,
//   neurotype: string
// ): Promise<Record<string, string>> {
//   const prompt = buildPromptFromChunks(chunks, neurotype);
//   const API_KEY = "YOUR_API_KEY"; // Replace with actual API key or env var

//   if (!API_KEY) {
//     console.error("Missing Gemini API key in .env");
//     return {};
//   }

//   const response = await fetch(
//     `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${API_KEY}`,
//     {
//       method: 'POST',
//       headers: { 'Content-Type': 'application/json' },
//       body: JSON.stringify({
//         contents: [{ parts: [{ text: prompt }] }]
//       })
//     }
//   );

//   const json = await response.json();

//   if (!response.ok) {
//     console.error(`Gemini API error: ${response.status} ${response.statusText}`, json);
//     return {};
//   }

//   const raw = json?.candidates?.[0]?.content?.parts?.[0]?.text || '{}';
//   return tryParseJSON(raw);
// }

// // Main function that background.js will call to process data
// export function processData(fullData: any): ProcessedData {
//   console.log('Processing data in gemini.ts:');
//   console.log(fullData);
  
//   // For now, return mock data while the Gemini API integration is being set up
//   // In the real implementation, you would call getAdaptedChunks here
//   return {
//     layoutChanges: [
//       { 
//         elementSelector: 'body',
//         layout: { 
//           fontFamily: 'Arial, sans-serif',
//           lineHeight: '1.6'
//         }
//       }
//     ],
//     styleChanges: [
//       { 
//         elementSelector: 'h1, h2, h3',
//         styles: { 
//           color: '#333',
//           marginBottom: '15px'
//         }
//       }
//     ],
//     elementChanges: [
//       { 
//         elementSelector: 'h1',
//         type: 'paragraph', 
//         text: 'Simplified Heading for Accessibility'
//       }
//     ]
//   };
// }

// // Chrome message listener for direct communication
// chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
//   if (message.type === 'processDataWithGemini') {
//     console.log('Received data for processing in gemini.ts');
//     const fullData = message.fullData;
    
//     // Add a typescript ignore comment to suppress the unused variable warning
//     // @ts-ignore: Keeping this for future implementation
//     const _neurotype = message.neurotype || 'adhd'; // Default to ADHD if not specified
    
//     // For now, using the mock implementation
//     const processedData = processData(fullData);
//     sendResponse({ status: 'success', processedData });
    
//     return true; // Keep the message channel open for the async response
//   }
// });

// // Helper function to transform adapted content into layout changes
// // Add multiple ignore/disable comments to suppress the unused function warning
// // @ts-ignore
// // eslint-disable-next-line @typescript-eslint/no-unused-vars
// function _transformToLayoutChanges(adaptedContent: Record<string, string>, originalData: any): ProcessedData {
//   // This would map the simplified content back to the original selectors
//   // and create the appropriate layout/style/element changes
  
//   const layoutChanges: LayoutChange[] = [];
//   const styleChanges: StyleChange[] = [];
//   const elementChanges: ElementChange[] = [];
  
//   // Example implementation logic (would be more complex in reality)
//   Object.entries(adaptedContent).forEach(([chunkId, simplifiedText]) => {
//     // Find the original chunk and its elements
//     const originalChunk = originalData[chunkId];
//     if (originalChunk) {
//       // Add style changes for readability
//       styleChanges.push({
//         elementSelector: originalChunk.elementSelector,
//         styles: { color: '#333', fontSize: '16px' }
//       });
      
//       // Add the simplified text to the appropriate element
//       if (originalChunk.content && originalChunk.content.length > 0) {
//         originalChunk.content.forEach((item: any) => {
//           if (item.type === 'paragraph' || item.type === 'heading') {
//             elementChanges.push({
//               elementSelector: item.elementSelector,
//               type: item.type,
//               text: simplifiedText // Use the simplified text from Gemini
//             });
//           }
//         });
//       }
//     }
//   });
  
//   return {
//     layoutChanges,
//     styleChanges,
//     elementChanges
//   };
// }

