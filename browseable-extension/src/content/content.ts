console.log("Content script loaded");

// Function to generate a CSS selector for an element
const getSelector = (element: Element): string => {
  const path = [];
  let currentNode: Element | null = element;

  while (currentNode && currentNode !== document.documentElement) {
    let selector = currentNode.tagName.toLowerCase();
    if (currentNode.id) {
      selector += `#${currentNode.id}`;
    } else {
      const siblings = Array.from(currentNode.parentElement?.children || []);
      const index = siblings.indexOf(currentNode) + 1;
      selector += `:nth-child(${index})`;
    }
    path.unshift(selector);
    currentNode = currentNode.parentElement;
  }

  return path.join(' > ');
};

// Function to extract the content of all elements
const extractContent = (): { selector: string, content: string }[] => {
  const elements = document.querySelectorAll('*');
  const contentData: { selector: string, content: string }[] = [];

  elements.forEach((element) => {
    // Filter out elements that have no visible content or are non-meaningful
    if (element instanceof HTMLElement && element.innerText.trim()) {
      const selector = getSelector(element);
      const content = element.innerText.trim();
      contentData.push({ selector, content });
    }
  });

  return contentData;
};

// Function to save content data as a JSON file
const saveContentToFile = (data: { selector: string, content: string }[]) => {
  console.log("Saving content to file...");
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'page-content.json';
  a.click();
  URL.revokeObjectURL(url);
};

// Function to run once the DOM is fully loaded
const onPageLoad = () => {
  const contentData = extractContent();
  saveContentToFile(contentData); 
  // Send content data to background script to save it
  chrome.runtime.sendMessage({ 
    type: 'saveContent',
    data: contentData 
  }, (response) => {
    console.log("Got response:", response);
  });
};

// Attach the event listener for page load
document.addEventListener('DOMContentLoaded', onPageLoad);
