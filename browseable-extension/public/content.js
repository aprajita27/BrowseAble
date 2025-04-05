console.log("Content script loaded");

// Track the active neurotype in content.js
let activeNeurotype = 'adhd';

// Get the active neurotype when the content script loads
chrome.runtime.sendMessage({ type: 'getNeurotype' }, function (response) {
  if (response && response.neurotype) {
    activeNeurotype = response.neurotype;
    console.log(`Current neurotype: ${activeNeurotype}`);
  }
});

// Listen for neurotype changes
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'updateNeurotype') {
    activeNeurotype = message.neurotype;
    console.log(`Neurotype updated to: ${activeNeurotype}`);
  }
});

// Function to generate a CSS selector for an element
function getElementSelector(el) {
  if (!el || !el.tagName) return null;
  const path = [];
  while (el && el.nodeType === 1) {
    let selector = el.nodeName.toLowerCase();
    if (el.id) {
      selector += `#${el.id}`;
      path.unshift(selector);
      break;
    } else {
      let siblingIndex = 1;
      let sibling = el.previousElementSibling;
      while (sibling) {
        if (sibling.nodeName === el.nodeName) siblingIndex++;
        sibling = sibling.previousElementSibling;
      }
      selector += `:nth-of-type(${siblingIndex})`;
    }
    path.unshift(selector);
    el = el.parentElement;
  }
  return path.join(" > ");
}

// Function to extract the content of an element
function extractContentFromElement(el) {
  const type = el.tagName.toLowerCase();
  const selector = getElementSelector(el);
  let content = { type: null, elementSelector: selector };

  if (["h1", "h2", "h3", "h4", "h5", "h6"].includes(type)) {
    content.type = "heading";
    content.level = parseInt(type[1]);
    content.text = el.innerText.trim();
  } else if (type === "p") {
    content.type = "paragraph";
    content.text = el.innerText.trim();
  } else if (type === "img") {
    content.type = "image";
    content.src = el.src;
    content.alt = el.alt || "";
  } else if (type === "video") {
    content.type = "video";
    content.src = el.src || el.querySelector("source")?.src || "";
    content.caption = el.getAttribute("aria-label") || "";
  } else if (type === "ul" || type === "ol") {
    content.type = "list";
    content.items = Array.from(el.querySelectorAll("li")).map(li => li.innerText.trim());
  } else {
    content.type = "unknown";
    content.text = el.innerText.trim().slice(0, 200); // fallback preview
  }

  return content;
}

// Function to guess the section role based on class or role attributes
function guessSectionRole(el) {
  const className = el.className || "";
  const role = el.getAttribute("role");

  if (role) return role;
  if (/hero|banner/i.test(className)) return "hero";
  if (/footer/i.test(className)) return "footer";
  if (/nav/i.test(className)) return "navigation";
  if (/sidebar/i.test(className)) return "sidebar";
  if (/main/i.test(className)) return "main";
  if (/step|card|panel/i.test(className)) return "content-step";

  return "section";
}

// Function to count tokens (approximated by word count)
function countTokens(text) {
  // A simple approximation: a token is roughly equivalent to a word.
  return text.split(/\s+/).length;
}

// Function to extract the page layout (structure)
function extractPageLayout() {
  const layout = [];
  const sections = document.querySelectorAll("main section, section, article, div");

  sections.forEach(section => {
    const contentBlocks = [];
    const children = section.querySelectorAll("h1,h2,h3,h4,h5,h6,p,img,video,ul,ol");

    children.forEach(child => {
      const content = extractContentFromElement(child);
      if (content && (content.text?.length > 0 || content.src)) {
        contentBlocks.push(content);
      }
    });

    if (contentBlocks.length > 0) {
      layout.push({
        type: "section",
        role: guessSectionRole(section),
        elementSelector: getElementSelector(section),
        content: contentBlocks
      });
    }
  });

  return {
    title: document.title,
    url: window.location.href,
    layout
  };
}

function countTokens(text) {
  // A simple approximation: a token is roughly equivalent to a word.
  return text.split(/\s+/).length;
}

// Updated function to count the total size of the content, including JSON structure
function countJsonTokens(jsonObject) {
  const jsonString = JSON.stringify(jsonObject); // Convert JSON to string
  return countTokens(jsonString); // Calculate token count for the entire JSON structure
}

// Function to chunk the layout data into smaller parts based on token limit (without splitting sections)
function chunkLayout(layout, tokenLimit = 1500) {
  const chunks = [];
  let currentChunk = [];
  let currentTokenCount = 0;

  layout.forEach((section, index) => {
    // Calculate the total tokens for this section's content
    const sectionTokens = section.content.reduce((acc, content) => {
      if (content.text) {
        acc += countTokens(content.text); // Count tokens of text content
      }
      return acc;
    }, 0);

    // Create a mock chunk with the current section added
    const mockChunk = [...currentChunk, section];
    const chunkTokenCount = countJsonTokens({ layout: mockChunk });

    // Check if the section can fit in the current chunk without exceeding the token limit
    if (chunkTokenCount <= tokenLimit) {
      currentChunk.push(section);
      currentTokenCount += sectionTokens;
    } else {
      // If adding this section exceeds the token limit, push the current chunk to the chunks array
      if (currentChunk.length > 0) {
        chunks.push({ [`chunk${chunks.length + 1}`]: currentChunk });
      }
      // Start a new chunk with the current section
      currentChunk = [section];
      currentTokenCount = sectionTokens;
    }
  });

  // Push any remaining chunk
  if (currentChunk.length > 0) {
    chunks.push({ [`chunk${chunks.length + 1}`]: currentChunk });
  }

  return chunks;
}

// Function to send layout data to gemini.js via chrome.runtime
function sendChunkToGemini(chunkData, chunkIndex, totalChunksExpected) {
  console.log(`Sending chunk ${chunkIndex} of ${totalChunksExpected}`);  // Add this to debug
  chrome.runtime.sendMessage({
    type: 'sendChunk',
    chunk: chunkData,
    totalChunksExpected: totalChunksExpected
  }, (response) => {
    console.log(`Response for chunk ${chunkIndex}:`, response);
  });
}

// Main function to run on page load
const onPageLoad = function () {
  console.log("DOM fully loaded or already loaded");

  const structuredData = extractPageLayout();
  console.log("Extracted structured layout:", structuredData);

  const chunks = chunkLayout(structuredData.layout);  // Chunking the content into smaller sections

  const totalChunks = chunks.length;  // Get the total number of chunks

  // Loop through each chunk and send it to Gemini
  chunks.forEach((chunk, index) => {
    const chunkIndex = index + 1;  // Index starts at 0, but you want it to start at 1
    sendChunkToGemini(chunk, chunkIndex, totalChunks);
  });

  chrome.runtime?.sendMessage?.(
    { type: 'saveContent', data: structuredData },
    (response) => {
      console.log("Got response from background:", response);
    }
  );
};

// Trigger when the DOM is loaded
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', onPageLoad);
} else {
  onPageLoad();
}

// content.js

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'gemini_data') {
    console.log('Received processed data in content.js:', message.payload);

    // Apply the changes to the page (layout, content, etc.)
    applyLayoutChanges(message.payload);

    sendResponse({ status: 'content_data_received' });
  }
});

// Add this function to replace applyLayoutChanges

function applyLayoutChanges(modifiedLayout) {
  console.log('Applying layout changes with text overlay:', modifiedLayout);

  // Remove any existing overlay first
  const existingOverlay = document.getElementById('browseable-overlay');
  if (existingOverlay) {
    existingOverlay.remove();
  }

  // Create the overlay container
  const overlay = document.createElement('div');
  overlay.id = 'browseable-overlay';
  overlay.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background-color: white;
    z-index: 9999;
    overflow-y: auto;
    padding: 20px;
    box-sizing: border-box;
    font-family: Arial, sans-serif;
    line-height: 1.6;
    color: #333;
  `;

  // Create overlay header
  const header = document.createElement('div');
  header.style.cssText = `
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding-bottom: 15px;
    margin-bottom: 20px;
    border-bottom: 1px solid #eaeaea;
    position: sticky;
    top: 0;
    background: white;
    z-index: 10;
  `;

  // Add the BrowseAble logo/title
  const title = document.createElement('div');
  title.innerHTML = '<span style="color: #4CAF50; font-size: 24px;">🌟</span> <strong>BrowseAble</strong>';
  title.style.fontSize = '18px';

  // Create neurotype indicator
  const neurotype = document.createElement('div');
  neurotype.textContent = `Mode: ${activeNeurotype.toUpperCase()}`;
  neurotype.style.cssText = `
    background: #4CAF50;
    color: white;
    padding: 5px 10px;
    border-radius: 4px;
    font-size: 14px;
  `;

  // Add close button
  const closeBtn = document.createElement('button');
  closeBtn.textContent = 'Return to Original Page';
  closeBtn.style.cssText = `
    background: #f0f0f0;
    border: none;
    padding: 8px 12px;
    border-radius: 4px;
    cursor: pointer;
    font-weight: bold;
  `;
  closeBtn.onclick = function () {
    overlay.remove();
  };

  // Append the header elements
  header.appendChild(title);
  header.appendChild(neurotype);
  header.appendChild(closeBtn);
  overlay.appendChild(header);

  // Create content container
  const content = document.createElement('div');
  content.style.cssText = `
    max-width: 800px;
    margin: 0 auto;
    padding: 20px;
    background: #f9f9f9;
    border-radius: 8px;
    box-shadow: 0 2px 8px rgba(0,0,0,0.1);
  `;

  // Format based on neurotype
  if (activeNeurotype === 'adhd') {
    content.style.lineHeight = '1.8';
  } else if (activeNeurotype === 'autism') {
    content.style.background = '#f8f8ff';
  } else if (activeNeurotype === 'blind') {
    content.style.fontSize = '18px';
    content.style.lineHeight = '2';
  } else if (activeNeurotype === 'sensory') {
    content.style.background = '#f5f5f5';
    content.style.color = '#444';
  }

  // Add the simplified content
  const simplifiedContent = document.createElement('div');

  // Collect all element changes
  if (modifiedLayout.elementChanges && modifiedLayout.elementChanges.length > 0) {
    // Track unique content to avoid duplicates
    const uniqueContent = new Set();

    // First pass: collect headings and their texts
    const headings = [];
    modifiedLayout.elementChanges.forEach(item => {
      if (item.type === 'heading') {
        // Only add if we haven't seen this text before
        const contentKey = item.text.substring(0, 50);
        if (!uniqueContent.has(contentKey)) {
          uniqueContent.add(contentKey);
          headings.push(item);
        }
      }
    });

    // Second pass: collect paragraphs
    const paragraphs = [];
    modifiedLayout.elementChanges.forEach(item => {
      if (item.type === 'paragraph') {
        // Only add if we haven't seen this text before
        const contentKey = item.text.substring(0, 50);
        if (!uniqueContent.has(contentKey)) {
          uniqueContent.add(contentKey);
          paragraphs.push(item);
        }
      }
    });

    // Sort headings by their position in the document
    headings.sort((a, b) => {
      // Extract numbers from selectors for basic ordering
      const aMatch = a.elementSelector.match(/#([A-Za-z_]+)/);
      const bMatch = b.elementSelector.match(/#([A-Za-z_]+)/);

      if (aMatch && bMatch) {
        return aMatch[1].localeCompare(bMatch[1]);
      }
      return 0;
    });

    // Now render the unique content
    const mainSection = document.createElement('div');
    mainSection.className = 'browseable-section';
    mainSection.style.marginBottom = '30px';

    // Render the headings first
    headings.forEach(item => {
      const heading = document.createElement('h3');
      heading.innerHTML = item.text;
      heading.style.cssText = 'color: #2c3e50; margin: 25px 0 15px; font-weight: bold;';
      mainSection.appendChild(heading);
    });

    // Then render paragraphs
    paragraphs.forEach(item => {
      const paragraph = document.createElement('div');
      paragraph.innerHTML = item.text;
      paragraph.style.cssText = 'margin-bottom: 15px;';
      mainSection.appendChild(paragraph);
    });

    simplifiedContent.appendChild(mainSection);
  } else {
    const noContent = document.createElement('p');
    noContent.textContent = 'No simplified content available for this page.';
    noContent.style.textAlign = 'center';
    noContent.style.color = '#888';
    noContent.style.padding = '30px';
    simplifiedContent.appendChild(noContent);
  }

  content.appendChild(simplifiedContent);
  overlay.appendChild(content);

  // Add page info at the bottom
  const pageInfo = document.createElement('div');
  pageInfo.style.cssText = `
    text-align: center;
    margin-top: 30px;
    color: #888;
    font-size: 12px;
    padding: 10px;
  `;
  pageInfo.textContent = `Original page: ${document.title} | ${window.location.href}`;
  overlay.appendChild(pageInfo);

  // Append the overlay to the body
  document.body.appendChild(overlay);

  // Add a global variable to track the active neurotype for the overlay
  window.activeNeurotype = activeNeurotype;

  console.log('Text overlay created successfully');
}

// Modify the reprocessPage message handler

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'reprocessPage') {
    console.log(`Reprocessing page for neurotype: ${message.neurotype}`);

    // Update the active neurotype
    activeNeurotype = message.neurotype;

    // Show a processing notification
    const processingNotification = document.createElement('div');
    processingNotification.style.cssText = `
      position: fixed;
      top: 20px;
      left: 50%;
      transform: translateX(-50%);
      background-color: #4CAF50;
      color: white;
      padding: 10px 20px;
      border-radius: 5px;
      font-family: Arial, sans-serif;
      z-index: 10000;
      box-shadow: 0 2px 8px rgba(0,0,0,0.2);
    `;
    processingNotification.textContent = "🔄 BrowseAble: Adapting content...";
    document.body.appendChild(processingNotification);

    // Re-process the page
    setTimeout(() => {
      // Remove any existing overlay first
      const existingOverlay = document.getElementById('browseable-overlay');
      if (existingOverlay) {
        existingOverlay.remove();
      }

      onPageLoad();
      // Remove the notification after processing starts
      processingNotification.remove();
    }, 500);
  }
});

// Add this function to get the neurotype-specific CSS

function getNeurotypeStyles(neurotype) {
  const styles = {
    base: {
      container: `
        font-family: Arial, sans-serif;
        line-height: 1.6;
        color: #333;
        max-width: 800px;
        margin: 0 auto;
        padding: 20px;
        border-radius: 8px;
        box-shadow: 0 2px 8px rgba(0,0,0,0.1);
      `,
      heading: `
        margin: 25px 0 15px;
        font-weight: bold;
      `,
      paragraph: `
        margin-bottom: 15px;
      `
    },

    adhd: {
      container: `
        background: #f9f9f9;
        line-height: 1.8;
      `,
      heading: `
        color: #2c3e50;
        border-bottom: 2px solid #e7e7e7;
        padding-bottom: 5px;
      `,
      paragraph: `
        background-color: rgba(255,255,255,0.8);
        padding: 10px;
        border-radius: 4px;
        box-shadow: 0 1px 3px rgba(0,0,0,0.05);
      `
    },

    autism: {
      container: `
        background: #f8f8ff;
      `,
      heading: `
        color: #333;
        border-left: 4px solid #4a7aa7;
        padding-left: 10px;
      `,
      paragraph: `
        border-bottom: 1px solid #f0f0f0;
        padding-bottom: 10px;
      `
    },

    blind: {
      container: `
        background: #ffffff;
        font-size: 18px;
        line-height: 2;
      `,
      heading: `
        color: #000;
        margin-top: 30px;
        margin-bottom: 20px;
      `,
      paragraph: `
        margin-bottom: 20px;
      `
    },

    sensory: {
      container: `
        background: #f5f5f5;
        color: #444;
      `,
      heading: `
        color: #555;
        font-weight: 500;
      `,
      paragraph: `
        padding: 8px 0;
        border-bottom: 1px solid rgba(0,0,0,0.05);
      `
    }
  };

  return styles[neurotype] || styles.adhd;
}

