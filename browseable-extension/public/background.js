// background.js

let fullData = [];
let totalChunksExpected = 0;
let chunksReceived = 0;
let activeNeurotype = 'adhd'; // Default neurotype setting
let features = {}; // Global features variable to store user preferences

// ================ GEMINI FUNCTIONALITY ================
// Neurotype prompt styles from gemini.ts
const neuroPromptStyles = {
  adhd: "Summarize in short, clear bullet points. Use headers where necessary. Keep things structured and actionable. Remove extra detail or side notes.",
  autism: "Convert into clear, literal, step-by-step explanations. Avoid metaphors, idioms, or ambiguous language. Prefer structured sequences and exact terms.",
  blind: "Rephrase into simple, clear narration. Describe visuals briefly. Use consistent sentence structures. Do not include formatting instructions or markdown.",
  sensory: "Rewrite content in a calming, neutral tone. Remove emotional intensity or visual complexity. Prefer short, soft sentences without strong emphasis."
};

/**
 * Build a prompt from chunked content that considers element types and neurotype instructions.
 */
function buildPromptFromChunks(data, neurotype) {
  const instruction = neuroPromptStyles[neurotype] || "Simplify this content for accessibility.";
  const contentLines = [];

  // Handle the nested structure of chunks
  Object.entries(data).forEach(([dataIndex, dataItem]) => {
    // Each dataItem is an object like { "chunk1": [...sections] }
    Object.entries(dataItem).forEach(([chunkId, sections]) => {
      // Now process each section in the chunk
      sections.forEach((section, sectionIndex) => {
        if (!section || !section.content) return;

        const sectionId = `${chunkId}-${sectionIndex + 1}`;
        const sectionHeader = [`Section ${sectionId} (${section.role || 'section'})`, `Selector: ${section.elementSelector || 'unknown'}`];

        // Collect all text from the section for context
        const sectionText = [];

        // Process content items within the section
        section.content.forEach((item) => {
          if (item.text && item.text.trim().length > 0) {
            sectionText.push(item.text.trim());

            const isShort = item.text.trim().split(" ").length < 5;
            const prefix = isShort ? "[label]" : `[${item.type}]`;
            sectionHeader.push(`- ${prefix} "${item.text.trim()}"`);
          } else if (item.type === "image") {
            const label = item.alt?.trim() || "No alt text";
            sectionHeader.push(`- [image] alt="${label}"`);
          }
        });

        contentLines.push(sectionHeader.join("\n"));
      });
    });
  });

  // Create a prompt specific to the neurotype
  let specificInstructions = "";

  if (neurotype === 'adhd') {
    specificInstructions = `
For ADHD readers:
1. Use bullet points and short sentences
2. Break complex ideas into clear, manageable chunks
3. Use headers and lists where possible
4. Make important information stand out
5. Remove unnecessary details
6. Keep a consistent, organized structure
7. Use concrete language without metaphors
8. Make it actionable when possible`;
  } else if (neurotype === 'autism') {
    specificInstructions = `
For autistic readers:
1. Use clear, literal, and concrete language
2. Avoid figures of speech, sarcasm, or ambiguous wording
3. Explain things in a logical, step-by-step manner
4. Define technical terms when they're introduced
5. Use consistent terminology throughout
6. Present information in a predictable structure
7. Be precise and specific
8. Avoid unnecessary sensory language`;
  } else if (neurotype === 'blind') {
    specificInstructions = `
For blind readers using screen readers:
1. Use clear, descriptive text that works well when read aloud
2. Describe images briefly but clearly when mentioned
3. Use straightforward sentence structures
4. Don't rely on visual formatting that won't be conveyed by a screen reader
5. Avoid directional language like "see below" or "as shown above"
6. Make sure text flows logically without visual cues
7. Keep paragraphs focused on single ideas`;
  } else if (neurotype === 'sensory') {
    specificInstructions = `
For readers with sensory sensitivities:
1. Use calm, neutral language
2. Remove intense sensory descriptions
3. Use a gentle, soothing tone
4. Avoid content that might trigger sensory overload
5. Use shorter sentences and paragraphs
6. Break intense descriptions into gentler alternatives
7. Focus on facts rather than emotional or sensory impact`;
  }

  return `
You are an AI assistant specializing in adapting web content for users with ${neurotype}.
${specificInstructions}

Instructions: ${instruction}

Here is structured webpage content in sections. For each numbered section, return a simplified version.
Respond ONLY as a JSON object in this format exactly (no other text):
{
  "chunk1-1": "Simplified text here",
  "chunk1-2": "Simplified text here",
}

Content:
${contentLines.join('\n\n')}
`.trim();
}

/**
 * Clean and safely parse Gemini's response text.
 */
function tryParseJSON(raw) {
  const cleaned = raw.replace(/```json|```/g, "").trim();
  try {
    return JSON.parse(cleaned);
  } catch (err) {
    console.error("Failed to parse Gemini output:", cleaned);
    return {};
  }
}

/**
 * Get adapted chunks from Gemini API
 */
async function getAdaptedChunks(chunks, neurotype) {
  const prompt = buildPromptFromChunks(chunks, neurotype);

  // Enter your API key here (for development purposes)
  // In production, you should use a more secure method to store API keys
  const API_KEY = "AIzaSyBNguqgksMAivtdyvIo0sxW_c4-oL0vIMw";  // Replace with your real API key

  if (!API_KEY || API_KEY === "YOUR_GEMINI_API_KEY") {
    console.error("Missing valid Gemini API key");
    throw new Error("Missing valid Gemini API key");
  }

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${API_KEY}`,
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
      throw new Error(`Gemini API error: ${response.status} ${response.statusText}`);
    }

    const raw = json?.candidates?.[0]?.content?.parts?.[0]?.text || '{}';
    return tryParseJSON(raw);
  } catch (error) {
    console.error("Error calling Gemini API:", error);
    throw error;
  }
}

/**
 * Process data with Gemini API
 */
async function processData(fullData) {
  console.log('Processing data in background.js:');
  console.log(fullData);

  try {
    // Call the Gemini API with the current neurotype
    const adaptedContent = await getAdaptedChunks(fullData, activeNeurotype);
    console.log('Adapted content from Gemini:', adaptedContent);

    // Transform the adapted content into layout changes
    return transformToLayoutChanges(adaptedContent, fullData);
  } catch (error) {
    console.error('Error processing data with Gemini:', error);

    // Fallback to mock data if there's an error
    return {
      layoutChanges: [
        {
          elementSelector: 'body',
          layout: {
            fontFamily: 'Arial, sans-serif',
            lineHeight: '1.6'
          }
        }
      ],
      styleChanges: [
        {
          elementSelector: 'h1, h2, h3',
          styles: {
            color: '#333',
            marginBottom: '15px'
          }
        }
      ],
      elementChanges: [
        {
          elementSelector: 'h1',
          type: 'paragraph',
          text: 'Simplified Heading for Accessibility'
        }
      ]
    };
  }
}

/**
 * Transform the adapted content from Gemini into layout changes
 */
function transformToLayoutChanges(adaptedContent, originalData) {
  const layoutChanges = [];
  const styleChanges = [];
  const elementChanges = [];

  console.log('Transforming content with original data:', originalData);
  console.log('Adapted content to transform:', adaptedContent);

  // Add basic layout improvements for all neurotypes
  layoutChanges.push({
    elementSelector: 'body',
    layout: {
      fontFamily: 'Arial, sans-serif',
      lineHeight: '1.6',
      maxWidth: '1200px',
      margin: '0 auto',
      padding: '0 20px'
    }
  });

  // Add neurotype-specific style changes
  if (activeNeurotype === 'adhd') {
    // ADHD-specific styles for better focus and readability
    styleChanges.push({
      elementSelector: 'body',
      styles: {
        background: '#f8f8f8',
        color: '#333'
      }
    });
    styleChanges.push({
      elementSelector: 'p, li',
      styles: {
        fontSize: '16px',
        lineHeight: '1.8',
        marginBottom: '1em',
        maxWidth: '650px' // Limit line length for better readability
      }
    });
    styleChanges.push({
      elementSelector: 'h1, h2, h3',
      styles: {
        color: '#2c3e50',
        marginTop: '1.5em',
        marginBottom: '0.5em',
        borderBottom: '1px solid #eee',
        paddingBottom: '0.3em'
      }
    });
  } else if (activeNeurotype === 'autism') {
    // Autism-specific styles for clarity and reduced sensory input
    styleChanges.push({
      elementSelector: 'body',
      styles: {
        background: '#f9f9f9',
        color: '#333'
      }
    });
    styleChanges.push({
      elementSelector: 'p, li',
      styles: {
        fontSize: '16px',
        lineHeight: '1.6',
        marginBottom: '1em',
        fontWeight: '400'
      }
    });
    styleChanges.push({
      elementSelector: 'a',
      styles: {
        textDecoration: 'underline',
        color: '#0066cc'
      }
    });
  } else if (activeNeurotype === 'blind') {
    // Blind-specific styles for screen reader optimization
    styleChanges.push({
      elementSelector: 'body',
      styles: {
        fontSize: '18px',
        lineHeight: '2'
      }
    });
    styleChanges.push({
      elementSelector: 'img',
      styles: {
        border: '1px solid #ccc' // Make images more detectable for partially sighted users
      }
    });
  } else if (activeNeurotype === 'sensory') {
    // Sensory-specific styles for reduced sensory overload
    styleChanges.push({
      elementSelector: 'body',
      styles: {
        background: '#f5f5f5',
        color: '#444'
      }
    });
    styleChanges.push({
      elementSelector: 'img, video',
      styles: {
        filter: 'brightness(0.9) contrast(0.9)',
        maxWidth: '90%'
      }
    });
    styleChanges.push({
      elementSelector: '*',
      styles: {
        animation: 'none !important',
        transition: 'none !important'
      }
    });
  }

  // Create a map to track sections we've already processed to avoid duplicates
  const processedSelectors = new Set();

  // Process the adapted content
  Object.entries(adaptedContent).forEach(([chunkId, simplifiedText]) => {
    // Parse the chunk-section format (e.g., "chunk1-2")
    const parts = chunkId.match(/chunk(\d+)-(\d+)/);
    if (!parts) {
      console.log(`Skipping invalid chunk ID format: ${chunkId}`);
      return;
    }

    const chunkIndex = parseInt(parts[1]) - 1;
    const sectionIndex = parseInt(parts[2]) - 1;

    // Check if we have this chunk in the original data
    if (chunkIndex < 0 || chunkIndex >= originalData.length) {
      console.log(`Chunk index out of range: ${chunkIndex} (max: ${originalData.length - 1})`);
      return;
    }

    // Get the chunk data
    const chunkData = originalData[chunkIndex];

    // Find the corresponding chunk ID (e.g., "chunk1")
    const chunkKey = Object.keys(chunkData)[0];
    if (!chunkKey) {
      console.log(`No chunk key found in data at index ${chunkIndex}`);
      return;
    }

    // Get the sections in this chunk
    const sections = chunkData[chunkKey];

    // Check if the section index is valid
    if (sectionIndex < 0 || sectionIndex >= sections.length) {
      console.log(`Section index out of range: ${sectionIndex} (max: ${sections.length - 1}) for chunk ${chunkKey}`);
      return;
    }

    // Get the specific section
    const section = sections[sectionIndex];

    // Make sure the section is valid
    if (!section || !section.content) {
      console.log(`Invalid section or no content at ${chunkKey}[${sectionIndex}]`);
      return;
    }

    // Format the simplified text appropriately based on neurotype
    let formattedText = simplifiedText;

    // For ADHD, ensure bullet points are preserved and formatting is enhanced
    if (activeNeurotype === 'adhd' && simplifiedText.includes('- ')) {
      formattedText = simplifiedText.split('\n').map(line => {
        if (line.startsWith('- ')) {
          return `• ${line.substring(2)}`;
        }
        return line;
      }).join('<br>');
    }

    // For autism, ensure step-by-step structure is preserved
    if (activeNeurotype === 'autism') {
      formattedText = simplifiedText.replace(/\n/g, '<br>');
    }

    // Apply the simplified text to each content element
    section.content.forEach(item => {
      // Skip if we've already processed this selector
      if (processedSelectors.has(item.elementSelector)) return;

      if (item.type === 'heading' || item.type === 'paragraph') {
        // Add to the set of processed selectors
        processedSelectors.add(item.elementSelector);

        // Apply the simplified text to each content element
        elementChanges.push({
          elementSelector: item.elementSelector,
          type: item.type,
          text: formattedText
        });
      }
    });
  });

  console.log('Generated layout changes:', layoutChanges);
  console.log('Generated style changes:', styleChanges);
  console.log('Generated element changes:', elementChanges);

  return {
    layoutChanges,
    styleChanges,
    elementChanges
  };
}

// ================ MESSAGE HANDLERS ================

// Combine the duplicate message listeners into a single one
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  // Handle neurotype updates
  if (message.type === 'updateNeurotype') {
    activeNeurotype = message.neurotype;
    console.log('Neurotype updated:', activeNeurotype);
    sendResponse({ status: 'neurotype_updated' });
    return true;
  }

  // Handle features updates
  if (message.type === 'updateFeatures') {
    features = message.features; // Update global features variable
    console.log('Features updated:', features);
    sendResponse({ status: 'features_updated' });
    return true;
  }

  // Handle the "sendChunk" type message
  if (message.type === 'sendChunk') {
    const chunkData = message.chunk;
    totalChunksExpected = message.totalChunksExpected;

    // Collect chunks in order
    fullData.push(chunkData);
    chunksReceived = chunksReceived + 1;

    console.log(`Received chunk ${chunksReceived} of ${totalChunksExpected}`);

    // Once all chunks are received, process the data directly
    if (chunksReceived === totalChunksExpected) {
      console.log('All chunks received. Processing with Gemini API.');

      // Process the data with the real Gemini API
      processData(fullData)
        .then(processedData => {
          // Send the processed data to the content script
          chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            if (tabs.length > 0) {
              chrome.tabs.sendMessage(tabs[0].id, {
                type: 'gemini_data',
                payload: processedData
              }, (contentResponse) => {
                console.log('Content script response:', contentResponse);
              });
            }
          });
        })
        .catch(error => {
          console.error('Error processing data:', error);
        })
        .finally(() => {
          // Reset for next chunk set
          fullData = [];
          chunksReceived = 0;
        });
    }

    sendResponse({ status: 'chunk_received', message: `Chunk ${chunksReceived} received.` });
    return true;
  }

  return true; // Keep the message channel open for the async response
});
