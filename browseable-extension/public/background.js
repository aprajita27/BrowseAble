// background.js
// background.js
// Import the gemini module directly
// import { processData } from './src/utils/gemini.js';

let fullData = [];
let totalChunksExpected = 0;
let chunksReceived = 0;

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    // Handle the "sendChunk" type message
    if (message.type === 'sendChunk') {
        const chunkData = message.chunk;
        totalChunksExpected = message.totalChunksExpected;

        // Collect chunks in order
        fullData.push(chunkData);
        chunksReceived = chunksReceived + 1;

        console.log(`Received chunk ${chunksReceived} of ${totalChunksExpected}`);

        // Once all chunks are received, process with gemini.ts
        if (chunksReceived === totalChunksExpected) {
            console.log('All chunks received. Processing with gemini.ts.');

            // Combine all the chunks
            const processedData = processData(fullData);

            // Send the processed data back to the content script
            sendResponse({ status: 'success', processedData: processedData });

            // Reset for next chunk set
            fullData = [];
            chunksReceived = 0;
        }

        sendResponse({ status: 'chunk_received', message: `Chunk ${chunksReceived} received.` });
        return true; // Keep the message channel open for async response
    }

    return false;
});

// Function to process the full data (implement your custom logic here)
function processData(chunks) {
    console.log('Processing full data:', chunks);
  
    // Example: Combine all chunks and perform additional processing if needed
    const combinedData = chunks.join('');  // Join the chunks into one string (modify based on your needs)
  
    // For example, return the combined data with some transformation
    return {
      original: combinedData,
      transformed: combinedData.toUpperCase() // Example transformation
    };
  }


// let fullData = [];
// let totalChunksExpected = 0;
// let chunksReceived = 0;

// chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
//     // Handle the "sendChunk" type message
//     if (message.type === 'sendChunk') {
//         const chunkData = message.chunk;
//         totalChunksExpected = message.totalChunksExpected;

//         // Collect chunks in order
//         fullData.push(chunkData);
//         chunksReceived = chunksReceived + 1;

//         console.log(`Received chunk ${chunksReceived} of ${totalChunksExpected}`);

//         // Once all chunks are received, forward the full data to gemini.ts
//         if (chunksReceived === totalChunksExpected) {
//             console.log('All chunks received. Sending to gemini.ts.');

//             // Send the full data to gemini.ts for processing
//             chrome.runtime.sendMessage({
//                 type: 'processDataWithGemini',
//                 fullData: fullData,
//             }, (response) => {
//                 // Print the response received from gemini.ts
//                 console.log('Response from gemini.ts:', response);
//             });

//             // Reset for next chunk set
//             fullData = [];
//             chunksReceived = 0;
//         }

//         sendResponse({ status: 'chunk_received', message: `Chunk ${chunksReceived} received.` });
//         return true; // Keep the message channel open for async response
//     }

//     // Handle the "gemini_data" type message
//     if (message.type === 'gemini_data') {
//         console.log('Received data from gemini.ts:', message.payload);

//         // Ensure data is sent to content.js after it's fully processed
//         chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
//             if (tabs.length > 0) {
//                 chrome.tabs.sendMessage(tabs[0].id, { type: 'gemini_data', payload: message.payload }, (response) => {
//                     console.log('Sending data to content script:', message.payload);
//                     if (chrome.runtime.lastError) {
//                         console.error('Error sending message to content script:', chrome.runtime.lastError);
//                     } else {
//                         console.log('Response from content script:', response);
//                     }
//                 });
//             }
//         });

//         sendResponse({ status: 'data_received' });
//         // Return true to keep the channel open while awaiting async response
//     return true;
//     }
// });
