chrome.runtime?.sendMessage({ message: "Hello from content script" }, (response) => {
    console.log("Got response:", response);
  });
  