console.log("Content script loaded");

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
  

// Function to save content data (now handling multiple chunks)
function saveContentToFile(data, filename = "page-structure.json") {
  console.log("Saving structured layout to file...");

  const chunks = chunkLayout(data.layout);  // Chunking the content into smaller sections

  // Save the chunks into a single JSON file
  const finalData = chunks.map(chunk => chunk);

  const blob = new Blob([JSON.stringify(finalData, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// Main function to run on page load
const onPageLoad = function () {
  console.log("DOM fully loaded or already loaded");

  const structuredData = extractPageLayout();
  console.log("Extracted structured layout:", structuredData);

  saveContentToFile(structuredData);

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
