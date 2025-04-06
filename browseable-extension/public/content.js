console.log("Content script loaded");

// Track the active neurotype in content.js
let activeNeurotype = 'adhd';
let activeFeatures = {}; // Add this to track features
let userName = null; // Add this to track user name

// Get the active neurotype and user info when the content script loads
chrome.runtime.sendMessage({ type: 'getNeurotype' }, function (response) {
  if (response) {
    if (response.neurotype) {
      activeNeurotype = response.neurotype;
      console.log(`Current neurotype: ${activeNeurotype}`);
    }

    if (response.features) {
      activeFeatures = response.features;
      console.log('Active features:', activeFeatures);

      // Log enabled features in a more readable format
      const enabledFeatures = Object.entries(activeFeatures)
        .filter(([_, enabled]) => enabled)
        .map(([key]) => key);

      if (enabledFeatures.length > 0) {
        console.log('Enabled features:', enabledFeatures.join(', '));
      } else {
        console.log('No features enabled');
      }
    }

    if (response.userName) {
      userName = response.userName;
      console.log(`Current user: ${userName}`);
    }

    if (response.isLoggedIn) {
      console.log('User is logged in');
    } else {
      console.log('No user logged in - accessibility features inactive');
    }
  }
});

// Listen for neurotype changes and user info updates
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'updateNeurotype') {
    activeNeurotype = message.neurotype;
    console.log(`Neurotype updated to: ${activeNeurotype}`);
  }

  if (message.type === 'updateFeatures') {
    activeFeatures = message.features;
    console.log('Features updated:', activeFeatures);

    // Log enabled features in a more readable format
    const enabledFeatures = Object.entries(activeFeatures)
      .filter(([_, enabled]) => enabled)
      .map(([key]) => key);

    if (enabledFeatures.length > 0) {
      console.log('Enabled features:', enabledFeatures.join(', '));
    } else {
      console.log('No features enabled');
    }
  }

  if (message.type === 'userLoggedIn') {
    userName = message.userName || 'Unknown User';
    console.log(`User logged in: ${userName}`);
  }

  if (message.type === 'userLoggedOut') {
    userName = null;
    activeFeatures = {};
    console.log('User logged out - accessibility features deactivated');
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

//Helper funtions
function convertImageToBase64(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "Anonymous";

    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext("2d");
      ctx.drawImage(img, 0, 0);
      const base64 = canvas.toDataURL("image/png");
      resolve(base64);
    };

    img.onerror = reject;
    img.src = src;
  });
}

// Function to extract the content of an element
async function extractContentFromElement(el) {
  const type = el.tagName.toLowerCase();
  const selector = getElementSelector(el);
  let content = { type: null, elementSelector: selector };

  if (type === "a") {
    content.type = "link";
    content.text = el.innerText.trim();
    content.href = el.href || "";
  } else if (["h1", "h2", "h3", "h4", "h5", "h6"].includes(type)) {
    content.type = "heading";
    content.level = parseInt(type[1]);
    content.text = el.innerText.trim();
  } else if (type === "p") {
    content.type = "paragraph";
    content.text = el.innerText.trim();
  } else if (type === "img") {
    content.type = "image";
    content.src = el.src; // Always include src
    content.alt = el.alt || "";

    try {
      const base64 = await convertImageToBase64(el.src);
      if (base64) {
        content.base64 = base64;
      }
    } catch (err) {
      content.base64 = null; // handle canvas security/CORS issues
    }
  } else if (type === "video") {
    content.type = "video";
    content.src = el.src || el.querySelector("source")?.src || "";

    // Caption / accessibility metadata
    content.caption = el.getAttribute("aria-label")
      || el.getAttribute("title")
      || el.querySelector("track[kind='descriptions']")?.textContent
      || "";

    // Fallback caption from filename
    if (!content.caption && content.src) {
      const parts = content.src.split("/");
      const fileName = parts[parts.length - 1];
      content.caption = `Video file: ${fileName}`;
    }

    content.hasVideo = true;
  } else if (type === "ul" || type === "ol") {
    content.type = "list";
    content.items = Array.from(el.querySelectorAll("li")).map(li => li.innerText.trim());
  } else {
    content.type = "unknown";
    content.text = el.innerText.trim().slice(0, 200);
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
async function extractPageLayout() {
  const layout = [];
  const sections = document.querySelectorAll("main section, section, article, div");

  for (const section of sections) {
    const contentBlocks = [];
    const children = section.querySelectorAll("h1,h2,h3,h4,h5,h6,p,img,video,ul,ol,a");

    for (const child of children) {
      const content = await extractContentFromElement(child);
      if (content && (content.text?.length > 0 || content.src || content.base64 || content.href)) {
        contentBlocks.push(content);
      }
    }

    if (contentBlocks.length > 0) {
      layout.push({
        type: "section",
        role: guessSectionRole(section),
        elementSelector: getElementSelector(section),
        content: contentBlocks
      });
    }
  }

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
  console.log(`Sending chunk ${chunkIndex} of ${totalChunksExpected}`);

  // Show progress spinner on first chunk
  if (chunkIndex === 1) {
    showProgressSpinner("Analyzing page content...");
  }

  // Update progress counter with chunk info
  const counter = document.getElementById('browseable-progress-counter');
  if (counter) {
    counter.textContent = `Processing chunk ${chunkIndex} of ${totalChunksExpected}`;
  }

  chrome.runtime.sendMessage({
    type: 'sendChunk',
    chunk: chunkData,
    totalChunksExpected: totalChunksExpected
  }, (response) => {
    console.log(`Response for chunk ${chunkIndex}:`, response);

    // If it's the last chunk, we're done with sending, but still processing
    if (chunkIndex === totalChunksExpected) {
      const counter = document.getElementById('browseable-progress-counter');
      if (counter) {
        counter.textContent = 'Finalizing content adaptation...';
      }
    }
  });
}

// Main function to run on page load
const onPageLoad = async function () {
  console.log("DOM fully loaded or already loaded");

  // Skip Google pages
  if (isGooglePage()) {
    console.log("Google page detected. Skipping BrowseAble processing.");
    return;
  }

  // Show progress spinner when starting to extract layout
  showProgressSpinner("Analyzing page content...");

  const structuredData = await extractPageLayout();
  console.log("Extracted structured layout:", structuredData);

  const chunks = chunkLayout(structuredData.layout);
  const totalChunks = chunks.length;

  chunks.forEach((chunk, index) => {
    const chunkIndex = index + 1;
    sendChunkToGemini(chunk, chunkIndex, totalChunks);
  });

  chrome.runtime?.sendMessage?.(
    { type: 'saveContent', data: structuredData },
    (response) => {
      console.log("Got response from background:", response);
    }
  );
};

// Function to check if the current page is a Google page
function isGooglePage() {
  const hostname = window.location.hostname;
  return hostname.includes('google.') ||
    hostname === 'gmail.com' ||
    hostname.endsWith('.google.com');
}

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
    if (activeNeurotype === 'blind') {
      // If the neurotype is 'blind', read the content of the body aloud
      readMainContent();
    }

    sendResponse({ status: 'content_data_received' });
    return false;
  }
});

// Function to extract the main content (excluding navigation, headers, etc.) and read it aloud
function readMainContent() {
  // Try to find the main content using common tags and structures
  // Assuming the overlay is added to a specific container, such as ⁠ #overlay-container ⁠
  const overlayContainer = document.querySelector('#browseable-overlay'); // Adjust this selector if needed

  if (overlayContainer) {
    // Grab only the meaningful content elements (e.g., <p>, <h1>, <h2>, etc.)
    const contentElements = overlayContainer.querySelectorAll('p, h1, h2, h3, h4, h5, h6');

    // Filter out any elements that look like metadata or labels (e.g., anything with a specific class or id you can identify)
    const filteredContent = Array.from(contentElements)
      .filter(el => {
        // Add conditions here to exclude non-main content, e.g. based on class or id
        return !el.classList.contains('metadata') && !el.classList.contains('footer') && !el.tagName.includes('NAV');
      })
      .map(el => el.innerText.trim())
      .join(' '); // Combine all the relevant text into one string
    console.log("text", filteredContent);
    // Trigger Text-to-Speech (TTS) if there is any meaningful text content in the overlay
    if (filteredContent.length > 0) {
      speakText(filteredContent);
    } else {
      console.log('No main content found in overlay to read aloud.');
    }
  } else {
    console.log('Overlay container not found.');
  }
}



// Function to trigger speech synthesis (TTS)
function speakText(text) {
  console.log("Requesting background to speak:", text);
  chrome.runtime.sendMessage({ type: "speak", text: text });
}

// Add this function to replace applyLayoutChanges

function applyLayoutChanges(modifiedLayout) {
  console.log('Applying layout changes with elegant overlay:', modifiedLayout);

  // Hide the progress spinner if it exists
  hideProgressSpinner();

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
    background-color: #fafafa;
    z-index: 9999;
    overflow-y: auto;
    box-sizing: border-box;
    font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    line-height: 1.6;
    color: #333;
  `;

  // Create overlay header
  const header = document.createElement('div');
  header.style.cssText = `
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 15px 25px;
    margin-bottom: 20px;
    border-bottom: 1px solid #e0e0e0;
    position: sticky;
    top: 0;
    background: #fafafa;
    z-index: 10;
  `;

  // Add the BrowseAble logo/title
  const title = document.createElement('div');
  title.innerHTML = '<span style="color: #4a7aa7; font-size: 24px;"></span> <strong>BrowseAble</strong>';
  title.style.cssText = `
    font-size: 18px;
    font-weight: 500;
    letter-spacing: 0.3px;
  `;

  // Create neurotype indicator
  const neurotype = document.createElement('div');
  neurotype.textContent = `${activeNeurotype.toUpperCase()} Mode`;
  neurotype.style.cssText = `
    background: #4a7aa7;
    color: white;
    padding: 5px 12px;
    border-radius: 20px;
    font-size: 14px;
    font-weight: 500;
    letter-spacing: 0.3px;
  `;

  // Add close button
  const closeBtn = document.createElement('button');
  closeBtn.textContent = 'Return to Original';
  closeBtn.style.cssText = `
    background: transparent;
    border: 1px solid #bbb;
    padding: 8px 15px;
    border-radius: 20px;
    cursor: pointer;
    font-weight: 500;
    font-size: 14px;
    color: #555;
    transition: all 0.2s ease;
  `;
  closeBtn.onmouseover = function () {
    this.style.backgroundColor = '#f0f0f0';
  };
  closeBtn.onmouseout = function () {
    this.style.backgroundColor = 'transparent';
  };
  closeBtn.onclick = function () {
    overlay.remove();
  };

  // Append the header elements
  header.appendChild(title);
  // header.appendChild(neurotype);
  header.appendChild(closeBtn);
  overlay.appendChild(header);

  // Create content container
  const content = document.createElement('div');
  content.style.cssText = `
    max-width: 750px;
    margin: 0 auto 40px;
    padding: 25px 30px;
    background: white;
    border-radius: 8px;
    box-shadow: 0 1px 3px rgba(0,0,0,0.1);
  `;

  // Apply neurotype-specific styling
  if (activeNeurotype === 'adhd') {
    content.style.lineHeight = '1.8';
    content.style.letterSpacing = '0.2px';
  } else if (activeNeurotype === 'autism') {
    content.style.background = '#fcfcff';
    content.style.borderLeft = '4px solid #4a7aa7';
  } else if (activeNeurotype === 'blind') {
    content.style.fontSize = '18px';
    content.style.lineHeight = '2';
    content.style.borderBottom = '3px solid #4a7aa7';
  } else if (activeNeurotype === 'sensory') {
    content.style.background = '#f9f9f9';
    content.style.color = '#444';
    content.style.boxShadow = 'none';
    content.style.borderTop = '1px solid #e0e0e0';
    content.style.borderBottom = '1px solid #e0e0e0';
  }

  // Add the simplified content
  const simplifiedContent = document.createElement('div');

  // Document title at the top
  const pageTitle = document.createElement('h2');
  pageTitle.textContent = document.title || 'Page Content';
  pageTitle.style.cssText = `
    margin: 0 0 20px 0;
    padding-bottom: 12px;
    border-bottom: 1px solid #eee;
    color: #2c3e50;
    font-weight: 600;
    font-size: 22px;
  `;
  simplifiedContent.appendChild(pageTitle);

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

    // Render the headings first
    headings.forEach(item => {
      const heading = document.createElement('h3');
      heading.innerHTML = item.text;
      heading.style.cssText = `
        color: #2c3e50; 
        margin: 25px 0 15px; 
        font-weight: 600;
        font-size: 18px;
        border-left: 3px solid #4a7aa7;
        padding-left: 10px;
      `;
      mainSection.appendChild(heading);
    });

    // Then render paragraphs
    paragraphs.forEach(item => {
      const paragraph = document.createElement('div');
      paragraph.innerHTML = item.text;
      paragraph.style.cssText = `
        margin-bottom: 18px;
        padding-bottom: 6px;
      `;

      // For ADHD, add subtle visual anchors
      if (activeNeurotype === 'adhd') {
        paragraph.style.background = 'rgba(250,250,252,0.8)';
        paragraph.style.padding = '8px 12px';
        paragraph.style.borderRadius = '4px';
      }

      mainSection.appendChild(paragraph);
    });

    simplifiedContent.appendChild(mainSection);
  } else {
    const noContent = document.createElement('p');
    noContent.textContent = 'No simplified content available for this page.';
    noContent.style.cssText = `
      text-align: center;
      color: #888;
      padding: 30px;
      font-style: italic;
    `;
    simplifiedContent.appendChild(noContent);
  }

  content.appendChild(simplifiedContent);
  overlay.appendChild(content);

  // Add contextual insights if available
  if (modifiedLayout.contextualInsights) {
    const insightsContainer = document.createElement('div');
    insightsContainer.style.cssText = `
      max-width: 750px;
      margin: 25px auto;
      padding: 15px 20px;
      background: #f0f7ff;
      border-radius: 8px;
      border-left: 4px solid #4a7aa7;
      color: #2c3e50;
      font-size: 15px;
    `;

    const insightsTitle = document.createElement('h4');
    insightsTitle.textContent = 'Page Context';
    insightsTitle.style.cssText = `
      margin: 0 0 10px 0;
      font-size: 16px;
      color: #4a7aa7;
    `;

    const insightsText = document.createElement('p');
    insightsText.textContent = modifiedLayout.contextualInsights;
    insightsText.style.cssText = `margin: 0;`;

    insightsContainer.appendChild(insightsTitle);
    insightsContainer.appendChild(insightsText);
    overlay.appendChild(insightsContainer);
  }

  // Add relevant links table if available
  if (modifiedLayout.relevantLinks && modifiedLayout.relevantLinks.length > 0) {
    const linksContainer = document.createElement('div');
    linksContainer.style.cssText = `
      max-width: 750px;
      margin: 25px auto 40px;
      padding: 20px;
      background: white;
      border-radius: 8px;
      box-shadow: 0 1px 3px rgba(0,0,0,0.1);
    `;

    const linksTitle = document.createElement('h3');
    linksTitle.textContent = 'Important Links';
    linksTitle.style.cssText = `
      margin: 0 0 15px 0;
      padding-bottom: 12px;
      border-bottom: 1px solid #eee;
      color: #2c3e50;
      font-weight: 600;
      font-size: 18px;
    `;

    // Create links table
    const linksTable = document.createElement('table');
    linksTable.style.cssText = `
      width: 100%;
      border-collapse: collapse;
      font-size: 14px;
    `;

    // Add table header
    const tableHeader = document.createElement('thead');
    tableHeader.innerHTML = `
      <tr>
        <th style="text-align: left; padding: 8px; border-bottom: 2px solid #eee; color: #4a7aa7;">Link</th>
        <th style="text-align: left; padding: 8px; border-bottom: 2px solid #eee; color: #4a7aa7;">Description</th>
      </tr>
    `;

    // Add table body
    const tableBody = document.createElement('tbody');

    // Add rows for each link
    modifiedLayout.relevantLinks.forEach(link => {
      const row = document.createElement('tr');
      row.style.cssText = `border-bottom: 1px solid #f0f0f0;`;

      // Link cell with actual link
      const linkCell = document.createElement('td');
      linkCell.style.cssText = `padding: 12px 8px;`;

      const linkElement = document.createElement('a');
      linkElement.href = link.url;
      linkElement.textContent = link.title;
      linkElement.style.cssText = `
        color: #4a7aa7;
        text-decoration: none;
        border-bottom: 1px dotted #4a7aa7;
        font-weight: 500;
      `;
      linkElement.target = "_blank"; // Open in new tab

      linkCell.appendChild(linkElement);

      // Description cell
      const descCell = document.createElement('td');
      descCell.textContent = link.summary;
      descCell.style.cssText = `padding: 12px 8px; color: #555;`;

      // Add cells to row
      row.appendChild(linkCell);
      row.appendChild(descCell);

      // Add row to table body
      tableBody.appendChild(row);
    });

    // Assemble table
    linksTable.appendChild(tableHeader);
    linksTable.appendChild(tableBody);

    // Add elements to container
    linksContainer.appendChild(linksTitle);
    linksContainer.appendChild(linksTable);

    // Add container to overlay
    overlay.appendChild(linksContainer);
  }

  // Add page info at the bottom
  const pageInfo = document.createElement('div');
  pageInfo.style.cssText = `
    text-align: center;
    margin: 15px auto 20px;
    color: #888;
    font-size: 12px;
    max-width: 750px;
  `;

  const pageUrl = document.createElement('a');
  pageUrl.href = window.location.href;
  pageUrl.textContent = window.location.href;
  pageUrl.style.cssText = `
    color: #666;
    text-decoration: none;
    border-bottom: 1px dotted #999;
  `;

  const infoText = document.createElement('div');
  infoText.textContent = 'Original page: ';
  infoText.appendChild(pageUrl);
  pageInfo.appendChild(infoText);

  overlay.appendChild(pageInfo);

  // Add BrowseAble signature
  const signature = document.createElement('div');
  signature.style.cssText = `
    text-align: center;
    margin: 0 auto 30px;
    color: #aaa;
    font-size: 11px;
    max-width: 750px;
  `;
  signature.textContent = 'Adapted by BrowseAble • Accessibility for everyone';
  overlay.appendChild(signature);

  // Append the overlay to the body
  document.body.appendChild(overlay);

  // Add a global variable to track the active neurotype for the overlay
  window.activeNeurotype = activeNeurotype;

  console.log('Elegant text overlay created successfully');
}

// Modify the reprocessPage message handler

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'reprocessPage') {
    console.log(`Reprocessing page for neurotype: ${message.neurotype}`);

    // Skip Google pages
    if (isGooglePage()) {
      console.log("Google page detected. Skipping BrowseAble processing.");
      sendResponse({ status: 'google_page_skipped' });
      return true;
    }

    // Update the active neurotype
    activeNeurotype = message.neurotype;

    // Show a processing spinner with progress
    showProgressSpinner("Processing content...");

    // Re-process the page
    setTimeout(async () => {
      const existingOverlay = document.getElementById('browseable-overlay');
      if (existingOverlay) {
        existingOverlay.remove();
      }

      await onPageLoad(); // ensure async operation completes
      hideProgressSpinner();
      try {
        sendResponse({ status: 'reprocess_complete' });
      } catch (err) {
        console.warn("sendResponse failed:", err);
      }
    }, 500);

    return true;
  }
});

// Add these functions to show/hide a circular progress spinner

function showProgressSpinner(message = "Processing...") {
  // Remove any existing spinner
  hideProgressSpinner();

  // Create spinner container
  const spinnerContainer = document.createElement('div');
  spinnerContainer.id = 'browseable-progress-container';
  spinnerContainer.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background-color: rgba(255, 255, 255, 0.9);
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
    z-index: 10000;
    font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  `;

  // Add close button in the top-left corner
  const closeButton = document.createElement('button');
  closeButton.innerHTML = '&times;'; // × symbol
  closeButton.style.cssText = `
    position: absolute;
    top: 20px;
    left: 20px;
    background: rgba(255, 255, 255, 0.8);
    border: 1px solid #ccc;
    border-radius: 50%;
    width: 36px;
    height: 36px;
    font-size: 24px;
    line-height: 24px;
    color: #666;
    cursor: pointer;
    display: flex;
    justify-content: center;
    align-items: center;
    padding: 0;
    transition: all 0.2s ease;
  `;
  closeButton.title = "Cancel processing";

  // Add hover effects
  closeButton.onmouseover = function () {
    this.style.background = '#f0f0f0';
    this.style.color = '#333';
  };
  closeButton.onmouseout = function () {
    this.style.background = 'rgba(255, 255, 255, 0.8)';
    this.style.color = '#666';
  };

  // Add click handler to cancel processing
  closeButton.onclick = function () {
    // Hide the spinner
    hideProgressSpinner();

    // Notify that processing was canceled
    console.log('Content processing canceled by user');

    // Send message to background script to stop any ongoing processing
    chrome.runtime.sendMessage({
      type: 'cancelProcessing'
    }, (response) => {
      console.log('Sent cancel processing request:', response);
    });
  };

  spinnerContainer.appendChild(closeButton);

  // Create spinner
  const spinner = document.createElement('div');
  spinner.className = 'browseable-progress-spinner';
  spinner.style.cssText = `
    width: 60px;
    height: 60px;
    border: 3px solid rgba(74, 122, 167, 0.2);
    border-radius: 50%;
    border-top-color: #4a7aa7;
    animation: browseable-spin 1s ease-in-out infinite;
  `;

  // Create keyframes for animation
  const style = document.createElement('style');
  style.textContent = `
    @keyframes browseable-spin {
      to { transform: rotate(360deg); }
    }
  `;
  document.head.appendChild(style);

  // Create message
  const messageElement = document.createElement('div');
  messageElement.textContent = message;
  messageElement.style.cssText = `
    margin-top: 20px;
    color: #4a7aa7;
    font-size: 16px;
    font-weight: 500;
  `;

  // Create progress counter
  const progressCounter = document.createElement('div');
  progressCounter.id = 'browseable-progress-counter';
  progressCounter.textContent = 'Processing...';
  progressCounter.style.cssText = `
    margin-top: 10px;
    color: #666;
    font-size: 14px;
  `;

  // Add BrowseAble branding
  const branding = document.createElement('div');
  branding.innerHTML = '<strong>BrowseAble</strong>';
  branding.style.cssText = `
    position: absolute;
    bottom: 20px;
    color: #4a7aa7;
    font-size: 14px;
    letter-spacing: 0.3px;
  `;

  // Append elements
  spinnerContainer.appendChild(spinner);
  spinnerContainer.appendChild(messageElement);
  spinnerContainer.appendChild(progressCounter);
  spinnerContainer.appendChild(branding);
  document.body.appendChild(spinnerContainer);

  // Start progress simulation
  simulateProgress();
}

function hideProgressSpinner() {
  const spinner = document.getElementById('browseable-progress-container');
  if (spinner) {
    spinner.remove();
  }

  // Clear any progress simulation interval
  if (window.browseableProgressInterval) {
    clearInterval(window.browseableProgressInterval);
    window.browseableProgressInterval = null;
  }
}

function simulateProgress() {
  let progress = 0;
  const counter = document.getElementById('browseable-progress-counter');

  // Clear any existing interval
  if (window.browseableProgressInterval) {
    clearInterval(window.browseableProgressInterval);
  }

  window.browseableProgressInterval = setInterval(() => {
    // Calculate new progress value - faster at first, slower towards the end
    if (progress < 70) {
      progress += Math.random() * 5;
    } else if (progress < 90) {
      progress += Math.random() * 2;
    } else if (progress < 95) {
      progress += 0.5;
    }

    // Cap at 95% - will go to 100% when complete
    progress = Math.min(progress, 95);

    if (counter) {
      counter.textContent = `${Math.floor(progress)}% complete`;
    }
  }, 300);
}

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

// Add to background.js to handle the cancelProcessing message
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'cancelProcessing') {
    console.log('Received request to cancel processing');

    // Set a flag to cancel ongoing operations
    window.cancelProcessingRequested = true;

    // Cancel any ongoing API calls if possible
    // This depends on your implementation of API calls

    sendResponse({ status: 'processing_canceled' });
    return true;
  }
});

let isPaused = false;  // Flag to track the pause/play state

document.addEventListener('keydown', (e) => {
  if (e.code === 'Space') {
    console.log('Spacebar pressed');
    e.preventDefault(); // Prevent the default spacebar action
    if (isPaused) {
      // If TTS is paused, resume it
      chrome.runtime.sendMessage({ type: 'resume_speech' });
      isPaused = false;
      console.log('Resuming speech...');
    } else {
      // If TTS is playing, pause it
      chrome.runtime.sendMessage({ type: 'pause_speech' });
      isPaused = true;
      console.log('Pausing speech...');
    }
  }
});

