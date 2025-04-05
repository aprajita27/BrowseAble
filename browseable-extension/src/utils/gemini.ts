// gemini.ts

// src/utils/gemini.ts

export function processData(fullData: any) {
    console.log('Processing data in gemini.ts:');
    console.log(fullData);
    
    // Process the data and return in the format content.js expects
    return {
      layoutChanges: [
        // Example layout changes based on your data
        { 
          elementSelector: '.some-element', 
          layout: { display: 'flex', justifyContent: 'center' } 
        }
      ],
      styleChanges: [
        // Example style changes
        { 
          elementSelector: '.some-element', 
          styles: { color: 'blue', fontSize: '16px' } 
        }
      ],
      elementChanges: [
        // Example content changes
        { 
          elementSelector: '.some-element', 
          type: 'paragraph', 
          text: 'Updated text content' 
        }
      ]
    };
  }

// // Listen for messages from the background script
// chrome.runtime.onMessage.addListener((message: any, _: chrome.runtime.MessageSender, sendResponse: (response: any) => void) => {
//     if (message.type === 'processDataWithGemini') {
//       const fullData = message.fullData;  // The full layout data sent by the background script
  
//       // Log the received data to the console
//       console.log('Received full data from background.js:');
//       console.log(fullData);  // Display the full data
  
//       // Optionally, send a response back to background.js (acknowledge reception)
//       sendResponse({ status: 'success', message: 'Data received and logged to console.' });
  
//       // Return true to indicate that the response is sent asynchronously
//       return;
//     }
//   });


// function sendDataToGemini(data: any): Promise<any> {
//     return new Promise((resolve, _) => {
//       // Simulating an async process like calling a server or API
//       setTimeout(() => {
//         const processedData = processGeminiData(data);
//         resolve(processedData); // Resolve with the processed data after "processing"
//       }, 1000); // Simulate async delay (e.g., API call)
//     });
//   }
  
//   function processGeminiData(data: any) {
//     // Simulating data processing
//     return {
//       chunk1: data.chunk1.map((item: any) => ({
//         ...item,
//         content: `Processed: ${item.content}`,
//       })),
//     };
//   }
  
//   // Send data to Gemini and handle the result
//   const sampleData = {
//     chunk1: [
//       {
//         type: 'section',
//         elementSelector: 'body > header > h1',
//         content: 'Original Title',
//       },
//     ],
//   };
  
//   // Send data and wait for response
//   sendDataToGemini(sampleData).then((processedData) => {
//     // Send back the processed data to background.js
//     chrome.runtime.sendMessage({ type: 'gemini_data', payload: processedData }, (response) => {
//       console.log('Processed data sent to background.js', response);
//     });
//   });
  
  