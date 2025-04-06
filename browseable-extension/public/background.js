// background.js

let fullData = [];
let totalChunksExpected = 0;
let chunksReceived = 0;
let activeNeurotype = 'adhd'; // Default neurotype setting

/**
 * Build a prompt from chunked content that considers element types and neurotype instructions.
 */
function buildPromptFromChunks(data, neurotype) {
  const contentLines = [];

  // Parse all chunks
  Object.entries(data).forEach(([dataIndex, dataItem]) => {
    Object.entries(dataItem).forEach(([chunkId, sections]) => {
      sections.forEach((section, sectionIndex) => {
        if (!section || !section.content) return;
        const sectionId = `${chunkId}-${sectionIndex + 1}`;
        const sectionLines = [`Section ${sectionId} (${section.role || 'section'})`, `Selector: ${section.elementSelector || 'unknown'}`];
        sections.forEach((section, sectionIndex) => {
          if (!section || !section.content) return;
        
          const sectionId = `${chunkId}-${sectionIndex + 1}`;
          const sectionHeader = [`Section ${sectionId} (${section.role || 'section'})`, `Selector: ${section.elementSelector || 'unknown'}`];
        
          section.content.forEach((item) => {
            if (item.type === "image") {
              const base64Info = item.base64 ? "base64_image_provided" : "no_base64";
              const label = item.alt?.trim() || "No alt text";
              sectionHeader.push(`- [image] (${base64Info}) alt="${label}"`);
            } else if (item.text && item.text.trim()) {
              const isShort = item.text.trim().split(" ").length < 5;
              const prefix = isShort ? "[label]" : `[${item.type}]`;
              sectionHeader.push(`- ${prefix} "${item.text.trim()}"`);
            }
          });
        
          contentLines.push(sectionHeader.join("\n"));
        });
        contentLines.push(sectionLines.join('\n'));
      });
    });
  });

  // Neurotype-specific instructions
  const neurotypeInstructions = {
    adhd: `
For ADHD users:
- Use short bullet points (max 15 words)
- Keep all sections and subheadings, summarize only the content inside
- Highlight key actions or benefits
- Remove unnecessary tangents or distractions but keep all context. Prepare a context summary separately to make it easy to follow
- If something is not defined or you are not sure, do not mention it. 
- Generate not just the text of what is displayed but the intent is derive a summary of the page and present to make it less overwhelming to concentrate
- Keep content logically organized and easy to scan`.trim(),

    autism: `
For Autistic users:
- Use literal, step-by-step explanations
- Avoid idioms, sarcasm, or vague phrasing
- Keep structure consistent and predictable
- Use factual, concise descriptions
- Define concepts clearly where necessary`.trim(),

    blind: `
For Blind users using screen readers:
- Use full sentences and clear, linear narrative
- Describe images with: "This is an image of ..."
- Provide video context using available captions or inferred description
- Avoid visual-only references (e.g., "see below")
- Do not include visual formatting`.trim(),

    sensory: `
For Sensory-sensitive users:
- Use a calm, neutral tone throughout
- Avoid intense or emotionally charged language
- Prefer short, gentle sentences and soft phrasing
- Remove emphasis or visual metaphors
- Simplify paragraphs into evenly-paced information`.trim()
  };

  const fallback = "Simplify this content for accessibility.";
  const specificInstructions = neurotypeInstructions[neurotype] || fallback;

  return `
You are an accessibility AI adapting web content for neurodivergent users.
Neurotype: ${neurotype.toUpperCase()}

Adapt each section using the rules below:
${specificInstructions}

Universal Rules for All Neurotypes:
- You need to generate a context summary and highlights of the entire content not just convert to text
- Do not skip any section, even if repetitive
- Do not over-summarize or merge content across sections
- Preserve facts, processes, names, and lists, purpose of the site, features provided, steps given
- Describe images using the pattern: "This is an image of ...", if no alt text is present infer the meaning and describe from the link or base64 if given
- Provide helpful video context using captions or inferred meaning
- The information about any graphic, or any text block on the page should not be not defined or ambiguous. For each provide the context or inference if not exact meaning
- If the content exceeds 5 bullets, give different sections for every 5 or less than 5 bullets
- Return clean and complete JSON in this exact format:

{
  "chunk1-1": "Simplified version of section 1",
  "chunk1-2": "Simplified version of section 2"
}


IMPORTANT FORMATTING RULES:
- DO NOT use Markdown (*, -, **, _, etc.).
- Return clean, plain text only.
- Use line breaks or numbered lists only if needed.
- Avoid styling markers like "**bold**" or "_italics_".

Strictly adhere to the above instructions. DO NOT RETURN MARKDOWN. DO NOT add explanations. 
Return Only the JSON.

Webpage Content:
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

// Listen for popup or settings changes to update the neurotype
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'updateNeurotype') {
    activeNeurotype = message.neurotype;
    sendResponse({ status: 'neurotype_updated' });
    return true;
  }
});

// Handle content script messages
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
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
      // Note: We need to handle the async function differently
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
    return true; // Keep the message channel open for async response
  }

  return true; // Always return true to keep message channel open
});
